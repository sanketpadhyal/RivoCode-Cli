import { MAX_AGENT_STEPS_DEFAULT } from '@codebuff/common/constants/agents'
import { toolNames } from '@codebuff/common/tools/constants'
import {
  normalizeAgentIdForLookup,
  parseAgentId,
} from '@codebuff/common/util/agent-id-parsing'
import { dropUnansweredToolCalls } from '@codebuff/common/util/messages'
import { generateCompactId } from '@codebuff/common/util/string'

import {
  UNTRACKED_RUN_ID_PREFIX,
  loopAgentSteps,
} from '../../../run-agent-step'
import { getAgentTemplate } from '../../../templates/agent-registry'
import { formatValueForError } from '../../../util/format-value'

import type { AgentTemplate } from '@codebuff/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@codebuff/common/types/contracts/agent-runtime'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type {
  ParamsExcluding,
  OptionalFields,
} from '@codebuff/common/types/function-params'
import type { Message } from '@codebuff/common/types/messages/codebuff-message'
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'
import type {
  AgentState,
  AgentTemplateType,
  Subgoal,
} from '@codebuff/common/types/session-state'
import type { ProjectFileContext } from '@codebuff/common/util/file'
import type { ToolSet } from 'ai'

export type SubagentContextParams = AgentRuntimeDeps &
  AgentRuntimeScopedDeps & {
    clientSessionId: string
    costMode?: string
    extraCodebuffMetadata?: Record<string, string>
    fileContext: ProjectFileContext
    localAgentTemplates: Record<string, AgentTemplate>
    repoId: string | undefined
    repoUrl: string | undefined
    signal: AbortSignal
    userId: string | undefined
  }

export function extractSubagentContextParams(
  params: SubagentContextParams,
): SubagentContextParams {
  return {
    clientEnv: params.clientEnv,
    ciEnv: params.ciEnv,
    getUserInfoFromApiKey: params.getUserInfoFromApiKey,
    fetchAgentFromDatabase: params.fetchAgentFromDatabase,
    startAgentRun: params.startAgentRun,
    finishAgentRun: params.finishAgentRun,
    addAgentStep: params.addAgentStep,
    consumeCreditsWithFallback: params.consumeCreditsWithFallback,
    promptAiSdkStream: params.promptAiSdkStream,
    promptAiSdk: params.promptAiSdk,
    promptAiSdkStructured: params.promptAiSdkStructured,
    databaseAgentCache: params.databaseAgentCache,
    trackEvent: params.trackEvent,
    logger: params.logger,
    fetch: params.fetch,

    handleStepsLogChunk: params.handleStepsLogChunk,
    requestToolCall: params.requestToolCall,
    requestMcpToolData: params.requestMcpToolData,
    requestFiles: params.requestFiles,
    requestOptionalFile: params.requestOptionalFile,
    sendAction: params.sendAction,
    sendSubagentChunk: params.sendSubagentChunk,
    apiKey: params.apiKey,

    clientSessionId: params.clientSessionId,
    costMode: params.costMode,
    extraCodebuffMetadata: params.extraCodebuffMetadata,
    fileContext: params.fileContext,
    localAgentTemplates: params.localAgentTemplates,
    repoId: params.repoId,
    repoUrl: params.repoUrl,
    signal: params.signal,
    userId: params.userId,
  }
}

export function getMatchingSpawn(
  spawnableAgents: AgentTemplateType[],
  childFullAgentId: string,
) {
  const {
    publisherId: childPublisherId,
    agentId: childAgentId,
    version: childVersion,
  } = parseAgentId(normalizeAgentIdForLookup(childFullAgentId))

  if (!childAgentId) {
    return null
  }

  for (const spawnableAgent of spawnableAgents) {
    const {
      publisherId: spawnablePublisherId,
      agentId: spawnableAgentId,
      version: spawnableVersion,
    } = parseAgentId(normalizeAgentIdForLookup(spawnableAgent))

    if (!spawnableAgentId) {
      continue
    }

    if (
      spawnableAgentId === childAgentId &&
      spawnablePublisherId === childPublisherId &&
      spawnableVersion === childVersion
    ) {
      return spawnableAgent
    }
    if (!childVersion && childPublisherId) {
      if (
        spawnablePublisherId === childPublisherId &&
        spawnableAgentId === childAgentId
      ) {
        return spawnableAgent
      }
    }
    if (!childPublisherId && childVersion) {
      if (
        spawnableAgentId === childAgentId &&
        spawnableVersion === childVersion
      ) {
        return spawnableAgent
      }
    }

    if (!childVersion && !childPublisherId) {
      if (spawnableAgentId === childAgentId) {
        return spawnableAgent
      }
    }
  }
  return null
}

export async function validateAndGetAgentTemplate(
  params: {
    agentTypeStr: string
    parentAgentTemplate: AgentTemplate
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
  } & ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<{ agentTemplate: AgentTemplate; agentType: string }> {
  const { agentTypeStr, parentAgentTemplate } = params
  const BASE_AGENTS = ['base', 'base-free', 'base-max', 'base-experimental']
  const isBaseAgent = BASE_AGENTS.includes(parentAgentTemplate.id)
  const agentType = isBaseAgent
    ? normalizeAgentIdForLookup(agentTypeStr)
    : getMatchingSpawn(parentAgentTemplate.spawnableAgents, agentTypeStr)

  if (!agentType) {
    if (toolNames.includes(agentTypeStr as any)) {
      throw new Error(
        `"${agentTypeStr}" is a tool, not an agent. Call it directly as a tool instead of wrapping it in spawn_agents.`,
      )
    }
    throw new Error(
      `Agent type ${parentAgentTemplate.id} is not allowed to spawn child agent type ${agentTypeStr}.`,
    )
  }

  const agentTemplate = await getAgentTemplate({
    ...params,
    agentId: agentType,
  })

  if (!agentTemplate) {
    if (toolNames.includes(agentTypeStr as any)) {
      throw new Error(
        `"${agentTypeStr}" is a tool, not an agent. Call it directly as a tool instead of wrapping it in spawn_agents.`,
      )
    }
    throw new Error(`Agent type ${agentTypeStr} not found.`)
  }

  return { agentTemplate, agentType }
}

export function validateAgentInput(
  agentTemplate: AgentTemplate,
  agentType: string,
  prompt?: string,
  params?: any,
): void {
  const { inputSchema } = agentTemplate

  if (inputSchema.prompt) {
    const result = inputSchema.prompt.safeParse(prompt ?? '')
    if (!result.success) {
      throw new Error(
        `Invalid prompt for agent ${agentType}: ${JSON.stringify(result.error.issues, null, 2)}\n\nOriginal prompt value:\n${formatValueForError(prompt ?? '')}`,
      )
    }
  }

  if (inputSchema.params) {
    const result = inputSchema.params.safeParse(params ?? {})
    if (!result.success) {
      throw new Error(
        `Invalid params for agent ${agentType}: ${JSON.stringify(result.error.issues, null, 2)}\n\nOriginal params value:\n${formatValueForError(params ?? {})}`,
      )
    }
  }
}

export function createAgentState(
  agentType: string,
  agentTemplate: AgentTemplate,
  parentAgentState: AgentState,
  agentContext: Record<string, Subgoal>,
  spawnBoundary: {
    toolCallId: string
    currentAssistantMessages?: readonly Message[]
  },
): AgentState {
  const agentId = generateCompactId()

  let messageHistory: Message[] = []

  if (agentTemplate.includeMessageHistory) {
    const historyBeforeSpawn: Message[] = []
    const historyAtSpawn = [
      ...parentAgentState.messageHistory,
      ...(spawnBoundary.currentAssistantMessages ?? []),
    ]
    for (const message of historyAtSpawn) {
      if (message.role !== 'assistant' || !Array.isArray(message.content)) {
        historyBeforeSpawn.push(message)
        continue
      }

      const spawnPartIndex = message.content.findIndex(
        (part) =>
          part.type === 'tool-call' &&
          part.toolCallId === spawnBoundary.toolCallId,
      )
      if (spawnPartIndex === -1) {
        historyBeforeSpawn.push(message)
        continue
      }

      const contentBeforeSpawn = message.content.slice(0, spawnPartIndex)
      if (contentBeforeSpawn.length > 0) {
        historyBeforeSpawn.push({ ...message, content: contentBeforeSpawn })
      }
      break
    }

    messageHistory = dropUnansweredToolCalls(
      historyBeforeSpawn.filter(
        (message) => !message.tags?.includes('SUBAGENT_SPAWN'),
      ),
    )
  }

  return {
    agentId,
    agentType,
    agentContext,
    ancestorRunIds: [
      ...parentAgentState.ancestorRunIds,
      parentAgentState.runId ?? 'NULL',
    ],
    subagents: [],
    childRunIds: [],
    messageHistory,
    stepsRemaining: MAX_AGENT_STEPS_DEFAULT,
    creditsUsed: 0,
    directCreditsUsed: 0,
    output: undefined,
    parentId: parentAgentState.agentId,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: parentAgentState.contextTokenCount,
  }
}

export function logAgentSpawn(params: {
  agentTemplate: AgentTemplate
  agentType: string
  agentId: string
  parentId: string | undefined
  prompt?: string
  spawnParams?: any
  inline?: boolean
  logger: Logger
}): void {
  const {
    agentTemplate,
    agentType,
    agentId,
    parentId,
    prompt,
    spawnParams,
    inline = false,
    logger,
  } = params
  logger.debug(
    {
      agentTemplate,
      prompt,
      params: spawnParams,
      agentId,
      parentId,
    },
    `Spawning agent${inline ? ' inline' : ''} — ${agentType} (${agentId})`,
  )
}

export async function executeSubagent(
  options: OptionalFields<
    {
      agentTemplate: AgentTemplate
      parentAgentState: AgentState
      parentTools?: ToolSet
      onResponseChunk: (chunk: string | PrintModeEvent) => void
      isOnlyChild?: boolean
      ancestorRunIds: string[]
    } & ParamsExcluding<typeof loopAgentSteps, 'agentType' | 'ancestorRunIds'>,
    'isOnlyChild' | 'clearUserPromptMessagesAfterResponse'
  >,
) {
  const withDefaults = {
    isOnlyChild: false,
    clearUserPromptMessagesAfterResponse: true,
    ...options,
  }
  const {
    onResponseChunk,
    agentTemplate,
    parentAgentState,
    isOnlyChild,
    ancestorRunIds,
    prompt,
    spawnParams,
  } = withDefaults

  const startEvent = {
    type: 'subagent_start' as const,
    agentId: withDefaults.agentState.agentId,
    agentType: agentTemplate.id,
    displayName: agentTemplate.displayName,
    onlyChild: isOnlyChild,
    parentAgentId: parentAgentState.agentId,
    prompt,
    params: spawnParams,
  }
  onResponseChunk(startEvent)

  const result = await loopAgentSteps({
    ...withDefaults,
    content: undefined,
    ancestorRunIds: [...ancestorRunIds, parentAgentState.runId ?? ''],
    agentType: agentTemplate.id,
  })

  onResponseChunk({
    type: 'subagent_finish',
    agentId: result.agentState.agentId,
    agentType: agentTemplate.id,
    displayName: agentTemplate.displayName,
    onlyChild: isOnlyChild,
    parentAgentId: parentAgentState.agentId,
    prompt,
    params: spawnParams,
  })

  if (
    result.agentState.runId &&
    !result.agentState.runId.startsWith(UNTRACKED_RUN_ID_PREFIX)
  ) {
    parentAgentState.childRunIds.push(result.agentState.runId)
  }

  return result
}
