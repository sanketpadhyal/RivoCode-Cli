
import { mock } from 'bun:test'

import type { Mock } from 'bun:test'

export interface TextChunk {
  type: 'text'
  text: string
  agentId?: string
}

export interface ToolCallChunk {
  type: 'tool-call'
  toolName: string
  toolCallId: string
  input: Record<string, unknown>
}

export interface ReasoningChunk {
  type: 'reasoning'
  text: string
}

export type StreamChunk = TextChunk | ToolCallChunk | ReasoningChunk

export interface CreateToolCallOptions {
  toolCallId?: string
}

let toolCallIdCounter = 0

export function createToolCallChunk(
  toolName: string,
  input: Record<string, unknown>,
  options: CreateToolCallOptions = {},
): ToolCallChunk {
  const { toolCallId = `tool-call-${++toolCallIdCounter}` } = options
  return {
    type: 'tool-call',
    toolName,
    toolCallId,
    input,
  }
}

export function createTextChunk(text: string, agentId?: string): TextChunk {
  const chunk: TextChunk = { type: 'text', text }
  if (agentId) {
    chunk.agentId = agentId
  }
  return chunk
}

export function createReasoningChunk(text: string): ReasoningChunk {
  return { type: 'reasoning', text }
}

export function createMockStream(
  chunks: StreamChunk[],
  returnValue: string | null = 'mock-message-id',
): AsyncGenerator<StreamChunk, string | null, undefined> {
  async function* generator(): AsyncGenerator<
    StreamChunk,
    string | null,
    undefined
  > {
    for (const chunk of chunks) {
      yield chunk
    }
    return returnValue
  }
  return generator()
}

export function createMockTextStream(
  text: string,
  chunkSize: number = 10,
  endWithTool: boolean = true,
): AsyncGenerator<StreamChunk, string | null, undefined> {
  const chunks: StreamChunk[] = []

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(createTextChunk(text.slice(i, i + chunkSize)))
  }

  if (endWithTool) {
    chunks.push(createToolCallChunk('end_turn', {}))
  }

  return createMockStream(chunks)
}

export interface MockPromptOptions {
  defaultResponse?: string

  includeEndTurn?: boolean

  chunks?: StreamChunk[]
}

export type MockPromptFn = Mock<
  (
    params: Record<string, unknown>,
  ) => AsyncGenerator<StreamChunk, string | null>
>

export function createMockPromptAiSdkStream(
  options: MockPromptOptions = {},
): MockPromptFn {
  const {
    defaultResponse = 'Mock response\n\n',
    includeEndTurn = true,
    chunks,
  } = options

  return mock(async function* () {
    if (chunks) {
      for (const chunk of chunks) {
        yield chunk
      }
    } else {
      yield createTextChunk(defaultResponse)
      if (includeEndTurn) {
        yield createToolCallChunk('end_turn', {})
      }
    }
    return 'mock-message-id'
  })
}

export async function collectStreamChunks<T, R>(
  stream: AsyncGenerator<T, R, undefined>,
): Promise<{ chunks: T[]; returnValue: R }> {
  const chunks: T[] = []

  let result = await stream.next()
  while (!result.done) {
    chunks.push(result.value)
    result = await stream.next()
  }

  return { chunks, returnValue: result.value }
}

export function resetToolCallIdCounter(): void {
  toolCallIdCounter = 0
}
