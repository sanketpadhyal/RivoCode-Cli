
import type { ChatMessage, ContentBlock, TextContentBlock, ThinkingCollapseState } from '../types/chat'

type CollapsibleBlock = ContentBlock & {
  isCollapsed?: boolean
  userOpened?: boolean
}

function isThinkingTextBlock(block: ContentBlock): block is TextContentBlock {
  return block.type === 'text' && 'thinkingId' in block && !!block.thinkingId
}

function isCollapsibleBlock(block: ContentBlock): block is CollapsibleBlock {
  if (block.type === 'text' && 'thinkingId' in block && block.thinkingId) {
    return true
  }
  if (block.type === 'agent' || block.type === 'tool' || block.type === 'agent-list') {
    return true
  }
  return false
}

function isBlockExpanded(block: CollapsibleBlock): boolean {
  if (isThinkingTextBlock(block)) {
    return block.thinkingCollapseState === 'expanded'
  }
  return block.isCollapsed === false
}

function getBlockCollapsedState(block: CollapsibleBlock): boolean {
  if (isThinkingTextBlock(block)) {
    return block.thinkingCollapseState !== 'expanded'
  }
  return block.isCollapsed ?? true
}

function createUpdatedBlock(
  block: CollapsibleBlock,
  collapsed: boolean,
): CollapsibleBlock | null {
  if (isThinkingTextBlock(block)) {
    const targetState: ThinkingCollapseState = collapsed ? 'hidden' : 'expanded'
    if (block.thinkingCollapseState === targetState) {
      return null
    }
    return {
      ...block,
      thinkingCollapseState: targetState,
      userOpened: !collapsed ? true : block.userOpened,
    }
  }
  const currentCollapsed = getBlockCollapsedState(block)
  if (currentCollapsed === collapsed) {
    return null
  }
  return {
    ...block,
    isCollapsed: collapsed,
    userOpened: !collapsed ? true : block.userOpened,
  }
}

function hasAnyExpandedBlocksRecursive(blocks: ContentBlock[]): boolean {
  for (const block of blocks) {
    if (isCollapsibleBlock(block)) {
      if (isBlockExpanded(block)) {
        return true
      }
      if (block.type === 'agent' && block.blocks) {
        if (hasAnyExpandedBlocksRecursive(block.blocks)) {
          return true
        }
      }
    }
  }
  return false
}

export function hasAnyExpandedBlocks(messages: ChatMessage[]): boolean {
  for (const message of messages) {
    if (message.variant === 'agent') {
      if (message.metadata?.isCollapsed === false) {
        return true
      }
    }

    if (message.blocks && hasAnyExpandedBlocksRecursive(message.blocks)) {
      return true
    }
  }

  return false
}

interface UpdateBlocksResult {
  blocks: ContentBlock[]
  changed: boolean
}

function updateBlocksRecursively(
  blocks: ContentBlock[],
  collapsed: boolean,
): UpdateBlocksResult {
  let anyChanged = false
  const result = blocks.map((block) => {
    if (!isCollapsibleBlock(block)) {
      return block
    }

    if (block.type === 'agent') {
      const currentCollapsed = getBlockCollapsedState(block)
      let updatedBlock = block
      let blockChanged = false

      if (currentCollapsed !== collapsed) {
        blockChanged = true
        updatedBlock = {
          ...block,
          isCollapsed: collapsed,
          userOpened: !collapsed ? true : block.userOpened,
        }
      }

      if (block.blocks) {
        const nested = updateBlocksRecursively(block.blocks, collapsed)
        if (nested.changed) {
          blockChanged = true
          updatedBlock = {
            ...updatedBlock,
            blocks: nested.blocks,
          }
        }
      }

      if (blockChanged) {
        anyChanged = true
        return updatedBlock
      }
      return block
    }

    const updated = createUpdatedBlock(block, collapsed)
    if (updated) {
      anyChanged = true
      return updated
    }
    return block
  })

  return { blocks: anyChanged ? result : blocks, changed: anyChanged }
}

export function setAllBlocksCollapsedState(
  messages: ChatMessage[],
  collapsed: boolean,
): ChatMessage[] {
  return messages.map((message) => {
    let updatedMessage = message
    let messageChanged = false

    if (message.variant === 'agent') {
      const currentCollapsed = message.metadata?.isCollapsed ?? true
      if (currentCollapsed !== collapsed) {
        messageChanged = true
        updatedMessage = {
          ...updatedMessage,
          metadata: {
            ...updatedMessage.metadata,
            isCollapsed: collapsed,
            userOpened: !collapsed ? true : updatedMessage.metadata?.userOpened,
          },
        }
      }
    }

    if (message.blocks) {
      const { blocks: updatedBlocks, changed } = updateBlocksRecursively(
        message.blocks,
        collapsed,
      )
      if (changed) {
        messageChanged = true
        updatedMessage = {
          ...updatedMessage,
          blocks: updatedBlocks,
        }
      }
    }

    return messageChanged ? updatedMessage : message
  })
}
