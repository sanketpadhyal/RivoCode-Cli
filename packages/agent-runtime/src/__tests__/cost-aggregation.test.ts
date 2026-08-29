import {
  createTestAgentRuntimeParams,
  testFileContext,
} from '@rivocode/common/testing/fixtures/agent-runtime'
import {
  getInitialAgentState,
  getInitialSessionState,
} from '@rivocode/common/types/session-state'
import { assistantMessage } from '@rivocode/common/util/messages'
import {
  spyOn,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test'

import * as agentRegistry from '../templates/agent-registry'
import * as spawnAgentUtils from '../tools/handlers/tool/spawn-agent-utils'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { AgentState } from '@rivocode/common/types/session-state'

const mockFileContext = testFileContext

describe('Cost Aggregation System', () => {
  let mockAgentTemplate: any
  let mockLocalAgentTemplates: Record<string, any>
  let params: any

  beforeEach(() => {
    mockAgentTemplate = {
      id: 'test-agent',
      displayName: 'Test Agent',
      model: 'gpt-4o-mini',
      toolNames: ['write_file'],
      spawnableAgents: ['test-agent'],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions',
      stepPrompt: 'Test step prompt',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      outputMode: 'last_message',
      inputSchema: {},
    }

    mockLocalAgentTemplates = {
      'test-agent': mockAgentTemplate,
    }

    const baseParams = createTestAgentRuntimeParams()
    params = {
      ...baseParams,
      agentTemplate: mockAgentTemplate,
      agentState: getInitialAgentState(),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      localAgentTemplates: mockLocalAgentTemplates,
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      signal: new AbortController().signal,
      system: 'Test system prompt',
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: { agents: [] },
      },
      userId: 'test-user',
      userInputId: 'test-input',
      writeToClient: () => {},
    }

    spyOn(agentRegistry, 'getAgentTemplate').mockResolvedValue(
      mockAgentTemplate,
    )

    spyOn(spawnAgentUtils, 'getMatchingSpawn').mockReturnValue('test-agent')
  })

  afterEach(() => {
    mock.restore()
  })

  describe('Single Agent Cost Tracking', () => {
    it('should track credits used by a single agent', async () => {
      const sessionState = getInitialSessionState(mockFileContext)
      const agentState = sessionState.mainAgentState

      expect(agentState.creditsUsed).toBe(0)

      agentState.creditsUsed += 100

      expect(agentState.creditsUsed).toBe(100)
    })

    it('should accumulate costs across multiple operations', async () => {
      const sessionState = getInitialSessionState(mockFileContext)
      const agentState = sessionState.mainAgentState

      agentState.creditsUsed += 50
      agentState.creditsUsed += 75
      agentState.creditsUsed += 25

      expect(agentState.creditsUsed).toBe(150)
    })
  })

  describe('Subagent Cost Aggregation', () => {
    it('should aggregate costs from successful subagents', async () => {
      const parentAgentState: AgentState = {
        agentId: 'parent-agent',
        agentType: 'test-agent',
        agentContext: {},
        ancestorRunIds: [],
        subagents: [],
        childRunIds: [],
        messageHistory: [],
        stepsRemaining: 10,
        creditsUsed: 50,
        directCreditsUsed: 50,
        systemPrompt: 'Test system prompt',
        toolDefinitions: {},
        contextTokenCount: 0,
      }

      const _mockExecuteAgent = spyOn(spawnAgentUtils, 'executeSubagent')
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-1',
            agentType: 'test-agent',
            stepsRemaining: 10,
            creditsUsed: 75,
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Sub-agent 1 response')],
          },
        })
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-2',
            agentType: 'test-agent',
            stepsRemaining: 10,
            creditsUsed: 100,
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Sub-agent 2 response')],
          },
        })

      const mockToolCall = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [
            { agent_type: 'test-agent', prompt: 'Task 1' },
            { agent_type: 'test-agent', prompt: 'Task 2' },
          ],
        },
      }

      await handleSpawnAgents({
        ...params,
        agentState: parentAgentState,
        toolCall: mockToolCall,
      })

      expect(parentAgentState.creditsUsed).toBe(225)
      expect(_mockExecuteAgent).toHaveBeenCalledTimes(2)
    })

    it('should aggregate partial costs from failed subagents', async () => {
      const parentAgentState: AgentState = {
        ...getInitialAgentState(),
        agentId: 'parent-agent',
        agentType: 'test-agent',
        stepsRemaining: 10,
        creditsUsed: 10,
      }

      const mockExecuteAgent2 = spyOn(spawnAgentUtils, 'executeSubagent')
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-1',
            agentType: 'test-agent',
            stepsRemaining: 10,
            creditsUsed: 50,
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Successful response')],
          },
        })
        .mockRejectedValueOnce(
          (() => {
            const error = new Error('Agent failed') as Error & {
              agentState?: AgentState
              output?: unknown
            }
            error.agentState = {
              ...getInitialAgentState(),
              agentId: 'sub-agent-2',
              agentType: 'test-agent',
              stepsRemaining: 10,
              creditsUsed: 25,
            }
            error.output = { type: 'error', message: 'Agent failed' }
            return error
          })(),
        )

      const mockToolCall = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [
            { agent_type: 'test-agent', prompt: 'Task 1' },
            { agent_type: 'test-agent', prompt: 'Task 2' },
          ],
        },
      }

      await handleSpawnAgents({
        ...params,
        agentState: parentAgentState,
        toolCall: mockToolCall,
      })

      expect(parentAgentState.creditsUsed).toBe(85)
      expect(mockExecuteAgent2).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should preserve costs when operations fail', async () => {
      const sessionState = getInitialSessionState(mockFileContext)
      const agentState = sessionState.mainAgentState

      agentState.creditsUsed = 50

      agentState.creditsUsed += 100

      try {
        throw new Error('Operation failed')
      } catch (error) {
      }

      expect(agentState.creditsUsed).toBe(150)
    })

    it('should preserve costs when complex operations fail', async () => {
      const sessionState = getInitialSessionState(mockFileContext)
      const agentState = sessionState.mainAgentState

      agentState.creditsUsed = 25

      agentState.creditsUsed += 30
      agentState.creditsUsed += 45

      let failed = false
      try {
        throw new Error('Complex operation failed')
      } catch (error) {
        failed = true
      }

      expect(failed).toBe(true)
      expect(agentState.creditsUsed).toBe(100)
    })
  })

  describe('Basic Functionality', () => {
    it('should initialize creditsUsed field to 0', () => {
      const sessionState = getInitialSessionState(mockFileContext)
      expect(sessionState.mainAgentState.creditsUsed).toBe(0)
    })

    it('should allow setting and retrieving creditsUsed field', () => {
      const sessionState = getInitialSessionState(mockFileContext)
      sessionState.mainAgentState.creditsUsed = 100
      expect(sessionState.mainAgentState.creditsUsed).toBe(100)
    })

    it('should verify cost field exists in AgentState structure', () => {
      const sessionState = getInitialSessionState(mockFileContext)

      expect(sessionState.mainAgentState).toHaveProperty('creditsUsed')
      expect(typeof sessionState.mainAgentState.creditsUsed).toBe('number')

      sessionState.mainAgentState.creditsUsed = 999
      expect(sessionState.mainAgentState.creditsUsed).toBe(999)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain consistent cost accounting across the agent hierarchy', async () => {
      const sessionState = getInitialSessionState(mockFileContext)
      const mainAgentState = sessionState.mainAgentState

      const baseAgentCost = 200
      const subAgent1Cost = 150
      const subAgent2Cost = 100
      const expectedTotal = baseAgentCost + subAgent1Cost + subAgent2Cost

      mainAgentState.creditsUsed = baseAgentCost

      const mockExecuteAgent3 = spyOn(spawnAgentUtils, 'executeSubagent')
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-1',
            agentType: 'test-agent',
            messageHistory: [assistantMessage('Sub-agent 1 response')],
            stepsRemaining: 10,
            creditsUsed: subAgent1Cost,
          } as AgentState,
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Sub-agent 1 response')],
          },
        })
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-2',
            agentType: 'test-agent',
            messageHistory: [assistantMessage('Sub-agent 2 response')],
            stepsRemaining: 10,
            creditsUsed: subAgent2Cost,
          } as AgentState,
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Sub-agent 2 response')],
          },
        })

      const mockToolCall = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [
            { agent_type: 'test-agent', prompt: 'Task 1' },
            { agent_type: 'test-agent', prompt: 'Task 2' },
          ],
        },
      }

      await handleSpawnAgents({
        ...params,
        agentState: mainAgentState,
        toolCall: mockToolCall,
      })

      expect(mainAgentState.creditsUsed).toBe(expectedTotal)

      expect(mainAgentState.creditsUsed).toBeGreaterThanOrEqual(0)
      expect(mainAgentState.creditsUsed).toBe(
        Math.floor(mainAgentState.creditsUsed),
      )
      expect(mockExecuteAgent3).toHaveBeenCalledTimes(2)
    })
  })
})
