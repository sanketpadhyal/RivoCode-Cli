import { TEST_AGENT_RUNTIME_IMPL } from '@rivocode/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@rivocode/common/types/session-state'
import { beforeEach, describe, expect, it } from 'bun:test'

import { assistantMessage, userMessage } from '@rivocode/common/util/messages'

import { mockFileContext } from './test-utils'
import {
  MAX_CONSECUTIVE_STREAM_RECOVERIES,
  OUTPUT_LIMIT_TAG,
  processStream,
  REPEATED_OUTPUT_LIMIT_MESSAGE,
  REPEATED_STREAM_INTERRUPTIONS_MESSAGE,
  STREAM_INTERRUPTED_TAG,
  trailingStreamRecoveryStreak,
} from '../tools/stream-parser'

import type { AgentTemplate } from '../templates/types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@rivocode/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@rivocode/common/types/contracts/llm'
import type { Message } from '@rivocode/common/types/messages/codebuff-message'
import type { PromptResult } from '@rivocode/common/util/error'

describe('stream parser interrupted streams', () => {
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL, sendAction: () => {} }
  })

  const testAgentTemplate: AgentTemplate = {
    id: 'test-agent',
    displayName: 'Test Agent',
    spawnerPrompt: 'Test agent',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'structured_output',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames: ['read_files', 'end_turn'],
    spawnableAgents: [],
    systemPrompt: 'Test system prompt',
    instructionsPrompt: 'Test instructions',
    stepPrompt: 'Test step prompt',
  }

  async function runStream(
    stream: AsyncGenerator<StreamChunk, PromptResult<string | null>>,
    initialHistory: Message[] = [],
  ) {
    const abortController = new AbortController()
    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    agentState.messageHistory = [...initialHistory]

    const result = await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: testAgentTemplate,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': testAgentTemplate },
      messages: [],
      prompt: 'test prompt',
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: abortController.signal,
      stream,
      system: 'test system',
      tools: {},
      userId: 'test-user',
      userInputId: 'test-input-id',
      onCostCalculated: async () => {},
      onResponseChunk: () => {},
    })

    return { result, messageHistory: agentState.messageHistory as Message[] }
  }

  it('records the interruption note and forces another step', async () => {
    async function* interruptedStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: 'The reviewer flagged two unused ' }
      yield {
        type: 'error' as const,
        source: 'stream-interrupted' as const,
        message: 'The connection dropped while the response was streaming.',
      }
      return { aborted: false, value: 'msg-id' }
    }

    const { result, messageHistory } = await runStream(interruptedStream())

    expect(result.hadToolCallError).toBe(true)

    const interruptionNotes = messageHistory.filter(
      (m) => m.role === 'user' && m.tags?.includes('STREAM_INTERRUPTED'),
    )
    expect(interruptionNotes).toHaveLength(1)
    const noteContent = interruptionNotes[0]!.content
    expect(JSON.stringify(noteContent)).toContain('connection dropped')
    expect(JSON.stringify(noteContent)).not.toContain('Error during tool call')

    expect(result.fullResponse).toBe('The reviewer flagged two unused ')
  })

  it('records an output-limit note with its own tag and forces another step', async () => {
    async function* outputLimitStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'reasoning' as const, text: 'thinking at great length ' }
      yield {
        type: 'error' as const,
        source: 'output-limit' as const,
        message: 'The response hit its output token limit while reasoning.',
      }
      return { aborted: false, value: 'msg-id' }
    }

    const { result, messageHistory } = await runStream(outputLimitStream())

    expect(result.hadToolCallError).toBe(true)
    const notes = messageHistory.filter(
      (m) => m.role === 'user' && m.tags?.includes(OUTPUT_LIMIT_TAG),
    )
    expect(notes).toHaveLength(1)
    expect(JSON.stringify(notes[0]!.content)).toContain('output token limit')
    expect(JSON.stringify(notes[0]!.content)).not.toContain(
      'Error during tool call',
    )
  })

  it('fails the turn after too many consecutive interruptions', async () => {
    async function* interruptedStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield {
        type: 'error' as const,
        source: 'stream-interrupted' as const,
        message: 'The connection dropped while the response was streaming.',
      }
      return { aborted: false, value: 'msg-id' }
    }

    const interruptionNote = () =>
      userMessage({
        content: 'interrupted',
        tags: [STREAM_INTERRUPTED_TAG],
      })
    const priorNotes = Array.from(
      { length: MAX_CONSECUTIVE_STREAM_RECOVERIES },
      interruptionNote,
    )

    await expect(runStream(interruptedStream(), priorNotes)).rejects.toThrow(
      REPEATED_STREAM_INTERRUPTIONS_MESSAGE,
    )
  })

  it('fails with the output-limit message when that source trips the shared cap', async () => {
    async function* outputLimitStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield {
        type: 'error' as const,
        source: 'output-limit' as const,
        message: 'The response hit its output token limit while reasoning.',
      }
      return { aborted: false, value: 'msg-id' }
    }

    const priorNotes = [
      userMessage({ content: 'n1', tags: [STREAM_INTERRUPTED_TAG] }),
      userMessage({ content: 'n2', tags: [OUTPUT_LIMIT_TAG] }),
      userMessage({ content: 'n3', tags: [STREAM_INTERRUPTED_TAG] }),
    ]

    await expect(runStream(outputLimitStream(), priorNotes)).rejects.toThrow(
      REPEATED_OUTPUT_LIMIT_MESSAGE,
    )
  })

  it('walks only back-to-back recovery notes of either kind, tracking count and last source', () => {
    const note = () =>
      userMessage({ content: 'interrupted', tags: [STREAM_INTERRUPTED_TAG] })
    const limitNote = () =>
      userMessage({ content: 'limited', tags: [OUTPUT_LIMIT_TAG] })
    const assistant = assistantMessage('partial output')
    const toolResult = {
      role: 'tool',
      content: {
        type: 'tool-result',
        toolName: 'read_files',
        toolCallId: 'x',
        output: [],
      },
    } as unknown as Message
    const plainUser = userMessage({ content: 'a real prompt' })

    expect(trailingStreamRecoveryStreak([])).toEqual({
      count: 0,
      lastSource: undefined,
    })
    expect(trailingStreamRecoveryStreak([plainUser])).toEqual({
      count: 0,
      lastSource: undefined,
    })
    expect(trailingStreamRecoveryStreak([plainUser, note()])).toEqual({
      count: 1,
      lastSource: 'stream-interrupted',
    })
    expect(trailingStreamRecoveryStreak([limitNote()])).toEqual({
      count: 1,
      lastSource: 'output-limit',
    })
    expect(trailingStreamRecoveryStreak([note(), limitNote()])).toEqual({
      count: 2,
      lastSource: 'output-limit',
    })
    expect(
      trailingStreamRecoveryStreak([limitNote(), assistant, note()]),
    ).toEqual({ count: 2, lastSource: 'stream-interrupted' })
    expect(
      trailingStreamRecoveryStreak([note(), toolResult, limitNote()]),
    ).toEqual({ count: 1, lastSource: 'output-limit' })
    expect(trailingStreamRecoveryStreak([note(), plainUser])).toEqual({
      count: 0,
      lastSource: undefined,
    })
  })

  it('does not misclassify a tag equal to an Object.prototype property name', () => {
    const prototypeTag = userMessage({
      content: 'not a recovery note',
      tags: ['constructor'],
    })
    expect(trailingStreamRecoveryStreak([prototypeTag])).toEqual({
      count: 0,
      lastSource: undefined,
    })

    for (const poisonTag of [
      'toString',
      'hasOwnProperty',
      'valueOf',
      '__proto__',
    ]) {
      expect(
        trailingStreamRecoveryStreak([
          userMessage({ content: 'x', tags: [poisonTag] }),
        ]),
      ).toEqual({ count: 0, lastSource: undefined })
    }

    const note = userMessage({
      content: 'interrupted',
      tags: [STREAM_INTERRUPTED_TAG],
    })
    expect(trailingStreamRecoveryStreak([prototypeTag, note])).toEqual({
      count: 1,
      lastSource: 'stream-interrupted',
    })
  })

  it('keeps wrapping ordinary error chunks as tool-call failures', async () => {
    async function* toolErrorStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'error' as const, message: 'bad tool input' }
      return { aborted: false, value: 'msg-id' }
    }

    const { result, messageHistory } = await runStream(toolErrorStream())

    expect(result.hadToolCallError).toBe(true)
    const errorNotes = messageHistory.filter(
      (m) => m.role === 'user' && m.tags?.includes('TOOL_CALL_ERROR'),
    )
    expect(errorNotes).toHaveLength(1)
    expect(JSON.stringify(errorNotes[0]!.content)).toContain(
      'Error during tool call',
    )
  })
})
