import * as analytics from '@codebuff/common/analytics'
import { TEST_USER_ID } from '@codebuff/common/old-constants'
import { createTestAgentRuntimeParams } from '@codebuff/common/testing/fixtures/agent-runtime'
import { getInitialSessionState } from '@codebuff/common/types/session-state'
import { promptAborted, promptSuccess } from '@codebuff/common/util/error'
import { assistantMessage, userMessage } from '@codebuff/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { runAgentStep } from '../run-agent-step'
import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { mockFileContext } from './test-utils'
import * as toolExecutor from '../tools/tool-executor'

import type { AgentTemplate, StepGenerator } from '../templates/types'
import type { PromptAiSdkFn } from '@codebuff/common/types/contracts/llm'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { ParamsOf } from '@codebuff/common/types/function-params'
import type { AgentState } from '@codebuff/common/types/session-state'

const logger: Logger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

describe('n parameter and GENERATE_N functionality', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let agentRuntimeImpl: any
  let runAgentStepBaseParams: any

  beforeEach(() => {
    agentRuntimeImpl = {
      ...createTestAgentRuntimeParams(),
      addAgentStep: async () => 'test-agent-step-id',

      sendAction: () => {},
    }

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    spyOn(crypto, 'randomUUID').mockImplementation(
      () =>
        'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
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
    } as AgentTemplate

    const sessionState = getInitialSessionState(mockFileContext)
    mockAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'test-agent-id',
      runId:
        'test-run-id' as `${string}-${string}-${string}-${string}-${string}`,
      messageHistory: [
        userMessage('Initial message'),
        assistantMessage('Initial response'),
      ],
      output: undefined,
      directCreditsUsed: 0,
      childRunIds: [],
    }

    runAgentStepBaseParams = {
      ...agentRuntimeImpl,
      additionalToolDefinitions: () => Promise.resolve({}),
      runId: 'test-run-id',
      ancestorRunIds: [],
      repoId: undefined,
      repoUrl: undefined,
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      clientSessionId: 'test-session',
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      onResponseChunk: () => {},
      agentType: 'test-agent',
      localAgentTemplates: { 'test-agent': mockTemplate },
      agentState: mockAgentState,
      prompt: 'Test prompt',
      spawnParams: undefined,
      system: 'Test system',
      signal: new AbortController().signal,
      tools: {},
    }
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
  })

  describe('runAgentStep with n parameter', () => {
    it('should call promptAiSdk with n parameter when n is provided', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(
          promptSuccess(
            JSON.stringify(['Response 1', 'Response 2', 'Response 3']),
          ),
        ),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 3,
      })

      expect(runAgentStepBaseParams.promptAiSdk).toHaveBeenCalledWith(
        expect.objectContaining({
          n: 3,
        }),
      )

      expect(result.nResponses).toEqual([
        'Response 1',
        'Response 2',
        'Response 3',
      ])
      expect(result.shouldEndTurn).toBe(false)
      expect(result.messageId).toBe(null)
    })

    it('should return early without calling promptAiSdkStream when n is provided', async () => {
      runAgentStepBaseParams.promptAiSdkStream = mock(async function* () {
        yield { type: 'text' as const, text: 'Should not be called' }
        return 'mock-message-id'
      })

      runAgentStepBaseParams.promptAiSdk = mock(async () =>
        promptSuccess(JSON.stringify(['Response 1', 'Response 2'])),
      )

      await runAgentStep({
        ...runAgentStepBaseParams,
        n: 2,
      })

      expect(runAgentStepBaseParams.promptAiSdkStream).not.toHaveBeenCalled()
    })

    it('should parse JSON response from promptAiSdk correctly', async () => {
      const responses = [
        'First implementation',
        'Second implementation',
        'Third implementation',
        'Fourth implementation',
        'Fifth implementation',
      ]

      runAgentStepBaseParams.promptAiSdk = mock(async () =>
        promptSuccess(JSON.stringify(responses)),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 5,
      })

      expect(result.nResponses).toEqual(responses)
      expect(result.nResponses?.length).toBe(5)
    })

    it('should use normal flow when n is undefined', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(async () =>
        promptSuccess('Should not be called'),
      )

      runAgentStepBaseParams.promptAiSdkStream = mock(async function* () {
        yield { type: 'text' as const, text: 'Normal response' }
        return promptSuccess('mock-message-id')
      })

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: undefined,
      })

      expect(runAgentStepBaseParams.promptAiSdk).not.toHaveBeenCalled()
      expect(runAgentStepBaseParams.promptAiSdkStream).toHaveBeenCalled()
      expect(result.nResponses).toBeUndefined()
    })
  })

  describe('runProgrammaticStep with GENERATE_N', () => {
    it('should handle GENERATE_N with different n values', async () => {
      for (const nValue of [1, 3, 5, 10]) {
        mockTemplate.handleSteps = function* () {
          yield { type: 'GENERATE_N', n: nValue }
        }

        const result = await runProgrammaticStep({
          ...agentRuntimeImpl,
          runId: `test-run-id-${nValue}`,
          ancestorRunIds: [],
          repoId: undefined,
          repoUrl: undefined,
          agentState: {
            ...mockAgentState,
            runId:
              `test-run-id-${nValue}` as `${string}-${string}-${string}-${string}-${string}`,
          },
          template: mockTemplate,
          prompt: 'Test prompt',
          toolCallParams: {},
          userId: TEST_USER_ID,
          userInputId: 'test-user-input',
          clientSessionId: 'test-session',
          fingerprintId: 'test-fingerprint',
          onResponseChunk: () => {},
          onCostCalculated: async () => {},
          fileContext: mockFileContext,
          localAgentTemplates: {},
          system: 'Test system prompt',
          stepsComplete: false,
          stepNumber: 1,
          logger,
          signal: new AbortController().signal,
          tools: {},
        })

        expect(result.generateN).toBe(nValue)

        clearAgentGeneratorCache({ logger })
      }
    })

    it('should not set generateN when GENERATE_N is not yielded', async () => {
      mockTemplate.handleSteps = function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'write_file', input: { path: 'out.txt' } }
        yield { toolName: 'end_turn', input: {} }
      }

      const result = await runProgrammaticStep({
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test prompt',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-user-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      })

      expect(result.generateN).toBeUndefined()
      expect(result.endTurn).toBe(true)
    })
  })

  describe('Integration: programmatic step -> n parameter -> nResponses', () => {
    it('should flow GENERATE_N through full pipeline', async () => {
      let receivedNResponses: string[] | undefined
      const expectedResponses = ['Impl A', 'Impl B', 'Impl C']

      mockTemplate.handleSteps = function* () {
        const step1 = yield { type: 'GENERATE_N', n: 3 }
        receivedNResponses = step1.nResponses

        yield {
          toolName: 'set_output',
          input: { selectedResponses: step1.nResponses },
        }
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      mockTemplate.toolNames = ['set_output', 'end_turn']

      const executeToolCallSpy = spyOn(
        toolExecutor,
        'executeToolCall',
      ).mockImplementation(
        async (
          options: ParamsOf<typeof toolExecutor.executeToolCall>,
        ): ReturnType<typeof toolExecutor.executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test prompt',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-user-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(3)
      expect(result1.endTurn).toBe(false)

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: expectedResponses,
        stepNumber: 2,
      })

      expect(receivedNResponses).toEqual(expectedResponses)
      expect(result2.agentState.output).toEqual({
        selectedResponses: expectedResponses,
      })

      executeToolCallSpy.mockRestore()
    })

    it('should handle GENERATE_N with tool execution before and after', async () => {
      const executionLog: string[] = []

      mockTemplate.handleSteps = function* () {
        executionLog.push('pre-processing')
        yield {
          toolName: 'read_files',
          input: { paths: ['context.txt'] },
        }

        executionLog.push('generating responses')
        const step = yield { type: 'GENERATE_N', n: 5 }
        executionLog.push(`received ${step.nResponses?.length} responses`)

        yield {
          toolName: 'write_file',
          input: {
            path: 'results.txt',
            instructions: 'Write results',
            content: `Got ${step.nResponses?.length} responses`,
          },
        }
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      mockTemplate.toolNames = ['read_files', 'write_file', 'end_turn']

      const executeToolCallSpy = spyOn(
        toolExecutor,
        'executeToolCall',
      ).mockImplementation(async () => {})

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(5)
      expect(executionLog).toEqual(['pre-processing', 'generating responses'])

      const mockResponses = ['R1', 'R2', 'R3', 'R4', 'R5']
      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: mockResponses,
        stepNumber: 2,
      })

      expect(executionLog).toEqual([
        'pre-processing',
        'generating responses',
        'received 5 responses',
      ])
      expect(result2.endTurn).toBe(true)

      executeToolCallSpy.mockRestore()
    })

    it('should handle multiple GENERATE_N calls in sequence', async () => {
      const allResponses: string[][] = []

      mockTemplate.handleSteps = function* () {
        const step1 = yield { type: 'GENERATE_N', n: 2 }
        allResponses.push(step1.nResponses || [])

        yield {
          toolName: 'write_file',
          input: {
            path: 'batch1.txt',
            instructions: 'Write batch 1',
            content: 'Batch 1',
          },
        }

        const step2 = yield { type: 'GENERATE_N', n: 3 }
        allResponses.push(step2.nResponses || [])

        yield {
          toolName: 'set_output',
          input: { totalBatches: allResponses.length },
        }
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      mockTemplate.toolNames = ['write_file', 'set_output', 'end_turn']

      const executeToolCallSpy = spyOn(
        toolExecutor,
        'executeToolCall',
      ).mockImplementation(
        async (
          options: ParamsOf<typeof toolExecutor.executeToolCall>,
        ): ReturnType<typeof toolExecutor.executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(2)

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: ['A1', 'A2'],
        stepNumber: 2,
      })

      expect(result2.generateN).toBe(3)

      const result3 = await runProgrammaticStep({
        ...mockParams,
        agentState: result2.agentState,
        nResponses: ['B1', 'B2', 'B3'],
        stepNumber: 3,
      })

      expect(allResponses).toEqual([
        ['A1', 'A2'],
        ['B1', 'B2', 'B3'],
      ])
      expect(result3.agentState.output).toEqual({ totalBatches: 2 })

      executeToolCallSpy.mockRestore()
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle GENERATE_N with n=1', async () => {
      mockTemplate.handleSteps = function* () {
        yield { type: 'GENERATE_N', n: 1 }
      } as () => StepGenerator

      const result = await runProgrammaticStep({
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      })

      expect(result.generateN).toBe(1)
      expect(result.endTurn).toBe(false)
    })

    it('should handle empty nResponses array', async () => {
      let receivedResponses: string[] | undefined

      mockTemplate.handleSteps = function* () {
        const step = yield { type: 'GENERATE_N', n: 3 }
        receivedResponses = step.nResponses
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      await runProgrammaticStep(mockParams)

      await runProgrammaticStep({
        ...mockParams,
        nResponses: [],
        stepNumber: 2,
      })

      expect(receivedResponses).toEqual([])
    })

    it('should handle undefined nResponses', async () => {
      let receivedResponses: string[] | undefined

      mockTemplate.handleSteps = function* () {
        const step = yield { type: 'GENERATE_N', n: 2 }
        receivedResponses = step.nResponses
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      await runProgrammaticStep(mockParams)

      await runProgrammaticStep({
        ...mockParams,
        nResponses: undefined,
        stepNumber: 2,
      })

      expect(receivedResponses).toBeUndefined()
    })

    it('should handle GENERATE_N followed by error', async () => {
      mockTemplate.handleSteps = function* () {
        yield { type: 'GENERATE_N', n: 3 }
        throw new Error('Unexpected error after GENERATE_N')
      } as () => StepGenerator

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(3)

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: ['R1', 'R2', 'R3'],
        stepNumber: 2,
      })

      expect(result2.endTurn).toBe(true)
      expect(result2.agentState.output?.error).toContain(
        'Unexpected error after GENERATE_N',
      )
    })

    it('should handle GENERATE_N with STEP afterwards', async () => {
      let receivedResponses: string[] | undefined

      mockTemplate.handleSteps = function* () {
        const step1 = yield { type: 'GENERATE_N', n: 4 }
        receivedResponses = step1.nResponses

        yield 'STEP'

        yield {
          toolName: 'set_output',
          input: { processedResponses: receivedResponses?.length },
        }
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      mockTemplate.toolNames = ['set_output', 'end_turn']

      const mockParams: ParamsOf<typeof runProgrammaticStep> = {
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      }

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(4)

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: ['A', 'B', 'C', 'D'],
        stepNumber: 2,
      })

      expect(receivedResponses).toEqual(['A', 'B', 'C', 'D'])
      expect(result2.endTurn).toBe(false)
    })

    it('should clear generateN when endTurn is true', async () => {
      mockTemplate.handleSteps = function* () {
        yield { type: 'GENERATE_N', n: 2 }
      } as () => StepGenerator

      const result = await runProgrammaticStep({
        ...agentRuntimeImpl,
        runId: 'test-run-id',
        ancestorRunIds: [],
        repoId: undefined,
        repoUrl: undefined,
        agentState: mockAgentState,
        template: mockTemplate,
        prompt: 'Test',
        toolCallParams: {},
        userId: TEST_USER_ID,
        userInputId: 'test-input',
        clientSessionId: 'test-session',
        fingerprintId: 'test-fingerprint',
        onResponseChunk: () => {},
        onCostCalculated: async () => {},
        fileContext: mockFileContext,
        localAgentTemplates: {},
        system: 'Test system prompt',
        stepsComplete: false,
        stepNumber: 1,
        logger,
        signal: new AbortController().signal,
        tools: {},
      })

      expect(result.generateN).toBe(2)
      expect(result.endTurn).toBe(false)
    })
  })

  describe('runAgentStep n parameter edge cases', () => {
    it('should handle promptAiSdk returning malformed JSON', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptSuccess('Not valid JSON')),
      )

      await expect(
        runAgentStep({
          ...runAgentStepBaseParams,
          n: 3,
        }),
      ).rejects.toThrow()
    })

    it('should update agentState.creditsUsed when using n parameter', async () => {
      const freshAgentState = {
        ...mockAgentState,
        creditsUsed: 0,
        directCreditsUsed: 0,
      }

      runAgentStepBaseParams.promptAiSdk = mock(
        async (params: ParamsOf<PromptAiSdkFn>): ReturnType<PromptAiSdkFn> => {
          await params.onCostCalculated?.(100)
          return promptSuccess(JSON.stringify(['R1', 'R2', 'R3']))
        },
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        agentState: freshAgentState,
        n: 3,
      })

      expect(runAgentStepBaseParams.promptAiSdk).toHaveBeenCalled()

      expect(result.agentState.creditsUsed).toBe(100)
      expect(result.agentState.directCreditsUsed).toBe(100)
    })

    it('should preserve messageHistory when using n parameter', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptSuccess(JSON.stringify(['R1', 'R2']))),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 2,
      })

      expect(result.agentState.messageHistory.length).toBeGreaterThanOrEqual(
        mockAgentState.messageHistory.length,
      )

      expect(result.agentState.messageHistory).toBeDefined()
    })

    it('should return early with shouldEndTurn: true when promptAiSdk returns aborted', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted('User cancelled')),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 3,
      })

      expect(runAgentStepBaseParams.promptAiSdk).toHaveBeenCalled()

      expect(result.fullResponse).toBe('')
      expect(result.shouldEndTurn).toBe(true)
      expect(result.messageId).toBe(null)
      expect(result.nResponses).toBeUndefined()
    })

    it('should return early when promptAiSdk returns aborted without reason', async () => {
      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted()),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        n: 2,
      })

      expect(result.fullResponse).toBe('')
      expect(result.shouldEndTurn).toBe(true)
      expect(result.messageId).toBe(null)
      expect(result.nResponses).toBeUndefined()
    })

    it('should not modify agentState.creditsUsed when promptAiSdk is aborted before onCostCalculated', async () => {
      const freshAgentState = {
        ...mockAgentState,
        creditsUsed: 0,
        directCreditsUsed: 0,
      }

      runAgentStepBaseParams.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted()),
      )

      const result = await runAgentStep({
        ...runAgentStepBaseParams,
        agentState: freshAgentState,
        n: 3,
      })

      expect(result.agentState.creditsUsed).toBe(0)
      expect(result.agentState.directCreditsUsed).toBe(0)
    })
  })
})
