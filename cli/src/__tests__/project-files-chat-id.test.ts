import { describe, test, expect } from 'bun:test'

import {
  getCurrentChatId,
  setCurrentChatId,
  startNewChat,
} from '../project-files'

describe('chat id lifecycle', () => {
  test('getCurrentChatId is stable across calls', () => {
    const first = getCurrentChatId()
    expect(getCurrentChatId()).toBe(first)
  })

  test('setCurrentChatId overrides the current chat id', () => {
    setCurrentChatId('resumed-chat-id')
    expect(getCurrentChatId()).toBe('resumed-chat-id')
  })

  test('startNewChat rotates to a fresh chat id', () => {
    setCurrentChatId('old-chat-id')

    const rotated = startNewChat()

    expect(rotated).not.toBe('old-chat-id')
    expect(getCurrentChatId()).toBe(rotated)
    expect(rotated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/)
  })
})
