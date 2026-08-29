import {
  createStreamParserState,
  parseStreamChunk,
} from './util/stream-xml-parser'

import type { StreamParserState } from './util/stream-xml-parser'
import type { StreamChunk } from '@codebuff/common/types/contracts/llm'
import type {
  PrintModeError,
  PrintModeText,
} from '@codebuff/common/types/print-mode'
import type { PromptResult } from '@codebuff/common/util/error'

export async function* processStreamWithTools(params: {
  stream: AsyncGenerator<StreamChunk, PromptResult<string | null>>
  processors: Record<
    string,
    {
      onTagStart: (
        tagName: string,
        attributes: Record<string, string>,
      ) => void | Promise<void>
      onTagEnd: (
        tagName: string,
        params: Record<string, any>,
      ) => void | Promise<void>
    }
  >
  defaultProcessor: (toolName: string) => {
    onTagStart: (
      tagName: string,
      attributes: Record<string, string>,
    ) => void | Promise<void>
    onTagEnd: (
      tagName: string,
      params: Record<string, any>,
    ) => void | Promise<void>
  }
  onResponseChunk: (chunk: PrintModeText | PrintModeError) => void
  executeXmlToolCall: (params: {
    toolCallId: string
    toolName: string
    input: Record<string, unknown>
  }) => Promise<void>
}): AsyncGenerator<StreamChunk, PromptResult<string | null>> {
  const {
    stream,
    processors,
    defaultProcessor,
    onResponseChunk,
    executeXmlToolCall,
  } = params
  let streamCompleted = false
  let buffer = ''

  const xmlParserState: StreamParserState = createStreamParserState()

  async function processToolCallObject(params: {
    toolName: string
    input: any
  }): Promise<void> {
    const { toolName } = params
    let { input } = params

    if (typeof input === 'string') {
      try {
        input = JSON.parse(input)
      } catch {}
    }

    const processor = processors[toolName] ?? defaultProcessor(toolName)

    await processor.onTagStart(toolName, {})
    await processor.onTagEnd(toolName, input)
  }

  function flush() {
    if (buffer) {
      onResponseChunk({
        type: 'text',
        text: buffer,
      })
    }
    buffer = ''
  }

  async function* processChunk(
    chunk: StreamChunk | undefined,
  ): AsyncGenerator<StreamChunk> {
    if (chunk === undefined) {
      flush()
      streamCompleted = true
      return
    }

    if (chunk.type === 'text') {
      const { filteredText, toolCalls } = parseStreamChunk(
        chunk.text,
        xmlParserState,
      )

      if (filteredText) {
        buffer += filteredText
        yield {
          type: 'text',
          text: filteredText,
        }
      }

      if (toolCalls.length > 0) {
        flush()
      }

      for (const toolCall of toolCalls) {
        const toolCallId = `xml-${crypto.randomUUID().slice(0, 8)}`

        await executeXmlToolCall({
          toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        })
      }
      return
    } else {
      flush()
    }

    if (chunk.type === 'tool-call') {
      await processToolCallObject(chunk)
    }

    yield chunk
  }

  let result: PromptResult<string | null> = { aborted: false, value: null }
  try {
    while (true) {
      const { value, done } = await stream.next()
      if (done) {
        result = value
        break
      }
      if (streamCompleted) {
        break
      }
      yield* processChunk(value)
    }
    if (!streamCompleted) {
      yield* processChunk(undefined)
    }
  } finally {
    flush()
  }
  return result
}
