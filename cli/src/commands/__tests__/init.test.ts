import * as fs from 'fs'
import path from 'path'

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import * as projectFiles from '../../project-files'
import { handleInitializationFlowLocally } from '../init'

import type { ChatMessage } from '../../types/chat'

const getMessageText = (messages: ChatMessage[]): string => {
  return messages
    .map((m) => {
      if (typeof m.content === 'string') {
        return m.content
      }
      return ''
    })
    .join('')
}

describe('handleInitializationFlowLocally', () => {
  const TEST_PROJECT_ROOT = '/test/project'
  const KNOWLEDGE_FILE_NAME = 'AGENTS.md'

  let existsSyncSpy: ReturnType<typeof spyOn>
  let writeFileSyncSpy: ReturnType<typeof spyOn>
  let mkdirSyncSpy: ReturnType<typeof spyOn>
  let getProjectRootSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    getProjectRootSpy = spyOn(projectFiles, 'getProjectRoot').mockReturnValue(
      TEST_PROJECT_ROOT,
    )

    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(false)
    writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    mkdirSyncSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)
  })

  afterEach(() => {
    mock.restore()
  })

  describe('knowledge file creation', () => {
    test('creates AGENTS.md when it does not exist', () => {
      existsSyncSpy.mockImplementation((_p: string) => false)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
        expect.stringContaining('# Project knowledge'),
      )

      const messages = postUserMessage([])
      expect(messages.length).toBeGreaterThan(0)
      expect(getMessageText(messages)).toContain('✅ Created `AGENTS.md`')
    })

    test('skips AGENTS.md creation when it already exists', () => {
      existsSyncSpy.mockImplementation((p: unknown) =>
        p === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
      )

      const { postUserMessage } = handleInitializationFlowLocally()

      const knowledgeWriteCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
      )
      expect(knowledgeWriteCalls.length).toBe(0)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('📋 `AGENTS.md` already exists')
    })
  })

  describe('.agents directory creation', () => {
    test('creates .agents directory when it does not exist', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_ROOT, '.agents'),
        { recursive: true },
      )

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('✅ Created `.agents/`')
    })

    test('skips .agents directory creation when it already exists', () => {
      existsSyncSpy.mockImplementation((p: unknown) =>
        p === path.join(TEST_PROJECT_ROOT, '.agents'),
      )

      const { postUserMessage } = handleInitializationFlowLocally()

      const agentsDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === path.join(TEST_PROJECT_ROOT, '.agents'),
      )
      expect(agentsDirCalls.length).toBe(0)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('📋 `.agents/` already exists')
    })
  })

  describe('.agents/types directory creation', () => {
    test('creates .agents/types directory when it does not exist', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_ROOT, '.agents', 'types'),
        { recursive: true },
      )

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('✅ Created `.agents/types/`')
    })

    test('skips .agents/types directory creation when it already exists', () => {
      existsSyncSpy.mockImplementation((p: unknown) => {
        return (
          p === path.join(TEST_PROJECT_ROOT, '.agents') ||
          p === path.join(TEST_PROJECT_ROOT, '.agents', 'types')
        )
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      const typesDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === path.join(TEST_PROJECT_ROOT, '.agents', 'types'),
      )
      expect(typesDirCalls.length).toBe(0)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain('📋 `.agents/types/` already exists')
    })
  })

  describe('type file copying', () => {
    test('copies type files when they do not exist', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      const typeFiles = ['agent-definition.ts', 'tools.ts', 'util-types.ts']
      for (const fileName of typeFiles) {
        const fileCalls = writeFileSyncSpy.mock.calls.filter((call: unknown[]) =>
          (call[0] as string).endsWith(fileName),
        )
        expect(fileCalls.length).toBe(1)
      }

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('`.agents/types/agent-definition.ts`')
      expect(messageContent).toContain('`.agents/types/tools.ts`')
      expect(messageContent).toContain('`.agents/types/util-types.ts`')
    })

    test('skips type files that already exist', () => {
      const typesDir = path.join(TEST_PROJECT_ROOT, '.agents', 'types')
      existsSyncSpy.mockImplementation((p: unknown) => {
        return p === path.join(typesDir, 'agent-definition.ts')
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      const agentDefCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).endsWith('agent-definition.ts'),
      )
      expect(agentDefCalls.length).toBe(0)

      const toolsCalls = writeFileSyncSpy.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).endsWith('tools.ts'),
      )
      expect(toolsCalls.length).toBe(1)

      const utilTypesCalls = writeFileSyncSpy.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).endsWith('util-types.ts'),
      )
      expect(utilTypesCalls.length).toBe(1)

      const messages = postUserMessage([])
      expect(getMessageText(messages)).toContain(
        '📋 `.agents/types/agent-definition.ts` already exists',
      )
    })
  })

  describe('message accumulation', () => {
    test('returns multiple messages for all operations', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      const messages = postUserMessage([])

      expect(messages.length).toBeGreaterThanOrEqual(6)
    })

    test('preserves previous messages in postUserMessage', () => {
      existsSyncSpy.mockReturnValue(false)

      const { postUserMessage } = handleInitializationFlowLocally()

      const previousMessages: ChatMessage[] = [
        {
          id: 'user-123',
          variant: 'user',
          content: 'Previous message',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ]

      const messages = postUserMessage(previousMessages)

      expect(messages[0]).toEqual(previousMessages[0])
      expect(messages.length).toBeGreaterThan(1)
    })
  })

  describe('error handling', () => {
    test('handles writeFileSync errors for type files gracefully', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('tools.ts')) {
          throw new Error('Permission denied')
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('⚠️ Failed to copy `.agents/types/tools.ts`')
      expect(messageContent).toContain('Permission denied')
    })

    test('handles writeFileSync errors for AGENTS.md gracefully', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith(KNOWLEDGE_FILE_NAME)) {
          throw new Error('Disk full')
        }
      })

      expect(() => handleInitializationFlowLocally()).toThrow('Disk full')
    })

    test('handles mkdirSync errors for .agents directory gracefully', () => {
      existsSyncSpy.mockReturnValue(false)
      mkdirSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('.agents')) {
          throw new Error('Cannot create directory')
        }
        return undefined
      })

      expect(() => handleInitializationFlowLocally()).toThrow('Cannot create directory')
    })

    test('handles mkdirSync errors for .agents/types directory gracefully', () => {
      existsSyncSpy.mockImplementation((p: unknown) => {
        return p === path.join(TEST_PROJECT_ROOT, '.agents')
      })
      mkdirSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('types')) {
          throw new Error('Permission denied for types dir')
        }
        return undefined
      })

      expect(() => handleInitializationFlowLocally()).toThrow('Permission denied for types dir')
    })

    test('continues copying other files when one type file fails', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('agent-definition.ts')) {
          throw new Error('File locked')
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()
      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('⚠️ Failed to copy `.agents/types/agent-definition.ts`')
      expect(messageContent).toContain('File locked')

      expect(messageContent).toContain('✅ Copied `.agents/types/tools.ts`')
      expect(messageContent).toContain('✅ Copied `.agents/types/util-types.ts`')
    })

    test('handles non-Error exceptions in type file copying', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('util-types.ts')) {
          throw 'string error'
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()
      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('⚠️ Failed to copy `.agents/types/util-types.ts`')
      expect(messageContent).toContain('string error')
    })

    test('handles null/undefined exceptions in type file copying', () => {
      existsSyncSpy.mockReturnValue(false)
      writeFileSyncSpy.mockImplementation((p: unknown) => {
        if ((p as string).endsWith('tools.ts')) {
          throw null
        }
      })

      const { postUserMessage } = handleInitializationFlowLocally()
      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('⚠️ Failed to copy `.agents/types/tools.ts`')
      expect(messageContent).toContain('Unknown')
    })
  })

  describe('integration scenarios', () => {
    test('handles partial initialization state correctly', () => {
      const agentsDir = path.join(TEST_PROJECT_ROOT, '.agents')
      const typesDir = path.join(agentsDir, 'types')

      existsSyncSpy.mockImplementation((p: unknown) => {
        return (
          p === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME) ||
          p === agentsDir
        )
      })

      const { postUserMessage } = handleInitializationFlowLocally()

      const knowledgeWriteCalls = writeFileSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === path.join(TEST_PROJECT_ROOT, KNOWLEDGE_FILE_NAME),
      )
      expect(knowledgeWriteCalls.length).toBe(0)

      const agentsDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === agentsDir,
      )
      expect(agentsDirCalls.length).toBe(0)

      const typesDirCalls = mkdirSyncSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === typesDir,
      )
      expect(typesDirCalls.length).toBe(1)

      const typeFileCalls = writeFileSyncSpy.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).startsWith(typesDir),
      )
      expect(typeFileCalls.length).toBe(3)

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('📋 `AGENTS.md` already exists')
      expect(messageContent).toContain('📋 `.agents/` already exists')
      expect(messageContent).toContain('✅ Created `.agents/types/`')
    })

    test('handles fully initialized project correctly', () => {
      existsSyncSpy.mockReturnValue(true)

      const { postUserMessage } = handleInitializationFlowLocally()

      expect(writeFileSyncSpy).not.toHaveBeenCalled()
      expect(mkdirSyncSpy).not.toHaveBeenCalled()

      const messages = postUserMessage([])
      const messageContent = getMessageText(messages)

      expect(messageContent).toContain('📋 `AGENTS.md` already exists')
      expect(messageContent).toContain('📋 `.agents/` already exists')
      expect(messageContent).toContain('📋 `.agents/types/` already exists')
      expect(messageContent).toContain(
        '📋 `.agents/types/agent-definition.ts` already exists',
      )
      expect(messageContent).toContain(
        '📋 `.agents/types/tools.ts` already exists',
      )
      expect(messageContent).toContain(
        '📋 `.agents/types/util-types.ts` already exists',
      )
    })
  })
})
