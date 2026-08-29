import { API_KEY_ENV_VAR } from '@rivocode/common/old-constants'
import {
  CodebuffClient,
  initialSessionState,
  withMessageHistory,
  type AgentDefinition,
  type Message,
  type ToolMessage,
  type JSONValue,
} from '@rivocode/sdk'
import { describe, expect, it } from 'bun:test'

import type { ToolCallPart } from '@rivocode/common/types/messages/content-part'

function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'tool-call' &&
    'toolCallId' in part &&
    typeof (part as ToolCallPart).toolCallId === 'string'
  )
}

function isToolMessageWithId(
  msg: Message,
): msg is ToolMessage & { toolCallId: string } {
  return (
    msg.role === 'tool' &&
    'toolCallId' in msg &&
    typeof msg.toolCallId === 'string'
  )
}
describe('Context Pruner Agent Integration', () => {
  const createMessage = (
    role: 'user' | 'assistant',
    content: string,
  ): Message => ({
    role,
    content: [{ type: 'text', text: content }],
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
    content: [{ type: 'json', value }],
  })

  it(
    'should prune large message history and maintain tool-call/tool-result pairs',
    async () => {
      const apiKey = process.env[API_KEY_ENV_VAR]!

      const testAgent: AgentDefinition = {
        id: 'context-pruner-test-agent',
        displayName: 'Context Pruner Test Agent',
        model: 'anthropic/claude-haiku-4.5',
        includeMessageHistory: true,
        toolNames: ['spawn_agents'],
        spawnableAgents: ['context-pruner'],
        instructionsPrompt: `You are a test agent. Your job is to:
1. First, spawn the context-pruner agent to prune the message history
2. After context-pruner completes, respond with "PRUNING_COMPLETE" followed by a count of how many messages remain in the conversation

Do not do anything else. Just spawn context-pruner and then report the result.`,
        handleSteps: function* () {
          yield {
            toolName: 'spawn_agents',
            input: {
              agents: [
                {
                  agent_type: 'context-pruner',
                  params: {
                    maxContextLength: 50000,
                  },
                },
              ],
            },
          }
          yield 'STEP'
        },
      }

      const largeContent = 'x'.repeat(20000)
      const initialMessages: Message[] = [
        createMessage('user', `First message: ${largeContent}`),
        createMessage('assistant', `Response 1: ${largeContent}`),
        createMessage('user', `Second message: ${largeContent}`),
        createToolCallMessage('call-1', 'read_files', { paths: ['test.ts'] }),
        createToolResultMessage('call-1', 'read_files', {
          content: 'file content',
        }),
        createMessage('user', `Third message: ${largeContent}`),
        createMessage('assistant', `Response 2: ${largeContent}`),
        createToolCallMessage('call-2', 'code_search', { pattern: 'test' }),
        createToolResultMessage('call-2', 'code_search', { results: [] }),
        createMessage('user', `Fourth message: ${largeContent}`),
        createMessage('assistant', `Response 3: ${largeContent}`),
        createMessage('user', 'Now spawn the context-pruner'),
      ]

      const client = new CodebuffClient({
        apiKey,
        agentDefinitions: [testAgent],
      })

      const sessionState = await initialSessionState({})
      const runStateWithMessages = withMessageHistory({
        runState: {
          traceSessionId: 'test-trace-session',
          sessionState,
          output: { type: 'error', message: '' },
        },
        messages: initialMessages,
      })

      const run = await client.run({
        agent: 'context-pruner-test-agent',
        prompt: '',
        previousRun: runStateWithMessages,
        handleEvent: (event) => {
          if (event.type === 'text') {
            console.log('Agent text:', event.text)
          }
        },
      })

      if (run.output.type === 'error') {
        console.error('Test 1 Error:', JSON.stringify(run.output, null, 2))
      }
      expect(run.output.type).not.toEqual('error')

      const finalMessages =
        run.sessionState?.mainAgentState.messageHistory ?? []

      const toolCallIds = new Set<string>()
      for (const msg of finalMessages) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (isToolCallPart(part)) {
              toolCallIds.add(part.toolCallId)
            }
          }
        }
      }

      const toolResultIds = new Set<string>()
      for (const msg of finalMessages) {
        if (isToolMessageWithId(msg)) {
          toolResultIds.add(msg.toolCallId)
        }
      }

      for (const resultId of toolResultIds) {
        expect(toolCallIds.has(resultId)).toBe(true)
      }

      for (const callId of toolCallIds) {
        expect(toolResultIds.has(callId)).toBe(true)
      }

      console.log('Tool call IDs:', [...toolCallIds])
      console.log('Tool result IDs:', [...toolResultIds])
      console.log(
        'All tool-call/tool-result pairs are intact:',
        toolCallIds.size === toolResultIds.size,
      )
    },
    { timeout: 120_000 },
  )

  it(
    'should prune context with small token limit and preserve tool pairs',
    async () => {
      const apiKey = process.env[API_KEY_ENV_VAR]!

      const testAgent: AgentDefinition = {
        id: 'aggressive-prune-test-agent',
        displayName: 'Aggressive Prune Test Agent',
        model: 'anthropic/claude-haiku-4.5',
        includeMessageHistory: true,
        toolNames: ['spawn_agents'],
        spawnableAgents: ['context-pruner'],
        instructionsPrompt: `Spawn context-pruner and then say "DONE".`,
        handleSteps: function* () {
          yield {
            toolName: 'spawn_agents',
            input: {
              agents: [
                {
                  agent_type: 'context-pruner',
                  params: {
                    maxContextLength: 10000,
                  },
                },
              ],
            },
          }
          yield 'STEP'
        },
      }

      const largeContent = 'y'.repeat(5000)
      const initialMessages: Message[] = [
        createMessage('user', `Start: ${largeContent}`),
        createMessage('assistant', `Response: ${largeContent}`),
        createToolCallMessage('pair-1', 'read_files', { paths: ['a.ts'] }),
        createToolResultMessage('pair-1', 'read_files', {
          content: largeContent,
        }),
        createMessage('user', `More: ${largeContent}`),
        createToolCallMessage('pair-2', 'code_search', { pattern: 'foo' }),
        createToolResultMessage('pair-2', 'code_search', {
          results: [largeContent],
        }),
        createMessage('user', 'Now prune the context'),
      ]

      const client = new CodebuffClient({
        apiKey,
        agentDefinitions: [testAgent],
      })

      const sessionState = await initialSessionState({})
      const runStateWithMessages = withMessageHistory({
        runState: {
          traceSessionId: 'test-trace-session',
          sessionState,
          output: { type: 'error', message: '' },
        },
        messages: initialMessages,
      })

      const run = await client.run({
        agent: 'aggressive-prune-test-agent',
        prompt: '',
        previousRun: runStateWithMessages,
        handleEvent: (event) => {
          if (event.type === 'text') {
            console.log('Agent text:', event.text)
          }
        },
      })

      if (run.output.type === 'error') {
        console.error('Test 2 Error:', JSON.stringify(run.output, null, 2))
      }
      expect(run.output.type).not.toEqual('error')

      const finalMessages =
        run.sessionState?.mainAgentState.messageHistory ?? []

      const toolCallIds = new Set<string>()
      const toolResultIds = new Set<string>()

      for (const msg of finalMessages) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (isToolCallPart(part)) {
              toolCallIds.add(part.toolCallId)
            }
          }
        }
        if (isToolMessageWithId(msg)) {
          toolResultIds.add(msg.toolCallId)
        }
      }

      console.log('Final tool call IDs:', [...toolCallIds])
      console.log('Final tool result IDs:', [...toolResultIds])

      for (const resultId of toolResultIds) {
        expect(toolCallIds.has(resultId)).toBe(true)
      }

      for (const callId of toolCallIds) {
        expect(toolResultIds.has(callId)).toBe(true)
      }
    },
    { timeout: 60_000 },
  )
})
