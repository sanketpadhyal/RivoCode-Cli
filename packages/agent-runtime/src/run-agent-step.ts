import { contextPrunerBudgetForModel } from '@codebuff/common/constants/model-config'
import {
  supportsAssistantPrefill,
  supportsCacheControl,
} from '@codebuff/common/old-constants'
import { TOOLS_WHICH_WONT_FORCE_NEXT_STEP } from '@codebuff/common/tools/constants'
import { buildArray } from '@codebuff/common/util/array'
import {
  AbortError,
  FETCH_IDLE_TIMEOUT_USER_MESSAGE,
  TRANSIENT_NETWORK_ERROR_USER_MESSAGE,
  extractApiErrorDetails,
  getErrorObject,
  isAbortError,
  isFetchIdleTimeoutError,
  isTransientNetworkError,
} from '@codebuff/common/util/error'
import { serializeCacheDebugCorrelation } from '@codebuff/common/util/cache-debug'
import {
  dropUnansweredToolCalls,
  systemMessage,
  userMessage,
} from '@codebuff/common/util/messages'
import { type ToolSet } from 'ai'
import { cloneDeep, mapValues } from 'lodash'
import z from 'zod/v4'

import { maybeCompactHistory } from './compact-history'
import { CACHE_DEBUG_FULL_LOGGING } from './constants'
import { getMCPToolData } from './mcp'
import { getAgentStreamFromTemplate } from './prompt-agent-stream'
import { isThinkOnlyResponse } from './util/think-tags'
import {
  clearProgrammaticRunState,
  runProgrammaticStep,
} from './run-programmatic-step'
import { additionalSystemPrompts } from './system-prompt/prompts'
import { getAgentTemplate } from './templates/agent-registry'
import { buildAgentToolSet } from './templates/prompts'
import { getAgentPrompt } from './templates/strings'
import { getToolSet } from './tools/prompts'
import { processStream } from './tools/stream-parser'
import { getAgentOutput } from './util/agent-output'
import {
  createCacheDebugSnapshot,
  enrichCacheDebugSnapshotWithProviderRequest,
  enrichCacheDebugSnapshotWithUsage,
} from './util/cache-debug'
import {
  withSystemInstructionTags,
  withSystemTags as withSystemTags,
  buildUserMessageContent,
  expireMessages,
} from './util/messages'
import { recountContextTokens } from './util/context-token-count'
import {
  countTokens,
  countTokensJson,
  countTokensMessages,
} from './util/token-counter'

import type { AgentTemplate } from '@codebuff/common/types/agent-template'
import type { TrackEventFn } from '@codebuff/common/types/contracts/analytics'
import type {
  AddAgentStepFn,
  FinishAgentRunFn,
  StartAgentRunFn,
} from '@codebuff/common/types/contracts/database'
import type {
  AgentUsageData,
  CacheDebugUsageData,
  ContextCompactionData,
  ModelUsageData,
  PromptAiSdkFn,
} from '@codebuff/common/types/contracts/llm'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { TraceWriter } from '@codebuff/common/types/contracts/trace'
import type { ParamsExcluding } from '@codebuff/common/types/function-params'
import type {
  Message,
  ToolMessage,
} from '@codebuff/common/types/messages/codebuff-message'
import type {
  TextPart,
  ImagePart,
} from '@codebuff/common/types/messages/content-part'
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'
import type {
  AgentTemplateType,
  AgentState,
  AgentOutput,
} from '@codebuff/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@codebuff/common/util/file'

export function toTokenCountInputSchema(
  inputSchema: unknown,
): Record<string, unknown> | undefined {
  if (inputSchema == null) return undefined

  let jsonSchema: Record<string, unknown>
  if (
    typeof (inputSchema as { safeParse?: unknown }).safeParse === 'function'
  ) {
    try {
      jsonSchema = z.toJSONSchema(inputSchema as z.ZodType, {
        io: 'input',
      }) as Record<string, unknown>
    } catch {
      jsonSchema = { type: 'object', properties: {} }
    }
  } else if (typeof inputSchema === 'object' && !Array.isArray(inputSchema)) {
    jsonSchema = { ...(inputSchema as Record<string, unknown>) }
  } else {
    return undefined
  }

  delete jsonSchema['$schema']
  if (jsonSchema.type == null || jsonSchema.type === '') {
    jsonSchema.type = 'object'
  }
  return jsonSchema
}

async function additionalToolDefinitions(
  params: {
    agentTemplate: AgentTemplate
    fileContext: ProjectFileContext
  } & ParamsExcluding<
    typeof getMCPToolData,
    'toolNames' | 'mcpServers' | 'writeTo'
  >,
): Promise<CustomToolDefinitions> {
  const { agentTemplate, fileContext } = params

  const defs = cloneDeep(
    Object.fromEntries(
      Object.entries(fileContext.customToolDefinitions).filter(([toolName]) =>
        agentTemplate!.toolNames.includes(toolName),
      ),
    ),
  )
  return getMCPToolData({
    ...params,
    toolNames: agentTemplate!.toolNames,
    mcpServers: agentTemplate!.mcpServers,
    writeTo: defs,
  })
}

export const UNTRACKED_RUN_ID_PREFIX = 'untracked-'

export const runAgentStep = async (
  params: {
    userId: string | undefined
    userInputId: string
    clientSessionId: string
    costMode?: string
    fingerprintId: string
    repoId: string | undefined
    onResponseChunk: (chunk: string | PrintModeEvent) => void

    agentType: AgentTemplateType
    agentTemplate: AgentTemplate
    fileContext: ProjectFileContext
    agentState: AgentState
    localAgentTemplates: Record<string, AgentTemplate>

    prompt: string | undefined
    spawnParams: Record<string, any> | undefined
    system: string
    n?: number

    trackEvent: TrackEventFn
    promptAiSdk: PromptAiSdkFn
    traceWriter?: TraceWriter
    onAgentUsageReceived?: (usage: AgentUsageData) => void
    onAgentUsageIncomplete?: () => void
    onCompaction?: (data: ContextCompactionData) => void
  } & ParamsExcluding<
    typeof processStream,
    | 'agentContext'
    | 'agentState'
    | 'agentStepId'
    | 'agentTemplate'
    | 'fullResponse'
    | 'messages'
    | 'onCostCalculated'
    | 'repoId'
    | 'stream'
  > &
    ParamsExcluding<
      typeof getAgentStreamFromTemplate,
      | 'agentId'
      | 'includeCacheControl'
      | 'messages'
      | 'onCostCalculated'
      | 'template'
    > &
    ParamsExcluding<typeof getAgentTemplate, 'agentId'> &
    ParamsExcluding<
      typeof getAgentPrompt,
      'agentTemplate' | 'promptType' | 'agentState' | 'agentTemplates'
    > &
    ParamsExcluding<
      typeof getMCPToolData,
      'toolNames' | 'mcpServers' | 'writeTo'
    > &
    ParamsExcluding<
      PromptAiSdkFn,
      'messages' | 'model' | 'onCostCalculated' | 'n'
    >,
): Promise<{
  agentState: AgentState
  fullResponse: string
  shouldEndTurn: boolean
  messageId: string | null
  nResponses?: string[]
}> => {
  const {
    agentType,
    fileContext,
    agentTemplate,
    localAgentTemplates,
    logger,
    prompt,
    repoId,
    spawnParams,
    system,
    userId,
    userInputId,
    onResponseChunk,
    promptAiSdk,
    additionalToolDefinitions,
  } = params
  let agentState = params.agentState

  const { agentContext } = agentState

  const startTime = Date.now()

  const agentStepId = crypto.randomUUID()

  if (agentState.stepsRemaining <= 0) {
    logger.warn(
      `Detected too many consecutive assistant messages without user prompt`,
    )

    onResponseChunk(`${STEP_WARNING_MESSAGE}\n\n`)

    agentState = {
      ...agentState,
      messageHistory: [
        ...expireMessages(agentState.messageHistory, 'userPrompt'),
        userMessage(
          withSystemTags(
            `The assistant has responded too many times in a row. The assistant's turn has automatically been ended. The maximum number of responses can be configured via maxAgentSteps.`,
          ),
        ),
      ],
    }
    return {
      agentState,
      fullResponse: STEP_WARNING_MESSAGE,
      shouldEndTurn: true,
      messageId: null,
    }
  }

  const stepPrompt = await getAgentPrompt({
    ...params,
    agentTemplate,
    promptType: { type: 'stepPrompt' },
    fileContext,
    agentState,
    agentTemplates: localAgentTemplates,
    logger,
    additionalToolDefinitions,
  })

  const history = dropUnansweredToolCalls(
    expireMessages(agentState.messageHistory, 'agentStep'),
  )

  const agentMessagesUntruncated = buildArray<Message>(
    ...history,

    stepPrompt &&
      userMessage({
        content: stepPrompt,
        tags: ['STEP_PROMPT'],

        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      }),
  )

  agentState.messageHistory = agentMessagesUntruncated

  const { model } = agentTemplate

  const lastMessage =
    agentState.messageHistory[agentState.messageHistory.length - 1]
  if (lastMessage?.role === 'assistant' && !supportsAssistantPrefill(model)) {
    agentState.messageHistory = [
      ...agentState.messageHistory,
      userMessage({
        content: withSystemTags('Continue from where you left off.'),
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      }),
    ]
  }

  let stepCreditsUsed = 0

  const onCostCalculated = async (credits: number) => {
    stepCreditsUsed += credits
    agentState.creditsUsed += credits
    agentState.directCreditsUsed += credits
  }

  const iterationNum = agentState.messageHistory.length
  const systemTokens = countTokens(system)

  let cacheDebugCorrelation:
    | ReturnType<typeof createCacheDebugSnapshot>
    | undefined
  if (CACHE_DEBUG_FULL_LOGGING) {
    try {
      cacheDebugCorrelation = createCacheDebugSnapshot({
        agentType: String(agentType),
        system,
        toolDefinitions: params.tools
          ? Object.fromEntries(
              Object.entries(params.tools).map(([name, tool]) => [
                name,
                {
                  description: tool.description,
                  inputSchema: tool.inputSchema as {},
                },
              ]),
            )
          : {},
        messages: [systemMessage(system), ...agentState.messageHistory],
        logger,
        projectRoot: fileContext.projectRoot,
        runId: agentState.runId,
        userInputId,
        agentStepId,
        model,
      })
    } catch (err) {
      logger.warn({ error: err }, '[Cache Debug] Failed to create snapshot')
    }
  }

  const onCacheDebugProviderRequestBuilt = cacheDebugCorrelation
    ? ({
        provider,
        rawBody,
        normalizedBody,
      }: {
        provider: string
        rawBody: unknown
        normalizedBody?: unknown
      }) => {
        enrichCacheDebugSnapshotWithProviderRequest({
          correlation: cacheDebugCorrelation,
          provider,
          rawBody,
          normalized: normalizedBody ?? rawBody,
          logger,
        })
      }
    : undefined

  const onCacheDebugUsageReceived = cacheDebugCorrelation
    ? (usage: CacheDebugUsageData) => {
        enrichCacheDebugSnapshotWithUsage({
          correlation: cacheDebugCorrelation,
          usage,
          logger,
        })
      }
    : undefined

  params.traceWriter?.recordStep({
    agentId: agentState.agentId,
    agentType: String(agentType),
    runId: agentState.runId,
    userInputId,
    step: iterationNum,
    system,
    messages: agentState.messageHistory,
  })

  logger.debug(
    {
      iteration: iterationNum,
      runId: agentState.runId,
      model,
      duration: Date.now() - startTime,
      contextTokenCount: agentState.contextTokenCount,
      messageCount: agentState.messageHistory.length,
      prompt,
      params: spawnParams,
      systemTokens,
      agentTemplateId: agentTemplate.id,
      toolNames: params.tools ? Object.keys(params.tools) : undefined,
    },
    `Start agent ${agentType} step ${iterationNum} (${userInputId}${prompt ? ` - Prompt: ${prompt.slice(0, 20)}` : ''})`,
  )

  if (params.n !== undefined) {
    const result = await promptAiSdk({
      ...params,
      messages: agentState.messageHistory,
      model,
      n: params.n,
      onCostCalculated,
      cacheDebugCorrelation: cacheDebugCorrelation
        ? serializeCacheDebugCorrelation(cacheDebugCorrelation)
        : undefined,
      onCacheDebugProviderRequestBuilt,
      onCacheDebugUsageReceived,
    })

    if (result.aborted) {
      return {
        agentState,
        fullResponse: '',
        shouldEndTurn: true,
        messageId: null,
        nResponses: undefined,
      }
    }

    const responsesString = result.value
    let nResponses: string[]
    try {
      nResponses = JSON.parse(responsesString) as string[]
      if (!Array.isArray(nResponses)) {
        if (params.n > 1) {
          throw new Error(
            `Expected JSON array response from LLM when n > 1, got non-array: ${responsesString.slice(0, 50)}`,
          )
        }
        nResponses = [responsesString]
      }
    } catch (e) {
      if (params.n > 1) {
        throw e
      }
      nResponses = [responsesString]
    }

    return {
      agentState,
      fullResponse: responsesString,
      shouldEndTurn: false,
      messageId: null,
      nResponses,
    }
  }

  let fullResponse = ''
  const toolResults: ToolMessage[] = []

  const stream = getAgentStreamFromTemplate({
    ...params,
    agentId: agentState.parentId ? agentState.agentId : undefined,
    costMode: params.costMode,
    cacheDebugCorrelation: cacheDebugCorrelation
      ? serializeCacheDebugCorrelation(cacheDebugCorrelation)
      : undefined,
    includeCacheControl: supportsCacheControl(agentTemplate.model),
    messages: [systemMessage(system), ...agentState.messageHistory],
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,
    onUsageReceived: params.onAgentUsageReceived
      ? (usage: ModelUsageData) =>
          params.onAgentUsageReceived?.({
            ...usage,
            isRoot: !agentState.parentId,
            agentId: agentState.agentId,
          })
      : undefined,
    onUsageIncomplete: params.onAgentUsageIncomplete,
    template: agentTemplate,
    onCostCalculated,
  })

  const {
    fullResponse: fullResponseAfterStream,
    hadToolCallError,
    messageId,
    toolCalls,
    toolResults: newToolResults,
  } = await processStream({
    ...params,
    agentContext,
    agentState,
    agentStepId,
    agentTemplate,
    fullResponse,
    messages: agentState.messageHistory,
    repoId,
    stream,
    onCostCalculated,
  })

  toolResults.push(...newToolResults)

  fullResponse = fullResponseAfterStream

  agentState.messageHistory = expireMessages(
    agentState.messageHistory,
    'agentStep',
  )

  const wasCompacted =
    prompt &&
    (prompt.toLowerCase() === '/compact' || prompt.toLowerCase() === 'compact')
  if (wasCompacted) {
    agentState.messageHistory = [
      userMessage(
        withSystemTags(
          `The following is a summary of the conversation between you and the user. The conversation continues after this summary:\n\n${fullResponse}`,
        ),
      ),
    ]
    logger.debug({ summary: fullResponse }, 'Compacted messages')
  }

  const hasNoToolResults =
    toolCalls.filter(
      (call) => !TOOLS_WHICH_WONT_FORCE_NEXT_STEP.includes(call.toolName),
    ).length === 0 &&
    toolResults.filter(
      (result) => !TOOLS_WHICH_WONT_FORCE_NEXT_STEP.includes(result.toolName),
    ).length === 0 &&
    !hadToolCallError

  const hasTaskCompleted = toolCalls.some(
    (call) =>
      call.toolName === 'task_completed' || call.toolName === 'end_turn',
  )

  const isThinkOnly = hasNoToolResults && isThinkOnlyResponse(fullResponse)

  const requiresExplicitCompletion =
    agentTemplate.toolNames.includes('task_completed')

  let shouldEndTurn: boolean
  if (requiresExplicitCompletion) {
    shouldEndTurn = !hadToolCallError && hasTaskCompleted
  } else {
    shouldEndTurn =
      !hadToolCallError &&
      (hasTaskCompleted || (hasNoToolResults && !isThinkOnly))
  }

  agentState = {
    ...agentState,
    stepsRemaining: agentState.stepsRemaining - 1,
    agentContext,
  }

  params.traceWriter?.recordStep({
    agentId: agentState.agentId,
    agentType: String(agentType),
    runId: agentState.runId,
    userInputId,
    step: iterationNum,
    system,
    messages: agentState.messageHistory,
  })

  logger.debug(
    {
      iteration: iterationNum,
      agentId: agentState.agentId,
      model,
      prompt,
      shouldEndTurn,
      duration: Date.now() - startTime,
      fullResponse,
      messageCount: agentState.messageHistory.length,
      toolCalls,
      toolResults,
      stepCreditsUsed,
    },
    `End agent ${agentType} step ${iterationNum} (${userInputId}${prompt ? ` - Prompt: ${prompt.slice(0, 20)}` : ''})`,
  )

  return {
    agentState,
    fullResponse,
    shouldEndTurn,
    messageId,
    nResponses: undefined,
  }
}

export async function loopAgentSteps(
  params: {
    addAgentStep: AddAgentStepFn
    agentState: AgentState
    agentType: string
    clearUserPromptMessagesAfterResponse?: boolean
    clientSessionId: string
    content?: Array<TextPart | ImagePart>
    costMode?: string
    fileContext: ProjectFileContext
    finishAgentRun: FinishAgentRunFn
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    parentSystemPrompt?: string
    parentTools?: ToolSet
    prompt: string | undefined
    signal: AbortSignal
    drainSteeringMessages?: () => string[]
    spawnParams: Record<string, any> | undefined
    startAgentRun: StartAgentRunFn
    userId: string | undefined
    userInputId: string
    agentTemplate?: AgentTemplate
  } & ParamsExcluding<typeof additionalToolDefinitions, 'agentTemplate'> &
    ParamsExcluding<
      typeof runProgrammaticStep,
      | 'agentState'
      | 'onCostCalculated'
      | 'prompt'
      | 'runId'
      | 'stepNumber'
      | 'stepsComplete'
      | 'system'
      | 'template'
      | 'toolCallParams'
      | 'tools'
    > &
    ParamsExcluding<typeof getAgentTemplate, 'agentId'> &
    ParamsExcluding<
      typeof getAgentPrompt,
      | 'agentTemplate'
      | 'promptType'
      | 'agentTemplates'
      | 'additionalToolDefinitions'
    > &
    ParamsExcluding<
      typeof getMCPToolData,
      'toolNames' | 'mcpServers' | 'writeTo'
    > &
    ParamsExcluding<StartAgentRunFn, 'agentId' | 'ancestorRunIds'> &
    ParamsExcluding<
      FinishAgentRunFn,
      'runId' | 'status' | 'totalSteps' | 'directCredits' | 'totalCredits'
    > &
    ParamsExcluding<
      typeof runAgentStep,
      | 'additionalToolDefinitions'
      | 'agentState'
      | 'agentTemplate'
      | 'prompt'
      | 'runId'
      | 'spawnParams'
      | 'system'
      | 'tools'
    > &
    ParamsExcluding<
      AddAgentStepFn,
      | 'agentRunId'
      | 'stepNumber'
      | 'credits'
      | 'childRunIds'
      | 'messageId'
      | 'status'
      | 'startTime'
    >,
): Promise<{
  agentState: AgentState
  output: AgentOutput
}> {
  let agentTemplate = params.agentTemplate
  if (!agentTemplate) {
    agentTemplate =
      (await getAgentTemplate({
        ...params,
        agentId: params.agentType,
      })) ?? undefined
  }
  if (!agentTemplate) {
    throw new Error(`Agent template not found for type: ${params.agentType}`)
  }

  if (agentTemplate.id.includes('context-pruner')) {
    params = {
      ...params,
      startAgentRun: async () =>
        `${UNTRACKED_RUN_ID_PREFIX}${crypto.randomUUID()}`,
      addAgentStep: async () => null,
      finishAgentRun: async () => {},
    }
  }

  const {
    addAgentStep,
    agentState: initialAgentState,
    agentType,
    clearUserPromptMessagesAfterResponse = true,
    clientSessionId,
    content,
    fileContext,
    finishAgentRun,
    localAgentTemplates,
    logger,
    parentSystemPrompt,
    parentTools,
    prompt,
    signal,
    spawnParams,
    startAgentRun,
    userId,
    userInputId,
    clientEnv,
    ciEnv,
  } = params

  if (signal.aborted) {
    return {
      agentState: initialAgentState,
      output: {
        type: 'error',
        message: 'Run cancelled by user',
      },
    }
  }

  const runId = await startAgentRun({
    ...params,
    agentId: agentTemplate.id,
    ancestorRunIds: initialAgentState.ancestorRunIds,
  })
  if (!runId) {
    throw new Error('Failed to start agent run')
  }
  initialAgentState.runId = runId

  let cachedAdditionalToolDefinitions: CustomToolDefinitions | undefined
  const useParentTools =
    agentTemplate.inheritParentSystemPrompt && parentTools !== undefined

  const instructionsPrompt = await getAgentPrompt({
    ...params,
    agentTemplate,
    promptType: { type: 'instructionsPrompt' },
    agentTemplates: localAgentTemplates,
    useParentTools,
    additionalToolDefinitions: async () => {
      if (!cachedAdditionalToolDefinitions) {
        cachedAdditionalToolDefinitions = await additionalToolDefinitions({
          ...params,
          agentTemplate,
        })
      }
      return cachedAdditionalToolDefinitions
    },
  })

  let system: string
  if (agentTemplate.inheritParentSystemPrompt && parentSystemPrompt) {
    system = parentSystemPrompt
  } else {
    const systemPrompt = await getAgentPrompt({
      ...params,
      agentTemplate,
      promptType: { type: 'systemPrompt' },
      agentTemplates: localAgentTemplates,
      additionalToolDefinitions: async () => {
        if (!cachedAdditionalToolDefinitions) {
          cachedAdditionalToolDefinitions = await additionalToolDefinitions({
            ...params,
            agentTemplate,
          })
        }
        return cachedAdditionalToolDefinitions
      },
    })
    system = systemPrompt ?? ''
  }

  const agentTools = useParentTools
    ? {}
    : await buildAgentToolSet({
        ...params,
        spawnableAgents: agentTemplate.spawnableAgents,
        agentTemplates: localAgentTemplates,
      })

  const tools = useParentTools
    ? parentTools
    : await getToolSet({
        toolNames: agentTemplate.toolNames,
        windowedFileReads: agentTemplate.windowedFileReads === true,
        additionalToolDefinitions: async () => {
          if (!cachedAdditionalToolDefinitions) {
            cachedAdditionalToolDefinitions = await additionalToolDefinitions({
              ...params,
              agentTemplate,
            })
          }
          return cachedAdditionalToolDefinitions
        },
        agentTools,
        skills: fileContext.skills ?? {},
      })

  const hasUserMessage = Boolean(
    prompt ||
    (spawnParams && Object.keys(spawnParams).length > 0) ||
    (content && content.length > 0),
  )

  const initialMessages = buildArray<Message>(
    ...initialAgentState.messageHistory,

    hasUserMessage && [
      {
        role: 'user' as const,
        content: buildUserMessageContent(prompt, spawnParams, content),
        tags: ['USER_PROMPT'],
        sentAt: Date.now(),

        keepDuringTruncation: true,
      },
      prompt &&
        prompt in additionalSystemPrompts &&
        userMessage(
          withSystemInstructionTags(
            additionalSystemPrompts[
              prompt as keyof typeof additionalSystemPrompts
            ],
          ),
        ),
      ,
    ],

    instructionsPrompt &&
      userMessage({
        content: instructionsPrompt,
        tags: ['INSTRUCTIONS_PROMPT'],

        keepLastTags: ['INSTRUCTIONS_PROMPT'],
      }),
  )

  const toolDefinitions = mapValues(tools, (tool) => ({
    description:
      typeof tool.description === 'string' ? tool.description : undefined,
    inputSchema: tool.inputSchema as {},
  }))

  const additionalToolDefinitionsWithCache = async () => {
    if (!cachedAdditionalToolDefinitions) {
      cachedAdditionalToolDefinitions = await additionalToolDefinitions({
        ...params,
        agentTemplate,
      })
    }
    return cachedAdditionalToolDefinitions
  }

  initialAgentState.messageHistory = initialMessages
  initialAgentState.systemPrompt = system
  initialAgentState.toolDefinitions = toolDefinitions
  let currentAgentState: AgentState = initialAgentState

  const toolsForTokenCount = Object.entries(toolDefinitions).map(
    ([name, def]) => {
      const input_schema = toTokenCountInputSchema(def.inputSchema)
      return {
        name,
        ...(def.description && { description: def.description }),
        ...(input_schema && { input_schema }),
      }
    },
  )

  const recountContextTokensForTurnEnd = () => {
    currentAgentState.contextTokenCount = recountContextTokens({
      agentState: {
        parentId: initialAgentState.parentId,
        messageHistory: currentAgentState.messageHistory,
        contextTokenCount: currentAgentState.contextTokenCount,
      },
      systemPrompt: system,
      toolsForTokenCount,
    })
  }

  let shouldEndTurn = false
  let hasRetriedOutputSchema = false
  let currentPrompt = prompt
  let currentParams = spawnParams
  let totalSteps = 0
  let llmStepNumber = 0
  let nResponses: string[] | undefined = undefined

  try {
    while (true) {
      totalSteps++
      if (signal.aborted) {
        throw new AbortError()
      }

      const startTime = new Date()

      const stepPrompt = await getAgentPrompt({
        ...params,
        agentTemplate,
        promptType: { type: 'stepPrompt' },
        fileContext,
        agentState: currentAgentState,
        agentTemplates: localAgentTemplates,
        logger,
        additionalToolDefinitions: additionalToolDefinitionsWithCache,
      })
      const messagesWithStepPrompt = buildArray(
        ...currentAgentState.messageHistory,
        stepPrompt &&
          userMessage({
            content: stepPrompt,
          }),
      )

      const estimateContextTokensLocally = () =>
        countTokensMessages(messagesWithStepPrompt) +
        countTokens(system) +
        countTokensJson(toolsForTokenCount)

      currentAgentState.contextTokenCount = estimateContextTokensLocally()

      if (agentTemplate.compactContext) {
        const compacted = maybeCompactHistory({
          ...(typeof agentTemplate.compactContext === 'object'
            ? agentTemplate.compactContext
            : {}),
          messages: currentAgentState.messageHistory,
          contextTokenCount: currentAgentState.contextTokenCount,
          maxContextLength: contextPrunerBudgetForModel(agentTemplate.model),
          logger,
          runId,
          onCompaction: (trigger) => {
            if (initialAgentState.parentId) return
            params.onCompaction?.({
              trigger,
              thresholdTokens: contextPrunerBudgetForModel(agentTemplate.model),
            })
          },
        })
        if (compacted) {
          currentAgentState.messageHistory = compacted
          currentAgentState.contextTokenCount =
            countTokensMessages(compacted) +
            countTokens(system) +
            countTokensJson(toolsForTokenCount)
        }
      }

      let n: number | undefined = undefined

      if (agentTemplate.handleSteps) {
        const programmaticResult = await runProgrammaticStep({
          ...params,

          agentState: currentAgentState,
          localAgentTemplates,
          nResponses,
          onCostCalculated: async (credits: number) => {
            currentAgentState.creditsUsed += credits
            currentAgentState.directCreditsUsed += credits
          },
          prompt: currentPrompt,
          runId,
          stepNumber: totalSteps,
          stepsComplete: shouldEndTurn,
          system,
          tools,
          template: agentTemplate,
          toolCallParams: currentParams,
        })
        const {
          agentState: programmaticAgentState,
          endTurn,
          stepNumber,
          generateN,
        } = programmaticResult
        n = generateN

        Object.assign(initialAgentState, programmaticAgentState)
        currentAgentState = initialAgentState
        totalSteps = stepNumber

        shouldEndTurn = endTurn
      }

      if (
        agentTemplate.outputSchema &&
        currentAgentState.output === undefined &&
        shouldEndTurn &&
        !hasRetriedOutputSchema
      ) {
        hasRetriedOutputSchema = true
        logger.warn(
          {
            agentType,
            agentId: currentAgentState.agentId,
            runId,
          },
          'Agent finished without setting required output, restarting loop',
        )

        const outputSchemaMessage = withSystemTags(
          `You must use the "set_output" tool to provide a result that matches the output schema before ending your turn. The output schema is required for this agent.`,
        )

        currentAgentState.messageHistory = [
          ...currentAgentState.messageHistory,
          userMessage({
            content: outputSchemaMessage,
            keepDuringTruncation: true,
          }),
        ]

        shouldEndTurn = false
      }

      if (shouldEndTurn) {
        break
      }

      const creditsBefore = currentAgentState.directCreditsUsed
      const childrenBefore = currentAgentState.childRunIds.length
      llmStepNumber++
      const {
        agentState: newAgentState,
        shouldEndTurn: llmShouldEndTurn,
        messageId,
        nResponses: generatedResponses,
      } = await runAgentStep({
        ...params,

        agentState: currentAgentState,
        agentTemplate,
        extraCodebuffMetadata: {
          ...(params.extraCodebuffMetadata ?? {}),
          llm_step_number: String(llmStepNumber),
        },
        n,
        prompt: currentPrompt,
        runId,
        spawnParams: currentParams,
        system,
        tools,
        additionalToolDefinitions: additionalToolDefinitionsWithCache,
      })

      if (newAgentState.runId) {
        await addAgentStep({
          ...params,
          agentRunId: newAgentState.runId,
          stepNumber: totalSteps,
          credits: newAgentState.directCreditsUsed - creditsBefore,
          childRunIds: newAgentState.childRunIds.slice(childrenBefore),
          messageId,
          status: 'completed',
          startTime,
        })
      } else {
        logger.error('No runId found for agent state after finishing agent run')
      }

      Object.assign(initialAgentState, newAgentState)
      currentAgentState = initialAgentState
      shouldEndTurn = llmShouldEndTurn
      nResponses = generatedResponses

      currentPrompt = undefined
      currentParams = undefined

      const steered = params.drainSteeringMessages?.()
      if (steered?.length) {
        currentAgentState.messageHistory = [
          ...currentAgentState.messageHistory,
          ...steered.map((text) =>
            userMessage({
              content: buildUserMessageContent(text, undefined, undefined),
              tags: ['USER_PROMPT'],
              keepDuringTruncation: true,
            }),
          ),
        ]
        shouldEndTurn = false
      }
    }

    if (clearUserPromptMessagesAfterResponse) {
      currentAgentState.messageHistory = expireMessages(
        currentAgentState.messageHistory,
        'userPrompt',
      )
    }

    recountContextTokensForTurnEnd()

    await finishAgentRun({
      ...params,
      runId,
      status: 'completed',
      totalSteps,
      directCredits: currentAgentState.directCreditsUsed,
      totalCredits: currentAgentState.creditsUsed,
    })

    return {
      agentState: currentAgentState,
      output: getAgentOutput(currentAgentState, agentTemplate),
    }
  } catch (error) {
    if (isAbortError(error)) {
      if (clearUserPromptMessagesAfterResponse) {
        currentAgentState.messageHistory = expireMessages(
          currentAgentState.messageHistory,
          'userPrompt',
        )
      }

      currentAgentState.messageHistory = [
        ...currentAgentState.messageHistory,
        userMessage(
          withSystemTags(
            "User interrupted the response. The assistant's previous work has been preserved.",
          ),
        ),
      ]

      logger.info(
        {
          agentType,
          agentId: currentAgentState.agentId,
          runId,
          totalSteps,
          messageHistory: currentAgentState.messageHistory,
        },
        'Agent run cancelled by user (abort error)',
      )

      recountContextTokensForTurnEnd()

      await finishAgentRun({
        ...params,
        runId,
        status: 'cancelled',
        totalSteps,
        directCredits: currentAgentState.directCreditsUsed,
        totalCredits: currentAgentState.creditsUsed,
      })

      return {
        agentState: currentAgentState,
        output: {
          type: 'error',
          message: 'Run cancelled by user',
        },
      }
    }

    logger.error(
      {
        error: getErrorObject(error),
        agentType,
        agentId: currentAgentState.agentId,
        runId,
        totalSteps,
        directCreditsUsed: currentAgentState.directCreditsUsed,
        creditsUsed: currentAgentState.creditsUsed,
        messageHistory: currentAgentState.messageHistory,
        systemPrompt: system,
      },
      'Agent execution failed',
    )

    const apiErrorDetails = extractApiErrorDetails(error)
    const isIdleTimeout = isFetchIdleTimeoutError(error)
    const isNetworkError = !isIdleTimeout && isTransientNetworkError(error)
    const hasServerMessage = apiErrorDetails.message !== undefined
    let fallbackMessage: string
    if (isIdleTimeout) {
      fallbackMessage = FETCH_IDLE_TIMEOUT_USER_MESSAGE
    } else if (isNetworkError) {
      fallbackMessage = TRANSIENT_NETWORK_ERROR_USER_MESSAGE
    } else if (error instanceof Error) {
      const includeStack =
        apiErrorDetails.statusCode === undefined && error.stack
      fallbackMessage =
        error.message + (includeStack ? `\n\n${error.stack}` : '')
    } else {
      fallbackMessage = String(error)
    }
    const errorMessage = apiErrorDetails.message ?? fallbackMessage
    const statusCode = apiErrorDetails.statusCode

    const status = signal.aborted ? 'cancelled' : 'failed'
    recountContextTokensForTurnEnd()
    await finishAgentRun({
      ...params,
      runId,
      status,
      totalSteps,
      directCredits: currentAgentState.directCreditsUsed,
      totalCredits: currentAgentState.creditsUsed,
      errorMessage,
    })

    if (statusCode === 402) {
      throw error
    }

    return {
      agentState: currentAgentState,
      output: {
        type: 'error',
        message:
          hasServerMessage || isIdleTimeout || isNetworkError
            ? errorMessage
            : 'Agent run error: ' + errorMessage,
        ...(statusCode !== undefined && { statusCode }),
        ...(apiErrorDetails.errorCode !== undefined && {
          error: apiErrorDetails.errorCode,
        }),
        ...(apiErrorDetails.countryCode !== undefined && {
          countryCode: apiErrorDetails.countryCode,
        }),
        ...(apiErrorDetails.countryBlockReason !== undefined && {
          countryBlockReason: apiErrorDetails.countryBlockReason,
        }),
        ...(apiErrorDetails.ipPrivacySignals !== undefined && {
          ipPrivacySignals: apiErrorDetails.ipPrivacySignals,
        }),
      },
    }
  } finally {
    clearProgrammaticRunState(runId)
  }
}

const STEP_WARNING_MESSAGE = [
  "I've made quite a few responses in a row.",
  "Let me pause here to make sure we're still on the right track.",
  "Please let me know if you'd like me to continue or if you'd like to guide me in a different direction.",
].join(' ')
