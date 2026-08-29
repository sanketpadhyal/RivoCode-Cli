
import {
  toolNameParam,
  toolXmlName,
} from '@rivocode/common/tools/constants'

const startToolTag = `<${toolXmlName}>`
const endToolTag = `</${toolXmlName}>`

export type ParsedToolCall = {
  toolName: string
  input: Record<string, unknown>
}

export type StreamParserState = {
  buffer: string
  insideToolCall: boolean
}

export type ParseResult = {
  filteredText: string
  toolCalls: ParsedToolCall[]
}

export function createStreamParserState(): StreamParserState {
  return {
    buffer: '',
    insideToolCall: false,
  }
}

export function parseStreamChunk(
  chunk: string,
  state: StreamParserState,
): ParseResult {
  if (!chunk) {
    return { filteredText: '', toolCalls: [] }
  }

  let text = state.buffer + chunk
  state.buffer = ''

  let filteredText = ''
  const toolCalls: ParsedToolCall[] = []

  while (text.length > 0) {
    if (state.insideToolCall) {
      const endIndex = text.indexOf(endToolTag)

      if (endIndex !== -1) {
        const toolCallContent = text.slice(0, endIndex)
        const parsedToolCall = parseToolCallContent(toolCallContent)
        if (parsedToolCall) {
          toolCalls.push(parsedToolCall)
        }

        text = text.slice(endIndex + endToolTag.length)
        state.insideToolCall = false
      } else {
        state.buffer = text
        text = ''
      }
    } else {
      const startIndex = text.indexOf(startToolTag)

      if (startIndex !== -1) {
        filteredText += text.slice(0, startIndex)
        text = text.slice(startIndex + startToolTag.length)
        state.insideToolCall = true
      } else {
        const partialStart = findPartialTagMatch(text, startToolTag)
        if (partialStart > 0) {
          filteredText += text.slice(0, -partialStart)
          state.buffer = text.slice(-partialStart)
          text = ''
        } else {
          filteredText += text
          text = ''
        }
      }
    }
  }

  return { filteredText, toolCalls }
}

function parseToolCallContent(content: string): ParsedToolCall | null {
  const trimmed = content.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    const toolName = parsed[toolNameParam]

    if (typeof toolName !== 'string') {
      return null
    }

    const input = { ...parsed }
    delete input[toolNameParam]
    delete input['cb_easp']

    return { toolName, input }
  } catch {
    return null
  }
}

function findPartialTagMatch(text: string, tag: string): number {
  const maxOverlap = Math.min(text.length, tag.length - 1)

  for (let len = maxOverlap; len > 0; len--) {
    const suffix = text.slice(-len)
    const prefix = tag.slice(0, len)
    if (suffix === prefix) {
      return len
    }
  }

  return 0
}
