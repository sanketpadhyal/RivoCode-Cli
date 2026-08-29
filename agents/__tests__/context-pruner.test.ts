import { describe, test, expect, beforeEach } from 'bun:test'

import contextPruner from '../context-pruner'

import type { AgentState } from '../types/agent-definition'
import type { JSONValue, Message, ToolMessage } from '../types/util-types'

function createMockAgentState(
  messageHistory: Message[],
  contextTokenCount: number,
): AgentState {
  return {
    agentId: 'test-agent',
    runId: 'test-run',
    parentId: undefined,
    messageHistory,
    output: undefined,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount,
  }
}

describe('context-pruner handleSteps serialization', () => {
  test('handleSteps works when serialized and executed in isolation (regression test for external variable references)', () => {
    const handleStepsString = contextPruner.handleSteps!.toString()

    expect(handleStepsString).toMatch(/^function\*\s*\(/)

    const isolatedFunction = new Function(`return (${handleStepsString})`)()

    const mockAgentState = createMockAgentState(
      [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
        },
      ],
      100,
    )

    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }

    const generator = isolatedFunction({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })

    const results: unknown[] = []
    let result = generator.next()
    while (!result.done) {
      results.push(result.value)
      result = generator.next()
    }

    expect(results.length).toBeGreaterThan(0)
  })

  test('handleSteps works in isolation when pruning is triggered', () => {
    const handleStepsString = contextPruner.handleSteps!.toString()

    const isolatedFunction = new Function(`return (${handleStepsString})`)()

    const mockAgentState = createMockAgentState(
      [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Please help me with a task' }],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Sure, I can help with that' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'read_files',
              input: { paths: ['test.ts'] },
            },
          ],
        },
        {
          role: 'tool',
          toolCallId: 'call-1',
          toolName: 'read_files',
          content: [{ type: 'json', value: { content: 'file content' } }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Thanks!' }],
        },
      ],
      250000,
    )

    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }

    const generator = isolatedFunction({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })

    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      results.push(result.value)
      result = generator.next()
    }

    expect(results.length).toBeGreaterThan(0)

    const setMessagesCall = results[0]
    expect(setMessagesCall.toolName).toBe('set_messages')
    expect(setMessagesCall.input.messages[0].content[0].text).toContain(
      '<conversation_summary>',
    )
  })
})

const createMessage = (
  role: 'user' | 'assistant',
  content: string,
): Message => ({
  role,
  content: [
    {
      type: 'text',
      text: content,
    },
  ],
})

const createToolCallMessage = (
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>,
): Message => ({
  role: 'assistant',
  content: [
    {
      type: 'tool-call',
      toolCallId,
      toolName,
      input,
    },
  ],
})

const createToolResultMessage = (
  toolCallId: string,
  toolName: string,
  value: JSONValue,
): ToolMessage => ({
  role: 'tool',
  toolCallId,
  toolName,
  content: [
    {
      type: 'json',
      value,
    },
  ],
})

describe('context-pruner handleSteps', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (
    messages: Message[],
    contextTokenCount?: number,
    maxContextLength?: number,
    budgets?: { assistantToolBudget?: number; userBudget?: number },
    infoLogs?: Array<{ data: unknown; message?: string }>,
    throwOnInfo = false,
  ) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount =
      contextTokenCount ?? Math.ceil(JSON.stringify(messages).length / 3)
    const mockLogger = {
      debug: () => {},
      info: (data: unknown, message?: string) => {
        if (throwOnInfo) throw new Error('logger unavailable')
        infoLogs?.push({ data, message })
      },
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: {
        ...(maxContextLength ? { maxContextLength } : {}),
        ...budgets,
      },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('does nothing when context is under max limit', () => {
    const messages = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi there!'),
    ]

    const results = runHandleSteps(messages, 199000, 200000)

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(
      expect.objectContaining({
        toolName: 'set_messages',
        input: {
          messages,
        },
      }),
    )
  })

  test('does not emit pruning telemetry when pruning is unnecessary', () => {
    const infoLogs: Array<{ data: unknown; message?: string }> = []

    runHandleSteps(
      [createMessage('user', 'Hello')],
      1_000,
      200_000,
      undefined,
      infoLogs,
    )

    expect(infoLogs).toEqual([])
  })

  test('still prunes when telemetry logging throws', () => {
    const results = runHandleSteps(
      [createMessage('user', 'Keep this request')],
      250_000,
      200_000,
      undefined,
      undefined,
      true,
    )

    expect(results).toHaveLength(1)
    expect(results[0].toolName).toBe('set_messages')
    expect(results[0].input.messages[0].content[0].text).toContain(
      'Keep this request',
    )
  })

  test('summarizes conversation when context exceeds max limit', () => {
    const messages = [
      createMessage('user', 'Please help me with this task'),
      createMessage('assistant', 'Sure, I can help you with that'),
      createMessage('user', 'Thanks for your help'),
    ]

    const results = runHandleSteps(messages, 210000, 200000)

    expect(results).toHaveLength(1)
    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(1)
    expect(resultMessages[0].role).toBe('user')

    const content = resultMessages[0].content[0].text
    expect(content).toContain('<conversation_summary>')
    expect(content).toContain('</conversation_summary>')

    expect(content).toContain('<historical_memory>')
    expect(content).toContain('[USER]')
    expect(content).toContain('Progress note:')
    expect(content).not.toContain('[ASSISTANT]')
  })

  test('includes tool call summaries in the output', () => {
    const messages = [
      createMessage('user', 'Read these files'),
      createToolCallMessage('call-1', 'read_files', {
        paths: ['file1.ts', 'file2.ts'],
      }),
      createToolResultMessage('call-1', 'read_files', {
        content: 'file data',
      } as JSONValue),
      createMessage('user', 'Now edit this file'),
      createToolCallMessage('call-2', 'str_replace', {
        path: 'file1.ts',
        replacements: [],
      }),
      createToolResultMessage('call-2', 'str_replace', { success: true }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('inspected files: file1.ts, file2.ts')
    expect(content).toContain('edited file: file1.ts')
  })

  test('summarizes various tool types correctly', () => {
    const messages = [
      createMessage('user', 'Do various tasks'),
      createToolCallMessage('call-1', 'write_file', {
        path: 'new-file.ts',
        content: 'code',
      }),
      createToolResultMessage('call-1', 'write_file', { success: true }),
      createToolCallMessage('call-2', 'run_terminal_command', {
        command: 'npm test',
      }),
      createToolResultMessage('call-2', 'run_terminal_command', {
        stdout: 'pass',
      }),
      createToolCallMessage('call-3', 'code_search', { pattern: 'function' }),
      createToolResultMessage('call-3', 'code_search', { results: [] }),
      createToolCallMessage('call-4', 'spawn_agents', {
        agents: [{ agent_type: 'file-picker' }, { agent_type: 'commander' }],
      }),
      createToolResultMessage('call-4', 'spawn_agents', { success: true }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('wrote file: new-file.ts')
    expect(content).toContain('ran command: npm test')
    expect(content).toContain('code search for "function"')
    expect(content).toContain('delegated agents:')
    expect(content).toContain('- file-picker')
    expect(content).toContain('- commander')
  })

  test('includes tool errors in summary', () => {
    const messages = [
      createMessage('user', 'Try to read a file'),
      createToolCallMessage('call-1', 'read_files', { paths: ['missing.ts'] }),
      createToolResultMessage('call-1', 'read_files', {
        errorMessage: 'File not found',
      }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Tool error from read_files: File not found')
  })

  test('notes when user messages have images', () => {
    const messageWithImage: Message = {
      role: 'user',
      content: [
        { type: 'text', text: 'Look at this image' },
        { type: 'image', image: 'base64data', mediaType: 'image/png' },
      ],
    }

    const messages = [messageWithImage, createMessage('assistant', 'I see it')]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('[USER] [image(s) were attached]')
  })

  test('removes only INSTRUCTIONS_PROMPT and SUBAGENT_SPAWN when under context limit', () => {
    const messages: Message[] = [
      createMessage('user', 'Hello'),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Instructions prompt' }],
        tags: ['INSTRUCTIONS_PROMPT'],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Spawning...' }],
        tags: ['SUBAGENT_SPAWN'],
      },
      createMessage('assistant', 'Response'),
    ]

    const results = runHandleSteps(messages, 100, 200000)
    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(2)
    expect(resultMessages[0]).toEqual(messages[0])
    expect(resultMessages[1]).toEqual(messages[3])
  })

  test('removes INSTRUCTIONS_PROMPT and SUBAGENT_SPAWN when summarizing', () => {
    const messages: Message[] = [
      createMessage('user', 'Hello'),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Instructions prompt' }],
        tags: ['INSTRUCTIONS_PROMPT'],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Spawning...' }],
        tags: ['SUBAGENT_SPAWN'],
      },
      createMessage('user', 'Follow up'),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(1)
    const content = (resultMessages[0].content[0] as { text: string }).text

    expect(content).not.toContain('Instructions prompt')
    expect(content).not.toContain('Spawning...')

    expect(content).toContain('Hello')
    expect(content).toContain('Follow up')
  })

  test('preserves last remaining INSTRUCTIONS_PROMPT as second message when summarizing', () => {
    const messages: Message[] = [
      createMessage('user', 'Hello'),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Parent agent instructions' }],
        tags: ['INSTRUCTIONS_PROMPT'],
      },
      createMessage('assistant', 'Working on it'),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Context pruner instructions' }],
        tags: ['INSTRUCTIONS_PROMPT'],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Spawning context pruner' }],
        tags: ['SUBAGENT_SPAWN'],
      },
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(2)

    const summaryContent = (resultMessages[0].content[0] as { text: string })
      .text
    expect(summaryContent).toContain('<conversation_summary>')
    expect(summaryContent).toContain('Hello')
    expect(summaryContent).toContain('Working on it')
    expect(summaryContent).not.toContain('Parent agent instructions')
    expect(summaryContent).not.toContain('Context pruner instructions')

    const secondMessage = resultMessages[1]
    expect(secondMessage.tags).toContain('INSTRUCTIONS_PROMPT')
    const instructionsContent = (secondMessage.content[0] as { text: string })
      .text
    expect(instructionsContent).toBe('Parent agent instructions')
  })

  test('preserves tagged live user prompt as a real message after summary', () => {
    const liveUserPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'LATEST LIVE REQUEST' }],
      tags: ['USER_PROMPT'],
    }
    const instructionsPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'Parent instructions' }],
      tags: ['INSTRUCTIONS_PROMPT'],
    }
    const prunerParamsPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: '{"maxContextLength":200000}' }],
      tags: ['USER_PROMPT'],
    }
    const messages: Message[] = [
      createMessage('user', 'Older request'),
      createMessage('assistant', 'Older answer'),
      liveUserPrompt,
      instructionsPrompt,
      prunerParamsPrompt,
    ]

    const infoLogs: Array<{ data: any; message?: string }> = []
    const results = runHandleSteps(
      messages,
      250000,
      200000,
      undefined,
      infoLogs,
    )
    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(2)
    const summaryContent = (resultMessages[0].content[0] as { text: string })
      .text
    expect(summaryContent).toContain('Older request')
    expect(summaryContent).not.toContain('LATEST LIVE REQUEST')
    expect(resultMessages[1]).toEqual(
      expect.objectContaining({
        role: 'user',
        tags: ['USER_PROMPT'],
      }),
    )
    expect((resultMessages[1].content[0] as { text: string }).text).toBe(
      'LATEST LIVE REQUEST',
    )
    expect(infoLogs).toHaveLength(1)
    expect(infoLogs[0]).toEqual({
      message: 'Context pruning completed',
      data: expect.objectContaining({
        axiomEvent: 'context_pruning.completed',
        trigger_reason: 'context_limit',
        context_token_count: 250000,
        max_context_length: 200000,
        live_user_prompt_found: true,
        live_user_prompt_text_preserved: true,
        mid_turn: false,
        dropped_user_entry_count: 0,
      }),
    })
    expect(JSON.stringify(infoLogs[0].data)).not.toContain(
      'LATEST LIVE REQUEST',
    )
  })

  test('keeps live user prompt in memory and adds continuation prompt when pruning mid-turn', () => {
    const liveUserPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'PLEASE FIX THE BUG' }],
      tags: ['USER_PROMPT'],
    }
    const prunerParamsPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: '{"maxContextLength":200000}' }],
      tags: ['USER_PROMPT'],
    }
    const messages: Message[] = [
      liveUserPrompt,
      createMessage('assistant', 'I found the likely issue.'),
      createToolCallMessage('call-1', 'read_files', {
        paths: ['src/bug.ts'],
      }),
      createToolResultMessage('call-1', 'read_files', {
        content: 'buggy code',
      }),
      prunerParamsPrompt,
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(2)
    const summaryContent = (resultMessages[0].content[0] as { text: string })
      .text
    expect(summaryContent).toContain('PLEASE FIX THE BUG')
    expect(summaryContent).toContain('I found the likely issue.')
    expect(summaryContent).toContain('inspected files: src/bug.ts')

    expect(resultMessages[1].role).toBe('user')
    expect(resultMessages[1].tags).toBeUndefined()
    const continuationText = (resultMessages[1].content[0] as { text: string })
      .text
    expect(continuationText).toContain('Continue the existing assistant turn')
    expect(continuationText).toContain('Do not restart completed work')
  })

  test('telemetry reports a mid-turn live prompt that exceeds the user budget', () => {
    const liveUserPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'OVERSIZED LIVE REQUEST' }],
      tags: ['USER_PROMPT'],
    }
    const prunerParamsPrompt: Message = {
      role: 'user',
      content: [{ type: 'text', text: '{"maxContextLength":200000}' }],
      tags: ['USER_PROMPT'],
    }
    const infoLogs: Array<{ data: any; message?: string }> = []

    runHandleSteps(
      [
        liveUserPrompt,
        createMessage('assistant', 'Work in progress'),
        prunerParamsPrompt,
      ],
      250000,
      200000,
      { userBudget: 1, assistantToolBudget: 1000 },
      infoLogs,
    )

    expect(infoLogs[0].data).toEqual(
      expect.objectContaining({
        live_user_prompt_found: true,
        live_user_prompt_text_preserved: false,
        dropped_user_entry_count: 1,
      }),
    )
  })

  test('handles empty message history', () => {
    const messages: Message[] = []

    const results = runHandleSteps(messages, 0, 200000)

    expect(results).toHaveLength(1)
    expect(results[0].input.messages).toEqual([])
  })

  test('preserves all user message content in summary', () => {
    const messages = [
      createMessage('user', 'First user request with important details'),
      createMessage('assistant', 'First response'),
      createMessage('user', 'Second user request'),
      createMessage('assistant', 'Second response'),
      createMessage('user', 'Third user request'),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('First user request with important details')
    expect(content).toContain('Second user request')
    expect(content).toContain('Third user request')
  })

  test('preserves assistant text content in summary', () => {
    const messages = [
      createMessage('user', 'Question'),
      createMessage('assistant', 'Here is my detailed answer to your question'),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Here is my detailed answer to your question')
  })

  test('handles write_todos tool with completion status and remaining tasks', () => {
    const messages = [
      createMessage('user', 'Create a plan'),
      createToolCallMessage('call-1', 'write_todos', {
        todos: [
          { task: 'Task 1', completed: true },
          { task: 'Task 2', completed: true },
          { task: 'Task 3 - still to do', completed: false },
          { task: 'Task 4 - also remaining', completed: false },
        ],
      }),
      createToolResultMessage('call-1', 'write_todos', { success: true }),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Todos: 2/4 complete')
    expect(content).toContain('- Task 3 - still to do')
    expect(content).toContain('- Task 4 - also remaining')
  })

  test('handles spawn_agent_inline tool', () => {
    const messages = [
      createMessage('user', 'Spawn an agent'),
      createToolCallMessage('call-1', 'spawn_agent_inline', {
        agent_type: 'file-picker',
      }),
      createToolResultMessage('call-1', 'spawn_agent_inline', { output: {} }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('delegated agent file-picker')
  })

  test('handles long terminal commands by truncating', () => {
    const longCommand =
      'npm run build -- --config=production --verbose --output=/very/long/path/to/output/directory'
    const messages = [
      createMessage('user', 'Run build'),
      createToolCallMessage('call-1', 'run_terminal_command', {
        command: longCommand,
      }),
      createToolResultMessage('call-1', 'run_terminal_command', { stdout: '' }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain(
      'ran command: npm run build -- --config=production --verbose --o...',
    )
  })

  test('handles unknown tools gracefully', () => {
    const messages = [
      createMessage('user', 'Use some tool'),
      createToolCallMessage('call-1', 'unknown_tool_name', { param: 'value' }),
      createToolResultMessage('call-1', 'unknown_tool_name', { result: 'ok' }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('used tool unknown_tool_name')
  })

  test('handles multiple tool calls in single assistant message', () => {
    const multiToolMessage: Message = {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'read_files',
          input: { paths: ['a.ts'] },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'read_files',
          input: { paths: ['b.ts'] },
        },
      ],
    }

    const messages = [
      createMessage('user', 'Read files'),
      multiToolMessage,
      createToolResultMessage('call-1', 'read_files', { content: 'a' }),
      createToolResultMessage('call-2', 'read_files', { content: 'b' }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('inspected files: a.ts')
    expect(content).toContain('inspected files: b.ts')
  })

  test('handles mixed text and tool calls in assistant message', () => {
    const mixedMessage: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file for you' },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'read_files',
          input: { paths: ['test.ts'] },
        },
      ],
    }

    const messages = [
      createMessage('user', 'Read test.ts'),
      mixedMessage,
      createToolResultMessage('call-1', 'read_files', { content: 'data' }),
    ]

    const results = runHandleSteps(messages, 50000, 10000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Let me read that file for you')
    expect(content).toContain('inspected files: test.ts')
  })
})

describe('context-pruner long message truncation', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (
    messages: Message[],
    contextTokenCount: number,
    maxContextLength: number,
    budgets?: { assistantToolBudget?: number; userBudget?: number },
  ) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = contextTokenCount
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength, ...budgets },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('truncates very long user messages with 80-20 ratio', () => {
    const longText = 'A'.repeat(45000)
    const messages = [
      createMessage('user', longText),
      createMessage('assistant', 'Got it'),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('[...truncated')
    expect(content).toContain('chars...]')

    expect(content).toContain('AAAAAAAAAA')
  })

  test('truncates very long assistant messages with 80-20 ratio', () => {
    const longResponse = 'B'.repeat(8000)
    const messages = [
      createMessage('user', 'Give me a long response'),
      createMessage('assistant', longResponse),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('[...truncated')
    expect(content).toContain('chars...]')

    expect(content).toContain('BBBBBBBBBB')
  })

  test('does not truncate messages under the limit', () => {
    const shortText = 'Short message under 20k chars'
    const messages = [
      createMessage('user', shortText),
      createMessage('assistant', 'Short response under 5k chars'),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).not.toContain('[...truncated')

    expect(content).toContain(shortText)
    expect(content).toContain('Short response under 5k chars')
  })
})

describe('context-pruner code_search with flags', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (messages: Message[]) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = 250000
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('includes flags in code_search summary', () => {
    const messages = [
      createMessage('user', 'Search for something'),
      createToolCallMessage('call-1', 'code_search', {
        pattern: 'myFunction',
        flags: '-g *.ts -i',
      }),
      createToolResultMessage('call-1', 'code_search', { results: [] }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('code search for "myFunction" (-g *.ts -i)')
  })
})

describe('context-pruner ask_user with questions and answers', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (messages: Message[]) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = 250000
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('includes question text in ask_user summary', () => {
    const messages = [
      createMessage('user', 'Help me choose'),
      createToolCallMessage('call-1', 'ask_user', {
        questions: [
          {
            question: 'Which database should we use?',
            options: [{ label: 'PostgreSQL' }, { label: 'MySQL' }],
          },
        ],
      }),
      createToolResultMessage('call-1', 'ask_user', {
        answers: [{ selectedOption: 'PostgreSQL' }],
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Asked user: Which database should we use?')
  })

  test('includes user answer in summary', () => {
    const messages = [
      createMessage('user', 'Help me choose'),
      createToolCallMessage('call-1', 'ask_user', {
        questions: [
          { question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] },
        ],
      }),
      createToolResultMessage('call-1', 'ask_user', {
        answers: [{ selectedOption: 'Option B was selected' }],
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('User answered: Option B was selected')
  })

  test('includes multi-select answers', () => {
    const messages = [
      createMessage('user', 'Pick features'),
      createToolCallMessage('call-1', 'ask_user', {
        questions: [
          { question: 'Select features', options: [], multiSelect: true },
        ],
      }),
      createToolResultMessage('call-1', 'ask_user', {
        answers: [{ selectedOptions: ['Caching', 'Logging', 'Monitoring'] }],
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('User answered: Caching, Logging, Monitoring')
  })

  test('shows when user skipped question', () => {
    const messages = [
      createMessage('user', 'Ask me something'),
      createToolCallMessage('call-1', 'ask_user', {
        questions: [{ question: 'Pick one', options: [] }],
      }),
      createToolResultMessage('call-1', 'ask_user', {
        skipped: true,
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('User skipped question')
  })
})

describe('context-pruner terminal command exit codes', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (messages: Message[]) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = 250000
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('shows failed command with exit code', () => {
    const messages = [
      createMessage('user', 'Run tests'),
      createToolCallMessage('call-1', 'run_terminal_command', {
        command: 'npm test',
      }),
      createToolResultMessage('call-1', 'run_terminal_command', {
        stdout: 'Tests failed',
        exitCode: 1,
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Command failed with exit code: 1')
  })

  test('does not show failure for successful command (exit code 0)', () => {
    const messages = [
      createMessage('user', 'Run tests'),
      createToolCallMessage('call-1', 'run_terminal_command', {
        command: 'npm test',
      }),
      createToolResultMessage('call-1', 'run_terminal_command', {
        stdout: 'All tests passed',
        exitCode: 0,
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).not.toContain('Command failed with exit code')
  })
})

describe('context-pruner spawn_agents with prompt and params', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (messages: Message[]) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = 250000
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('includes prompt in spawn_agents summary', () => {
    const messages = [
      createMessage('user', 'Find files'),
      createToolCallMessage('call-1', 'spawn_agents', {
        agents: [
          {
            agent_type: 'file-picker',
            prompt: 'Find all TypeScript files related to authentication',
          },
        ],
      }),
      createToolResultMessage('call-1', 'spawn_agents', { success: true }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('file-picker')
    expect(content).toContain(
      'prompt: "Find all TypeScript files related to authentication"',
    )
  })

  test('includes params in spawn_agents summary', () => {
    const messages = [
      createMessage('user', 'Run a command'),
      createToolCallMessage('call-1', 'spawn_agents', {
        agents: [
          {
            agent_type: 'commander',
            params: { command: 'npm test' },
          },
        ],
      }),
      createToolResultMessage('call-1', 'spawn_agents', { success: true }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('commander')
    expect(content).toContain('params: {"command":"npm test"}')
  })

  test('truncates very long prompts (over 1000 chars)', () => {
    const longPrompt = 'X'.repeat(1500)
    const messages = [
      createMessage('user', 'Do something'),
      createToolCallMessage('call-1', 'spawn_agent_inline', {
        agent_type: 'thinker',
        prompt: longPrompt,
      }),
      createToolResultMessage('call-1', 'spawn_agent_inline', { output: {} }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('...')
    expect(content).not.toContain(longPrompt)
  })
})

describe('context-pruner repeated compaction', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (
    messages: Message[],
    contextTokenCount: number,
    maxContextLength: number,
    budgets?: { assistantToolBudget?: number; userBudget?: number },
  ) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = contextTokenCount
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength, ...budgets },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('extracts and preserves content from previous summary', () => {
    const previousSummaryMessage: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<conversation_summary>
This is a summary of the conversation so far. The original messages have been condensed to save context space.

[USER]
First user request from earlier

---

[ASSISTANT]
First assistant response
</conversation_summary>`,
        },
      ],
    }

    const messages = [
      previousSummaryMessage,
      createMessage('user', 'New user message after summary'),
      createMessage('assistant', 'New assistant response'),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('First user request from earlier')
    expect(content).toContain('First assistant response')

    expect(content).toContain('New user message after summary')
    expect(content).toContain('New assistant response')
  })

  test('filters out old summary messages when building new summary', () => {
    const previousSummaryMessage: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<conversation_summary>\nOld summary content\n</conversation_summary>',
        },
      ],
    }

    const messages = [
      previousSummaryMessage,
      createMessage('user', 'After summary message'),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const content = results[0].input.messages[0].content[0].text

    const summaryTagCount = (content.match(/<conversation_summary>/g) || [])
      .length
    expect(summaryTagCount).toBe(1)
  })

  test('drops old entries independently by role across compaction cycles', () => {
    const simulateCompaction = (
      inputMessages: Message[],
      budgets: { assistantToolBudget: number; userBudget: number },
    ): Message => {
      const result = runHandleSteps(inputMessages, 250000, 200000, budgets)
      return result[0].input.messages[0]
    }

    const tightBudgets = { assistantToolBudget: 25, userBudget: 25 }

    const cycle1Messages = [
      createMessage('user', 'Cycle1-Request-A'),
      createMessage('assistant', 'Cycle1-Response-A'),
      createMessage('user', 'Cycle1-Request-B'),
      createMessage('assistant', 'Cycle1-Response-B'),
      createMessage('user', 'Cycle1-Request-C'),
      createMessage('assistant', 'Cycle1-Response-C'),
    ]
    const summary1 = simulateCompaction(cycle1Messages, tightBudgets)
    const summary1Text = (summary1.content[0] as { type: 'text'; text: string })
      .text

    expect(summary1Text).toContain('Cycle1-Request-C')
    expect(summary1Text).toContain('Cycle1-Response-C')
    expect(summary1Text).toContain('Cycle1-Request-A')
    expect(summary1Text).not.toContain('Cycle1-Response-A')

    const cycle2Messages = [
      summary1,
      createMessage('user', 'Cycle2-Request-D'),
      createMessage('assistant', 'Cycle2-Response-D'),
    ]
    const summary2 = simulateCompaction(cycle2Messages, tightBudgets)
    const summary2Text = (summary2.content[0] as { type: 'text'; text: string })
      .text

    expect(summary2Text).toContain('Cycle2-Request-D')
    expect(summary2Text).toContain('Cycle2-Response-D')
    expect(summary2Text).not.toContain('Cycle1-Request-A')
    expect(summary2Text).not.toContain('Cycle1-Response-A')

    const cycle3Messages = [
      summary2,
      createMessage('user', 'Cycle3-Request-E'),
      createMessage('assistant', 'Cycle3-Response-E'),
    ]
    const summary3 = simulateCompaction(cycle3Messages, tightBudgets)
    const summary3Text = (summary3.content[0] as { type: 'text'; text: string })
      .text

    expect(summary3Text).toContain('Cycle3-Request-E')
    expect(summary3Text).toContain('Cycle3-Response-E')
    expect(summary3Text).not.toContain('Cycle1-Request-A')
    expect(summary3Text).not.toContain('Cycle1-Response-A')

    const summaryTagCount = (
      summary3Text.match(/<conversation_summary>/g) || []
    ).length
    expect(summaryTagCount).toBe(1)
  })

  test('keeps multi-part tool entries grouped across compaction cycles', () => {
    const simulateCompaction = (inputMessages: Message[]): Message => {
      const result = runHandleSteps(inputMessages, 250000, 200000)
      return result[0].input.messages[0]
    }

    const cycle1Messages: Message[] = [
      createMessage('user', 'Run tests'),
      createToolCallMessage('call-1', 'run_terminal_command', {
        command: 'npm test',
      }),
      createToolResultMessage('call-1', 'run_terminal_command', {
        errorMessage: 'Test suite failed',
        exitCode: 1,
      }),
      createMessage('user', 'Fix the tests'),
      createMessage('assistant', 'I will fix them'),
    ]

    const summary1 = simulateCompaction(cycle1Messages)
    const summary1Text = (summary1.content[0] as { type: 'text'; text: string })
      .text

    expect(summary1Text).toContain(
      'Tool error from run_terminal_command: Test suite failed',
    )
    expect(summary1Text).toContain('Command failed with exit code: 1')

    const cycle2Messages: Message[] = [
      summary1,
      createMessage('user', 'Try again'),
      createMessage('assistant', 'Running tests again'),
    ]
    const summary2 = simulateCompaction(cycle2Messages)
    const summary2Text = (summary2.content[0] as { type: 'text'; text: string })
      .text

    expect(summary2Text).toContain(
      'Tool error from run_terminal_command: Test suite failed',
    )
    expect(summary2Text).toContain('Command failed with exit code: 1')

    const separator = '\n\n---\n\n'
    const chunks = summary2Text
      .replace(/<conversation_summary>[\s\S]*?\n\n/, '')
      .replace(/<\/conversation_summary>[\s\S]*/, '')
      .split(separator)
    const errorChunk = chunks.find((c) => c.includes('Tool error from'))
    expect(errorChunk).toBeDefined()
    expect(errorChunk).toContain('Command failed with exit code: 1')
  })

  test('handles 3+ compaction cycles without nested PREVIOUS SUMMARY markers', () => {
    const simulateCompaction = (inputMessages: Message[]): Message => {
      const result = runHandleSteps(inputMessages, 250000, 200000)
      return result[0].input.messages[0]
    }

    const cycle1Messages = [
      createMessage('user', 'Cycle 1: User request about feature A'),
      createMessage('assistant', 'Cycle 1: I will help with feature A'),
    ]
    const summary1 = simulateCompaction(cycle1Messages)
    const summary1Text = (summary1.content[0] as { type: 'text'; text: string })
      .text

    expect(summary1Text).toContain('Cycle 1: User request about feature A')
    expect(summary1Text).toContain('Cycle 1: I will help with feature A')
    expect(summary1Text).not.toContain('[PREVIOUS SUMMARY]')

    const cycle2Messages = [
      summary1,
      createMessage('user', 'Cycle 2: Now work on feature B'),
      createMessage('assistant', 'Cycle 2: Starting feature B work'),
    ]
    const summary2 = simulateCompaction(cycle2Messages)
    const summary2Text = (summary2.content[0] as { type: 'text'; text: string })
      .text

    expect(summary2Text).toContain('Cycle 1: User request about feature A')
    expect(summary2Text).toContain('Cycle 2: Now work on feature B')

    const cycle3Messages = [
      summary2,
      createMessage('user', 'Cycle 3: Final feature C request'),
      createMessage('assistant', 'Cycle 3: Completing feature C'),
    ]
    const summary3 = simulateCompaction(cycle3Messages)
    const summary3Text = (summary3.content[0] as { type: 'text'; text: string })
      .text

    expect(summary3Text).toContain('Cycle 1: User request about feature A')
    expect(summary3Text).toContain('Cycle 2: Now work on feature B')
    expect(summary3Text).toContain('Cycle 3: Final feature C request')

    const cycle4Messages = [
      summary3,
      createMessage('user', 'Cycle 4: Additional request'),
      createMessage('assistant', 'Cycle 4: Final response'),
    ]
    const summary4 = simulateCompaction(cycle4Messages)
    const summary4Text = (summary4.content[0] as { type: 'text'; text: string })
      .text

    expect(summary4Text).toContain('Cycle 1: User request about feature A')
    expect(summary4Text).toContain('Cycle 2: Now work on feature B')
    expect(summary4Text).toContain('Cycle 3: Final feature C request')
    expect(summary4Text).toContain('Cycle 4: Additional request')

    const summaryTagCount = (
      summary4Text.match(/<conversation_summary>/g) || []
    ).length
    expect(summaryTagCount).toBe(1)
  })
})

describe('context-pruner image token counting', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (
    messages: Message[],
    contextTokenCount?: number,
    maxContextLength?: number,
  ) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount =
      contextTokenCount ?? Math.ceil(JSON.stringify(messages).length / 3)
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: maxContextLength ? { maxContextLength } : {},
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('does not over-count image tokens', () => {
    const largeBase64Image = 'x'.repeat(300000)

    const userMessageWithImage: Message = {
      role: 'user',
      content: [
        {
          type: 'image',
          image: largeBase64Image,
          mediaType: 'image/png',
        },
      ],
    }

    const results = runHandleSteps([userMessageWithImage], 1000, 200000)

    expect(results).toHaveLength(1)
    expect(results[0].input.messages).toHaveLength(1)
    expect(results[0].input.messages[0].content[0].type).toBe('image')
  })
})

describe('context-pruner threshold behavior', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (
    messages: Message[],
    contextTokenCount: number,
    maxContextLength: number,
    budgets?: { assistantToolBudget?: number; userBudget?: number },
  ) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = contextTokenCount
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength, ...budgets },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('does not prune when under max limit minus fudge factor', () => {
    const messages = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ]

    const results = runHandleSteps(messages, 199000, 200000)

    expect(results[0].input.messages).toHaveLength(2)
    expect(results[0].input.messages[0].role).toBe('user')
    expect(results[0].input.messages[1].role).toBe('assistant')
  })

  test('prunes when at max limit due to fudge factor', () => {
    const messages = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ]

    const results = runHandleSteps(messages, 200000, 200000)

    expect(results[0].input.messages).toHaveLength(1)
    expect(results[0].input.messages[0].content[0].text).toContain(
      '<conversation_summary>',
    )
  })
})

describe('context-pruner str_replace and write_file tool results', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (messages: Message[]) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = 250000
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 200000 },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('includes str_replace result in summary', () => {
    const messages = [
      createMessage('user', 'Edit this file'),
      createToolCallMessage('call-1', 'str_replace', {
        path: 'src/utils.ts',
        replacements: [{ old: 'foo', new: 'bar' }],
      }),
      createToolResultMessage('call-1', 'str_replace', {
        file: 'src/utils.ts',
        message: 'Updated file',
        unifiedDiff:
          '--- a/src/utils.ts\n+++ b/src/utils.ts\n@@ -1,1 +1,1 @@\n-foo\n+bar',
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Edit result from str_replace:')
    expect(content).toContain('unifiedDiff')
    expect(content).toContain('-foo')
    expect(content).toContain('+bar')
  })

  test('includes write_file result in summary', () => {
    const messages = [
      createMessage('user', 'Create a new file'),
      createToolCallMessage('call-1', 'write_file', {
        path: 'src/new-file.ts',
        content: 'export const hello = "world"',
      }),
      createToolResultMessage('call-1', 'write_file', {
        file: 'src/new-file.ts',
        message: 'Created file',
        unifiedDiff:
          '--- /dev/null\n+++ b/src/new-file.ts\n@@ -0,0 +1 @@\n+export const hello = "world"',
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Edit result from write_file:')
    expect(content).toContain('export const hello')
  })

  test('truncates very long str_replace results', () => {
    const longDiff = 'X'.repeat(3000)
    const messages = [
      createMessage('user', 'Make big changes'),
      createToolCallMessage('call-1', 'str_replace', {
        path: 'src/big-file.ts',
        replacements: [],
      }),
      createToolResultMessage('call-1', 'str_replace', {
        file: 'src/big-file.ts',
        message: 'Updated file',
        unifiedDiff: longDiff,
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('Edit result from str_replace:')
    expect(content).toContain('...')
    expect(content).not.toContain(longDiff)
  })

  test('truncates very large tool entries to 5k token limit', () => {
    const largeAgentResults = Array.from({ length: 5 }, (_, i) => ({
      agentType: `editor`,
      value: {
        type: 'string',
        value: `AGENT_${i}_START_` + 'X'.repeat(4000) + `_AGENT_${i}_END`,
      },
    }))

    const messages: Message[] = [
      createMessage('user', 'Spawn many agents'),
      createToolCallMessage('call-1', 'spawn_agents', {
        agents: [
          { agent_type: 'editor' },
          { agent_type: 'editor' },
          { agent_type: 'editor' },
          { agent_type: 'editor' },
          { agent_type: 'editor' },
        ],
      }),
      {
        role: 'tool',
        toolCallId: 'call-1',
        toolName: 'spawn_agents',
        content: [{ type: 'json', value: largeAgentResults }],
      } as ToolMessage,
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('[...truncated')
    expect(content).not.toContain('AGENT_4_START_')
    expect(content).toContain('AGENT_0_START_')
  })

  test('includes all result properties even without unifiedDiff', () => {
    const messages = [
      createMessage('user', 'Edit file'),
      createToolCallMessage('call-1', 'str_replace', {
        path: 'src/file.ts',
        replacements: [],
      }),
      createToolResultMessage('call-1', 'str_replace', {
        file: 'src/file.ts',
        errorMessage: 'No match found for old string',
      }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('edited file: src/file.ts')
    expect(content).toContain('Edit result from str_replace:')
    expect(content).toContain('errorMessage')
    expect(content).toContain('No match found for old string')
  })
})

describe('context-pruner glob and list_directory tools', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (messages: Message[]) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = 50000
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength: 10000 },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('summarizes glob tool with pattern', () => {
    const messages = [
      createMessage('user', 'Find files'),
      createToolCallMessage('call-1', 'glob', {
        pattern: '**/*.ts',
      }),
      createToolResultMessage('call-1', 'glob', { files: [] }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('glob search for **/*.ts')
  })

  test('summarizes list_directory tool with path', () => {
    const messages = [
      createMessage('user', 'List directories'),
      createToolCallMessage('call-1', 'list_directory', {
        path: 'src',
      }),
      createToolResultMessage('call-1', 'list_directory', { entries: [] }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('listed directory: src')
  })

  test('summarizes read_subtree tool with paths', () => {
    const messages = [
      createMessage('user', 'Read subtree'),
      createToolCallMessage('call-1', 'read_subtree', {
        paths: ['src/components', 'src/utils'],
      }),
      createToolResultMessage('call-1', 'read_subtree', { tree: {} }),
    ]

    const results = runHandleSteps(messages)
    const content = results[0].input.messages[0].content[0].text

    expect(content).toContain('inspected subtrees: src/components, src/utils')
  })
})

describe('context-pruner dual-budget behavior', () => {
  let mockAgentState: AgentState

  beforeEach(() => {
    mockAgentState = createMockAgentState([], 0)
  })

  const runHandleSteps = (
    messages: Message[],
    contextTokenCount: number,
    maxContextLength: number,
    budgets?: { assistantToolBudget?: number; userBudget?: number },
  ) => {
    mockAgentState.messageHistory = messages
    mockAgentState.contextTokenCount = contextTokenCount
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const generator = contextPruner.handleSteps!({
      agentState: mockAgentState,
      logger: mockLogger,
      params: { maxContextLength, ...budgets },
    })
    const results: any[] = []
    let result = generator.next()
    while (!result.done) {
      if (typeof result.value === 'object') {
        results.push(result.value)
      }
      result = generator.next()
    }
    return results
  }

  test('includes recent messages in summary and drops older ones', () => {
    const messages = [
      createMessage('user', 'Old user message 1'),
      createMessage('assistant', 'Old assistant response 1'),
      createMessage('user', 'Old user message 2'),
      createMessage('assistant', 'Old assistant response 2'),
      createMessage('user', 'Recent user message'),
      createMessage('assistant', 'Recent assistant response'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 15,
      userBudget: 15,
    })

    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('<conversation_summary>')

    expect(content).toContain('Recent user message')
    expect(content).toContain('Recent assistant response')

    expect(content).not.toContain('Old user message 1')
    expect(content).not.toContain('Old assistant response 1')
    expect(content).not.toContain('Old user message 2')
    expect(content).not.toContain('Old assistant response 2')
  })

  test('summarizes all messages when they fit within budgets', () => {
    const messages = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi there!'),
      createMessage('user', 'How are you?'),
      createMessage('assistant', 'I am fine!'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 20000,
      userBudget: 50000,
    })

    const resultMessages = results[0].input.messages

    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('Hello')
    expect(content).toContain('Hi there!')
    expect(content).toContain('How are you?')
    expect(content).toContain('I am fine!')
  })

  test('respects user budget separately from assistant+tool budget', () => {
    const largeUserText = 'U'.repeat(600)
    const messages = [
      createMessage('user', largeUserText),
      createMessage('assistant', 'Short response'),
      createMessage('user', 'Recent short question'),
      createMessage('assistant', 'Recent short answer'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 5000,
      userBudget: 100,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('<conversation_summary>')
    expect(content).not.toContain(largeUserText)
    expect(content).toContain('Recent short question')
    expect(content).toContain('Recent short answer')
  })

  test('keeps older user prompts when assistant+tool budget is exhausted', () => {
    const importantUserPrompt =
      'SSH connection: host=prod.example, user=deploy, key=~/.ssh/prod'
    const messages = [
      createMessage('user', importantUserPrompt),
      createMessage('assistant', 'A'.repeat(600)),
      createMessage('user', 'Recent short question'),
      createMessage('assistant', 'Recent short answer'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 100,
      userBudget: 5000,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain(importantUserPrompt)
    expect(content).toContain('Recent short question')
    expect(content).toContain('Recent short answer')
    expect(content).not.toContain('A'.repeat(600))
  })

  test('always keeps the newest entry when it alone exceeds its role budget', () => {
    const newestAssistant = 'LATEST_ASSISTANT_' + 'A'.repeat(600)
    const assistantResults = runHandleSteps(
      [
        createMessage('user', 'Older user prompt'),
        createMessage('assistant', newestAssistant),
      ],
      250000,
      200000,
      { assistantToolBudget: 100, userBudget: 5000 },
    )
    const assistantSummary = (
      assistantResults[0].input.messages[0].content[0] as { text: string }
    ).text

    expect(assistantSummary).toContain('Older user prompt')
    expect(assistantSummary).toContain(newestAssistant)

    const newestUser = 'LATEST_USER_' + 'U'.repeat(600)
    const userResults = runHandleSteps(
      [
        createMessage('assistant', 'Older assistant response'),
        createMessage('user', newestUser),
      ],
      250000,
      200000,
      { assistantToolBudget: 5000, userBudget: 100 },
    )
    const userSummary = (
      userResults[0].input.messages[0].content[0] as { text: string }
    ).text

    expect(userSummary).toContain('Older assistant response')
    expect(userSummary).toContain(newestUser)
  })

  test('drops tool entries beyond budget at the cutoff boundary', () => {
    const messages = [
      createMessage('user', 'Old message'),
      createToolCallMessage('call-1', 'read_files', { paths: ['old.ts'] }),
      createToolResultMessage('call-1', 'read_files', { content: 'old file' }),
      createMessage('user', 'Recent message'),
      createMessage('assistant', 'Recent response'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 15,
      userBudget: 15,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text

    expect(content).toContain('Recent message')
    expect(content).toContain('Recent response')

    expect(content).not.toContain('old.ts')
  })

  test('counts tool result summaries against assistant+tool budget', () => {
    const largeDiff = 'LARGE_DIFF_CONTENT_' + 'X'.repeat(900)
    const messages = [
      createMessage('user', 'Do something'),
      createToolCallMessage('call-1', 'str_replace', {
        path: 'big.ts',
        replacements: [],
      }),
      createToolResultMessage('call-1', 'str_replace', {
        file: 'big.ts',
        message: 'Updated',
        unifiedDiff: largeDiff,
      }),
      createMessage('user', 'Recent question'),
      createMessage('assistant', 'Recent answer'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 100,
      userBudget: 5000,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('<conversation_summary>')
    expect(content).toContain('Recent question')
    expect(content).toContain('Recent answer')
    expect(content).not.toContain('LARGE_DIFF_CONTENT_')
  })

  test('drops older messages and includes recent ones in summary', () => {
    const messages = [
      createMessage('user', 'First request about feature A'),
      createMessage('assistant', 'Working on feature A'),
      createMessage('user', 'Second request about feature B'),
      createMessage('assistant', 'Working on feature B'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 15,
      userBudget: 15,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('<conversation_summary>')

    expect(content).toContain('Second request about feature B')
    expect(content).toContain('Working on feature B')

    expect(content).not.toContain('First request about feature A')
    expect(content).not.toContain('Working on feature A')
  })

  test('excludes STEP_PROMPT tagged messages from budget calculation', () => {
    const largeStepPrompt = 'S'.repeat(900)
    const messages: Message[] = [
      createMessage('user', 'User request'),
      createMessage('assistant', 'Assistant response'),
      {
        role: 'user',
        content: [{ type: 'text', text: largeStepPrompt }],
        tags: ['STEP_PROMPT'],
      },
      createMessage('user', 'Recent question'),
      createMessage('assistant', 'Recent answer'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 200,
      userBudget: 200,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('User request')
    expect(content).toContain('Assistant response')
    expect(content).toContain('Recent question')
    expect(content).toContain('Recent answer')
    expect(content).not.toContain(largeStepPrompt)
  })

  test('excludes SUBAGENT_SPAWN tagged messages from budget calculation', () => {
    const messages: Message[] = [
      createMessage('user', 'User request'),
      createMessage('assistant', 'First response'),
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'A'.repeat(900) }],
        tags: ['SUBAGENT_SPAWN'],
      },
      createMessage('user', 'Follow up'),
      createMessage('assistant', 'Second response'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 200,
      userBudget: 200,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('User request')
    expect(content).toContain('First response')
    expect(content).toContain('Follow up')
    expect(content).toContain('Second response')
  })

  test('charges old summary entries against their correct budgets', () => {
    const largeUserContent = 'X'.repeat(900)
    const previousSummary: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<conversation_summary>\nThis is a summary of the conversation so far. The original messages have been condensed to save context space.\n\n[USER]\n${largeUserContent}\n\n---\n\n[ASSISTANT]\nOld assistant response\n</conversation_summary>`,
        },
      ],
    }

    const messages: Message[] = [
      previousSummary,
      createMessage('user', 'After summary request'),
      createMessage('assistant', 'After summary response'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 5000,
      userBudget: 50,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('After summary request')
    expect(content).toContain('After summary response')
    expect(content).toContain('Old assistant response')
    expect(content).not.toContain(largeUserContent)
  })

  test('applies old summary entry budgets independently by role', () => {
    const previousSummary: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<conversation_summary>\nThis is a summary of the conversation so far. The original messages have been condensed to save context space.\n\n[USER]\nOLDEST_USER_ENTRY\n\n---\n\n[ASSISTANT]\nOLDEST_ASSISTANT_ENTRY\n\n---\n\n[USER]\nMIDDLE_USER_ENTRY\n\n---\n\n[ASSISTANT]\nMIDDLE_ASSISTANT_ENTRY\n</conversation_summary>`,
        },
      ],
    }

    const messages: Message[] = [
      previousSummary,
      createMessage('user', 'Recent request'),
      createMessage('assistant', 'Recent response'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 25,
      userBudget: 25,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('MIDDLE_USER_ENTRY')
    expect(content).toContain('MIDDLE_ASSISTANT_ENTRY')
    expect(content).toContain('Recent request')
    expect(content).toContain('Recent response')
    expect(content).toContain('OLDEST_USER_ENTRY')
    expect(content).not.toContain('OLDEST_ASSISTANT_ENTRY')
  })

  test('handles complex scenario with long messages of all types and previous summary', () => {
    const previousSummary: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<conversation_summary>\nThis is a summary of the conversation so far. The original messages have been condensed to save context space.\n\n[USER]\nOLD_USER_REQUEST_1: The user asked about setting up authentication with OAuth2 and JWT tokens for the API.\n\n---\n\n[ASSISTANT]\nOLD_ASSISTANT_RESPONSE_1: Explained OAuth2 flow and implemented JWT token generation.\nTools: Read files: src/auth.ts, src/middleware.ts; Edited file: src/auth.ts\n\n---\n\n[USER]\nOLD_USER_REQUEST_2: Asked for unit tests for the auth module.\n\n---\n\n[ASSISTANT]\nOLD_ASSISTANT_RESPONSE_2: Created comprehensive test suite for authentication.\nTools: Wrote file: src/__tests__/auth.test.ts\n</conversation_summary>`,
        },
      ],
    }

    const longUserMessage =
      'LONG_USER_START_' +
      'Here is a detailed specification for the new feature. '.repeat(650) +
      '_LONG_USER_MIDDLE_MARKER_' +
      'Here is a detailed specification for the new feature. '.repeat(150)

    const longAssistantText =
      'LONG_ASSISTANT_START_' +
      'I will implement this step by step, starting with the data model changes. '.repeat(
        60,
      ) +
      '_LONG_ASST_MIDDLE_MARKER_' +
      'I will implement this step by step, starting with the data model changes. '.repeat(
        40,
      )
    const assistantWithToolCalls: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: longAssistantText },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'read_files',
          input: { paths: ['src/model.ts', 'src/service.ts'] },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'str_replace',
          input: { path: 'src/model.ts', replacements: [] },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-3',
          toolName: 'spawn_agents',
          input: {
            agents: [
              { agent_type: 'editor' },
              { agent_type: 'editor' },
              { agent_type: 'editor' },
              { agent_type: 'editor' },
              { agent_type: 'editor' },
            ],
          },
        },
      ],
    }

    const largeDiff =
      'DIFF_START_MARKER_' + '+added line\n'.repeat(250) + '_DIFF_END_MARKER'

    const largeAgentResults = Array.from({ length: 5 }, (_, i) => ({
      agentType: 'editor',
      value: {
        type: 'string',
        value:
          `AGENT_${i}_OUTPUT_START_` +
          'Implementation details. '.repeat(160) +
          `_AGENT_${i}_OUTPUT_END`,
      },
    }))

    const messages: Message[] = [
      previousSummary,
      createMessage('user', longUserMessage),
      assistantWithToolCalls,
      createToolResultMessage('call-1', 'read_files', {
        content: 'file data',
      } as JSONValue),
      createToolResultMessage('call-2', 'str_replace', {
        file: 'src/model.ts',
        message: 'Updated',
        unifiedDiff: largeDiff,
      }),
      {
        role: 'tool',
        toolCallId: 'call-3',
        toolName: 'spawn_agents',
        content: [{ type: 'json', value: largeAgentResults }],
      } as ToolMessage,
      createMessage('user', 'FINAL_USER_REQUEST: Now run the tests'),
      createMessage('assistant', 'FINAL_ASSISTANT_RESPONSE: Running tests now'),
    ]

    const results = runHandleSteps(messages, 250000, 200000)
    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text

    expect(content).toContain('<conversation_summary>')
    expect(content).toContain('</conversation_summary>')
    const summaryTagCount = (content.match(/<conversation_summary>/g) || [])
      .length
    expect(summaryTagCount).toBe(1)

    expect(content).toContain('OLD_USER_REQUEST_1')
    expect(content).toContain('OLD_ASSISTANT_RESPONSE_1')
    expect(content).toContain('OLD_USER_REQUEST_2')
    expect(content).toContain('OLD_ASSISTANT_RESPONSE_2')

    expect(content).toContain('LONG_USER_START_')
    expect(content).not.toContain('_LONG_USER_MIDDLE_MARKER_')
    expect(content).toContain('[...truncated')

    expect(content).toContain('LONG_ASSISTANT_START_')
    expect(content).not.toContain('_LONG_ASST_MIDDLE_MARKER_')

    expect(content).toContain('inspected files: src/model.ts, src/service.ts')
    expect(content).toContain('edited file: src/model.ts')
    expect(content).toContain('delegated agents:')

    expect(content).toContain('Edit result from str_replace:')
    expect(content).toContain('DIFF_START_MARKER_')
    expect(content).not.toContain('_DIFF_END_MARKER')

    expect(content).toContain('AGENT_0_OUTPUT_START_')
    expect(content).not.toContain('AGENT_4_OUTPUT_START_')

    expect(content).toContain('FINAL_USER_REQUEST')
    expect(content).toContain('FINAL_ASSISTANT_RESPONSE')

    expect(content).toContain('---')
  })

  test('with tight budgets, drops old summary entries while keeping truncated new entries', () => {
    const previousSummary: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<conversation_summary>\nThis is a summary of the conversation so far. The original messages have been condensed to save context space.\n\n[USER]\nOLD_DROPPED_USER: ${'X'.repeat(600)}\n\n---\n\n[ASSISTANT]\nOLD_DROPPED_ASSISTANT: ${'Y'.repeat(600)}\n\n---\n\n[USER]\nOLD_RETAINED_USER_2: Asked about deployment\n\n---\n\n[ASSISTANT]\nOLD_DROPPED_ASSISTANT_2: ${'Explained deployment process. '.repeat(80)}\n</conversation_summary>`,
        },
      ],
    }

    const longUserMessage =
      'SURVIVED_USER_START_' +
      'Feature request details. '.repeat(400) +
      '_SURVIVED_USER_END'

    const assistantMsg: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'SURVIVED_ASSISTANT: Working on it' },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'str_replace',
          input: { path: 'src/app.ts', replacements: [] },
        },
      ],
    }

    const toolResult = createToolResultMessage('call-1', 'str_replace', {
      file: 'src/app.ts',
      message: 'Updated file',
      unifiedDiff:
        '--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+SURVIVED_DIFF_CONTENT',
    })

    const messages: Message[] = [
      previousSummary,
      createMessage('user', longUserMessage),
      assistantMsg,
      toolResult,
      createMessage('user', 'SURVIVED_FINAL_USER'),
      createMessage('assistant', 'SURVIVED_FINAL_ASSISTANT'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 400,
      userBudget: 3400,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text

    expect(content).toContain('SURVIVED_USER_START_')
    expect(content).toContain('SURVIVED_ASSISTANT')
    expect(content).toContain('SURVIVED_DIFF_CONTENT')
    expect(content).toContain('SURVIVED_FINAL_USER')
    expect(content).toContain('SURVIVED_FINAL_ASSISTANT')

    expect(content).not.toContain('OLD_DROPPED_USER:')
    expect(content).not.toContain('OLD_DROPPED_ASSISTANT:')
    expect(content).toContain('OLD_RETAINED_USER_2:')
    expect(content).not.toContain('OLD_DROPPED_ASSISTANT_2:')
  })

  test('fully includes conversation summary when it fits within user budget', () => {
    const previousSummary: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<conversation_summary>\nThis is a summary of the conversation so far. The original messages have been condensed to save context space.\n\n[USER]\nOld request about feature A\n\n---\n\n[ASSISTANT]\nWorked on feature A\n</conversation_summary>`,
        },
      ],
    }

    const messages: Message[] = [
      previousSummary,
      createMessage('user', 'New request about feature B'),
      createMessage('assistant', 'Working on feature B'),
    ]

    const results = runHandleSteps(messages, 250000, 200000, {
      assistantToolBudget: 20000,
      userBudget: 50000,
    })

    const resultMessages = results[0].input.messages
    expect(resultMessages).toHaveLength(1)

    const content = (resultMessages[0].content[0] as { text: string }).text
    expect(content).toContain('Old request about feature A')
    expect(content).toContain('Worked on feature A')
    expect(content).toContain('New request about feature B')
    expect(content).toContain('Working on feature B')
  })
})
