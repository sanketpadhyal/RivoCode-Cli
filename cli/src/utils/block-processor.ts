
import { shouldCollapseByDefault } from './constants'
import {
  isImplementorAgent,
  groupConsecutiveImplementors,
  groupConsecutiveNonImplementorAgents,
  groupConsecutiveToolBlocks,
} from './implementor-helpers'
import { isImageBlock } from '../types/chat'

import type {
  ContentBlock,
  AgentContentBlock,
  ToolContentBlock,
  TextContentBlock,
  ImageContentBlock,
} from '../types/chat'
import type { ReactNode } from 'react'

export function isReasoningTextBlock(
  block: ContentBlock,
): block is Extract<ContentBlock, { type: 'text' }> {
  return block.type === 'text' && block.textType === 'reasoning'
}

export interface BlockProcessorHandlers {
  onReasoningGroup: (
    blocks: TextContentBlock[],
    startIndex: number,
  ) => ReactNode

  onImageBlock?: (block: ImageContentBlock, index: number) => ReactNode

  onToolGroup: (
    blocks: ToolContentBlock[],
    startIndex: number,
    nextIndex: number,
  ) => ReactNode

  onImplementorGroup: (
    blocks: AgentContentBlock[],
    startIndex: number,
    nextIndex: number,
  ) => ReactNode

  onAgentGroup: (
    blocks: AgentContentBlock[],
    startIndex: number,
    nextIndex: number,
  ) => ReactNode

  onSingleBlock: (block: ContentBlock, index: number) => ReactNode
}

export function splitByAgentSize<T>(
  items: T[],
  getAgentType: (item: T) => string,
): T[][] {
  if (items.length <= 1) return [items]

  const subGroups: T[][] = []
  let currentSmallGroup: T[] = []

  for (const item of items) {
    if (shouldCollapseByDefault(getAgentType(item))) {
      currentSmallGroup.push(item)
    } else {
      if (currentSmallGroup.length > 0) {
        subGroups.push(currentSmallGroup)
        currentSmallGroup = []
      }
      subGroups.push([item])
    }
  }

  if (currentSmallGroup.length > 0) {
    subGroups.push(currentSmallGroup)
  }

  return subGroups
}

export function splitAgentsBySize(
  agents: AgentContentBlock[],
): AgentContentBlock[][] {
  return splitByAgentSize(agents, (a) => a.agentType)
}

export function processBlocks(
  blocks: ContentBlock[],
  handlers: BlockProcessorHandlers,
): ReactNode[] {
  const nodes: ReactNode[] = []

  for (let i = 0; i < blocks.length; ) {
    const block = blocks[i]

    if (isReasoningTextBlock(block)) {
      const start = i
      const reasoningBlocks: TextContentBlock[] = []
      while (i < blocks.length) {
        const currentBlock = blocks[i]
        if (!isReasoningTextBlock(currentBlock)) break
        reasoningBlocks.push(currentBlock)
        i++
      }

      const node = handlers.onReasoningGroup(reasoningBlocks, start)
      if (node !== null) {
        nodes.push(node)
      }
      continue
    }

    if (isImageBlock(block)) {
      if (handlers.onImageBlock) {
        const node = handlers.onImageBlock(block, i)
        if (node !== null) {
          nodes.push(node)
        }
      }
      i++
      continue
    }

    if (block.type === 'tool') {
      const start = i
      const { group: toolBlocks, nextIndex } = groupConsecutiveToolBlocks(
        blocks,
        i,
      )
      i = nextIndex

      const node = handlers.onToolGroup(toolBlocks, start, nextIndex)
      if (node !== null) {
        nodes.push(node)
      }
      continue
    }

    if (block.type === 'agent') {
      if (isImplementorAgent(block)) {
        const start = i
        const { group: implementors, nextIndex } = groupConsecutiveImplementors(
          blocks,
          i,
        )
        i = nextIndex

        const node = handlers.onImplementorGroup(implementors, start, nextIndex)
        if (node !== null) {
          nodes.push(node)
        }
      } else {
        const start = i
        const { group: agentBlocks, nextIndex } =
          groupConsecutiveNonImplementorAgents(blocks, i)
        i = nextIndex

        const node = handlers.onAgentGroup(agentBlocks, start, nextIndex)
        if (node !== null) {
          nodes.push(node)
        }
      }
      continue
    }

    const node = handlers.onSingleBlock(block, i)
    if (node !== null) {
      nodes.push(node)
    }
    i++
  }

  return nodes
}
