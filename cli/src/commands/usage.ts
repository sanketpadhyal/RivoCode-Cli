import { useChatStore } from '../state/chat-store'
import { getAuthToken } from '../utils/auth'
import { getSystemMessage } from '../utils/message-history'

import type { PostUserMessageFn } from '../types/contracts/send-message'

export async function handleUsageCommand(): Promise<{
  postUserMessage: PostUserMessageFn
}> {
  const authToken = getAuthToken()

  if (!authToken) {
    const postUserMessage: PostUserMessageFn = (prev) => [
      ...prev,
      getSystemMessage('Please log in first to view your usage.'),
    ]
    return { postUserMessage }
  }

  useChatStore.getState().setInputMode('usage')

  const postUserMessage: PostUserMessageFn = (prev) => prev
  return { postUserMessage }
}
