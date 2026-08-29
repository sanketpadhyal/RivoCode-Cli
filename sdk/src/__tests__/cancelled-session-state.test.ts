import { countTokensMessages } from '@rivocode/agent-runtime/util/token-counter'
import { getInitialSessionState } from '@rivocode/common/types/session-state'
import { getStubProjectFileContext } from '@rivocode/common/util/file'
import { describe, expect, test } from 'bun:test'

import { buildCancelledSessionState } from '../run'

import type { Message } from '@rivocode/common/types/messages/codebuff-message'
import type { SessionState } from '@rivocode/common/types/session-state'

const SYSTEM_AND_TOOLS = 9_000

const text = (role: 'user' | 'assistant', body: string) =>
  ({ role, content: [{ type: 'text', text: body }] }) as unknown as Message

const toolCall = (toolCallId: string) =>
  ({
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId,
        toolName: 'read_files',
        input: { paths: ['a.ts', 'b.ts', 'c.ts'] },
      },
    ],
  }) as unknown as Message

function sessionStateWith(messageHistory: Message[]): SessionState {
  const state = getInitialSessionState(getStubProjectFileContext())
  state.mainAgentState.messageHistory = messageHistory
  state.mainAgentState.contextTokenCount =
    countTokensMessages(messageHistory) + SYSTEM_AND_TOOLS
  return state
}

describe('buildCancelledSessionState', () => {
  test('the count describes the history it persists', () => {
    const history = [
      text('user', 'refactor the run loop'.repeat(40)),
      text('assistant', 'done'.repeat(400)),
    ]
    const state = buildCancelledSessionState({
      sessionState: sessionStateWith(history),
      runtimeMadeProgress: true,
      message: 'Run cancelled by user.',
    })

    expect(state.mainAgentState.messageHistory.length).toBe(history.length + 1)
    expect(state.mainAgentState.contextTokenCount).toBe(
      countTokensMessages(state.mainAgentState.messageHistory) +
        SYSTEM_AND_TOOLS,
    )
  })

  test('the count follows the user prompt that gets restored', () => {
    const history = [text('assistant', 'earlier turn'.repeat(200))]
    const prompt = text('user', 'refactor the run loop'.repeat(40))
    const state = buildCancelledSessionState({
      sessionState: sessionStateWith(history),
      runtimeMadeProgress: false,
      promptMessage: prompt,
      message: 'Run cancelled by user.',
    })

    expect(state.mainAgentState.messageHistory.length).toBe(history.length + 2)
    expect(state.mainAgentState.contextTokenCount).toBe(
      countTokensMessages(state.mainAgentState.messageHistory) +
        SYSTEM_AND_TOOLS,
    )
  })

  test('the count follows a dropped half-step', () => {
    const history = [
      text('user', 'read the runner'.repeat(40)),
      toolCall('call-1'),
    ]
    const state = buildCancelledSessionState({
      sessionState: sessionStateWith(history),
      runtimeMadeProgress: true,
      message: 'Run cancelled by user.',
    })

    const persisted = state.mainAgentState.messageHistory
    expect(persisted.some((m) => m.role === 'assistant')).toBe(false)
    expect(state.mainAgentState.contextTokenCount).toBe(
      countTokensMessages(persisted) + SYSTEM_AND_TOOLS,
    )
  })

  test('does not disturb the live session', () => {
    const history = [text('user', 'hello')]
    const live = sessionStateWith(history)
    const before = live.mainAgentState.contextTokenCount
    buildCancelledSessionState({
      sessionState: live,
      runtimeMadeProgress: true,
      message: 'Run cancelled by user.',
    })
    expect(live.mainAgentState.messageHistory.length).toBe(1)
    expect(live.mainAgentState.contextTokenCount).toBe(before)
  })
})
