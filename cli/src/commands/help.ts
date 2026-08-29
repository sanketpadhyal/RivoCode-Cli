import { useChatStore } from '../state/chat-store'

import type { PostUserMessageFn } from '../types/contracts/send-message'

export async function handleHelpCommand(): Promise<{
  postUserMessage: PostUserMessageFn
}> {
  useChatStore.getState().setInputMode('help')

  const postUserMessage: PostUserMessageFn = (prev) => prev
  return { postUserMessage }
}
