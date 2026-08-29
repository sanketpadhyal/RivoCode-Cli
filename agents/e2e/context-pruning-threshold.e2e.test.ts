
import { API_KEY_ENV_VAR } from '@codebuff/common/old-constants'
import {
  CodebuffClient,
  initialSessionState,
  withMessageHistory,
  type AgentDefinition,
  type Message,
  type ToolMessage,
  type JSONValue,
} from '@codebuff/sdk'
import { describe, expect, it } from 'bun:test'

import contextPruner from '../context-pruner'

import type { ToolCallPart } from '@codebuff/common/types/messages/content-part'

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

const testAgent: AgentDefinition = {
  id: 'context-pruning-threshold-test-agent',
  displayName: 'Context Pruning Threshold Test Agent',
  model: 'anthropic/claude-haiku-4.5',
  includeMessageHistory: true,
  toolNames: ['spawn_agents'],
  spawnableAgents: ['context-pruner'],
  instructionsPrompt: `You are a test agent for verifying context pruning behavior. When the user asks you to do something, do it briefly and concisely. Just say "OK" or "DONE" as requested.`,
  handleSteps: function* ({ params }) {
    while (true) {
      yield {
        toolName: 'spawn_agent_inline',
        input: {
          agent_type: 'context-pruner',
          params: params ?? {},
        },
        includeToolCall: false,
      } as any

      const { stepsComplete } = yield 'STEP'
      if (stepsComplete) break
    }
  },
}

const LARGE_CONTENT_SIZE = 8_000
const CHARS_PER_TOKEN = 4
const TOOL_PAIR_TOKENS = 550
const TOKENS_PER_ROUND = Math.ceil(
  (2 * LARGE_CONTENT_SIZE) / CHARS_PER_TOKEN + TOOL_PAIR_TOKENS,
)

const WORD_FILLER =
  'alpha bravo charlie delta echo foxtrot golf hotel india juliett kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu '

function makeLargeContent(prefix: string, size: number): string {
  const repeats = Math.ceil((size - prefix.length) / WORD_FILLER.length)
  return prefix + WORD_FILLER.repeat(repeats).slice(0, size - prefix.length)
}

function buildMessageHistory(targetApproxTokens: number): Message[] {
  const messages: Message[] = []
  const roundsNeeded = Math.max(1, Math.ceil(targetApproxTokens / TOKENS_PER_ROUND))
  const now = Date.now()

  console.log(
    `  Building ${roundsNeeded} rounds for ~${targetApproxTokens} tokens ` +
    `(est ${TOKENS_PER_ROUND} tokens/round)`,
  )

  for (let i = 0; i < roundsNeeded; i++) {
    const sentAt = now - (roundsNeeded - i) * 30_000

    const userMsg = createMessage(
      'user',
      makeLargeContent(`Round ${i + 1}: `, LARGE_CONTENT_SIZE),
    )
    userMsg.sentAt = sentAt
    messages.push(userMsg)

    const assistantMsg = createMessage(
      'assistant',
      makeLargeContent(`Response ${i + 1}: `, LARGE_CONTENT_SIZE),
    )
    assistantMsg.sentAt = sentAt + 10_000
    messages.push(assistantMsg)

    if (i % 2 === 0) {
      const callId = `call-${i}`
      messages.push(
        createToolCallMessage(callId, 'read_files', { paths: [`file-${i}.ts`] }),
      )
      messages.push(
        createToolResultMessage(callId, 'read_files', {
          content: makeLargeContent('', LARGE_CONTENT_SIZE / 2),
        }),
      )
    }
  }

  return messages
}

function detectPruning(
  finalMessages: Message[],
  originalMessageCount: number,
): {
  wasPruned: boolean
  hasSummary: boolean
  hasTrimFallback: boolean
  messageReduction: number
} {
  const hasSummary = finalMessages.some((msg) => {
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return false
    return msg.content.some(
      (part) =>
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'text' &&
        typeof (part as any).text === 'string' &&
        (part as any).text.includes('<conversation_summary>'),
    )
  })

  const hasTrimFallback = finalMessages.some((msg) => {
    if (!Array.isArray(msg.content)) return false
    return msg.content.some(
      (part) =>
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'text' &&
        typeof (part as any).text === 'string' &&
        (part as any).text.includes('Previous message(s) omitted'),
    )
  })

  const messageReduction =
    originalMessageCount > 0
      ? 1 - finalMessages.length / originalMessageCount
      : 0

  const wasPruned =
    hasSummary || hasTrimFallback || messageReduction > 0.5

  return { wasPruned, hasSummary, hasTrimFallback, messageReduction }
}

function verifyToolCallPairIntegrity(messages: Message[]) {
  const toolCallIds = new Set<string>()
  const toolResultIds = new Set<string>()

  for (const msg of messages) {
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

  for (const resultId of toolResultIds) {
    expect(toolCallIds.has(resultId)).toBe(true)
  }
  for (const callId of toolCallIds) {
    expect(toolResultIds.has(callId)).toBe(true)
  }
}

describe('Context Pruning Threshold E2E', () => {
  it(
    'should NOT prune when token count is well below the limit',
    async () => {
      const apiKey = process.env[API_KEY_ENV_VAR]!
      if (!apiKey) {
        console.log('Skipping: No API key found')
        return
      }

      const messages = buildMessageHistory(30_000)

      const client = new CodebuffClient({
        apiKey,
        agentDefinitions: [testAgent, contextPruner],
      })

      const sessionState = await initialSessionState({})
      const runStateWithMessages = withMessageHistory({
        runState: {
          traceSessionId: 'test-trace-session',
          sessionState,
          output: { type: 'error', message: '' },
        },
        messages,
      })

      const run = await client.run({
        agent: testAgent.id,
        prompt: 'Say "OK" and nothing else.',
        previousRun: runStateWithMessages,
        params: { maxContextLength: 100_000 },
        handleEvent: (event) => {
          if (event.type === 'text') {
            console.log('  [below-limit] Agent text:', event.text.slice(0, 100))
          }
        },
      })

      if (run.output.type === 'error') {
        console.error('Below-limit test error:', JSON.stringify(run.output, null, 2))
      }
      expect(run.output.type).not.toEqual('error')

      const finalMessages =
        run.sessionState?.mainAgentState.messageHistory ?? []
      const tokenCount = run.sessionState?.mainAgentState.contextTokenCount ?? 0
      const pruningResult = detectPruning(finalMessages, messages.length)

      console.log('  [below-limit] Token count:', tokenCount)
      console.log(
        '  [below-limit] Message count:',
        finalMessages.length,
        '(original:',
        messages.length,
        ')',
      )
      console.log('  [below-limit] Pruning result:', pruningResult)

      expect(pruningResult.wasPruned).toBe(false)

      expect(tokenCount).toBeLessThan(100_000)

      expect(tokenCount).toBeGreaterThan(10_000)
      expect(tokenCount).toBeLessThan(80_000)
    },
    { timeout: 120_000 },
  )

  it(
    'should prune when token count exceeds the limit',
    async () => {
      const apiKey = process.env[API_KEY_ENV_VAR]!
      if (!apiKey) {
        console.log('Skipping: No API key found')
        return
      }

      const messages = buildMessageHistory(80_000)

      const client = new CodebuffClient({
        apiKey,
        agentDefinitions: [testAgent, contextPruner],
      })

      const sessionState = await initialSessionState({})
      const runStateWithMessages = withMessageHistory({
        runState: {
          traceSessionId: 'test-trace-session',
          sessionState,
          output: { type: 'error', message: '' },
        },
        messages,
      })

      const run = await client.run({
        agent: testAgent.id,
        prompt: 'Say "DONE" and nothing else.',
        previousRun: runStateWithMessages,
        params: { maxContextLength: 50_000 },
        handleEvent: (event) => {
          if (event.type === 'text') {
            console.log('  [above-limit] Agent text:', event.text.slice(0, 100))
          }
        },
      })

      if (run.output.type === 'error') {
        console.error('Above-limit test error:', JSON.stringify(run.output, null, 2))
      }
      expect(run.output.type).not.toEqual('error')

      const finalMessages =
        run.sessionState?.mainAgentState.messageHistory ?? []
      const tokenCount = run.sessionState?.mainAgentState.contextTokenCount ?? 0
      const pruningResult = detectPruning(finalMessages, messages.length)

      console.log('  [above-limit] Token count:', tokenCount)
      console.log(
        '  [above-limit] Message count:',
        finalMessages.length,
        '(original:',
        messages.length,
        ')',
      )
      console.log('  [above-limit] Pruning result:', pruningResult)

      expect(pruningResult.wasPruned).toBe(true)

      expect(finalMessages.length).toBeLessThan(messages.length)

      verifyToolCallPairIntegrity(finalMessages)

    },
    { timeout: 180_000 },
  )

  it(
    'should verify token counting accuracy: no premature 30% buffer for Anthropic models',
    async () => {
      const apiKey = process.env[API_KEY_ENV_VAR]!
      if (!apiKey) {
        console.log('Skipping: No API key found')
        return
      }

      const TARGET_ESTIMATED_TOKENS = 95_000
      const messages = buildMessageHistory(TARGET_ESTIMATED_TOKENS)

      const client = new CodebuffClient({
        apiKey,
        agentDefinitions: [testAgent, contextPruner],
      })

      const sessionStateCal = await initialSessionState({})
      const runStateCal = withMessageHistory({
        runState: {
          traceSessionId: 'test-trace-session',
          sessionState: sessionStateCal,
          output: { type: 'error', message: '' },
        },
        messages,
      })

      console.log('  [accuracy] Running calibration with 200k limit...')
      const calRun = await client.run({
        agent: testAgent.id,
        prompt: 'Say "CAL" and nothing else.',
        previousRun: runStateCal,
        params: { maxContextLength: 200_000 },
        handleEvent: (event) => {
          if (event.type === 'text') {
            console.log('  [accuracy-cal] Agent text:', event.text.slice(0, 100))
          }
        },
      })

      const trueTokenCount =
        calRun.sessionState?.mainAgentState.contextTokenCount ?? 0
      const calMessages =
        calRun.sessionState?.mainAgentState.messageHistory ?? []
      const calPruning = detectPruning(calMessages, messages.length)

      console.log('  [accuracy] ========== CALIBRATION RESULTS ==========')
      console.log('  [accuracy] TRUE token count (200k limit):', trueTokenCount)
      console.log(
        '  [accuracy] Cal message count:',
        calMessages.length,
        '(original:',
        messages.length,
        ')',
      )
      console.log('  [accuracy] Cal pruning result:', calPruning)
      console.log(
        '  [accuracy] Ratio true/estimated:',
        (trueTokenCount / TARGET_ESTIMATED_TOKENS).toFixed(2),
      )
      console.log('  [accuracy] =========================================')

      expect(calPruning.wasPruned).toBe(false)
      expect(trueTokenCount).toBeGreaterThan(50_000)

      const sessionState = await initialSessionState({})
      const runStateWithMessages = withMessageHistory({
        runState: {
          traceSessionId: 'test-trace-session',
          sessionState,
          output: { type: 'error', message: '' },
        },
        messages,
      })

      const MAX_CONTEXT_LENGTH = 100_000

      console.log('  [accuracy] Running test with 100k limit...')
      const run = await client.run({
        agent: testAgent.id,
        prompt: 'Say "ACK" and nothing else.',
        previousRun: runStateWithMessages,
        params: { maxContextLength: MAX_CONTEXT_LENGTH },
        handleEvent: (event) => {
          if (event.type === 'text') {
            console.log('  [accuracy-100k] Agent text:', event.text.slice(0, 100))
          }
        },
      })

      if (run.output.type === 'error') {
        console.error('Accuracy test error:', JSON.stringify(run.output, null, 2))
      }
      expect(run.output.type).not.toEqual('error')

      const reportedTokenCount =
        run.sessionState?.mainAgentState.contextTokenCount ?? 0
      const finalMessages =
        run.sessionState?.mainAgentState.messageHistory ?? []
      const pruningResult = detectPruning(finalMessages, messages.length)

      console.log('  [accuracy] ========== 100K LIMIT TEST RESULTS ==========')
      console.log('  [accuracy] Reported token count:', reportedTokenCount)
      console.log(
        '  [accuracy] Final message count:',
        finalMessages.length,
        '(original:',
        messages.length,
        ')',
      )
      console.log('  [accuracy] Pruning result:', pruningResult)
      console.log(
        '  [accuracy] Was pruned:',
        pruningResult.wasPruned,
        '(true tokens were:',
        trueTokenCount,
        ', limit:',
        MAX_CONTEXT_LENGTH,
        ')',
      )
      console.log('  [accuracy] ================================================')

      if (trueTokenCount < MAX_CONTEXT_LENGTH && pruningResult.wasPruned) {
        console.error(
          `  ❌ BUG DETECTED: True tokens (${trueTokenCount}) < limit (${MAX_CONTEXT_LENGTH}), ` +
            `but pruning was triggered! The token counting API is over-reporting.`,
        )
      } else if (
        trueTokenCount < MAX_CONTEXT_LENGTH &&
        !pruningResult.wasPruned
      ) {
        console.log(
          `  ✅ No bug: True tokens (${trueTokenCount}) < limit (${MAX_CONTEXT_LENGTH}), ` +
            `no pruning occurred.`,
        )
      } else {
        console.log(
          `  ⚠️ Content too large: True tokens (${trueTokenCount}) >= limit (${MAX_CONTEXT_LENGTH}). ` +
            `Pruning is expected. Adjust content size.`,
        )
      }

      const ratio = trueTokenCount / TARGET_ESTIMATED_TOKENS
      console.log(
        '  [accuracy] Ratio of true/estimated:',
        ratio.toFixed(2),
        '(expected: 1.0-1.3, 30% bug → 1.3+, fallback → 1.5+)',
      )
      expect(ratio).toBeLessThan(1.3)

      if (trueTokenCount < MAX_CONTEXT_LENGTH) {
        expect(pruningResult.wasPruned).toBe(false)
      } else {
        console.log(
          `  [accuracy] Content too large: true tokens (${trueTokenCount}) >= limit (${MAX_CONTEXT_LENGTH}). Pruning is expected.`,
        )
      }
    },
    { timeout: 300_000 },
  )
})
