import { TEST_USER_ID } from '@codebuff/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@codebuff/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@codebuff/common/types/session-state'
import { promptSuccess } from '@codebuff/common/util/error'
import { assistantMessage, userMessage } from '@codebuff/common/util/messages'
import { beforeEach, describe, expect, it } from 'bun:test'

import { loopAgentSteps } from '../run-agent-step'

import type { AgentTemplate } from '../templates/types'
import type { ParamsExcluding } from '@codebuff/common/types/function-params'
import type { Message } from '@codebuff/common/types/messages/codebuff-message'
import type { TextPart } from '@codebuff/common/types/messages/content-part'
import type { ProjectFileContext } from '@codebuff/common/util/file'

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
  agentTemplates: {},
  customToolDefinitions: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}

describe('Prompt Caching for Subagents with inheritParentSystemPrompt', () => {
  let mockLocalAgentTemplates: Record<string, AgentTemplate>
  let capturedMessages: Message[] = []
  let loopAgentStepsBaseParams: ParamsExcluding<
    typeof loopAgentSteps,
    | 'agentState'
    | 'userInputId'
    | 'prompt'
    | 'agentType'
    | 'parentSystemPrompt'
    | 'agentTemplate'
  >

  beforeEach(() => {
    capturedMessages = []

    mockLocalAgentTemplates = {
      parent: {
        id: 'parent',
        displayName: 'Parent Agent',
        outputMode: 'last_message',
        inputSchema: {},
        spawnerPrompt: '',
        model: 'anthropic/claude-sonnet-4',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: ['child'],
        systemPrompt: 'Parent agent system prompt for testing',
        instructionsPrompt: '',
        stepPrompt: '',
      } satisfies AgentTemplate,
      child: {
        id: 'child',
        displayName: 'Child Agent',
        outputMode: 'last_message',
        inputSchema: {},
        spawnerPrompt: '',
        model: 'anthropic/claude-sonnet-4',
        includeMessageHistory: false,
        inheritParentSystemPrompt: true,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      } satisfies AgentTemplate,
    }
    loopAgentStepsBaseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      sendAction: () => {},
      promptAiSdkStream: async function* (options) {
        capturedMessages = options.messages

        yield {
          type: 'text' as const,
          text: 'Test response',
        }

        if (options.onCostCalculated) {
          await options.onCostCalculated(1)
        }

        return promptSuccess('mock-message-id')
      },
      requestFiles: async ({ filePaths }) => {
        const results: Record<string, string | null> = {}
        filePaths.forEach((path) => {
          results[path] = null
        })
        return results
      },
      requestToolCall: async () => ({
        output: [
          {
            type: 'json',
            value: 'Tool call success',
          },
        ],
      }),
      repoId: undefined,
      repoUrl: undefined,
      spawnParams: undefined,
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      localAgentTemplates: mockLocalAgentTemplates,
      userId: TEST_USER_ID,
      clientSessionId: 'test-session',
      ancestorRunIds: [],
      onResponseChunk: () => {},
      signal: new AbortController().signal,
    }
  })

  it('should inherit parent system prompt when inheritParentSystemPrompt is true', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    const parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    expect(parentMessages.length).toBeGreaterThan(0)
    expect(parentMessages[0].role).toBe('system')
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text
    expect(parentSystemPrompt).toContain(
      'Parent agent system prompt for testing',
    )

    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages
    expect(childMessages.length).toBeGreaterThan(0)
    expect(childMessages[0].role).toBe('system')
    expect(
      childMessages[0].content[0].type === 'text' &&
        childMessages[0].content[0].text,
    ).toBe(parentSystemPrompt)
  })

  it('should generate own system prompt when inheritParentSystemPrompt is false', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    const standaloneChild: AgentTemplate = {
      id: 'standalone-child',
      displayName: 'Standalone Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: false,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: 'Standalone child system prompt',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['standalone-child'] = standaloneChild

    const parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'standalone-child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'standalone-child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages

    expect(childMessages[0].role).toBe('system')
    const text = (childMessages[0].content[0] as TextPart).text
    expect(text).not.toBe(parentSystemPrompt)
    expect(text).toContain('Standalone child system prompt')
  })

  it('should work independently: includeMessageHistory without inheritParentSystemPrompt', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    const messageHistoryChild: AgentTemplate = {
      id: 'message-history-child',
      displayName: 'Message History Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: 'Child with message history system prompt',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['message-history-child'] = messageHistoryChild

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'message-history-child' as const,
      messageHistory: [
        userMessage('Previous message'),
        assistantMessage('Previous response'),
      ],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'message-history-child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages

    expect(childMessages[0].role).toBe('system')
    const text = (childMessages[0].content[0] as TextPart).text
    expect(text).not.toBe(parentSystemPrompt)
    expect(text).toContain('Child with message history system prompt')

    expect(childMessages.length).toBeGreaterThan(2)
    const hasMessageHistory = childMessages.some(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text === 'Previous message',
    )
    expect(hasMessageHistory).toBe(true)
  })

  it('should validate that agents with inheritParentSystemPrompt cannot have custom systemPrompt', () => {
    const {
      DynamicAgentTemplateSchema,
    } = require('@codebuff/common/types/dynamic-agent-template')

    const validAgent = {
      id: 'valid-agent',
      displayName: 'Valid',
      model: 'anthropic/claude-sonnet-4',
      inheritParentSystemPrompt: true,
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    const validResult = DynamicAgentTemplateSchema.safeParse(validAgent)
    expect(validResult.success).toBe(true)

    const invalidAgent = {
      id: 'invalid-agent',
      displayName: 'Invalid',
      model: 'anthropic/claude-sonnet-4',
      inheritParentSystemPrompt: true,
      systemPrompt: 'Custom system prompt',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    const invalidResult = DynamicAgentTemplateSchema.safeParse(invalidAgent)
    expect(invalidResult.success).toBe(false)
    if (!invalidResult.success) {
      expect(invalidResult.error.message).toContain(
        'Cannot specify both systemPrompt and inheritParentSystemPrompt',
      )
    }
  })

  it('should enable prompt caching with matching system prompt prefix', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    const parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages

    expect(parentMessages[0].role).toBe('system')
    expect(childMessages[0].role).toBe('system')
    expect(childMessages[0].content).toEqual(parentMessages[0].content)

  })

  it('should pass parent tools and add subagent tools message when inheritParentSystemPrompt is true', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    const childWithTools: AgentTemplate = {
      id: 'child-with-tools',
      displayName: 'Child With Tools',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: false,
      inheritParentSystemPrompt: true,
      mcpServers: {},
      toolNames: ['read_files', 'code_search'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['child-with-tools'] = childWithTools

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    const parentTools = { read_files: {}, write_file: {}, code_search: {} }

    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'child-with-tools' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'child-with-tools',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
      parentTools: parentTools as unknown as Parameters<
        typeof loopAgentSteps
      >[0]['parentTools'],
    })

    const childMessages = capturedMessages

    expect(childMessages[0].role).toBe('system')
    expect((childMessages[0].content[0] as TextPart).text).toBe(
      parentSystemPrompt,
    )

    const instructionsMessage = childMessages.find(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text.includes('subagent') &&
        msg.content[0].text.includes('read_files') &&
        msg.content[0].text.includes('code_search'),
    )
    expect(instructionsMessage).toBeTruthy()
  })

  it('should support both inheritParentSystemPrompt and includeMessageHistory together', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    const fullInheritChild: AgentTemplate = {
      id: 'full-inherit-child',
      displayName: 'Full Inherit Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: true,
      inheritParentSystemPrompt: true,
      mcpServers: {},
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['full-inherit-child'] = fullInheritChild

    const parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: {
        ...sessionState.mainAgentState,
        messageHistory: [
          userMessage('Initial question'),
          assistantMessage('Initial answer'),
        ],
      },
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'full-inherit-child' as const,
      messageHistory: [
        userMessage('Initial question'),
        assistantMessage('Initial answer'),
      ],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'full-inherit-child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages

    expect(childMessages[0].role).toBe('system')
    expect((childMessages[0].content[0] as TextPart).text).toBe(
      parentSystemPrompt,
    )

    expect(childMessages.length).toBeGreaterThan(2)
    const hasMessageHistory = childMessages.some(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text === 'Initial question',
    )
    expect(hasMessageHistory).toBe(true)
  })
})
