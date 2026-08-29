import type { ChatMessage, ContentBlock, TextContentBlock } from '../types/chat'

export type SetMessagesFn = (
  updater: (messages: ChatMessage[]) => ChatMessage[],
) => void

export type MessageUpdater = {
  updateAiMessage: (updater: (msg: ChatMessage) => ChatMessage) => void
  updateAiMessageBlocks: (
    blockUpdater: (blocks: ContentBlock[]) => ContentBlock[],
  ) => void
  markComplete: (metadata?: Partial<ChatMessage>) => void
  setError: (message: string) => void
  clearUserError: () => void
  addBlock: (block: ContentBlock) => void
}

export type BatchedMessageUpdater = MessageUpdater & {
  flush: () => void
  dispose: () => void
}

export const DEFAULT_FLUSH_INTERVAL_MS = 100

export const createMessageUpdater = (
  aiMessageId: string,
  setMessages: SetMessagesFn,
): MessageUpdater => {
  const updateAiMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === aiMessageId ? updater(msg) : msg)),
    )
  }

  const updateAiMessageBlocks = (
    blockUpdater: (blocks: ContentBlock[]) => ContentBlock[],
  ) => {
    updateAiMessage((msg) => ({
      ...msg,
      blocks: blockUpdater(msg.blocks ?? []),
    }))
  }

  const addBlock = (block: ContentBlock) => {
    updateAiMessage((msg) => ({
      ...msg,
      blocks: [...(msg.blocks ?? []), block],
    }))
  }

  const markComplete = (metadata?: Partial<ChatMessage>) => {
    updateAiMessage((msg) => {
      const { metadata: messageMetadata, ...rest } = metadata ?? {}

      const updatedBlocks = msg.blocks?.map((block) => {
        if (
          block.type === 'text' &&
          (block as TextContentBlock).textType === 'reasoning' &&
          (block as TextContentBlock).thinkingOpen !== false
        ) {
          return { ...block, thinkingOpen: false } as ContentBlock
        }
        return block
      })

      const nextMessage: ChatMessage = {
        ...msg,
        isComplete: true,
        ...(updatedBlocks && { blocks: updatedBlocks }),
        ...rest,
      }

      if (messageMetadata) {
        nextMessage.metadata = {
          ...(msg.metadata ?? {}),
          ...messageMetadata,
        }
      }

      return nextMessage
    })
  }

  const setError = (message: string) => {
    updateAiMessage((msg) => ({
      ...msg,
      userError: message,
      isComplete: true,
    }))
  }

  const clearUserError = () => {
    updateAiMessage((msg) => {
      if (!msg.userError) return msg
      const { userError: _, ...rest } = msg
      return rest as ChatMessage
    })
  }

  return {
    updateAiMessage,
    updateAiMessageBlocks,
    markComplete,
    setError,
    clearUserError,
    addBlock,
  }
}

export const createBatchedMessageUpdater = (
  aiMessageId: string,
  setMessages: SetMessagesFn,
  flushIntervalMs: number = DEFAULT_FLUSH_INTERVAL_MS,
): BatchedMessageUpdater => {
  const pendingUpdaters: Array<(msg: ChatMessage) => ChatMessage> = []
  let intervalId: ReturnType<typeof setInterval> | null = null
  let isDisposed = false

  const flush = () => {
    if (pendingUpdaters.length === 0) return

    const updaters = pendingUpdaters.splice(0, pendingUpdaters.length)

    const composedUpdater = (msg: ChatMessage): ChatMessage => {
      return updaters.reduce((m, fn) => fn(m), msg)
    }

    setMessages((prev) =>
      prev.map((msg) => (msg.id === aiMessageId ? composedUpdater(msg) : msg)),
    )
  }

  const dispose = () => {
    if (isDisposed) return
    flush()
    isDisposed = true
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  intervalId = setInterval(flush, flushIntervalMs)

  const updateAiMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
    if (isDisposed) {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMessageId ? updater(msg) : msg)),
      )
      return
    }
    pendingUpdaters.push(updater)
  }

  const updateAiMessageBlocks = (
    blockUpdater: (blocks: ContentBlock[]) => ContentBlock[],
  ) => {
    updateAiMessage((msg) => ({
      ...msg,
      blocks: blockUpdater(msg.blocks ?? []),
    }))
  }

  const addBlock = (block: ContentBlock) => {
    updateAiMessage((msg) => ({
      ...msg,
      blocks: [...(msg.blocks ?? []), block],
    }))
  }

  const markComplete = (metadata?: Partial<ChatMessage>) => {
    flush()
    dispose()

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== aiMessageId) return msg
        const { metadata: messageMetadata, ...rest } = metadata ?? {}

        const updatedBlocks = msg.blocks?.map((block) => {
          if (
            block.type === 'text' &&
            (block as TextContentBlock).textType === 'reasoning' &&
            (block as TextContentBlock).thinkingOpen !== false
          ) {
            return { ...block, thinkingOpen: false } as ContentBlock
          }
          return block
        })

        const nextMessage: ChatMessage = {
          ...msg,
          isComplete: true,
          ...(updatedBlocks && { blocks: updatedBlocks }),
          ...rest,
        }
        if (messageMetadata) {
          nextMessage.metadata = {
            ...(msg.metadata ?? {}),
            ...messageMetadata,
          }
        }
        return nextMessage
      }),
    )
  }

  const setError = (message: string) => {
    flush()
    dispose()

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== aiMessageId) return msg
        return {
          ...msg,
          userError: message,
          isComplete: true,
        }
      }),
    )
  }

  const clearUserError = () => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== aiMessageId || !msg.userError) return msg
        const { userError: _, ...rest } = msg
        return rest as ChatMessage
      }),
    )
  }

  return {
    updateAiMessage,
    updateAiMessageBlocks,
    markComplete,
    setError,
    clearUserError,
    addBlock,
    flush,
    dispose,
  }
}
