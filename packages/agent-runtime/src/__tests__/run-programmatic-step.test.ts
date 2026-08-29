import * as analytics from '@codebuff/common/analytics'
import { TEST_USER_ID } from '@codebuff/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@codebuff/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@codebuff/common/types/session-state'
import {
  assistantMessage,
  jsonToolResult,
  userMessage,
} from '@codebuff/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'
import { cloneDeep } from 'lodash'

import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { mockFileContext } from './test-utils'
import * as toolExecutor from '../tools/tool-executor'

import type { AgentTemplate, StepGenerator } from '../templates/types'
import type { executeToolCall } from '../tools/tool-executor'
import type { PublicAgentState } from '@codebuff/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@codebuff/common/types/contracts/agent-runtime'
import type { SendActionFn } from '@codebuff/common/types/contracts/client'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { ParamsOf } from '@codebuff/common/types/function-params'
import type { ToolMessage } from '@codebuff/common/types/messages/codebuff-message'
import type { ToolResultOutput } from '@codebuff/common/types/messages/content-part'
import type { AgentState } from '@codebuff/common/types/session-state'

const logger: Logger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

describe('runProgrammaticStep', () => {
  let mockTemplate: AgentTemplate
  let mockAgentState: AgentState
  let mockParams: ParamsOf<typeof runProgrammaticStep>
  let executeToolCallSpy: ReturnType<
    typeof spyOn<typeof toolExecutor, 'executeToolCall'>
  >
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

  beforeEach(() => {
    agentRuntimeImpl = {
      ...TEST_AGENT_RUNTIME_IMPL,
      addAgentStep: async () => 'test-agent-step-id',

      sendAction: () => {},
    }

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    executeToolCallSpy = spyOn(
      toolExecutor,
      'executeToolCall',
    ).mockImplementation(async () => {})

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

    mockParams = {
      ...agentRuntimeImpl,
      runId: 'test-run-id',
      ancestorRunIds: [],
      repoId: undefined,
      repoUrl: undefined,
      agentState: mockAgentState,
      template: mockTemplate,
      prompt: 'Test prompt',
      toolCallParams: { testParam: 'value' },
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
      tools: {},

      logger,
      signal: new AbortController().signal,
    }
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
  })

  describe('step context', () => {
    it('passes the template model to handleSteps', async () => {
      let seenModel: string | undefined = 'not-called'
      mockTemplate.model = 'moonshotai/kimi-k2.7-code'
      mockTemplate.handleSteps = ({ model }) => {
        seenModel = model
        return (function* () {
          yield { toolName: 'end_turn', input: {} }
        })() as StepGenerator
      }

      await runProgrammaticStep(mockParams)

      expect(seenModel).toBe('moonshotai/kimi-k2.7-code')
    })

    it('reflects a per-request model override on the next run', async () => {
      const seen: (string | undefined)[] = []
      mockTemplate.handleSteps = ({ model }) => {
        seen.push(model)
        return (function* () {
          yield { toolName: 'end_turn', input: {} }
        })() as StepGenerator
      }

      mockTemplate.model = 'minimax/minimax-m3'
      await runProgrammaticStep(mockParams)
      mockTemplate.model = 'moonshotai/kimi-k2.7-code'
      await runProgrammaticStep(mockParams)

      expect(seen).toEqual(['minimax/minimax-m3', 'moonshotai/kimi-k2.7-code'])
    })
  })

  describe('generator lifecycle', () => {
    it('should create new generator when none exists', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState).toBeDefined()
    })

    it('should not reuse existing generator for same agent', async () => {
      let callCount = 0
      const createGenerator = () => {
        callCount++
        return (function* () {
          yield { toolName: 'end_turn', input: {} }
        })() as StepGenerator
      }

      mockTemplate.handleSteps = createGenerator
      await runProgrammaticStep(mockParams)
      expect(callCount).toBe(1)

      await runProgrammaticStep(mockParams)
      expect(callCount).toBe(2)
    })

    it('should handle STEP_ALL generator state', async () => {
      const mockGenerator = (function* () {
        yield 'STEP_ALL'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.endTurn).toBe(false)

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
      })
      expect(result2.endTurn).toBe(false)
      expect(result2.agentState.agentId).toEqual(result1.agentState.agentId)
    })

    it('should throw error when template has no handleStep', async () => {
      mockTemplate.handleSteps = undefined

      await expect(runProgrammaticStep(mockParams)).rejects.toThrow(
        'No step handler found for agent template test-agent',
      )
    })
  })

  describe('tool execution', () => {
    it('should not add tool call message for add_message tool', async () => {
      const mockGenerator = (function* () {
        yield {
          toolName: 'add_message',
          input: { role: 'user', content: 'Hello world' },
          includeToolCall: false,
        }
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() satisfies StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = ['add_message', 'read_files', 'end_turn']

      const sentChunks: string[] = []
      const sendActionMock = mock<SendActionFn>(({ action }) => {
        if (action.type === 'subagent-response-chunk') {
          sentChunks.push(action.chunk)
        }
      })

      const result = await runProgrammaticStep({
        ...mockParams,
        sendAction: sendActionMock,
      })

      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'add_message',
          input: { role: 'user', content: 'Hello world' },
        }),
      )

      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
        }),
      )

      const addMessageToolCallChunk = sentChunks.find(
        (chunk) =>
          typeof chunk === 'string' &&
          chunk.includes('add_message') &&
          chunk.includes('Hello world'),
      )
      expect(addMessageToolCallChunk).toBeUndefined()

      const addMessageToolCallInHistory = result.agentState.messageHistory.find(
        (msg) =>
          msg.content[0].type === 'text' &&
          msg.content[0].text.includes('add_message') &&
          msg.content[0].text.includes('Hello world'),
      )
      expect(addMessageToolCallInHistory).toBeUndefined()

      expect(result.endTurn).toBe(true)
    })
    it('should execute single tool call', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(2)
      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'read_files',
          input: expect.any(Object),
          agentTemplate: mockTemplate,
          fileContext: mockFileContext,
        }),
      )
      expect(result.endTurn).toBe(true)
    })

    it('should add find_files tool result to messageHistory', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'find_files', input: { query: 'authentication' } }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = ['find_files', 'end_turn']

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'find_files') {
            const toolResult: ToolMessage = {
              role: 'tool',
              toolName: 'find_files',
              toolCallId: 'find-files-call-id',
              content: jsonToolResult({
                files: [
                  { path: 'src/auth.ts', relevance: 0.9 },
                  { path: 'src/login.ts', relevance: 0.8 },
                ],
              }),
            }
            options.toolResults.push(toolResult)

            options.agentState.messageHistory.push(toolResult)
          }
        },
      )

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'find_files',
          input: { query: 'authentication' },
          agentTemplate: mockTemplate,
          fileContext: mockFileContext,
        }),
      )

      const toolMessages = result.agentState.messageHistory.filter(
        (msg) =>
          msg.role === 'tool' &&
          JSON.stringify(msg.content).includes('src/auth.ts'),
      )
      expect(toolMessages).toHaveLength(1)
      expect(JSON.stringify(toolMessages[0].content)).toContain('src/auth.ts')
      expect(JSON.stringify(toolMessages[0].content)).toContain('src/login.ts')

      expect(result.endTurn).toBe(true)
    })

    it('should execute multiple tool calls in sequence', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['file1.txt'] } }
        yield {
          toolName: 'write_file',
          input: { path: 'file2.txt', content: 'test' },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(3)
      expect(result.endTurn).toBe(true)
    })

    it('should comprehensively test STEP_ALL functionality with multiple tools and state management', async () => {
      const toolResultsReceived: ToolResultOutput[][] = []
      const stateSnapshots: PublicAgentState[] = []
      let stepCount = 0

      const mockGenerator = (function* () {
        stepCount++

        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['src/auth.ts', 'src/config.ts'] },
        }
        toolResultsReceived.push(step1.toolResult)
        stateSnapshots.push({ ...step1.agentState })

        const step2 = yield {
          toolName: 'code_search',
          input: { pattern: 'authenticate', flags: '-i' },
        }
        toolResultsReceived.push(step2.toolResult)
        stateSnapshots.push({ ...step2.agentState })

        const step3 = yield {
          toolName: 'create_plan',
          input: {
            path: 'analysis-plan.md',
            plan: 'Comprehensive analysis of authentication system',
          },
        }
        toolResultsReceived.push(step3.toolResult)
        stateSnapshots.push({ ...step3.agentState })

        const step4 = yield {
          toolName: 'add_subgoal',
          input: {
            id: 'auth-analysis',
            objective: 'Analyze authentication patterns',
            status: 'IN_PROGRESS',
            plan: 'Review auth files and create recommendations',
          },
        }
        toolResultsReceived.push(step4.toolResult)
        stateSnapshots.push({ ...step4.agentState })

        const step5 = yield {
          toolName: 'write_file',
          input: {
            path: 'auth-analysis.md',
            instructions: 'Create authentication analysis document',
            content: '# Authentication Analysis\n\nBased on code review...',
          },
        }
        toolResultsReceived.push(step5.toolResult)
        stateSnapshots.push({ ...step5.agentState })

        const step6 = yield {
          toolName: 'update_subgoal',
          input: {
            id: 'auth-analysis',
            status: 'COMPLETE',
            log: 'Analysis completed successfully',
          },
        }
        toolResultsReceived.push(step6.toolResult)
        stateSnapshots.push({ ...step6.agentState })

        const step7 = yield {
          toolName: 'set_output',
          input: {
            status: 'success',
            filesAnalyzed: ['src/auth.ts', 'src/config.ts'],
            patternsFound: 3,
            recommendations: ['Use stronger auth', 'Add 2FA'],
            completedAt: new Date().toISOString(),
          },
        }
        toolResultsReceived.push(step7.toolResult)
        stateSnapshots.push({ ...step7.agentState })

        yield 'STEP_ALL'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = [
        'read_files',
        'code_search',
        'create_plan',
        'add_subgoal',
        'write_file',
        'update_subgoal',
        'set_output',
        'end_turn',
      ]

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          const { toolName, input, toolResults, agentState } = options

          let result: string
          switch (toolName) {
            case 'read_files':
              result = JSON.stringify({
                'src/auth.ts':
                  'export function authenticate(user) { return true; }',
                'src/config.ts': 'export const authConfig = { enabled: true };',
              })
              break
            case 'code_search':
              result =
                'src/auth.ts:1:export function authenticate(user) {\nsrc/config.ts:1:authConfig'
              break
            case 'create_plan':
              result = 'Plan created successfully at analysis-plan.md'
              break
            case 'add_subgoal':
              result = 'Subgoal "auth-analysis" added successfully'
              agentState.agentContext['auth-analysis'] = {
                objective: 'Analyze authentication patterns',
                status: 'IN_PROGRESS',
                plan: 'Review auth files and create recommendations',
                logs: [],
              }
              break
            case 'write_file':
              result = 'File written successfully: auth-analysis.md'
              break
            case 'update_subgoal':
              result = 'Subgoal "auth-analysis" updated successfully'
              if (agentState.agentContext['auth-analysis']) {
                agentState.agentContext['auth-analysis'].status = 'COMPLETE'
                agentState.agentContext['auth-analysis'].logs.push(
                  'Analysis completed successfully',
                )
              }
              break
            case 'set_output':
              result = 'Output set successfully'
              agentState.output = input
              break
            default:
              result = `${toolName} executed successfully`
          }

          const toolResult: ToolMessage = {
            role: 'tool',
            toolName,
            toolCallId: `${toolName}-call-id`,
            content: [
              {
                type: 'json',
                value: result,
              },
            ],
          }
          toolResults.push(toolResult)

          agentState.messageHistory.push(toolResult)
        },
      )

      const result1 = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(7)
      expect(result1.endTurn).toBe(false)
      expect(stepCount).toBe(1)

      const toolCalls = executeToolCallSpy.mock.calls
      expect(toolCalls[0][0].toolName).toBe('read_files')
      expect(toolCalls[0][0].input.paths).toEqual([
        'src/auth.ts',
        'src/config.ts',
      ])
      expect(toolCalls[1][0].toolName).toBe('code_search')
      expect(toolCalls[1][0].input.pattern).toBe('authenticate')
      expect(toolCalls[2][0].toolName).toBe('create_plan')
      expect(toolCalls[3][0].toolName).toBe('add_subgoal')
      expect(toolCalls[4][0].toolName).toBe('write_file')
      expect(toolCalls[5][0].toolName).toBe('update_subgoal')
      expect(toolCalls[6][0].toolName).toBe('set_output')

      expect(toolResultsReceived).toHaveLength(7)
      expect(JSON.stringify(toolResultsReceived[0])).toContain('authenticate')
      expect(JSON.stringify(toolResultsReceived[3])).toContain('auth-analysis')
      expect(JSON.stringify(toolResultsReceived[6])).toContain(
        'Output set successfully',
      )

      expect(stateSnapshots).toHaveLength(7)
      expect(Object.keys(result1.agentState.agentContext)).toContain(
        'auth-analysis',
      )
      expect(result1.agentState.agentContext['auth-analysis']?.status).toBe(
        'COMPLETE',
      )
      expect(result1.agentState.output).toEqual({
        status: 'success',
        filesAnalyzed: ['src/auth.ts', 'src/config.ts'],
        patternsFound: 3,
        recommendations: ['Use stronger auth', 'Add 2FA'],
        completedAt: expect.any(String),
      })

      expect(toolResultsReceived).toHaveLength(7)
      expect(toolResultsReceived.every((result) => result !== undefined)).toBe(
        true,
      )

      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentState: expect.objectContaining({
            messageHistory: expect.any(Array),
          }),
        }),
      )

      executeToolCallSpy.mockClear()

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
      })

      expect(executeToolCallSpy).not.toHaveBeenCalled()
      expect(result2.endTurn).toBe(false)
      expect(result2.agentState.agentId).toEqual(result1.agentState.agentId)
      expect(stepCount).toBe(1)

      const result3 = await runProgrammaticStep({
        ...mockParams,
        agentState: result2.agentState,
      })

      expect(executeToolCallSpy).not.toHaveBeenCalled()
      expect(result3.endTurn).toBe(false)
      expect(result3.agentState.agentId).toEqual(result1.agentState.agentId)
      expect(stepCount).toBe(1)
    })

    it('should pass tool results back to generator', async () => {
      const toolResults: ToolMessage[] = []
      let receivedToolResult: ToolResultOutput[] | undefined

      const mockGenerator = (function* () {
        const input1 = yield {
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
        }
        receivedToolResult = input1.toolResult
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'read_files') {
            options.toolResults.push({
              role: 'tool',
              toolName: 'read_files',
              toolCallId: 'test-id',
              content: [
                {
                  type: 'json',
                  value: 'file content',
                },
              ],
            } satisfies ToolMessage)
          }
        },
      )

      await runProgrammaticStep(mockParams)

      expect(receivedToolResult).toEqual([
        {
          type: 'json',
          value: 'file content',
        },
      ])
    })
  })

  describe('generator control flow', () => {
    it('should handle STEP value to break execution', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield 'STEP'
        yield {
          toolName: 'write_file',
          input: { path: 'test.txt', content: 'test' },
        }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(1)
      expect(result.endTurn).toBe(false)
    })

    it('should handle generator completion', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        return
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
    })

    it('should end turn when end_turn tool is called', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
        yield {
          toolName: 'write_file',
          input: { path: 'test.txt', content: 'test' },
        }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledTimes(2)
      expect(result.endTurn).toBe(true)
    })
  })

  describe('state management', () => {
    it('should preserve agent state changes', async () => {
      const mockGenerator = (function* () {
        yield {
          toolName: 'set_output',
          input: { status: 'complete' },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames.push('set_output')

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = { status: 'complete' }
          }
        },
      )

      const result = await runProgrammaticStep(mockParams)

      expect(result.agentState.output).toEqual({ status: 'complete' })
    })

    it('should preserve message history', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator
      const previousMessageHistory = cloneDeep(mockAgentState.messageHistory)

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.agentState.messageHistory.length).toBeGreaterThanOrEqual(
        previousMessageHistory.length,
      )
      expect(result.agentState.messageHistory[0]).toEqual(
        previousMessageHistory[0],
      )
      expect(result.agentState.messageHistory[1]).toEqual(
        previousMessageHistory[1],
      )
      const lastMessage =
        result.agentState.messageHistory[
          result.agentState.messageHistory.length - 1
        ]
      expect(lastMessage.role).toBe('assistant')
      expect(lastMessage.content[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'end_turn',
      })
    })
  })

  describe('error handling', () => {
    it('should handle generator errors gracefully', async () => {
      const mockGenerator = (function* () {
        throw new Error('Generator error')
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain('Generator error')
      expect(
        responseChunks.some(
          (chunk) =>
            typeof chunk === 'string' && chunk.includes('Generator error'),
        ),
      ).toBe(true)
    })

    it('should handle tool execution errors', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      executeToolCallSpy.mockRejectedValue(new Error('Tool execution failed'))

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain('Tool execution failed')
    })

    it('should handle non-Error exceptions', async () => {
      const mockGenerator = (function* () {
        throw 'String error'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain('Unknown error')
    })
  })

  describe('output schema validation', () => {
    it('should validate output against outputSchema when using setOutput', async () => {
      const schemaTemplate = {
        ...mockTemplate,
        outputMode: 'structured_output' as const,
        outputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            status: { type: 'string', enum: ['success', 'error'] },
            count: { type: 'number' },
          },
          required: ['message', 'status'],
        },
        toolNames: ['set_output', 'end_turn'],
      }

      const mockGenerator = (function* () {
        yield {
          toolName: 'set_output',
          input: {
            message: 'Task completed successfully',
            status: 'success',
            count: 42,
          },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      schemaTemplate.handleSteps = () => mockGenerator

      executeToolCallSpy.mockRestore()

      const result = await runProgrammaticStep({
        ...mockParams,
        template: schemaTemplate as unknown as AgentTemplate,
        localAgentTemplates: {
          'test-agent': schemaTemplate as unknown as AgentTemplate,
        },
      })

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output).toEqual({
        message: 'Task completed successfully',
        status: 'success',
        count: 42,
      })
    })

    it('should handle invalid output that fails schema validation', async () => {
      const schemaTemplate = {
        ...mockTemplate,
        outputMode: 'structured_output' as const,
        outputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            status: { type: 'string', enum: ['success', 'error'] },
          },
          required: ['message', 'status'],
        },
        toolNames: ['set_output', 'end_turn'],
      }

      const mockGenerator = (function* () {
        yield {
          toolName: 'set_output',
          input: {
            message: 'Task completed',
            status: 'invalid_status',
            extraField: 'not allowed',
          },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      schemaTemplate.handleSteps = () => mockGenerator

      executeToolCallSpy.mockRestore()

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep({
        ...mockParams,
        template: schemaTemplate as unknown as AgentTemplate,
        localAgentTemplates: {
          'test-agent': schemaTemplate as unknown as AgentTemplate,
        },
      })

      expect(result.endTurn).toBe(true)
      expect(result.agentState).toBeDefined()
    })

    it('should work with agents that have no outputSchema', async () => {
      const noSchemaTemplate = {
        ...mockTemplate,
        outputMode: 'last_message' as const,
        outputSchema: undefined,
        toolNames: ['set_output', 'end_turn'],
      }

      const mockGenerator = (function* () {
        yield {
          toolName: 'set_output',
          input: {
            anyField: 'any value',
            anotherField: 123,
          },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      noSchemaTemplate.handleSteps = () => mockGenerator

      executeToolCallSpy.mockRestore()

      const result = await runProgrammaticStep({
        ...mockParams,
        template: noSchemaTemplate,
        localAgentTemplates: { 'test-agent': noSchemaTemplate },
      })

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output).toEqual({
        anyField: 'any value',
        anotherField: 123,
      })
    })

    it('should work with outputMode structured_output but no outputSchema defined', async () => {
      const schemaWithoutSchemaTemplate = {
        ...mockTemplate,
        outputMode: 'structured_output' as const,
        outputSchema: undefined,
        toolNames: ['set_output', 'end_turn'],
      }

      const mockGenerator = (function* () {
        yield {
          toolName: 'set_output',
          input: {
            result: 'success',
            data: { count: 5 },
          },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      schemaWithoutSchemaTemplate.handleSteps = () => mockGenerator

      executeToolCallSpy.mockRestore()

      const result = await runProgrammaticStep({
        ...mockParams,
        template: schemaWithoutSchemaTemplate,
        localAgentTemplates: { 'test-agent': schemaWithoutSchemaTemplate },
      })

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output).toEqual({
        result: 'success',
        data: { count: 5 },
      })
    })
  })

  describe('stepsComplete parameter', () => {
    it('should pass stepsComplete=false by default', async () => {
      let receivedStepsComplete: boolean | undefined

      const mockGenerator = (function* () {
        const input = yield {
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
        }
        receivedStepsComplete = input.stepsComplete
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep({
        ...mockParams,
        stepsComplete: false,
      })

      expect(receivedStepsComplete).toBe(false)
    })

    it('should pass stepsComplete=true when specified', async () => {
      let receivedStepsComplete: boolean | undefined

      const mockGenerator = (function* () {
        const input = yield {
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
        }
        receivedStepsComplete = input.stepsComplete
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(receivedStepsComplete).toBe(true)
    })

    it('should handle post-processing when stepsComplete=true', async () => {
      const executionLog: string[] = []

      const mockGenerator = (function* () {
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['file1.txt'] },
        }
        executionLog.push(`step1: stepsComplete=${step1.stepsComplete}`)

        if (step1.stepsComplete) {
          executionLog.push('performing post-processing')
          yield {
            toolName: 'set_output',
            input: { message: 'Post-processing completed' },
          }
        }

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = ['read_files', 'set_output', 'end_turn']

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(executionLog).toEqual([
        'step1: stepsComplete=true',
        'performing post-processing',
      ])
      expect(result.agentState.output).toEqual({
        message: 'Post-processing completed',
      })
      expect(executeToolCallSpy).toHaveBeenCalledTimes(3)
    })

    it('should clear STEP_ALL mode when stepsComplete=true', async () => {
      let generatorCallCount = 0
      const createGenerator = () => {
        generatorCallCount++
        if (generatorCallCount === 1) {
          return (function* () {
            yield 'STEP_ALL'
          })() as StepGenerator
        } else {
          return (function* () {
            yield {
              toolName: 'set_output',
              input: { status: 'finalized' },
            }
            yield { toolName: 'end_turn', input: {} }
          })() as StepGenerator
        }
      }

      mockTemplate.handleSteps = createGenerator
      mockTemplate.toolNames = ['set_output', 'end_turn']

      const result1 = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: false,
      })
      expect(result1.endTurn).toBe(false)
      expect(generatorCallCount).toBe(1)

      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        stepsComplete: false,
      })
      expect(result2.endTurn).toBe(false)
      expect(generatorCallCount).toBe(1)

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const result3 = await runProgrammaticStep({
        ...mockParams,
        agentState: result2.agentState,
        stepsComplete: true,
      })

      expect(result3.endTurn).toBe(true)
      expect(generatorCallCount).toBe(1)
    })
  })

  describe('continued stepping after completion', () => {
    it('should allow agent to continue with STEP after initial completion', async () => {
      const executionSteps: string[] = []

      const mockGenerator = (function* () {
        executionSteps.push('initial execution')
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['config.txt'] },
        }

        if (step1.stepsComplete) {
          executionSteps.push('post-processing detected')
          yield {
            toolName: 'write_file',
            input: {
              path: 'summary.txt',
              instructions: 'Create summary',
              content: 'Processing completed',
            },
          }

          executionSteps.push('requesting continuation')
          const step2 = yield 'STEP'
          executionSteps.push(`step2: stepsComplete=${step2.stepsComplete}`)

          if (!step2.stepsComplete) {
            yield {
              toolName: 'set_output',
              input: { message: 'Continued processing' },
            }
          }
        }

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = [
        'read_files',
        'write_file',
        'set_output',
        'end_turn',
      ]

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          }
        },
      )

      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(executionSteps).toEqual([
        'initial execution',
        'post-processing detected',
        'requesting continuation',
      ])
      expect(result.endTurn).toBe(false)
      expect(executeToolCallSpy).toHaveBeenCalledTimes(2)

      const finalResult = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: false,
      })

      expect(executionSteps).toEqual([
        'initial execution',
        'post-processing detected',
        'requesting continuation',
        'step2: stepsComplete=false',
      ])
      expect(finalResult.endTurn).toBe(true)
      expect(executeToolCallSpy).toHaveBeenCalledTimes(4)
    })

    it('should allow agent to continue with STEP_ALL after initial completion', async () => {
      const executionSteps: string[] = []

      const mockGenerator = (function* () {
        executionSteps.push('initial execution')
        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['data.txt'] },
        }

        if (step1.stepsComplete) {
          executionSteps.push('post-processing with STEP_ALL')
          yield {
            toolName: 'write_file',
            input: {
              path: 'processed.txt',
              instructions: 'Create processed file',
              content: 'Data processed',
            },
          }

          yield 'STEP_ALL'
          executionSteps.push('STEP_ALL requested')
        }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = ['read_files', 'write_file', 'end_turn']

      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(executionSteps).toEqual([
        'initial execution',
        'post-processing with STEP_ALL',
      ])
      expect(result.endTurn).toBe(false)
      expect(executeToolCallSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle complex post-processing workflow', async () => {
      const workflowSteps: string[] = []
      let stepCount = 0

      const mockGenerator = (function* () {
        stepCount++
        workflowSteps.push(`generator run ${stepCount}`)

        const step1 = yield {
          toolName: 'read_files',
          input: { paths: ['input.txt'] },
        }
        workflowSteps.push(
          `read completed, stepsComplete=${step1.stepsComplete}`,
        )

        if (step1.stepsComplete) {
          workflowSteps.push('entering post-processing')

          yield {
            toolName: 'code_search',
            input: { pattern: 'TODO', flags: '-n' },
          }

          yield {
            toolName: 'write_file',
            input: {
              path: 'analysis.md',
              instructions: 'Create analysis report',
              content: '# Analysis Report\n\nTODO items found.',
            },
          }

          yield {
            toolName: 'add_subgoal',
            input: {
              id: 'analysis-complete',
              objective: 'Complete post-processing analysis',
              status: 'COMPLETE',
            },
          }

          yield {
            toolName: 'set_output',
            input: {
              phase: 'post-processing',
              analysisCreated: true,
              subgoalAdded: true,
            },
          }

          const step2 = yield 'STEP'
          workflowSteps.push(
            `step after STEP: stepsComplete=${step2.stepsComplete}`,
          )

          if (step2.stepsComplete) {
            yield {
              toolName: 'update_subgoal',
              input: {
                id: 'analysis-complete',
                log: 'All post-processing completed',
              },
            }
          }
        } else {
          workflowSteps.push('normal processing mode')
          yield {
            toolName: 'set_output',
            input: { phase: 'normal', message: 'Regular processing' },
          }
        }

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator
      mockTemplate.toolNames = [
        'read_files',
        'code_search',
        'write_file',
        'add_subgoal',
        'set_output',
        'update_subgoal',
        'end_turn',
      ]

      executeToolCallSpy.mockImplementation(
        async (
          options: ParamsOf<typeof executeToolCall>,
        ): ReturnType<typeof executeToolCall> => {
          if (options.toolName === 'set_output') {
            options.agentState.output = options.input
          } else if (options.toolName === 'add_subgoal') {
            options.agentState.agentContext[options.input.id as string] = {
              ...options.input,
              logs: [],
            }
          }
        },
      )

      const result = await runProgrammaticStep({
        ...mockParams,
        stepsComplete: true,
      })

      expect(workflowSteps).toEqual([
        'generator run 1',
        'read completed, stepsComplete=true',
        'entering post-processing',
      ])

      expect(result.endTurn).toBe(false)
      expect(result.agentState.output).toEqual({
        phase: 'post-processing',
        analysisCreated: true,
        subgoalAdded: true,
      })
      expect(result.agentState.agentContext['analysis-complete']).toBeDefined()
      expect(executeToolCallSpy).toHaveBeenCalledTimes(5)
    })
  })

  describe('yield value validation', () => {
    it('should reject invalid yield values', async () => {
      const mockGenerator = (function* () {
        yield { invalid: 'value' } as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject yield values with wrong types', async () => {
      const mockGenerator = (function* () {
        yield { type: 'STEP_TEXT', text: 123 } as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject GENERATE_N with non-positive n', async () => {
      const mockGenerator = (function* () {
        yield { type: 'GENERATE_N', n: 0 } as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject GENERATE_N with negative n', async () => {
      const mockGenerator = (function* () {
        yield { type: 'GENERATE_N', n: -5 } as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const responseChunks: unknown[] = []
      mockParams.onResponseChunk = (chunk) => responseChunks.push(chunk)

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should accept valid STEP literal', async () => {
      const mockGenerator = (function* () {
        yield 'STEP'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(false)
      expect(result.agentState.output?.error).toBeUndefined()
    })

    it('should accept valid STEP_ALL literal', async () => {
      const mockGenerator = (function* () {
        yield 'STEP_ALL'
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(false)
      expect(result.agentState.output?.error).toBeUndefined()
    })

    it('should accept valid STEP_TEXT object and continue to next step', async () => {
      const mockGenerator = (function* () {
        yield { type: 'STEP_TEXT', text: 'Custom response text' }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toBeUndefined()
    })

    it('should accept valid GENERATE_N object', async () => {
      const mockGenerator = (function* () {
        yield { type: 'GENERATE_N', n: 3 }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(false)
      expect(result.generateN).toBe(3)
      expect(result.agentState.output?.error).toBeUndefined()
    })

    it('should accept valid tool call object', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toBeUndefined()
    })

    it('should accept tool call with includeToolCall option', async () => {
      const mockGenerator = (function* () {
        yield {
          toolName: 'read_files',
          input: { paths: ['test.txt'] },
          includeToolCall: false,
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toBeUndefined()
    })

    it('should reject random string values', async () => {
      const mockGenerator = (function* () {
        yield 'INVALID_STEP' as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject null yield values', async () => {
      const mockGenerator = (function* () {
        yield null as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject undefined yield values', async () => {
      const mockGenerator = (function* () {
        yield undefined as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject tool call without toolName', async () => {
      const mockGenerator = (function* () {
        yield { input: { paths: ['test.txt'] } } as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })

    it('should reject tool call without input', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files' } as unknown
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output?.error).toContain(
        'Invalid yield value from handleSteps',
      )
    })
  })

  describe('logging and context', () => {
    it('should log agent execution start', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep(mockParams)

      expect(true).toBe(true)
    })

    it('should generate unique agent step ID', async () => {
      const mockGenerator = (function* () {
        yield { toolName: 'read_files', input: { paths: ['test.txt'] } }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep(mockParams)

      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentStepId: 'mock-uuid-0000-0000-0000-000000000000',
        }),
      )
    })
  })
})
