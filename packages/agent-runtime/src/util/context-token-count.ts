import { countTokens, countTokensJson, countTokensMessages } from './token-counter'

import type { Message } from '@codebuff/common/types/messages/codebuff-message'

type CountableAgentState = {
  parentId?: string
  messageHistory: Message[]
  contextTokenCount: number
}

export function recountContextTokens(params: {
  agentState: CountableAgentState
  systemPrompt: string
  toolsForTokenCount: unknown
}): number {
  const { agentState, systemPrompt, toolsForTokenCount } = params
  if (agentState.parentId) return agentState.contextTokenCount
  return (
    countTokensMessages(agentState.messageHistory) +
    countTokens(systemPrompt) +
    countTokensJson(toolsForTokenCount)
  )
}

export function adjustContextTokenCountForHistoryEdit(params: {
  contextTokenCount: number
  previousHistory: Message[]
  nextHistory: Message[]
}): number {
  const { contextTokenCount, previousHistory, nextHistory } = params
  if (previousHistory === nextHistory) return contextTokenCount
  const delta =
    countTokensMessages(nextHistory) - countTokensMessages(previousHistory)
  return Math.max(0, contextTokenCount + delta)
}
