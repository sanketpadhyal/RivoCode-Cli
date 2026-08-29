import { HandleStepsYieldValueSchema } from '@rivocode/common/types/agent-template'
import { getErrorObject } from '@rivocode/common/util/error'
import { assistantMessage } from '@rivocode/common/util/messages'
import { cloneDeep } from 'lodash'

import { clearProposedContentForRun } from './tools/handlers/tool/proposed-content-store'
import { executeToolCall } from './tools/tool-executor'
import { parseTextWithToolCalls } from './util/parse-tool-calls-from-text'

import type { FileProcessingState } from './tools/handlers/tool/write-file'
import type { ExecuteToolCallParams } from './tools/tool-executor'
import type { ParsedSegment } from './util/parse-tool-calls-from-text'
import type { CodebuffToolCall } from '@rivocode/common/tools/list'
import type {
  AgentTemplate,
  StepGenerator,
  PublicAgentState,
} from '@rivocode/common/types/agent-template'
import type {
  HandleStepsLogChunkFn,
  SendActionFn,
} from '@rivocode/common/types/contracts/client'
import type { AddAgentStepFn } from '@rivocode/common/types/contracts/database'
import type { Logger } from '@rivocode/common/types/contracts/logger'
import type { ParamsExcluding } from '@rivocode/common/types/function-params'
import type { ToolMessage } from '@rivocode/common/types/messages/codebuff-message'
import type {
  ToolCallPart,
  ToolResultOutput,
} from '@rivocode/common/types/messages/content-part'
import type { PrintModeEvent } from '@rivocode/common/types/print-mode'
import type { AgentState } from '@rivocode/common/types/session-state'
const runIdToGenerator: Record<string, StepGenerator | undefined> = {}
export const runIdToStepAll: Set<string> = new Set()
type HandleStepsFn = Exclude<AgentTemplate['handleSteps'], string | undefined>

function deserializeHandleSteps(source: string): HandleStepsFn {
  const globalEval = eval as unknown as (code: string) => unknown
  return globalEval(`(${source})`) as HandleStepsFn
}

export function clearAgentGeneratorCache(params: { logger: Logger }) {
  for (const key in runIdToGenerator) {
    clearProposedContentForRun(key)
    delete runIdToGenerator[key]
  }
  runIdToStepAll.clear()
}

export function clearProgrammaticRunState(runId: string): void {
  delete runIdToGenerator[runId]
  runIdToStepAll.delete(runId)
  clearProposedContentForRun(runId)
}

export async function runProgrammaticStep(
  params: {
    addAgentStep: AddAgentStepFn
    agentState: AgentState
    clientSessionId: string
    fingerprintId: string
    handleStepsLogChunk: HandleStepsLogChunkFn
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    nResponses?: string[]
    onResponseChunk: (chunk: string | PrintModeEvent) => void
    prompt: string | undefined
    repoId: string | undefined
    repoUrl: string | undefined
    stepNumber: number
    stepsComplete: boolean
    template: AgentTemplate
    toolCallParams: Record<string, any> | undefined
    sendAction: SendActionFn
    system: string | undefined
    userId: string | undefined
    userInputId: string
  } & Omit<
    ExecuteToolCallParams,
    | 'toolName'
    | 'input'
    | 'autoInsertEndStepParam'
    | 'currentAssistantMessages'
    | 'excludeToolFromMessageHistory'
    | 'agentContext'
    | 'agentStepId'
    | 'agentTemplate'
    | 'fullResponse'
    | 'previousToolCallFinished'
    | 'fileProcessingState'
    | 'toolCallId'
    | 'toolCalls'
    | 'toolCallsToAddToMessageHistory'
    | 'toolResults'
    | 'toolResultsToAddToMessageHistory'
  > &
    ParamsExcluding<
      AddAgentStepFn,
      | 'agentRunId'
      | 'stepNumber'
      | 'credits'
      | 'childRunIds'
      | 'status'
      | 'startTime'
      | 'messageId'
    >,
): Promise<{
  agentState: AgentState
  endTurn: boolean
  stepNumber: number
  generateN?: number
}> {
  const {
    agentState,
    template,
    clientSessionId: _clientSessionId,
    prompt,
    toolCallParams,
    nResponses,
    system: _system,
    userId: _userId,
    userInputId,
    repoId: _repoId,
    fingerprintId: _fingerprintId,
    onResponseChunk,
    localAgentTemplates: _localAgentTemplates,
    stepsComplete,
    handleStepsLogChunk,
    sendAction,
    addAgentStep,
    logger,
  } = params
  let { stepNumber } = params

  if (!template.handleSteps) {
    throw new Error('No step handler found for agent template ' + template.id)
  }

  if (!agentState.runId) {
    throw new Error('Agent state has no run ID')
  }

  let generator = runIdToGenerator[agentState.runId]

  if (!generator) {
    const createLogMethod =
      (level: 'debug' | 'info' | 'warn' | 'error') =>
      (data: any, msg?: string) => {
        logger[level](data, msg)
        handleStepsLogChunk({
          userInputId,
          runId: agentState.runId ?? 'undefined',
          level,
          data,
          message: msg,
        })
      }

    const streamingLogger = {
      debug: createLogMethod('debug'),
      info: createLogMethod('info'),
      warn: createLogMethod('warn'),
      error: createLogMethod('error'),
    }

    const generatorFn =
      template.handleStepsFn ??
      (typeof template.handleSteps === 'string'
        ? deserializeHandleSteps(template.handleSteps)
        : template.handleSteps)

    generator = generatorFn({
      agentState,
      prompt,
      params: toolCallParams,
      model: template.model,
      logger: streamingLogger,
    })
    runIdToGenerator[agentState.runId] = generator
  }

  if (runIdToStepAll.has(agentState.runId)) {
    if (stepsComplete) {
      runIdToStepAll.delete(agentState.runId)
    } else {
      return { agentState, endTurn: false, stepNumber }
    }
  }

  const agentStepId = crypto.randomUUID()

  const toolCalls: CodebuffToolCall[] = []
  const toolResults: ToolMessage[] = []
  const fileProcessingState: FileProcessingState = {
    promisesByPath: {},
    allPromises: [],
    fileChangeErrors: [],
    fileChanges: [],
    firstFileProcessed: false,
  }
  const agentContext = cloneDeep(agentState.agentContext)
  const _sendSubagentChunk = (data: {
    userInputId: string
    agentId: string
    agentType: string
    chunk: string
    prompt?: string
    forwardToPrompt?: boolean
  }) => {
    sendAction({
      action: {
        type: 'subagent-response-chunk',
        ...data,
      },
    })
  }

  let toolResult: ToolResultOutput[] | undefined = undefined
  let endTurn = false
  let generateN: number | undefined = undefined

  let startTime = new Date()
  let creditsBefore = agentState.directCreditsUsed
  let childrenBefore = agentState.childRunIds.length

  try {
    do {
      startTime = new Date()
      creditsBefore = agentState.directCreditsUsed
      childrenBefore = agentState.childRunIds.length

      const result = generator!.next({
        agentState: getPublicAgentState(
          agentState as AgentState & Required<Pick<AgentState, 'runId'>>,
        ),
        toolResult: toolResult ?? [],
        stepsComplete,
        nResponses,
      })

      if (result.done) {
        endTurn = true
        break
      }

      const parseResult = HandleStepsYieldValueSchema.safeParse(result.value)
      if (!parseResult.success) {
        throw new Error(
          `Invalid yield value from handleSteps in agent ${template.id}: ${parseResult.error.message}. ` +
            `Received: ${JSON.stringify(result.value)}`,
        )
      }

      if (result.value === 'STEP') {
        break
      }
      if (result.value === 'STEP_ALL') {
        runIdToStepAll.add(agentState.runId)
        break
      }

      if ('type' in result.value && result.value.type === 'STEP_TEXT') {
        const segments = parseTextWithToolCalls(result.value.text)

        if (segments.length > 0) {
          toolResult = await executeSegmentsArray(segments, {
            ...params,
            agentContext,
            agentStepId,
            agentTemplate: template,
            agentState,
            fileProcessingState,
            fullResponse: '',
            previousToolCallFinished: Promise.resolve(),
            toolCalls,
            toolResults,
            onResponseChunk,
          })
        }
        continue
      }

      if ('type' in result.value && result.value.type === 'GENERATE_N') {
        logger.info({ resultValue: result.value }, 'GENERATE_N yielded')
        generateN = result.value.n
        endTurn = false
        break
      }

      const toolCall = result.value as ToolCallToExecute

      toolResult = await executeSingleToolCall(toolCall, {
        ...params,
        agentContext,
        agentStepId,
        agentTemplate: template,
        agentState,
        fileProcessingState,
        fullResponse: '',
        previousToolCallFinished: Promise.resolve(),
        toolCalls,
        toolResults,
        onResponseChunk,
      })

      if (agentState.runId) {
        await addAgentStep({
          ...params,
          agentRunId: agentState.runId,
          stepNumber,
          credits: agentState.directCreditsUsed - creditsBefore,
          childRunIds: agentState.childRunIds.slice(childrenBefore),
          status: 'completed',
          startTime,
          messageId: null,
        })
      } else {
        logger.error('No runId found for agent state after finishing agent run')
      }
      stepNumber++

      if (toolCall.toolName === 'end_turn') {
        endTurn = true
        break
      }
    } while (true)

    return {
      agentState,
      endTurn,
      stepNumber,
      generateN,
    }
  } catch (error) {
    endTurn = true

    const minifiedSourceHint =
      error instanceof ReferenceError &&
      !template.handleStepsFn &&
      typeof template.handleSteps === 'string'
        ? ' (handleSteps was deserialized from a string that references an out-of-scope identifier — likely a minified bundle serialized the function; ship the live function or unminified source)'
        : ''
    const errorMessage = `Error executing handleSteps for agent ${template.id}: ${
      error instanceof Error ? error.message : 'Unknown error'
    }${minifiedSourceHint}`
    logger.error(
      { error: getErrorObject(error), template: template.id },
      errorMessage,
    )

    onResponseChunk(errorMessage)

    agentState.messageHistory.push(assistantMessage(errorMessage))
    agentState.output = {
      ...agentState.output,
      error: errorMessage,
    }

    if (agentState.runId) {
      await addAgentStep({
        ...params,
        agentRunId: agentState.runId,
        stepNumber,
        credits: agentState.directCreditsUsed - creditsBefore,
        childRunIds: agentState.childRunIds.slice(childrenBefore),
        status: 'skipped',
        startTime,
        errorMessage,
        messageId: null,
        logger,
      })
    } else {
      logger.error('No runId found for agent state after failed agent run')
    }
    stepNumber++

    return {
      agentState,
      endTurn,
      stepNumber,
      generateN: undefined,
    }
  } finally {
    if (endTurn) {
      clearProgrammaticRunState(agentState.runId)
    }
  }
}

export const getPublicAgentState = (
  agentState: AgentState & Required<Pick<AgentState, 'runId'>>,
): PublicAgentState => {
  const {
    agentId,
    runId,
    parentId,
    messageHistory,
    output,
    systemPrompt,
    toolDefinitions,
    contextTokenCount,
  } = agentState
  return {
    agentId,
    runId,
    parentId,
    messageHistory: messageHistory as any as PublicAgentState['messageHistory'],
    output,
    systemPrompt,
    toolDefinitions,
    contextTokenCount,
  }
}

type ToolCallToExecute = {
  toolName: string
  input: Record<string, unknown>
  includeToolCall?: boolean
}

type ExecuteToolCallsArrayParams = Omit<
  ExecuteToolCallParams,
  | 'toolName'
  | 'input'
  | 'autoInsertEndStepParam'
  | 'currentAssistantMessages'
  | 'excludeToolFromMessageHistory'
  | 'toolCallId'
  | 'toolCallsToAddToMessageHistory'
  | 'toolResultsToAddToMessageHistory'
> & {
  agentState: AgentState
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}

async function executeSingleToolCall(
  toolCallToExecute: ToolCallToExecute,
  params: ExecuteToolCallsArrayParams,
): Promise<ToolResultOutput[] | undefined> {
  const { agentState, onResponseChunk, toolResults } = params

  const toolCallId = crypto.randomUUID()
  const excludeToolFromMessageHistory =
    toolCallToExecute.includeToolCall === false

  if (!excludeToolFromMessageHistory) {
    const toolCallPart: ToolCallPart = {
      type: 'tool-call',
      toolCallId,
      toolName: toolCallToExecute.toolName,
      input: toolCallToExecute.input,
    }
    agentState.messageHistory = [...agentState.messageHistory]
    agentState.messageHistory.push(assistantMessage(toolCallPart))
  }

  const toolResultsToAddToMessageHistory: ToolMessage[] = []
  await executeToolCall({
    ...params,
    toolName: toolCallToExecute.toolName as any,
    input: toolCallToExecute.input,
    autoInsertEndStepParam: true,
    excludeToolFromMessageHistory,
    fromHandleSteps: true,
    toolCallId,
    toolCalls: [],
    toolCallsToAddToMessageHistory: [],
    toolResultsToAddToMessageHistory,

    onResponseChunk: (chunk: string | PrintModeEvent) => {
      if (typeof chunk === 'string') {
        onResponseChunk(chunk)
        return
      }

      if (agentState.parentId) {
        const parentAgentId = agentState.agentId

        switch (chunk.type) {
          case 'subagent_start':
          case 'subagent_finish':
            if (!chunk.parentAgentId) {
              onResponseChunk({
                ...chunk,
                parentAgentId,
              })
              return
            }
            break
          case 'tool_call':
          case 'tool_result': {
            if (!chunk.parentAgentId) {
              onResponseChunk({
                ...chunk,
                parentAgentId,
              })
              return
            }
            break
          }
          default:
            break
        }
      }

      onResponseChunk(chunk)
    },
  })

  agentState.messageHistory = [...agentState.messageHistory]
  agentState.messageHistory.push(...toolResultsToAddToMessageHistory)

  return toolResults[toolResults.length - 1]?.content
}

async function executeSegmentsArray(
  segments: ParsedSegment[],
  params: ExecuteToolCallsArrayParams,
): Promise<ToolResultOutput[] | undefined> {
  const { agentState, onResponseChunk } = params

  let toolResults: ToolResultOutput[] = []

  for (const segment of segments) {
    if (segment.type === 'text') {
      agentState.messageHistory = [...agentState.messageHistory]
      agentState.messageHistory.push(assistantMessage(segment.text))

      onResponseChunk(segment.text)
    } else {
      const toolResult = await executeSingleToolCall(segment, params)
      if (toolResult) {
        toolResults.push(...toolResult)
      }
    }
  }

  return toolResults
}
