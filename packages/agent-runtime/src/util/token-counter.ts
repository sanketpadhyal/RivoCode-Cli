import { LRUCache } from '@codebuff/common/util/lru-cache'
import { encode } from 'gpt-tokenizer/esm/model/gpt-4o'

import type { Message } from '@codebuff/common/types/messages/codebuff-message'

const ANTHROPIC_TOKEN_FUDGE_FACTOR = 1.35

const IMAGE_TOKEN_ESTIMATE = 1600

const PER_MESSAGE_TOKEN_OVERHEAD = 8

const TOKEN_COUNT_CACHE = new LRUCache<string, number>(1000)

export function countTokens(text: string): number {
  try {
    const cached = TOKEN_COUNT_CACHE.get(text)
    if (cached !== undefined) {
      return cached
    }
    const count = Math.floor(
      encode(text, { allowedSpecial: 'all' }).length *
        ANTHROPIC_TOKEN_FUDGE_FACTOR,
    )

    if (text.length > 100) {
      TOKEN_COUNT_CACHE.set(text, count)
    }
    return count
  } catch (e) {
    console.error('Error counting tokens', e)
    return Math.ceil(text.length / 3)
  }
}

export function countTokensJson(value: unknown): number {
  return countTokens(JSON.stringify(value) ?? '')
}

export function countTokensMessages(messages: Message[]): number {
  let total = 0
  for (const message of messages) {
    total += PER_MESSAGE_TOKEN_OVERHEAD

    const content = (message as { content?: unknown }).content
    if (typeof content === 'string') {
      total += countTokens(content)
      continue
    }
    if (!Array.isArray(content)) {
      continue
    }

    for (const part of content as Array<Record<string, unknown>>) {
      switch (part.type) {
        case 'text':
        case 'reasoning':
          total += countTokens(part.text as string)
          break
        case 'tool-call':
          total +=
            countTokens(part.toolName as string) + countTokensJson(part.input)
          break
        case 'json':
          total += countTokensJson(part.value)
          break
        case 'image':
        case 'file':
        case 'media':
          total += IMAGE_TOKEN_ESTIMATE
          break
        default:
          total += countTokensJson(part)
      }
    }
  }
  return total
}

export function countTokensForFiles(
  files: Record<string, string | null>,
): Record<string, number> {
  const tokenCounts: Record<string, number> = {}
  for (const [filePath, content] of Object.entries(files)) {
    tokenCounts[filePath] = content ? countTokens(content) : 0
  }
  return tokenCounts
}
