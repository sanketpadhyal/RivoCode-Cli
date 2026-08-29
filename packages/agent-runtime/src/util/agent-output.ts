import type { AgentTemplate } from '@rivocode/common/types/agent-template'
import type { Message } from '@rivocode/common/types/messages/codebuff-message'
import type {
  AgentState,
  AgentOutput,
} from '@rivocode/common/types/session-state'

const EXCLUDED_OUTPUT_TAGS = ['TOOL_CALL_ERROR'] as const

function isExcludedFromOutput(message: Message): boolean {
  return !!message.tags?.some((t) =>
    (EXCLUDED_OUTPUT_TAGS as readonly string[]).includes(t),
  )
}

function getLastAssistantTurnMessages(messageHistory: Message[]): Message[] {
  let lastAssistantIndex = -1
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    if (messageHistory[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  for (let i = lastAssistantIndex; i >= 0; i--) {
    if (messageHistory[i].role === 'assistant') {
      lastAssistantIndex = i
    } else break
  }

  if (lastAssistantIndex === -1) {
    return []
  }

  const result: Message[] = []
  for (let i = lastAssistantIndex; i < messageHistory.length; i++) {
    const message = messageHistory[i]
    if (message.role === 'assistant' || message.role === 'tool') {
      result.push(message)
    } else {
      break
    }
  }

  return result.filter((m) => !isExcludedFromOutput(m))
}

export function getAgentOutput(
  agentState: AgentState,
  agentTemplate: AgentTemplate,
): AgentOutput {
  if (agentTemplate.outputMode === 'structured_output') {
    return {
      type: 'structuredOutput',
      value: agentState.output ?? null,
    }
  }
  if (agentTemplate.outputMode === 'last_message') {
    const lastTurnMessages = getLastAssistantTurnMessages(
      agentState.messageHistory,
    )
    if (lastTurnMessages.length === 0) {
      return {
        type: 'error',
        message: 'No response from agent',
      }
    }
    return {
      type: 'lastMessage',
      value: lastTurnMessages,
    }
  }
  if (agentTemplate.outputMode === 'all_messages') {
    const agentMessages = agentState.messageHistory
      .slice(1)
      .filter((m) => !isExcludedFromOutput(m))
    return {
      type: 'allMessages',
      value: agentMessages,
    }
  }
  agentTemplate.outputMode satisfies never
  throw new Error(
    `Unknown output mode: ${'outputMode' in agentTemplate ? agentTemplate.outputMode : 'undefined'}`,
  )
}
