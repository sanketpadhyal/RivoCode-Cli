import type { ContentBlock, TextContentBlock } from '../types/chat'

export interface BlockMargins {
  marginTop: number
  marginBottom: number
}

export function extractTextBlockMargins(
  block: TextContentBlock,
  prevBlock: ContentBlock | null,
): BlockMargins {
  const prevBlockSuppressesMargin =
    prevBlock !== null &&
    (prevBlock.type === 'tool' || prevBlock.type === 'agent')

  const marginTop = prevBlockSuppressesMargin ? 0 : (block.marginTop ?? 0)
  const marginBottom = block.marginBottom ?? 0

  return { marginTop, marginBottom }
}

export function extractHtmlBlockMargins(block: {
  marginTop?: number
  marginBottom?: number
}): BlockMargins {
  return {
    marginTop: block.marginTop ?? 0,
    marginBottom: block.marginBottom ?? 0,
  }
}
