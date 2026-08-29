import * as analytics from '@rivocode/common/analytics'
import { TEST_USER_ID } from '@rivocode/common/old-constants'
import { createTestAgentRuntimeParams } from '@rivocode/common/testing/fixtures/agent-runtime'
import { clearMockedModules } from '@rivocode/common/testing/mock-modules'
import {
  createMockDbOperations,
  setupDbSpies,
} from '@rivocode/common/testing/mocks/database'
import { getInitialSessionState } from '@rivocode/common/types/session-state'
import { AbortError, promptSuccess } from '@rivocode/common/util/error'
import { assistantMessage, userMessage } from '@rivocode/common/util/messages'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'
import { APICallError, RetryError } from 'ai'
import { z } from 'zod/v4'

import { loopAgentSteps } from '../run-agent-step'
import { clearAgentGeneratorCache } from '../run-programmatic-step'
import {
  MAX_CONSECUTIVE_STREAM_RECOVERIES,
  OUTPUT_LIMIT_TAG,
  REPEATED_OUTPUT_LIMIT_MESSAGE,
  REPEATED_STREAM_INTERRUPTIONS_MESSAGE,
  STREAM_INTERRUPTED_TAG,
} from '../tools/stream-parser'
import { createToolCallChunk, mockFileContext } from './test-utils'

import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@rivocode/common/testing/mocks/database'
import type { StepGenerator } from '@rivocode/common/types/agent-template'
import type { AgentState } from '@rivocode/common/types/session-state'

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let llmCallCount: number
  let agentRuntimeImpl: Omit<
    ReturnType<typeof createTestAgentRuntimeParams>,
    'agentTemplate' | 'localAgentTemplates'
  > & {
    promptAiSdkStream?: ReturnType<typeof mock>
  }
  let loopAgentStepsBaseParams: Parameters<typeof loopAgentSteps>[0]
  let dbSpies: DbSpies

  beforeAll(async () => {
  })

  beforeEach(() => {
    const {
      agentTemplate: _,
      localAgentTemplates: __,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()

    agentRuntimeImpl = {
      ...baseRuntimeParams,
    }

    llmCallCount = 0

    dbSpies = setupDbSpies(createMockDbOperations())

    agentRuntimeImpl.promptAiSdkStream = mock(async function* ({}) {
      llmCallCount++
      yield { type: 'text' as const, text: 'LLM response\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    })

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    spyOn(crypto, 'randomUUID').mockImplementation(
      () => 'mock-uuid-0000-0000-0000-000000000000' as const,
    )

    mockTemplate = {
      id: 'test-agent',
      displayName: 'Test Agent',
      spawnerPrompt: 'Testing',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['read_files', 'write_file', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test user prompt',
      stepPrompt: 'Test agent step prompt',
      handleSteps: undefined,
    } satisfies AgentTemplate as AgentTemplate

    const sessionState = getInitialSessionState(mockFileContext)
    mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'test-agent-id',
      messageHistory: [
        userMessage('Initial message'),
        assistantMessage('Initial response'),
      ],
      output: undefined,
      stepsRemaining: 10,
    }

    loopAgentStepsBaseParams = {
      ...agentRuntimeImpl,
      agentType: 'test-agent',
      localAgentTemplates: { 'test-agent': mockTemplate },
      repoId: undefined,
      repoUrl: undefined,
      userInputId: 'test-user-input',
      agentState: mockAgentState,
      prompt: 'Test prompt',
      spawnParams: undefined,
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      userId: TEST_USER_ID,
      clientSessionId: 'test-session',
      ancestorRunIds: [],
      onResponseChunk: () => {},
      signal: new AbortController().signal,
    }
  })

  afterEach(() => {
    clearAgentGeneratorCache(agentRuntimeImpl)
    dbSpies.restore()
    mock.restore()
    const {
      agentTemplate: _,
      localAgentTemplates: __,
      ...baseRuntimeParams
    } = createTestAgentRuntimeParams()
    agentRuntimeImpl = {
      ...baseRuntimeParams,
    }
  })

  afterAll(() => {
    clearMockedModules()
  })

  it('should verify correct STEP behavior - LLM called once after STEP', async () => {

    let stepCount = 0
    const mockGeneratorFunction = function* () {
      stepCount++
      yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
      yield 'STEP'
      yield {
        toolName: 'write_file',
        input: { path: 'output.txt', content: 'test' },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    console.log(`LLM calls made: ${llmCallCount}`)
    console.log(`Step count: ${stepCount}`)

    expect(llmCallCount).toBe(1)

    expect(stepCount).toBe(1)
  })

  it('should demonstrate correct behavior when programmatic agent completes without STEP', async () => {

    const mockGeneratorFunction = function* () {
      yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
      yield {
        toolName: 'write_file',
        input: { path: 'output.txt', content: 'test' },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallCount).toBe(0)
    expect(result.agentState).toBeDefined()
  })

  it('should run programmatic step first, then LLM step, then continue', async () => {

    let stepCount = 0
    const mockGeneratorFunction = function* () {
      stepCount++
      yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
      yield 'STEP'
      yield {
        toolName: 'write_file',
        input: { path: 'output.txt', content: 'updated by LLM' },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(stepCount).toBe(1)
    expect(llmCallCount).toBe(1)
    expect(result.agentState).toBeDefined()
  })

  it('should handle programmatic agent that yields STEP_ALL', async () => {

    let stepCount = 0
    const mockGeneratorFunction = function* () {
      stepCount++
      yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
      yield 'STEP_ALL'
      yield {
        toolName: 'write_file',
        input: { path: 'final.txt', content: 'done' },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(stepCount).toBe(1)
    expect(llmCallCount).toBe(1)
    expect(result.agentState).toBeDefined()
  })

  it('should not call LLM when programmatic agent returns without STEP', async () => {

    const mockGeneratorFunction = function* () {
      yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
      yield {
        toolName: 'write_file',
        input: { path: 'result.txt', content: 'processed' },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallCount).toBe(0)
    expect(result.agentState).toBeDefined()
  })

  it('should handle LLM-only agent (no handleSteps)', async () => {

    const llmOnlyTemplate = {
      ...mockTemplate,
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': llmOnlyTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallCount).toBe(1)
    expect(result.agentState).toBeDefined()
  })

  it('should pass the full message history to the traceWriter when provided', async () => {
    const recordedSteps: Array<{ agentId: string; messages: unknown[] }> = []
    const traceWriter = {
      recordStep: (params: { agentId: string; messages: unknown[] }) => {
        recordedSteps.push(params)
      },
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      traceWriter,
      agentType: 'test-agent',
      localAgentTemplates: {
        'test-agent': { ...mockTemplate, handleSteps: undefined },
      },
    })

    expect(result.agentState).toBeDefined()
    expect(recordedSteps.length).toBeGreaterThanOrEqual(2)
    expect(recordedSteps[0]!.agentId).toBe('test-agent-id')
    const lastMessages = recordedSteps[recordedSteps.length - 1]!.messages
    expect(lastMessages.length).toBeGreaterThan(
      recordedSteps[0]!.messages.length,
    )
  })

  it('should handle programmatic agent error and still call LLM', async () => {

    const mockGeneratorFunction = function* () {
      yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
      throw new Error('Programmatic step failed')
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallCount).toBe(0)
    expect(result.agentState).toBeDefined()
    expect(result.agentState.output?.error).toContain(
      'Error executing handleSteps for agent test-agent',
    )
  })

  it('should handle mixed execution with multiple STEP yields', async () => {

    let stepCount = 0
    const mockGeneratorFunction = function* () {
      stepCount++
      yield { toolName: 'read_files', input: { paths: ['input.txt'] } }
      yield 'STEP'
      yield {
        toolName: 'write_file',
        input: { path: 'temp.txt', content: 'intermediate' },
      }
      yield {
        toolName: 'write_file',
        input: { path: 'final.txt', content: 'complete' },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(stepCount).toBe(1)
    expect(llmCallCount).toBe(1)
    expect(result.agentState).toBeDefined()
  })

  it('should pass shouldEndTurn: true as stepsComplete when end_turn tool is called', async () => {

    let stepsCompleteValues: boolean[] = []

    const mockGeneratorFunction = function* () {
      const result1 = yield 'STEP'
      stepsCompleteValues.push(result1.stepsComplete)

      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(stepsCompleteValues).toHaveLength(1)
    expect(stepsCompleteValues[0]).toBe(true)
  })

  it('should continue loop when handleSteps returns endTurn: false even if LLM calls end_turn', async () => {

    let programmaticStepCount = 0
    let llmStepCount = 0

    const mockGeneratorFunction = function* () {
      programmaticStepCount++
      yield 'STEP'

      programmaticStepCount++
      yield 'STEP'

      programmaticStepCount++
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    let promptCallCount = 0
    loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
      promptCallCount++
      llmStepCount++

      yield { type: 'text' as const, text: 'LLM response\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess(`mock-message-id-${promptCallCount}`)
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(programmaticStepCount).toBe(3)

    expect(llmStepCount).toBe(2)

  })

  it('should restart loop when agent finishes without setting required output', async () => {

    const outputSchema = z.object({
      result: z.string(),
      status: z.string(),
    })

    const templateWithOutputSchema = {
      ...mockTemplate,
      outputSchema,
      toolNames: ['set_output', 'end_turn'],
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': templateWithOutputSchema,
    }

    let llmCallNumber = 0
    const llmStepNumbers: string[] = []
    let capturedAgentState: AgentState | null = null

    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({
      extraCodebuffMetadata,
    }) {
      llmCallNumber++
      llmStepNumbers.push(extraCodebuffMetadata?.llm_step_number ?? '')
      if (llmCallNumber === 1) {
        yield {
          type: 'text' as const,
          text: 'First response without output\n\n',
        }
        yield createToolCallChunk('end_turn', {})
      } else if (llmCallNumber === 2) {
        if (capturedAgentState) {
          capturedAgentState.output = {
            result: 'test result',
            status: 'success',
          }
        }
        yield { type: 'text' as const, text: 'Setting output now\n\n' }
        yield createToolCallChunk('set_output', {
          result: 'test result',
          status: 'success',
        })
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
      } else {
        yield { type: 'text' as const, text: 'Ending\n\n' }
        yield createToolCallChunk('end_turn', {})
      }
      return promptSuccess('mock-message-id')
    }

    mockAgentState.output = undefined
    capturedAgentState = mockAgentState

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallNumber).toBe(2)
    expect(llmStepNumbers).toEqual(['1', '2'])

    expect(result.agentState.output).toEqual({
      result: 'test result',
      status: 'success',
    })

    const systemMessages = result.agentState.messageHistory.filter(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text.includes('set_output'),
    )
    expect(systemMessages.length).toBeGreaterThan(0)
  })

  it('should not restart loop if output is set correctly', async () => {

    const outputSchema = z.object({
      result: z.string(),
    })

    const templateWithOutputSchema = {
      ...mockTemplate,
      outputSchema,
      toolNames: ['set_output', 'end_turn'],
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': templateWithOutputSchema,
    }

    let llmCallNumber = 0
    let capturedAgentState: AgentState | null = null

    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({}) {
      llmCallNumber++
      if (capturedAgentState) {
        capturedAgentState.output = { result: 'success' }
      }
      yield { type: 'text' as const, text: 'Setting output\n\n' }
      yield createToolCallChunk('set_output', { result: 'success' })
      yield { type: 'text' as const, text: '\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    mockAgentState.output = undefined
    capturedAgentState = mockAgentState

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallNumber).toBe(1)

    expect(result.agentState.output).toEqual({ result: 'success' })
  })

  it('should pass generateN from programmatic step to runAgentStep as n parameter', async () => {

    let agentStepN: number | undefined

    const mockGeneratorFunction = function* () {
      yield { type: 'GENERATE_N', n: 5 }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    loopAgentStepsBaseParams.promptAiSdk = async (params: any) => {
      agentStepN = params.n
      return promptSuccess(
        JSON.stringify([
          'Response 1',
          'Response 2',
          'Response 3',
          'Response 4',
          'Response 5',
        ]),
      )
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(agentStepN).toBe(5)
  })

  it('should pass nResponses from runAgentStep back to programmatic step', async () => {

    let receivedNResponses: string[] | undefined

    const mockGeneratorFunction = function* () {
      const { nResponses } = yield { type: 'GENERATE_N', n: 3 }
      receivedNResponses = nResponses
      const step = yield {
        toolName: 'read_files',
        input: { paths: ['test.txt'] },
      }
      yield { toolName: 'end_turn', input: {} }
    } as () => StepGenerator

    mockTemplate.handleSteps = mockGeneratorFunction

    const localAgentTemplates = {
      'test-agent': mockTemplate,
    }

    const expectedResponses = [
      'Implementation A',
      'Implementation B',
      'Implementation C',
    ]
    loopAgentStepsBaseParams.promptAiSdk = async () => {
      return promptSuccess(JSON.stringify(expectedResponses))
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(receivedNResponses).toEqual(expectedResponses)
  })

  it('should allow agents without outputSchema to end normally', async () => {

    const templateWithoutOutputSchema = {
      ...mockTemplate,
      outputSchema: undefined,
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': templateWithoutOutputSchema,
    }

    let llmCallNumber = 0
    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({}) {
      llmCallNumber++
      yield { type: 'text' as const, text: 'Response without output\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallNumber).toBe(1)

    expect(result.agentState.output).toBeUndefined()
  })

  it('should continue loop if agent does not end turn (has more work)', async () => {

    const outputSchema = z.object({
      result: z.string(),
    })

    const templateWithOutputSchema = {
      ...mockTemplate,
      outputSchema,
      toolNames: ['read_files', 'set_output', 'end_turn'],
      handleSteps: undefined,
    }

    const localAgentTemplates = {
      'test-agent': templateWithOutputSchema,
    }

    let llmCallNumber = 0
    let capturedAgentState: AgentState | null = null

    loopAgentStepsBaseParams.promptAiSdkStream = async function* ({}) {
      llmCallNumber++
      if (llmCallNumber === 1) {
        yield { type: 'text' as const, text: 'Doing work\n\n' }
        yield createToolCallChunk('read_files', { paths: ['test.txt'] })
      } else {
        if (capturedAgentState) {
          capturedAgentState.output = { result: 'done' }
        }
        yield { type: 'text' as const, text: 'Finishing\n\n' }
        yield createToolCallChunk('set_output', { result: 'done' })
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
      }
      return promptSuccess('mock-message-id')
    }

    mockAgentState.output = undefined
    capturedAgentState = mockAgentState

    const result = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(llmCallNumber).toBe(2)

    expect(result.agentState.output).toEqual({ result: 'done' })
  })

  describe('abort handling', () => {
    it('should handle AbortError and finish with cancelled status', async () => {

      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      let finishAgentRunStatus: string | undefined
      const mockFinishAgentRun = mock(async (params: { status: string }) => {
        finishAgentRunStatus = params.status
      })

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        yield { type: 'text' as const, text: 'Starting work...\n' }
        throw new AbortError('User pressed Ctrl+C')
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
        finishAgentRun: mockFinishAgentRun,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe('Run cancelled by user')
      }

      expect(mockFinishAgentRun).toHaveBeenCalled()
      expect(finishAgentRunStatus).toBe('cancelled')
    })

    it('should distinguish AbortError from other errors', async () => {

      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      let finishAgentRunStatus: string | undefined
      const mockFinishAgentRun = mock(async (params: { status: string }) => {
        finishAgentRunStatus = params.status
      })

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        yield { type: 'text' as const, text: 'Starting...\n' }
        throw new Error('Network connection failed')
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
        finishAgentRun: mockFinishAgentRun,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('Network connection failed')
        expect(result.output.message).not.toBe('Run cancelled by user')
      }

      expect(mockFinishAgentRun).toHaveBeenCalled()
      expect(finishAgentRunStatus).toBe('failed')
    })

    it('should handle signal.aborted before loop starts', async () => {

      const abortController = new AbortController()
      abortController.abort()

      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
        signal: abortController.signal,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe('Run cancelled by user')
      }

      expect(llmCallCount).toBe(0)
    })
  })

  describe('API error handling', () => {
    it('should propagate error code and server message from 403 APICallError responseBody', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        throw new APICallError({
          statusCode: 403,
          message: 'Forbidden',
          url: 'https://api.codebuff.com/v1/chat/completions',
          requestBodyValues: {},
          responseBody: JSON.stringify({
            error: 'free_mode_unavailable',
            message: 'Free mode is not available in your country.',
            countryCode: 'US',
            countryBlockReason: 'anonymous_network',
            ipPrivacySignals: ['vpn', 'hosting'],
          }),
          isRetryable: false,
        })
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe(
          'Free mode is not available in your country.',
        )
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.error).toBe('free_mode_unavailable')
        expect(result.output.statusCode).toBe(403)
        expect(result.output.countryCode).toBe('US')
        expect(result.output.countryBlockReason).toBe('anonymous_network')
        expect(result.output.ipPrivacySignals).toEqual(['vpn', 'hosting'])
      }
    })

    it('should prefix with "Agent run error:" when responseBody has no parseable message', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        throw new APICallError({
          statusCode: 500,
          message: 'Internal Server Error',
          url: 'https://api.codebuff.com/v1/chat/completions',
          requestBodyValues: {},
          responseBody: undefined,
          isRetryable: true,
        })
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('Agent run error:')
        expect(result.output.message).toContain('Internal Server Error')
        expect(result.output.error).toBeUndefined()
      }
    })

    it('should unwrap retry errors to propagate underlying 409 gate errors', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      const apiError = new APICallError({
        statusCode: 409,
        message: 'Conflict',
        url: 'https://api.codebuff.com/v1/chat/completions',
        requestBodyValues: {},
        responseBody: JSON.stringify({
          error: 'session_superseded',
          message:
            'Another instance of freebuff has taken over this session. Only one instance per account is allowed.',
        }),
        isRetryable: true,
      })

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        throw new RetryError({
          message: 'Failed after 4 attempts. Last error: Conflict',
          reason: 'maxRetriesExceeded',
          errors: [apiError],
        })
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toBe(
          'Another instance of freebuff has taken over this session. Only one instance per account is allowed.',
        )
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.error).toBe('session_superseded')
        expect(result.output.statusCode).toBe(409)
      }
    })

    it('should explain fetch idle timeouts instead of showing the raw runtime message', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        const timeoutError = new Error('The operation timed out.')
        timeoutError.name = 'TimeoutError'
        throw timeoutError
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain(
          'no data was received from the server for 5 minutes',
        )
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.message).not.toBe('The operation timed out.')
      }
    })

    it('should explain dropped socket connections instead of showing the raw runtime message', async () => {
      const llmOnlyTemplate = {
        ...mockTemplate,
        handleSteps: undefined,
      }

      const localAgentTemplates = {
        'test-agent': llmOnlyTemplate,
      }

      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        const socketError = new Error(
          'The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()',
        ) as Error & { code: string }
        socketError.code = 'ECONNRESET'
        throw socketError
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        localAgentTemplates,
      })

      expect(result.output.type).toBe('error')
      if (result.output.type === 'error') {
        expect(result.output.message).toContain('Connection interrupted')
        expect(result.output.message).not.toContain('Agent run error:')
        expect(result.output.message).not.toContain(
          'pass `verbose: true` in the second argument to fetch()',
        )
      }
    })
  })

  describe('steering (drainSteeringMessages)', () => {
    it('appends a steering message at the step boundary and continues the turn', async () => {
      const steerText = 'Also rename the variable to fooBar'
      let drainCalls = 0
      const drainSteeringMessages = () => {
        drainCalls++
        return drainCalls === 1 ? [steerText] : []
      }

      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        drainSteeringMessages,
      })

      expect(llmCallCount).toBe(2)

      const steered = result.agentState.messageHistory.find(
        (m) =>
          m.role === 'user' && JSON.stringify(m.content).includes(steerText),
      )
      expect(steered).toBeDefined()
      expect((steered as { tags?: string[] }).tags).toContain('USER_PROMPT')
    })

    it('does not extend the turn when no steering messages arrive', async () => {
      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentType: 'test-agent',
        drainSteeringMessages: () => [],
      })

      expect(llmCallCount).toBe(1)
      expect(result.agentState).toBeDefined()
    })
  })

  describe('stream interruptions', () => {
    it('retries after a stream interruption and completes the turn', async () => {
      let callCount = 0
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        callCount++
        if (callCount === 1) {
          yield { type: 'text' as const, text: 'partial answer that got cut ' }
          yield {
            type: 'error' as const,
            source: 'stream-interrupted' as const,
            message: 'The connection dropped while the response was streaming.',
          }
          return promptSuccess('interrupted-message-id')
        }
        yield { type: 'text' as const, text: 'complete answer' }
        yield createToolCallChunk('end_turn', {})
        return promptSuccess('complete-message-id')
      }

      const result = await loopAgentSteps(loopAgentStepsBaseParams)

      expect(callCount).toBe(2)
      expect(result.output?.type).not.toBe('error')

      const notes = result.agentState.messageHistory.filter(
        (m) => m.role === 'user' && m.tags?.includes(STREAM_INTERRUPTED_TAG),
      )
      expect(notes).toHaveLength(1)
    })

    it('gives up with a clear error when every attempt is interrupted', async () => {
      let callCount = 0
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        callCount++
        yield {
          type: 'error' as const,
          source: 'stream-interrupted' as const,
          message: 'The connection dropped while the response was streaming.',
        }
        return promptSuccess(`interrupted-${callCount}`)
      }

      const result = await loopAgentSteps(loopAgentStepsBaseParams)

      expect(result.output?.type).toBe('error')
      expect((result.output as { message?: string }).message).toContain(
        REPEATED_STREAM_INTERRUPTIONS_MESSAGE,
      )
      expect(callCount).toBe(MAX_CONSECUTIVE_STREAM_RECOVERIES + 1)
    })

    it('retries after an output-limit thinking overrun and completes the turn', async () => {
      let callCount = 0
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        callCount++
        if (callCount === 1) {
          yield { type: 'reasoning' as const, text: 'thinking forever ' }
          yield {
            type: 'error' as const,
            source: 'output-limit' as const,
            message: 'The response hit its output token limit while reasoning.',
          }
          return promptSuccess('limited-message-id')
        }
        yield { type: 'text' as const, text: 'concise answer' }
        yield createToolCallChunk('end_turn', {})
        return promptSuccess('complete-message-id')
      }

      const result = await loopAgentSteps(loopAgentStepsBaseParams)

      expect(callCount).toBe(2)
      expect(result.output?.type).not.toBe('error')

      const notes = result.agentState.messageHistory.filter(
        (m) => m.role === 'user' && m.tags?.includes(OUTPUT_LIMIT_TAG),
      )
      expect(notes).toHaveLength(1)
    })

    it('gives up with the output-limit message when every attempt overruns', async () => {
      let callCount = 0
      loopAgentStepsBaseParams.promptAiSdkStream = async function* () {
        callCount++
        yield {
          type: 'error' as const,
          source: 'output-limit' as const,
          message: 'The response hit its output token limit while reasoning.',
        }
        return promptSuccess(`limited-${callCount}`)
      }

      const result = await loopAgentSteps(loopAgentStepsBaseParams)

      expect(result.output?.type).toBe('error')
      expect((result.output as { message?: string }).message).toContain(
        REPEATED_OUTPUT_LIMIT_MESSAGE,
      )
      expect(callCount).toBe(MAX_CONSECUTIVE_STREAM_RECOVERIES + 1)
    })
  })

  describe('the end-of-turn context recount', () => {
    const BIG_PARTIAL_ANSWER = 'here is what I found so far. '.repeat(2000)

    const contextTokensAfterCancelledTurn = async (agentState: AgentState) => {
      const result = await loopAgentSteps({
        ...loopAgentStepsBaseParams,
        agentState,
        promptAiSdkStream: async function* () {
          yield { type: 'text' as const, text: BIG_PARTIAL_ANSWER }
          throw new AbortError('User pressed Ctrl+C')
        },
      })
      return result.agentState.contextTokenCount
    }

    const withHistory = (extra?: Partial<AgentState>): AgentState => ({
      ...mockAgentState,
      messageHistory: [...mockAgentState.messageHistory],
      contextTokenCount: 0,
      ...extra,
    })

    it('leaves the root counting the history the turn actually kept', async () => {
      const asRoot = await contextTokensAfterCancelledTurn(withHistory())
      expect(asRoot).toBeGreaterThan(10_000)
    })

    it('does not pay to recount a subagent nobody reads', async () => {
      const asRoot = await contextTokensAfterCancelledTurn(withHistory())
      const asSubagent = await contextTokensAfterCancelledTurn(
        withHistory({ parentId: 'parent-agent-id' }),
      )

      expect(asRoot).toBeGreaterThan(asSubagent * 2)
    })
  })
})
