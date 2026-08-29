import { TEST_AGENT_RUNTIME_IMPL } from '@rivocode/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@rivocode/common/types/session-state'
import { AbortError, isAbortError } from '@rivocode/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'

import { mockFileContext } from './test-utils'
import { processStream } from '../tools/stream-parser'

import type { AgentTemplate } from '../templates/types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@rivocode/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@rivocode/common/types/contracts/llm'
import type { AssistantMessage } from '@rivocode/common/types/messages/codebuff-message'
import type { PromptResult } from '@rivocode/common/util/error'

describe('stream parser abort handling', () => {
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

  function getAssistantText(
    messageHistory: {
      role: string
      content: { type: string; text?: string }[]
    }[],
  ): string[] {
    return messageHistory
      .filter((m): m is AssistantMessage => m.role === 'assistant')
      .flatMap((m) => m.content)
      .filter((c) => c.type === 'text')
      .map((c) => ('text' in c ? c.text! : ''))
  }

  it('preserves unflushed buffer text in message history when stream throws AbortError', async () => {
    const abortController = new AbortController()

    async function* mockStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: 'Hello ' }
      yield { type: 'text' as const, text: 'world' }
      abortController.abort()
      throw new AbortError()
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    let thrownError: unknown
    try {
      await processStream({
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
        stream: mockStream(),
        system: 'test system',
        tools: {},
        userId: 'test-user',
        userInputId: 'test-input-id',
        onCostCalculated: async () => {},
        onResponseChunk: () => {},
      })
    } catch (error) {
      thrownError = error
    }

    expect(isAbortError(thrownError)).toBe(true)

    const textParts = getAssistantText(agentState.messageHistory)
    expect(textParts.join('')).toBe('Hello world')
  })

  it('preserves text buffered after a tool call when stream throws AbortError', async () => {
    const abortController = new AbortController()

    async function* mockStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: 'Analyzing code...' }
      yield {
        type: 'tool-call' as const,
        toolName: 'read_files',
        toolCallId: 'tc-1',
        input: { paths: ['test.ts'] },
      }
      yield { type: 'text' as const, text: 'Now editing the file' }
      abortController.abort()
      throw new AbortError()
    }

    agentRuntimeImpl.requestFiles = async () => ({
      'test.ts': 'console.log("test")',
    })

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    let thrownError: unknown
    try {
      await processStream({
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
        stream: mockStream(),
        system: 'test system',
        tools: {},
        userId: 'test-user',
        userInputId: 'test-input-id',
        onCostCalculated: async () => {},
        onResponseChunk: () => {},
      })
    } catch (error) {
      thrownError = error
    }

    expect(isAbortError(thrownError)).toBe(true)

    const textParts = getAssistantText(agentState.messageHistory)
    expect(textParts).toContain('Analyzing code...')
    expect(textParts).toContain('Now editing the file')
  })

  it('flushes buffer on cooperative abort via signal.aborted check', async () => {
    const abortController = new AbortController()

    async function* mockStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: 'Starting ' }
      yield { type: 'text' as const, text: 'analysis' }
      abortController.abort()
      yield { type: 'text' as const, text: '... more text' }
      return { aborted: true }
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    let thrownError: unknown
    try {
      await processStream({
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
        stream: mockStream(),
        system: 'test system',
        tools: {},
        userId: 'test-user',
        userInputId: 'test-input-id',
        onCostCalculated: async () => {},
        onResponseChunk: () => {},
      })
    } catch (error) {
      thrownError = error
    }

    expect(isAbortError(thrownError)).toBe(true)

    const textParts = getAssistantText(agentState.messageHistory)
    const allText = textParts.join('')
    expect(allText).toContain('Starting ')
    expect(allText).toContain('analysis')
    expect(allText).toContain('... more text')
  })
})
