import { TEST_AGENT_RUNTIME_IMPL } from '@rivocode/common/testing/impl/agent-runtime'
import { promptSuccess } from '@rivocode/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'

import { processStreamWithTools } from '../tool-stream-parser'
import { createToolCallChunk } from './test-utils'

import type { AgentRuntimeDeps } from '@rivocode/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@rivocode/common/types/contracts/llm'

describe('XML tool result ordering', () => {
  async function* createMockStream(chunks: StreamChunk[]) {
    for (const chunk of chunks) {
      yield chunk
    }
    return promptSuccess('mock-message-id')
  }

  function textChunk(text: string): StreamChunk {
    return { type: 'text' as const, text }
  }

  let agentRuntimeImpl: AgentRuntimeDeps

  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL }
  })

  it('should call executeXmlToolCall synchronously and track execution order', async () => {
    const executionOrder: string[] = []

    const xmlToolCall = `<codebuff_tool_call>
{"cb_tool_name": "test_tool", "param1": "value1"}
</codebuff_tool_call>`

    const streamChunks: StreamChunk[] = [
      textChunk('Text before tool call\n'),
      textChunk(xmlToolCall),
      textChunk('\nText after tool call'),
    ]

    const stream = createMockStream(streamChunks)
    const responseChunks: any[] = []

    function onResponseChunk(chunk: any) {
      responseChunks.push(chunk)
    }

    function defaultProcessor(toolName: string) {
      return {
        onTagStart: () => {},
        onTagEnd: () => {},
      }
    }

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors: {},
      defaultProcessor,
      onResponseChunk,
      executeXmlToolCall: async ({ toolName, input }) => {
        executionOrder.push(`executeXmlToolCall:${toolName}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push(`executeXmlToolCall:${toolName}:done`)
      },
    })) {
      if (chunk.type === 'text') {
        executionOrder.push(`text:${chunk.text.trim().slice(0, 20)}`)
      } else if (chunk.type === 'tool-call') {
        executionOrder.push(`tool-call:${chunk.toolName}`)
      }
    }

    console.log('Execution order:', executionOrder)

    const executeStartIndex = executionOrder.findIndex((e) =>
      e.startsWith('executeXmlToolCall:test_tool'),
    )
    const executeDoneIndex = executionOrder.findIndex((e) =>
      e.includes(':done'),
    )
    const textAfterIndex = executionOrder.findIndex((e) =>
      e.includes('Text after'),
    )

    expect(executeStartIndex).toBeGreaterThan(-1)
    expect(executeDoneIndex).toBeGreaterThan(-1)

    if (textAfterIndex > -1) {
      expect(executeDoneIndex).toBeLessThan(textAfterIndex)
    }
  })

  it('should track tool_call and tool_result events in correct order', async () => {

    const events: { type: string; toolName?: string; order: number }[] = []
    let eventCounter = 0

    const xmlToolCall = `<codebuff_tool_call>
{"cb_tool_name": "read_files", "paths": ["test.ts"]}
</codebuff_tool_call>`

    const streamChunks: StreamChunk[] = [
      textChunk('Before\n'),
      textChunk(xmlToolCall),
      textChunk('\nAfter'),
    ]

    const stream = createMockStream(streamChunks)

    function defaultProcessor(toolName: string) {
      return {
        onTagStart: () => {},
        onTagEnd: () => {},
      }
    }

    function onResponseChunk(chunk: any) {
      if (chunk.type === 'text') {
        events.push({ type: 'text', order: eventCounter++ })
      }
    }

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors: {},
      defaultProcessor,
      onResponseChunk,
      executeXmlToolCall: async ({ toolName }) => {
        events.push({ type: 'tool_call', toolName, order: eventCounter++ })

        await new Promise((resolve) => setTimeout(resolve, 5))

        events.push({ type: 'tool_result', toolName, order: eventCounter++ })
      },
    })) {
    }

    const toolCallEvent = events.find((e) => e.type === 'tool_call')
    const toolResultEvent = events.find((e) => e.type === 'tool_result')
    const textAfterEvents = events.filter(
      (e) => e.type === 'text' && e.order > (toolCallEvent?.order ?? 0),
    )

    expect(toolCallEvent).toBeDefined()
    expect(toolResultEvent).toBeDefined()

    if (toolResultEvent && textAfterEvents.length > 0) {
      const firstTextAfter = textAfterEvents[0]
      expect(toolResultEvent.order).toBeLessThan(firstTextAfter.order)
    }
  })

  it('should not deadlock when executeXmlToolCall awaits tool execution', async () => {

    const xmlToolCall = `<codebuff_tool_call>
{"cb_tool_name": "test_tool", "param": "value"}
</codebuff_tool_call>`

    const streamChunks: StreamChunk[] = [
      textChunk('Before\n'),
      textChunk(xmlToolCall),
      textChunk('\nAfter'),
    ]

    const stream = createMockStream(streamChunks)
    let toolExecuted = false

    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 1000),
    )

    const streamPromise = (async () => {
      for await (const chunk of processStreamWithTools({
        ...agentRuntimeImpl,
        stream,
        processors: {},
        defaultProcessor: () => ({ onTagStart: () => {}, onTagEnd: () => {} }),
        onResponseChunk: () => {},
        executeXmlToolCall: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          toolExecuted = true
        },
      })) {
      }
      return 'completed'
    })()

    const result = await Promise.race([streamPromise, timeoutPromise])

    expect(result).toBe('completed')
    expect(toolExecuted).toBe(true)
  })
})
