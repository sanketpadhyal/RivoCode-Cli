
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { setAllBlocksCollapsedState, hasAnyExpandedBlocks } from '../utils/collapse-helpers'
import { buildMessageTree } from '../utils/message-tree-utils'

import type { ChatMessage, ContentBlock } from '../types/chat'

const MESSAGE_BATCH_SIZE = 15

export interface UseChatMessagesOptions {
  messages: ChatMessage[]
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
}

export interface UseChatMessagesReturn {
  messageTree: Map<string, ChatMessage[]>
  topLevelMessages: ChatMessage[]
  visibleTopLevelMessages: ChatMessage[]
  hiddenMessageCount: number
  handleCollapseToggle: (id: string) => void
  isUserCollapsing: () => boolean
  handleLoadPreviousMessages: () => void
  handleToggleAll: () => void
}

export function useChatMessages({
  messages,
  setMessages,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const [visibleMessageCount, setVisibleMessageCount] =
    useState(MESSAGE_BATCH_SIZE)

  useEffect(() => {
    if (messages.length <= MESSAGE_BATCH_SIZE) {
      setVisibleMessageCount(MESSAGE_BATCH_SIZE)
    }
  }, [messages.length])

  const isUserCollapsingRef = useRef<boolean>(false)

  const isUserCollapsing = useCallback(() => {
    return isUserCollapsingRef.current
  }, [])

  const handleCollapseToggle = useCallback(
    (id: string) => {
      isUserCollapsingRef.current = true

      setMessages((prevMessages) => {
        return prevMessages.map((message) => {
          if (message.variant === 'agent' && message.id === id) {
            const wasCollapsed = message.metadata?.isCollapsed ?? false
            return {
              ...message,
              metadata: {
                ...message.metadata,
                isCollapsed: !wasCollapsed,
                userOpened: wasCollapsed,
              },
            }
          }

          if (!message.blocks) return message

          const updateBlocksRecursively = (
            blocks: ContentBlock[],
          ): ContentBlock[] => {
            let foundTarget = false
            const result = blocks.map((block) => {
              if (block.type === 'text' && block.thinkingId === id) {
                foundTarget = true
                const isExpanded = block.thinkingCollapseState === 'expanded'
                return {
                  ...block,
                  thinkingCollapseState: isExpanded ? 'preview' as const : 'expanded' as const,
                  userOpened: !isExpanded,
                }
              }

              if (block.type === 'agent' && block.agentId === id) {
                foundTarget = true
                const wasCollapsed = block.isCollapsed ?? false
                return {
                  ...block,
                  isCollapsed: !wasCollapsed,
                  userOpened: wasCollapsed,
                }
              }

              if (block.type === 'tool' && block.toolCallId === id) {
                foundTarget = true
                const wasCollapsed = block.isCollapsed ?? false
                return {
                  ...block,
                  isCollapsed: !wasCollapsed,
                  userOpened: wasCollapsed,
                }
              }

              if (block.type === 'agent-list' && block.id === id) {
                foundTarget = true
                const wasCollapsed = block.isCollapsed ?? false
                return {
                  ...block,
                  isCollapsed: !wasCollapsed,
                  userOpened: wasCollapsed,
                }
              }

              if (block.type === 'agent' && block.blocks) {
                const updatedBlocks = updateBlocksRecursively(block.blocks)
                if (updatedBlocks !== block.blocks) {
                  foundTarget = true
                  return {
                    ...block,
                    blocks: updatedBlocks,
                  }
                }
              }

              return block
            })

            return foundTarget ? result : blocks
          }

          return {
            ...message,
            blocks: updateBlocksRecursively(message.blocks),
          }
        })
      })

      setTimeout(() => {
        isUserCollapsingRef.current = false
      }, 0)
    },
    [setMessages],
  )

  const handleLoadPreviousMessages = useCallback(() => {
    setVisibleMessageCount((prev) => prev + MESSAGE_BATCH_SIZE)
  }, [])

  const handleToggleAll = useCallback(() => {
    isUserCollapsingRef.current = true

    setMessages((prevMessages) => {
      const allCollapsed = !hasAnyExpandedBlocks(prevMessages)
      const shouldCollapse = !allCollapsed
      return setAllBlocksCollapsedState(prevMessages, shouldCollapse)
    })

    setTimeout(() => {
      isUserCollapsingRef.current = false
    }, 0)
  }, [setMessages])

  const { tree: messageTree, topLevelMessages } = useMemo(
    () => buildMessageTree(messages),
    [messages],
  )

  const visibleTopLevelMessages = useMemo(() => {
    if (topLevelMessages.length <= visibleMessageCount) {
      return topLevelMessages
    }
    return topLevelMessages.slice(-visibleMessageCount)
  }, [topLevelMessages, visibleMessageCount])

  const hiddenMessageCount =
    topLevelMessages.length - visibleTopLevelMessages.length

  return {
    messageTree,
    topLevelMessages,
    visibleTopLevelMessages,
    hiddenMessageCount,
    handleCollapseToggle,
    isUserCollapsing,
    handleLoadPreviousMessages,
    handleToggleAll,
  }
}
