
import { has } from 'lodash'

import { AI_MESSAGE_ID_PREFIX, generateAiMessageId } from './ai-message-id'
import { markRunningAgentsAsCancelled } from './block-operations'
import { shouldHideAgent } from './constants'
import { formatTimestamp } from './helpers'
import {
  appendInterruptionNotice,
  autoCollapseBlocks,
  createAgentBlock,
  stripHiddenAgentBlocks,
} from './message-block-helpers'

import type { AgentMode } from './constants'
import type { ChatMessage, ContentBlock } from '../types/chat'

export const createModeDividerMessage = (
  agentMode: AgentMode,
): ChatMessage => ({
  id: `divider-${Date.now()}`,
  variant: 'ai',
  content: '',
  blocks: [
    {
      type: 'mode-divider',
      mode: agentMode,
    },
  ],
  timestamp: formatTimestamp(),
})

export const createAiMessageShell = (messageId: string): ChatMessage => ({
  id: messageId,
  variant: 'ai',
  content: '',
  blocks: [],
  timestamp: formatTimestamp(),
  metadata: { allowInlineAds: true },
})

export const createErrorMessage = (content: string): ChatMessage => ({
  id: `error-${Date.now()}`,
  variant: 'error',
  content,
  timestamp: formatTimestamp(),
})

export { AI_MESSAGE_ID_PREFIX, generateAiMessageId }

export const sanitizeRestoredMessages = (
  messages: ChatMessage[],
): ChatMessage[] =>
  messages.map((message) => {
    let restoredMessage = message
    if (message.metadata?.allowInlineAds) {
      const { allowInlineAds: _, ...metadata } = message.metadata
      restoredMessage = { ...message, metadata }
    }

    if (restoredMessage.blocks) {
      const blocks = stripHiddenAgentBlocks(restoredMessage.blocks)
      if (blocks !== restoredMessage.blocks) {
        restoredMessage = { ...restoredMessage, blocks }
      }
    }

    if (
      restoredMessage.variant !== 'ai' ||
      !restoredMessage.id.startsWith(AI_MESSAGE_ID_PREFIX) ||
      restoredMessage.isComplete
    ) {
      return restoredMessage
    }
    try {
      return {
        ...restoredMessage,
        isComplete: true,
        blocks: appendInterruptionNotice(
          markRunningAgentsAsCancelled(restoredMessage.blocks ?? []),
        ),
      }
    } catch {
      return { ...restoredMessage, isComplete: true }
    }
  })

export const autoCollapsePreviousMessages = (
  messages: ChatMessage[],
  currentAiMessageId: string,
): ChatMessage[] =>
  messages.map((message) => {
    if (message.id === currentAiMessageId) {
      return message
    }

    if (message.variant === 'agent') {
      const userOpened = message.metadata?.userOpened ?? false
      return userOpened
        ? message
        : {
            ...message,
            metadata: {
              ...message.metadata,
              isCollapsed: true,
            },
          }
    }

    if (!message.blocks) {
      return message
    }

    return {
      ...message,
      blocks: autoCollapseBlocks(message.blocks),
    }
  })

export const createSpawnAgentBlocks = (
  toolCallId: string,
  agents: Array<{ agent_type?: string; prompt?: string }>,
): ContentBlock[] =>
  agents
    .map((agent, index) => ({ agent, index }))
    .filter(({ agent }) => !shouldHideAgent(agent.agent_type || ''))
    .map(({ agent, index }) =>
      createAgentBlock({
        agentId: `${toolCallId}-${index}`,
        agentType: agent.agent_type || '',
        prompt: agent.prompt,
      }),
    )

export const isSpawnAgentsResult = (outputValue: unknown): boolean =>
  Array.isArray(outputValue) &&
  outputValue.some((v: unknown) => {
    if (typeof v !== 'object' || v === null) return false
    return has(v, 'agentName') || has(v, 'agentType')
  })

export const markMessageComplete = (
  message: ChatMessage,
  options?: {
    completionTime?: string
    credits?: number
    runState?: unknown
  },
): ChatMessage => {
  const metadata = {
    ...(message.metadata ?? {}),
    ...(options?.runState ? { runState: options.runState } : {}),
  }
  return {
    ...message,
    isComplete: true,
    ...(options?.completionTime
      ? { completionTime: options.completionTime }
      : {}),
    ...(options?.credits !== undefined ? { credits: options.credits } : {}),
    metadata,
  }
}

export const setMessageError = (
  message: ChatMessage,
  errorContent: string,
): ChatMessage => ({
  ...message,
  content: errorContent,
  blocks: undefined,
  isComplete: true,
})
