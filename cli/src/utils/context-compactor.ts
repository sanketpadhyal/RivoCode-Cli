import type { ChatMessage, TextContentBlock } from '../types/chat'

export interface TokenStats {
  usedTokens: number
  maxTokens: number
  percent: number
  formattedTokens: string
  formattedMax: string
}

export function estimateMessageTokens(messages: ChatMessage[]): number {
  if (!messages || messages.length === 0) return 0
  let totalChars = 0
  for (const msg of messages) {
    if (msg.content) totalChars += msg.content.length
    if (msg.blocks) {
      for (const b of msg.blocks) {
        if (b.type === 'text') {
          totalChars += (b as TextContentBlock).content?.length || 0
        }
      }
    }
  }
  // Rough rule of thumb: ~4 characters per token
  return Math.ceil(totalChars / 4)
}

export function getTokenStats(messages: ChatMessage[], modelId?: string | null): TokenStats {
  const isGemini = !modelId || modelId === 'gemini' || modelId.includes('gemini')
  const maxTokens = isGemini ? 1000000 : 128000
  const usedTokens = estimateMessageTokens(messages)
  const percent = Math.min(100, Math.max(1, Math.round((usedTokens / maxTokens) * 100)))

  const formattedTokens =
    usedTokens >= 1000000
      ? `${(usedTokens / 1000000).toFixed(1)}M`
      : usedTokens >= 1000
      ? `${(usedTokens / 1000).toFixed(1)}k`
      : `${usedTokens}`

  const formattedMax =
    maxTokens >= 1000000
      ? `${(maxTokens / 1000000).toFixed(0)}M`
      : `${(maxTokens / 1000).toFixed(0)}k`

  return {
    usedTokens,
    maxTokens,
    percent,
    formattedTokens,
    formattedMax,
  }
}

export function compactChatHistory(messages: ChatMessage[], thresholdCount = 16): ChatMessage[] {
  if (!messages || messages.length <= thresholdCount) {
    return messages
  }

  // Preserve initial context and latest 8 messages, compact the middle turns
  const keepStart = 2
  const keepEnd = 8
  if (messages.length <= keepStart + keepEnd) return messages

  const middleMessages = messages.slice(keepStart, messages.length - keepEnd)
  const summaryText = `[Context compacted: ${middleMessages.length} prior conversation turns summarized to maintain optimal response speed]`

  const compactedSummaryMessage: ChatMessage = {
    id: 'compacted_context_' + Date.now(),
    variant: 'ai',
    content: summaryText,
    timestamp: new Date().toISOString(),
    blocks: [
      {
        type: 'text',
        textType: 'text',
        content: summaryText,
      },
    ],
  }

  return [
    ...messages.slice(0, keepStart),
    compactedSummaryMessage,
    ...messages.slice(messages.length - keepEnd),
  ]
}
