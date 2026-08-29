import { describe, expect, test } from 'bun:test'

import {
  adjustContextTokenCountForHistoryEdit,
  recountContextTokens,
} from '../context-token-count'
import { countTokensMessages } from '../token-counter'

import type { Message } from '@codebuff/common/types/messages/codebuff-message'

const text = (role: 'user' | 'assistant', body: string) =>
  ({ role, content: [{ type: 'text', text: body }] }) as unknown as Message

const HISTORY: Message[] = [
  text('user', 'find every caller of loopAgentSteps'.repeat(50)),
  text('assistant', 'here they are'.repeat(200)),
]

const SYSTEM = 'you are a coding agent'.repeat(100)
const TOOLS = { read_files: { description: 'read', inputSchema: {} } }

describe('recountContextTokens', () => {
  test('counts the history, the system prompt and the tool schemas', () => {
    const agentState = {
      messageHistory: HISTORY,
      contextTokenCount: 1,
    }
    const counted = recountContextTokens({
      agentState,
      systemPrompt: SYSTEM,
      toolsForTokenCount: TOOLS,
    })
    expect(counted).toBeGreaterThan(countTokensMessages(HISTORY))
  })

  test('leaves a subagent\'s count alone instead of paying to recompute it', () => {
    const agentState = {
      parentId: 'parent-run-id',
      messageHistory: HISTORY,
      contextTokenCount: 7,
    }
    expect(
      recountContextTokens({
        agentState,
        systemPrompt: SYSTEM,
        toolsForTokenCount: TOOLS,
      }),
    ).toBe(7)
  })
})

describe('adjustContextTokenCountForHistoryEdit', () => {
  const SYSTEM_AND_TOOLS = 9_000

  test('follows an appended message', () => {
    const nextHistory = [...HISTORY, text('user', 'run cancelled by user')]
    const adjusted = adjustContextTokenCountForHistoryEdit({
      contextTokenCount: countTokensMessages(HISTORY) + SYSTEM_AND_TOOLS,
      previousHistory: HISTORY,
      nextHistory,
    })
    expect(adjusted).toBe(countTokensMessages(nextHistory) + SYSTEM_AND_TOOLS)
    expect(adjusted).toBeGreaterThan(
      countTokensMessages(HISTORY) + SYSTEM_AND_TOOLS,
    )
  })

  test('follows a dropped message', () => {
    const nextHistory = [HISTORY[0]]
    expect(
      adjustContextTokenCountForHistoryEdit({
        contextTokenCount: countTokensMessages(HISTORY) + SYSTEM_AND_TOOLS,
        previousHistory: HISTORY,
        nextHistory,
      }),
    ).toBe(countTokensMessages(nextHistory) + SYSTEM_AND_TOOLS)
  })

  test('never goes negative', () => {
    expect(
      adjustContextTokenCountForHistoryEdit({
        contextTokenCount: 0,
        previousHistory: HISTORY,
        nextHistory: [],
      }),
    ).toBe(0)
  })
})
