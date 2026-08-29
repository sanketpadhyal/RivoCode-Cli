import { AgentTemplateTypes } from '@codebuff/common/types/session-state'

import { loopAgentSteps } from './run-agent-step'
import {
  assembleLocalAgentTemplates,
  getAgentTemplate,
} from './templates/agent-registry'

import type { AgentTemplate } from './templates/types'
import type { ClientAction } from '@codebuff/common/actions'
import type { CostMode } from '@codebuff/common/old-constants'
import type {
  RequestToolCallFn,
  SendActionFn,
} from '@codebuff/common/types/contracts/client'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { ParamsExcluding } from '@codebuff/common/types/function-params'
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'
import type {
  SessionState,
  AgentTemplateType,
  AgentOutput,
} from '@codebuff/common/types/session-state'

export async function mainPrompt(
  params: {
    action: ClientAction<'prompt'>

    onResponseChunk: (chunk: string | PrintModeEvent) => void
    localAgentTemplates: Record<string, AgentTemplate>

    requestToolCall: RequestToolCallFn
    logger: Logger
  } & ParamsExcluding<
    typeof loopAgentSteps,
    | 'userInputId'
    | 'spawnParams'
    | 'agentState'
    | 'prompt'
    | 'content'
    | 'agentType'
    | 'fingerprintId'
    | 'fileContext'
    | 'ancestorRunIds'
  > &
    ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<{
  sessionState: SessionState
  output: AgentOutput
}> {
  const { action, localAgentTemplates, logger } = params

  const {
    prompt,
    content,
    sessionState: sessionState,
    fingerprintId,
    costMode,
    promptId,
    agentId,
    promptParams,
  } = action
  const { fileContext, mainAgentState } = sessionState

  const availableAgents = Object.keys(localAgentTemplates)

  let agentType: AgentTemplateType

  if (agentId) {
    const agentTemplate = await getAgentTemplate({ ...params, agentId })
    if (!agentTemplate) {
      throw new Error(
        `Invalid agent ID: "${agentId}". Available agents: ${availableAgents.join(', ')}`,
      )
    }

    agentType = agentId
  } else {
    agentType = (
      {
        ask: AgentTemplateTypes.ask,
        free: AgentTemplateTypes.base_free,
        lite: AgentTemplateTypes.base_free,
        normal: AgentTemplateTypes.base,
        max: AgentTemplateTypes.base_max,
        experimental: 'base2',
      } satisfies Record<CostMode, AgentTemplateType>
    )[costMode ?? 'normal'] ?? 'base2'
  }

  mainAgentState.agentType = agentType

  let mainAgentTemplate = await getAgentTemplate({
    ...params,
    agentId: agentType,
  })
  if (!mainAgentTemplate) {
    throw new Error(`Agent template not found for type: ${agentType}`)
  }

  const { agentState, output } = await loopAgentSteps({
    ...params,
    userInputId: promptId,
    spawnParams: promptParams,
    agentState: mainAgentState,
    ancestorRunIds: [],
    prompt,
    content,
    agentType,
    fingerprintId,
    fileContext,
    costMode,
  })

  logger.debug(
    {
      outputType: output?.type,
      messageCount:
        output && 'value' in output && Array.isArray(output.value)
          ? output.value.length
          : undefined,
    },
    'Main prompt finished',
  )

  return {
    sessionState: {
      fileContext,
      mainAgentState: agentState,
    },
    output: output ?? {
      type: 'error' as const,
      message: 'No output from agent',
    },
  }
}

export async function callMainPrompt(
  params: {
    action: ClientAction<'prompt'>
    promptId: string
    sendAction: SendActionFn
    logger: Logger
    signal: AbortSignal
  } & ParamsExcluding<
    typeof mainPrompt,
    'localAgentTemplates' | 'onResponseChunk'
  >,
) {
  const { action, promptId, sendAction, logger } = params
  const { fileContext } = action.sessionState

  action.sessionState.mainAgentState.creditsUsed = 0
  action.sessionState.mainAgentState.directCreditsUsed = 0

  if (action.toolResults && action.toolResults.length > 0) {
    action.sessionState.mainAgentState.messageHistory.push(
      ...action.toolResults,
    )
  }

  const { agentTemplates: localAgentTemplates, validationErrors } =
    assembleLocalAgentTemplates({ fileContext, logger })

  if (validationErrors.length > 0) {
    sendAction({
      action: {
        type: 'prompt-error',
        message: `Invalid agent config: ${validationErrors.map((err) => err.message).join('\n')}`,
        userInputId: promptId,
      },
    })
  }

  sendAction({
    action: {
      type: 'response-chunk',
      userInputId: promptId,
      chunk: {
        type: 'start',
        agentId: action.sessionState.mainAgentState.agentType ?? undefined,
        messageHistoryLength:
          action.sessionState.mainAgentState.messageHistory.length,
      },
    },
  })

  const result = await mainPrompt({
    ...params,
    localAgentTemplates,
    onResponseChunk: (chunk) => {
      if (!params.signal.aborted) {
        sendAction({
          action: {
            type: 'response-chunk',
            userInputId: promptId,
            chunk,
          },
        })
      }
    },
  })

  const { sessionState, output } = result

  sendAction({
    action: {
      type: 'response-chunk',
      userInputId: promptId,
      chunk: {
        type: 'finish',
        agentId: sessionState.mainAgentState.agentType ?? undefined,
        totalCost: sessionState.mainAgentState.creditsUsed,
      },
    },
  })

  sendAction({
    action: {
      type: 'prompt-response',
      promptId,
      sessionState,
      toolCalls: [],
      toolResults: [],
      output,
    },
  })

  return result
}
