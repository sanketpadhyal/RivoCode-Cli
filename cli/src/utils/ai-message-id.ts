
export const AI_MESSAGE_ID_PREFIX = 'ai-'

export const generateAiMessageId = (): string =>
  `${AI_MESSAGE_ID_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}`
