import * as analytics from '@rivocode/common/analytics'
import { TEST_USER_ID } from '@rivocode/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@rivocode/common/testing/impl/agent-runtime'
import {
  createMockDbOperations,
  setupDbSpies,
} from '@rivocode/common/testing/mocks/database'
import { getInitialSessionState } from '@rivocode/common/types/session-state'
import { promptSuccess } from '@rivocode/common/util/error'
import { assistantMessage, userMessage } from '@rivocode/common/util/messages'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { runAgentStep } from '../run-agent-step'
import { clearAgentGeneratorCache } from '../run-programmatic-step'
import { createToolCallChunk } from './test-utils'

import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@rivocode/common/testing/mocks/database'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@rivocode/common/types/contracts/agent-runtime'
import type { ParamsExcluding } from '@rivocode/common/types/function-params'
import type { Message } from '@rivocode/common/types/messages/codebuff-message'
import type { ProjectFileContext } from '@rivocode/common/util/file'

describe('runAgentStep - set_output tool', () => {
  let testAgent: AgentTemplate
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps
  let runAgentStepBaseParams: ParamsExcluding<
    typeof runAgentStep,
    | 'agentType'
    | 'prompt'
    | 'localAgentTemplates'
    | 'agentState'
    | 'agentTemplate'
  >
  let dbSpies: DbSpies

  beforeEach(async () => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL, sendAction: () => {} }

    testAgent = {
      id: 'test-set-output-agent',
      displayName: 'Test Set Output Agent',
      spawnerPrompt: 'Testing set_output functionality',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['set_output', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions prompt',
      stepPrompt: 'Test agent step prompt',
    }

    dbSpies = setupDbSpies(createMockDbOperations())

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    agentRuntimeImpl.requestFiles = async ({ filePaths }) => {
      const results: Record<string, string | null> = {}
      filePaths.forEach((p) => {
        if (p === 'src/auth.ts') {
          results[p] = 'export function authenticate() { return true; }'
        } else if (p === 'src/user.ts') {
          results[p] = 'export interface User { id: string; name: string; }'
        } else {
          results[p] = null
        }
      })
      return results
    }
    agentRuntimeImpl.requestOptionalFile = async ({ filePath }) => {
      if (filePath === 'src/auth.ts') {
        return 'export function authenticate() { return true; }'
      } else if (filePath === 'src/user.ts') {
        return 'export interface User { id: string; name: string; }'
      }
      return null
    }

    agentRuntimeImpl.promptAiSdk = async function () {
      return promptSuccess('Test response')
    }
    clearAgentGeneratorCache(agentRuntimeImpl)

    runAgentStepBaseParams = {
      ...agentRuntimeImpl,

      additionalToolDefinitions: () => Promise.resolve({}),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      onResponseChunk: () => {},
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: new AbortController().signal,
      spawnParams: undefined,
      system: 'Test system prompt',
      tools: {},
      userId: TEST_USER_ID,
      userInputId: 'test-input',
    }
  })

  afterEach(() => {
    dbSpies.restore()
    mock.restore()
  })

  afterAll(() => {
    clearAgentGeneratorCache(agentRuntimeImpl)
  })

  const mockFileContext: ProjectFileContext = {
    projectRoot: '/test',
    cwd: '/test',
    fileTree: [],
    fileTokenScores: {},
    knowledgeFiles: {},
    gitChanges: {
      status: '',
      diff: '',
      diffCached: '',
      lastCommitMessages: '',
    },
    changesSinceLastChat: {},
    shellConfigFiles: {},
    systemInfo: {
      platform: 'test',
      shell: 'test',
      nodeVersion: 'test',
      arch: 'test',
      homedir: '/home/test',
      cpus: 1,
      chromeAvailable: false,
    },
    agentTemplates: {},
    customToolDefinitions: {},
  }

  const createAgent = (
    id: string,
    overrides: Partial<AgentTemplate> = {},
  ): AgentTemplate => ({
    ...testAgent,
    id,
    displayName: id,
    outputMode: 'last_message',
    toolNames: [],
    spawnableAgents: [],
    stepPrompt: '',
    ...overrides,
  })

  it('should set output with simple key-value pair', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', { message: 'Hi' })
      yield { type: 'text' as const, text: '\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'test-set-output-agent',
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      prompt: 'Analyze the codebase',
    })

    expect(result.agentState.output).toEqual({
      message: 'Hi',
    })
    expect(result.shouldEndTurn).toBe(true)
  })

  it('should set output with complex data', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', {
        message: 'Analysis complete',
        status: 'success',
        findings: ['Bug in auth.ts', 'Missing validation'],
      })
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'test-set-output-agent',
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      prompt: 'Analyze the codebase',
    })

    expect(result.agentState.output).toEqual({
      message: 'Analysis complete',
      status: 'success',
      findings: ['Bug in auth.ts', 'Missing validation'],
    })
    expect(result.shouldEndTurn).toBe(true)
  })

  it('should replace existing output data', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', {
        newField: 'new value',
        existingField: 'updated value',
      })
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    agentState.output = {
      existingField: 'original value',
      anotherField: 'unchanged',
    }
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      prompt: 'Update the output',
      agentType: 'test-set-output-agent',
    })

    expect(result.agentState.output).toEqual({
      newField: 'new value',
      existingField: 'updated value',
    })
  })

  it('should handle empty output parameter', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', {})
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    agentState.output = { existingField: 'value' }
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      agentType: 'test-set-output-agent',
      prompt: 'Update with empty object',
    })

    expect(result.agentState.output).toEqual({})
  })

  it('ends the step after suggest_prompts without requiring a follow-up response', async () => {
    const suggestAgent: AgentTemplate = {
      ...testAgent,
      toolNames: ['suggest_prompts', 'end_turn'],
    }
    const fileContextWithSuggest: ProjectFileContext = {
      ...mockFileContext,
      customToolDefinitions: {
        suggest_prompts: {
          inputSchema: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              prompts: { type: 'array' },
            },
            required: ['response', 'prompts'],
          },
          description: 'Finish with the answer and suggest next prompts',
          endsAgentStep: false,
        },
      },
    }
    const sessionState = getInitialSessionState(fileContextWithSuggest)
    runAgentStepBaseParams.promptAiSdkStream = async function* () {
      yield createToolCallChunk('suggest_prompts', {
        response: 'Finished.',
        prompts: [{ prompt: 'Add tests' }],
      })
      return promptSuccess('mock-message-id')
    }
    runAgentStepBaseParams.requestToolCall = async () => ({
      output: [{ type: 'json', value: { ok: true } }],
    })

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: suggestAgent.id,
      localAgentTemplates: { [suggestAgent.id]: suggestAgent },
      agentTemplate: suggestAgent,
      agentState: sessionState.mainAgentState,
      fileContext: fileContextWithSuggest,
      prompt: 'Finish the task',
    })

    expect(result.shouldEndTurn).toBe(true)
  })

  it('should handle handleSteps with one tool call and STEP_ALL', async () => {
    const mockAgentTemplate: AgentTemplate = {
      id: 'test-handlesteps-agent',
      displayName: 'Test HandleSteps Agent',
      spawnerPrompt: 'Testing handleSteps functionality',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['read_files', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions prompt',
      stepPrompt: 'Test agent step prompt',
      handleSteps: function* ({ agentState, prompt, params }) {
        yield {
          toolName: 'read_files',
          input: { paths: ['src/test.ts'] },
        }
        yield 'STEP_ALL'
      },
    }

    const mockAgentRegistry = {
      'test-handlesteps-agent': mockAgentTemplate,
    }

    runAgentStepBaseParams.requestFiles = async ({ filePaths }) => {
      const results: Record<string, string | null> = {}
      filePaths.forEach((p) => {
        if (p === 'src/test.ts') {
          results[p] = 'export function testFunction() { return "test"; }'
        } else {
          results[p] = null
        }
      })
      return results
    }

    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield { type: 'text' as const, text: 'Continuing with the analysis...' }
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    agentState.messageHistory = [
      ...agentState.messageHistory,
      userMessage({
        content: 'Test the handleSteps functionality',
        keepDuringTruncation: true,
      }),
      userMessage({
        content: 'Test instructions prompt',
        timeToLive: 'userPrompt' as const,
        keepDuringTruncation: true,
      }),
    ]

    const initialMessageCount = agentState.messageHistory.length

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'test-handlesteps-agent',
      localAgentTemplates: mockAgentRegistry,
      agentTemplate: mockAgentTemplate,
      agentState,
      prompt: 'Test the handleSteps functionality',
    })

    expect(result.shouldEndTurn).toBe(true)

    const finalMessages = result.agentState.messageHistory

    const newMessages = finalMessages.slice(initialMessageCount)

    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('Test the handleSteps functionality'),
      ),
    ).toBe(true)

    expect(
      newMessages.some(
        (m) =>
          m.role === 'assistant' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'Continuing with the analysis...',
      ),
    ).toBe(true)
  })

  it('continues the turn when the LLM response is only think-tag scaffolding', async () => {
    const thinkOnlyAgent: AgentTemplate = {
      id: 'test-think-only-agent',
      displayName: 'Test Think Only Agent',
      spawnerPrompt: 'Testing think-only turn continuation',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'last_message' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['read_files', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions prompt',
      stepPrompt: 'Test agent step prompt',
    }

    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield { type: 'text' as const, text: '</think> ' }
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'test-think-only-agent',
      localAgentTemplates: { 'test-think-only-agent': thinkOnlyAgent },
      agentTemplate: thinkOnlyAgent,
      agentState: sessionState.mainAgentState,
      prompt: 'Continue the task',
    })

    expect(result.shouldEndTurn).toBe(false)
    expect(result.fullResponse).toBe('</think> ')
  })

  it('gives a streamed child only assistant content before its spawn call', async () => {
    let childHistory: Message[] = []
    const childAgent = createAgent('history-child', {
      handleSteps: function* ({ agentState }) {
        childHistory = structuredClone(agentState.messageHistory as Message[])
      },
    })
    const parentAgent = createAgent('history-parent', {
      toolNames: ['spawn_agents'],
      spawnableAgents: ['history-child'],
    })

    runAgentStepBaseParams.promptAiSdkStream = async function* () {
      yield { type: 'reasoning' as const, text: 'Reasoning before spawn.' }
      yield { type: 'text' as const, text: 'Visible before spawn.' }
      yield createToolCallChunk('spawn_agents', {
        agents: [
          { agent_type: 'history-child', prompt: 'Review the conclusion.' },
        ],
      })
      yield { type: 'text' as const, text: 'Visible after spawn.' }
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    sessionState.mainAgentState.messageHistory = [
      userMessage('Work through the problem, then ask for a review.'),
    ]

    await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: parentAgent.id,
      localAgentTemplates: {
        [parentAgent.id]: parentAgent,
        [childAgent.id]: childAgent,
      },
      agentTemplate: parentAgent,
      agentState: sessionState.mainAgentState,
      prompt: 'Work through the problem, then ask for a review.',
    })

    const inheritedAssistantParts = childHistory
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
    expect(inheritedAssistantParts).toContainEqual({
      type: 'reasoning',
      text: 'Reasoning before spawn.',
    })
    expect(inheritedAssistantParts).toContainEqual({
      type: 'text',
      text: 'Visible before spawn.',
    })
    expect(inheritedAssistantParts).not.toContainEqual({
      type: 'text',
      text: 'Visible after spawn.',
    })
    expect(
      inheritedAssistantParts.some((part) => part.type === 'tool-call'),
    ).toBe(false)
  })

  it('does not duplicate streamed history consumed by an inline child', async () => {
    let childHistory: Message[] = []
    const childAgent = createAgent('inline-history-child', {
      inheritParentSystemPrompt: true,
      handleSteps: function* ({ agentState }) {
        childHistory = structuredClone(agentState.messageHistory as Message[])
      },
    })
    const parentAgent = createAgent('inline-history-parent', {
      toolNames: ['spawn_agent_inline'],
      spawnableAgents: ['inline-history-child'],
    })

    runAgentStepBaseParams.promptAiSdkStream = async function* () {
      yield { type: 'reasoning' as const, text: 'Reasoning before inline.' }
      yield { type: 'text' as const, text: 'Visible before inline spawn.' }
      yield createToolCallChunk('spawn_agent_inline', {
        agent_type: 'inline-history-child',
        prompt: 'Inspect the current transcript.',
      })
      yield { type: 'reasoning' as const, text: 'Reasoning between inline.' }
      yield { type: 'text' as const, text: 'Visible between inline spawns.' }
      yield createToolCallChunk('spawn_agent_inline', {
        agent_type: 'inline-history-child',
        prompt: 'Inspect the updated transcript.',
      })
      yield { type: 'text' as const, text: 'Visible after inline spawn.' }
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    sessionState.mainAgentState.messageHistory = [
      userMessage('Inspect inline history handling.'),
    ]

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: parentAgent.id,
      localAgentTemplates: {
        [parentAgent.id]: parentAgent,
        [childAgent.id]: childAgent,
      },
      agentTemplate: parentAgent,
      agentState: sessionState.mainAgentState,
      prompt: 'Inspect inline history handling.',
    })

    const childText = childHistory
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
    expect(childText).toContain('Visible before inline spawn.')
    expect(childText).toContain('Visible between inline spawns.')
    expect(childText).not.toContain('Visible after inline spawn.')

    const childReasoning = childHistory
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'reasoning')
      .map((part) => part.text)
    expect(childReasoning).toContain('Reasoning before inline.')
    expect(childReasoning).toContain('Reasoning between inline.')

    const parentText = result.agentState.messageHistory
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
    expect(
      parentText.filter((text) => text === 'Visible before inline spawn.'),
    ).toHaveLength(1)
    expect(
      parentText.filter((text) => text === 'Visible between inline spawns.'),
    ).toHaveLength(1)
    expect(
      parentText.filter((text) => text === 'Visible after inline spawn.'),
    ).toHaveLength(1)
    const parentReasoning = result.agentState.messageHistory
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'reasoning')
      .map((part) => part.text)
    expect(parentReasoning).toEqual([
      'Reasoning before inline.',
      'Reasoning between inline.',
    ])
  })

  it('does not drop pre-call text when an inline call is invalid', async () => {
    const parentAgent = createAgent('invalid-inline-parent', {
      toolNames: ['spawn_agent_inline'],
    })

    runAgentStepBaseParams.promptAiSdkStream = async function* () {
      yield { type: 'text' as const, text: 'Keep this text.' }
      yield createToolCallChunk('spawn_agent_inline', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: parentAgent.id,
      localAgentTemplates: { [parentAgent.id]: parentAgent },
      agentTemplate: parentAgent,
      agentState: sessionState.mainAgentState,
      prompt: 'Attempt an invalid inline spawn.',
    })

    const parentText = result.agentState.messageHistory
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
    expect(
      parentText.filter((text) => text === 'Keep this text.'),
    ).toHaveLength(1)
  })

  it('should spawn agent inline that deletes last two assistant messages', async () => {
    const mockInlineAgentTemplate: AgentTemplate = {
      id: 'message-deleter-agent',
      displayName: 'Message Deleter Agent',
      spawnerPrompt: 'Deletes assistant messages',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['set_messages', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Delete messages system prompt',
      instructionsPrompt: 'Delete messages instructions prompt',
      stepPrompt: 'Delete messages step prompt',
      handleSteps: function* ({ agentState, prompt, params }) {
        const messages = [...agentState.messageHistory]

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages.splice(i, 1)
            break
          }
        }

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages.splice(i, 1)
            break
          }
        }

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages.splice(i, 1)
            break
          }
        }

        yield {
          toolName: 'set_messages',
          input: { messages },
        }
      },
    }

    const mockParentAgentTemplate: AgentTemplate = {
      id: 'parent-agent',
      displayName: 'Parent Agent',
      spawnerPrompt: 'Parent agent that spawns inline agents',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['spawn_agent_inline', 'end_turn'],
      spawnableAgents: ['message-deleter-agent'],
      systemPrompt: 'Parent system prompt',
      instructionsPrompt: 'Parent instructions prompt',
      stepPrompt: 'Parent step prompt',
    }

    const mockAgentRegistry = {
      'parent-agent': mockParentAgentTemplate,
      'message-deleter-agent': mockInlineAgentTemplate,
    }

    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('spawn_agent_inline', {
        agent_type: 'message-deleter-agent',
        prompt: 'Delete the last two assistant messages',
      })
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    agentState.messageHistory = [
      userMessage('Hello'),
      assistantMessage('Hi there!'),
      userMessage('How are you?'),
      assistantMessage('I am doing well, thank you!'),
      userMessage('Can you help me?'),
      assistantMessage('Of course, I would be happy to help!'),
      userMessage({
        content: 'Spawn an inline agent to clean up messages',
        keepDuringTruncation: true,
      }),
      userMessage({
        content: 'Parent instructions prompt',
        timeToLive: 'userPrompt' as const,
        keepDuringTruncation: true,
      }),
    ]

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'parent-agent',
      localAgentTemplates: mockAgentRegistry,
      agentTemplate: mockParentAgentTemplate,
      agentState,
      prompt: 'Spawn an inline agent to clean up messages',
    })

    const finalMessages = result.agentState.messageHistory

    const assistantMessagesCount = finalMessages.filter(
      (m) => m.role === 'assistant',
    ).length
    expect(assistantMessagesCount).toBeLessThan(3)

    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes(
            'Spawn an inline agent to clean up messages',
          ),
      ),
    ).toBe(true)

    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'Hello',
      ),
    ).toBe(true)
    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'How are you?',
      ),
    ).toBe(true)
    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'Can you help me?',
      ),
    ).toBe(true)
  })
})
