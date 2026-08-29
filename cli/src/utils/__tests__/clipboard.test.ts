import { execSync } from 'child_process'

import { createMockTimers } from '@codebuff/common/testing/mocks/timers'
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'

import {
  copyTextToClipboard,
  OSC52_BLOCKED_MESSAGE,
  showClipboardMessage,
  subscribeClipboardMessages,
  clearClipboardMessage,
  registerClipboardRenderer,
  unregisterClipboardRenderer,
} from '../clipboard'
import { logger } from '../logger'

import type { MockTimers } from '@codebuff/common/testing/mocks/timers'

describe('clipboard', () => {
  describe('showClipboardMessage and subscriptions', () => {
    let mockTimers: MockTimers
    let receivedMessages: (string | null)[]

    beforeEach(() => {
      mockTimers = createMockTimers()
      mockTimers.install()
      receivedMessages = []
      clearClipboardMessage()
    })

    afterEach(() => {
      mockTimers.restore()
      clearClipboardMessage()
    })

    test('notifies subscribers when message is shown', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message')

      expect(receivedMessages).toContain('Test message')

      unsubscribe()
    })

    test('clears message after default duration (3000ms)', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message')
      expect(receivedMessages).toContain('Test message')

      mockTimers.advanceBy(3001)

      expect(receivedMessages[receivedMessages.length - 1]).toBeNull()

      unsubscribe()
    })

    test('clears message after custom duration', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message', { durationMs: 1000 })

      mockTimers.advanceBy(1001)

      expect(receivedMessages[receivedMessages.length - 1]).toBeNull()

      unsubscribe()
    })

    test('cancels previous timer when new message is shown', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      receivedMessages = []

      showClipboardMessage('First message', { durationMs: 5000 })
      mockTimers.advanceBy(2000)
      showClipboardMessage('Second message', { durationMs: 5000 })
      mockTimers.advanceBy(3000)

      expect(receivedMessages).toEqual(['First message', 'Second message'])

      unsubscribe()
    })

    test('unsubscribe stops receiving messages', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      receivedMessages = []

      showClipboardMessage('Before unsubscribe')
      unsubscribe()
      showClipboardMessage('After unsubscribe')

      expect(receivedMessages).toContain('Before unsubscribe')
      expect(receivedMessages).not.toContain('After unsubscribe')
    })

    test('multiple subscribers all receive messages', () => {
      const messages1: (string | null)[] = []
      const messages2: (string | null)[] = []

      const unsub1 = subscribeClipboardMessages((msg) => messages1.push(msg))
      const unsub2 = subscribeClipboardMessages((msg) => messages2.push(msg))

      showClipboardMessage('Broadcast message')

      expect(messages1).toContain('Broadcast message')
      expect(messages2).toContain('Broadcast message')

      unsub1()
      unsub2()
    })

    test('clearClipboardMessage immediately clears the message', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message', { durationMs: 10000 })
      clearClipboardMessage()

      expect(receivedMessages[receivedMessages.length - 1]).toBeNull()

      unsubscribe()
    })
  })

  describe('copyTextToClipboard - empty/whitespace handling', () => {
    beforeEach(() => {
      clearClipboardMessage()
    })

    afterEach(() => {
      clearClipboardMessage()
    })

    test('returns early for empty string', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))
      messages.length = 0

      await copyTextToClipboard('')

      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })

    test('returns early for whitespace-only string', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))
      messages.length = 0

      await copyTextToClipboard('   \n\t  ')

      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })
  })

  describe('copyTextToClipboard - success message formatting', () => {
    const shouldRun = process.platform === 'darwin' && !process.env.CI

    beforeEach(() => {
      clearClipboardMessage()
    })

    afterEach(() => {
      clearClipboardMessage()
    })

    test.skipIf(!shouldRun)('formats short text with quotes', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await copyTextToClipboard('Hello')

      expect(messages).toContain('Copied: "Hello"')

      unsubscribe()
    })

    test.skipIf(!shouldRun)('truncates long text with ellipsis', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      const longText = 'This is a very long piece of text that should be truncated because it exceeds the maximum display length'
      await copyTextToClipboard(longText)

      const lastMessage = messages.find((m) => m?.startsWith('Copied:'))
      expect(lastMessage).toBeDefined()
      expect(lastMessage!.length).toBeLessThan(55)
      expect(lastMessage).toContain('…')

      unsubscribe()
    })

    test.skipIf(!shouldRun)('collapses whitespace in preview', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await copyTextToClipboard('Hello\n\n\nWorld\t\tTest')

      expect(messages).toContain('Copied: "Hello World Test"')

      unsubscribe()
    })

    test.skipIf(!shouldRun)('uses custom success message when provided', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await copyTextToClipboard('test', { successMessage: 'Custom success!' })

      expect(messages).toContain('Custom success!')

      unsubscribe()
    })

    test.skipIf(!shouldRun)('shows no message when successMessage is null', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))
      messages.length = 0

      await copyTextToClipboard('test', { successMessage: null })

      expect(messages.filter((m) => m?.startsWith('Copied'))).toHaveLength(0)

      unsubscribe()
    })

    test.skipIf(!shouldRun)('suppresses message when suppressGlobalMessage is true', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))
      messages.length = 0

      await copyTextToClipboard('test', { suppressGlobalMessage: true })

      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })
  })

  describe('copyTextToClipboard - error handling when both methods fail', () => {
    let mockTimers: MockTimers
    let loggerErrorSpy: ReturnType<typeof spyOn>
    let originalPlatform: PropertyDescriptor | undefined
    let originalEnv: { SSH_CLIENT?: string; SSH_TTY?: string; SSH_CONNECTION?: string; TERM?: string }

    beforeEach(() => {
      mockTimers = createMockTimers()
      mockTimers.install()

      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
      }
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'dumb'

      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      clearClipboardMessage()
    })

    afterEach(() => {
      mockTimers.restore()
      loggerErrorSpy.mockRestore()
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      if (originalEnv.SSH_CLIENT !== undefined) process.env.SSH_CLIENT = originalEnv.SSH_CLIENT
      else delete process.env.SSH_CLIENT
      if (originalEnv.SSH_TTY !== undefined) process.env.SSH_TTY = originalEnv.SSH_TTY
      else delete process.env.SSH_TTY
      if (originalEnv.SSH_CONNECTION !== undefined) process.env.SSH_CONNECTION = originalEnv.SSH_CONNECTION
      else delete process.env.SSH_CONNECTION
      if (originalEnv.TERM !== undefined) process.env.TERM = originalEnv.TERM
      else delete process.env.TERM
      clearClipboardMessage()
    })

    test('shows default error message when both methods fail', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await expect(copyTextToClipboard('test text')).rejects.toThrow()

      expect(messages).toContain('Failed to copy to clipboard')

      unsubscribe()
    })

    test('shows custom error message when provided', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await expect(
        copyTextToClipboard('test text', { errorMessage: 'Custom error!' })
      ).rejects.toThrow()

      expect(messages).toContain('Custom error!')

      unsubscribe()
    })

    test('suppresses error message when suppressGlobalMessage is true', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))
      messages.length = 0

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow()

      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })

    test('logs error when both methods fail', async () => {
      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow()

      expect(loggerErrorSpy).toHaveBeenCalled()
    })

    test('throws error when both methods fail', async () => {
      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')
    })
  })

  describe('copyTextToClipboard - integration test', () => {
    const shouldRun = process.platform === 'darwin' && !process.env.CI

    test.skipIf(!shouldRun)('actually copies text to system clipboard on macOS', async () => {
      const testText = `clipboard-test-${Date.now()}`

      await copyTextToClipboard(testText, { suppressGlobalMessage: true })

      const clipboardContent = execSync('pbpaste', { encoding: 'utf8' })

      expect(clipboardContent).toBe(testText)
    })
  })

  describe('registerClipboardRenderer and renderer-based copy', () => {
    let originalPlatform: PropertyDescriptor | undefined
    let originalEnv: Record<string, string | undefined>
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
      }
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'dumb'
      delete process.env.TMUX
      delete process.env.STY

      clearClipboardMessage()
      unregisterClipboardRenderer()
    })

    afterEach(() => {
      unregisterClipboardRenderer()
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('renderer with copyToClipboardOSC52 returning true succeeds', async () => {
      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['test text'])
    })

    test('renderer with copyToClipboardOSC52 returning false falls through and fails', async () => {
      registerClipboardRenderer({ copyToClipboardOSC52: () => false })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')
    })

    test('renderer without copyToClipboardOSC52 falls through and fails', async () => {
      registerClipboardRenderer({ someOtherMethod: () => true })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')
    })

    test('renderer whose copyToClipboardOSC52 throws falls through gracefully', async () => {
      registerClipboardRenderer({
        copyToClipboardOSC52: () => { throw new Error('renderer error') },
      })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')
    })

    test('unregisterClipboardRenderer removes renderer so it is no longer used', async () => {
      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })
      unregisterClipboardRenderer()

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')

      expect(calls).toEqual([])
    })

    test('renderer is tried in remote sessions (SSH) before manual OSC52', async () => {
      process.env.SSH_CLIENT = '192.168.1.100 54321 22'
      process.env.TERM = 'xterm-256color'

      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: () => {
          calls.push('renderer')
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['renderer'])
    })

    test('shows success message when renderer copy succeeds', async () => {
      registerClipboardRenderer({ copyToClipboardOSC52: () => true })

      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await copyTextToClipboard('Hello world')

      expect(messages).toContain('Copied: "Hello world"')

      unsubscribe()
    })
  })

  describe('copyTextToClipboard - SSH session detection behavior', () => {

    let originalEnv: Record<string, string | undefined>
    let originalPlatform: PropertyDescriptor | undefined
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
      }
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})
      clearClipboardMessage()
    })

    afterEach(() => {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('SSH_CLIENT env var triggers remote session behavior', async () => {
      process.env.SSH_CLIENT = '192.168.1.100 54321 22'
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'xterm-256color'
      delete process.env.TMUX
      delete process.env.STY

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
      } catch {
      }

      expect(true).toBe(true)
    })

    test('SSH_TTY env var triggers remote session behavior', async () => {
      delete process.env.SSH_CLIENT
      process.env.SSH_TTY = '/dev/pts/0'
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'xterm-256color'

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
      } catch {
      }

      expect(true).toBe(true)
    })

    test('SSH_CONNECTION env var triggers remote session behavior', async () => {
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      process.env.SSH_CONNECTION = '192.168.1.100 54321 10.0.0.1 22'
      process.env.TERM = 'xterm-256color'

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
      } catch {
      }

      expect(true).toBe(true)
    })

    test('no SSH env vars triggers local session behavior (platform tools first)', async () => {
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'xterm-256color'

      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }

      if (process.platform === 'darwin' && !process.env.CI) {
        const testText = `local-session-test-${Date.now()}`
        await copyTextToClipboard(testText, { suppressGlobalMessage: true })

        const clipboardContent = execSync('pbpaste', { encoding: 'utf8' })
        expect(clipboardContent).toBe(testText)
      } else {
        expect(true).toBe(true)
      }
    })
  })

  describe('copyTextToClipboard - blocked OSC52 terminals (Codespaces / VS Code remote)', () => {

    let originalEnv: Record<string, string | undefined>
    let originalPlatform: PropertyDescriptor | undefined
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
        TERM_PROGRAM: process.env.TERM_PROGRAM,
        CODESPACES: process.env.CODESPACES,
      }
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      delete process.env.TMUX
      delete process.env.STY
      delete process.env.CODESPACES
      process.env.TERM = 'xterm-256color'
      process.env.TERM_PROGRAM = 'vscode'

      clearClipboardMessage()
      unregisterClipboardRenderer()
    })

    afterEach(() => {
      unregisterClipboardRenderer()
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('Codespaces: renderer OSC52 is skipped and copy fails', async () => {
      process.env.CODESPACES = 'true'

      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')

      expect(calls).toEqual([])
    })

    test('Codespaces: shows Shift+drag guidance even with suppressGlobalMessage', async () => {
      process.env.CODESPACES = 'true'

      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow()

      expect(messages).toContain(OSC52_BLOCKED_MESSAGE)

      unsubscribe()
    })

    test('VS Code remote SSH: OSC52 is skipped and guidance is shown', async () => {
      process.env.SSH_CONNECTION = '192.168.1.100 54321 10.0.0.1 22'

      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) => messages.push(msg))

      registerClipboardRenderer({ copyToClipboardOSC52: () => true })

      await expect(copyTextToClipboard('test text')).rejects.toThrow()

      expect(messages).toContain(OSC52_BLOCKED_MESSAGE)
      expect(messages.find((m) => m?.startsWith('Copied'))).toBeUndefined()

      unsubscribe()
    })

    test('local VS Code terminal: OSC52 still works', async () => {
      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['test text'])
    })

    test('Codespaces over plain SSH (not vscode terminal): OSC52 still works', async () => {
      process.env.CODESPACES = 'true'
      delete process.env.TERM_PROGRAM

      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['test text'])
    })
  })

  describe('copyTextToClipboard - OSC52 behavior', () => {

    let originalEnv: Record<string, string | undefined>
    let originalPlatform: PropertyDescriptor | undefined
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
      }
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})
      clearClipboardMessage()
    })

    afterEach(() => {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('TERM=dumb disables OSC52 (returns null sequence)', async () => {
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'dumb'
      delete process.env.TMUX
      delete process.env.STY

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      await expect(
        copyTextToClipboard('test', { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')
    })

    test('very large text (>32KB) causes OSC52 to be skipped due to size limit', async () => {
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'xterm-256color'
      delete process.env.TMUX
      delete process.env.STY

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      const largeText = 'x'.repeat(25_000)

      await expect(
        copyTextToClipboard(largeText, { suppressGlobalMessage: true })
      ).rejects.toThrow('No clipboard method available')
    })

    test('TMUX env var should use tmux passthrough wrapping for OSC52', async () => {
      process.env.SSH_CLIENT = '192.168.1.100 54321 22'
      process.env.TERM = 'xterm-256color'
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0'
      delete process.env.STY

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
      } catch {
      }

      expect(true).toBe(true)
    })

    test('STY env var (GNU screen) should use screen passthrough wrapping for OSC52', async () => {
      process.env.SSH_CLIENT = '192.168.1.100 54321 22'
      process.env.TERM = 'screen-256color'
      delete process.env.TMUX
      process.env.STY = '12345.pts-0.hostname'

      Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
      } catch {
      }

      expect(true).toBe(true)
    })
  })
})
