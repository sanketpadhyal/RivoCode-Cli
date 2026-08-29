import * as fs from 'fs'
import path from 'path'
import { randomUUID } from 'node:crypto'

import {
  getCurrentChatDir,
  getMostRecentChatDir,
  getProjectDataDir,
} from '../project-files'
import {
  CHAT_MESSAGES_FILENAME,
  CHAT_META_FILENAME,
  writeChatMeta,
} from './chat-meta'
import { logger } from './logger'
import { classifyStringifyError, serializeForPersistence } from './safe-json'
import { writeFileAtomic, writeFileAtomicAsync } from './write-file-atomic'

import type { ChatMessage, ContentBlock } from '../types/chat'
import type { RunState } from '@codebuff/sdk'

const RUN_STATE_FILENAME = 'run-state.json'

type SavedChatState = {
  runState: RunState
  messages: ChatMessage[]
  chatId?: string
}

type LiveChatState = {
  runState: RunState
  messages: ChatMessage[]
}

let liveChatStateProvider: {
  ownerId: string
  chatDir: string
  provide: () => LiveChatState | null
} | null = null

export function setLiveChatStateProvider(
  ownerId: string,
  provide: () => LiveChatState | null,
): void {
  liveChatStateProvider = { ownerId, chatDir: resolveCurrentChatDir(), provide }
}

export function clearLiveChatStateProvider(ownerId: string): void {
  if (liveChatStateProvider?.ownerId === ownerId) {
    liveChatStateProvider = null
  }
}

export function flushLiveChatState(): void {
  try {
    for (const [chatDir, state] of pendingCheckpoints) {
      saveChatState(state.runState, state.messages, chatDir)
    }
    pendingCheckpoints.clear()

    const provider = liveChatStateProvider
    if (!provider) {
      return
    }
    if (provider.chatDir !== resolveCurrentChatDir()) {
      return
    }
    const state = provider.provide()
    if (state) {
      saveChatState(state.runState, state.messages, provider.chatDir)
    }
  } catch {
  }
}

function extractToggleIds(blocks: ContentBlock[] | undefined): string[] {
  if (!blocks) return []

  const ids: string[] = []

  for (const block of blocks) {
    if (block.type === 'agent') {
      ids.push(block.agentId)
      ids.push(...extractToggleIds(block.blocks))
    } else if (block.type === 'tool') {
      ids.push(block.toolCallId)
    }
  }

  return ids
}

export function getAllToggleIdsFromMessages(messages: ChatMessage[]): string[] {
  const ids: string[] = []

  for (const message of messages) {
    ids.push(...extractToggleIds(message.blocks))
  }

  return ids
}

let chatDirOverride: string | undefined

export function setChatDirOverrideForTesting(dir: string | undefined): void {
  chatDirOverride = dir
}

export function resolveCurrentChatDir(): string {
  if (chatDirOverride) {
    fs.mkdirSync(chatDirOverride, { recursive: true })
    return chatDirOverride
  }
  return getCurrentChatDir()
}

export function getRunStatePath(): string {
  const chatDir = resolveCurrentChatDir()
  return path.join(chatDir, RUN_STATE_FILENAME)
}

export function getChatMessagesPath(): string {
  const chatDir = resolveCurrentChatDir()
  return path.join(chatDir, CHAT_MESSAGES_FILENAME)
}

const SAVE_LOG_INTERVAL_MS = 5 * 60 * 1000
const saveIssueLastLoggedAt = new Map<string, number>()

function shouldLogSaveIssue(key: string): boolean {
  const now = Date.now()
  const last = saveIssueLastLoggedAt.get(key)
  if (last !== undefined && now - last < SAVE_LOG_INTERVAL_MS) {
    return false
  }
  saveIssueLastLoggedAt.set(key, now)
  return true
}

function bestEffortLog(
  level: 'warn' | 'error',
  payload: Record<string, unknown>,
  message: string,
): void {
  try {
    logger[level](payload, message)
  } catch {
  }
}

type SaveErrorClass = 'cyclic' | 'oom' | 'disk' | 'other'

function classifySaveError(error: unknown): SaveErrorClass {
  const fromStringify = classifyStringifyError(error)
  if (fromStringify) return fromStringify
  const msg = error instanceof Error ? error.message : String(error)
  if (/ENOSPC|EDQUOT|EROFS|EPERM|EACCES|EBUSY|EMFILE|ENFILE/.test(msg)) {
    return 'disk'
  }
  return 'other'
}

function chatShapeSummary(runState: RunState, messages: ChatMessage[]) {
  let blockCount = 0
  for (const message of messages) {
    blockCount += message.blocks?.length ?? 0
  }
  return {
    messageCount: messages.length,
    blockCount,
    runStateKeys:
      runState && typeof runState === 'object'
        ? Object.keys(runState as object).slice(0, 20)
        : [],
  }
}

type SerializedChatState = {
  runStateJson?: string
  messagesJson?: string
}

function serializeChatState(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string,
): SerializedChatState {
  const result: SerializedChatState = {}
  for (const part of ['runState', 'messages'] as const) {
    const value = part === 'runState' ? runState : messages
    try {
      const { json, fallback } = serializeForPersistence(value)
      if (part === 'runState') {
        result.runStateJson = json
      } else {
        result.messagesJson = json
      }
      if (fallback && shouldLogSaveIssue(`${chatDir}|fallback|${part}`)) {
        bestEffortLog(
          'warn',
          {
            part,
            reason: fallback.reason,
            cyclePaths: fallback.cyclePaths,
            truncatedStrings: fallback.truncatedStrings,
            jsonBytes: json.length,
            ...chatShapeSummary(runState, messages),
          },
          'Chat state serialized via fallback (broke cycles or truncated oversized strings)',
        )
      }
    } catch (error) {
      const errorClass = classifySaveError(error)
      if (shouldLogSaveIssue(`${chatDir}|serialize|${part}|${errorClass}`)) {
        bestEffortLog(
          errorClass === 'other' ? 'error' : 'warn',
          {
            part,
            errorClass,
            error: error instanceof Error ? error.message : String(error),
            ...chatShapeSummary(runState, messages),
          },
          'Failed to serialize chat state',
        )
      }
    }
  }
  return result
}

function logSaveWriteFailure(
  error: unknown,
  chatDir: string,
  message: string,
): void {
  const errorClass = classifySaveError(error)
  if (!shouldLogSaveIssue(`${chatDir}|write|${errorClass}`)) {
    return
  }
  bestEffortLog(
    errorClass === 'other' ? 'error' : 'warn',
    {
      errorClass,
      error: error instanceof Error ? error.message : String(error),
    },
    message,
  )
}

export function saveChatState(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string = resolveCurrentChatDir(),
): void {
  const serialized = serializeChatState(runState, messages, chatDir)
  if (!serialized.runStateJson && !serialized.messagesJson) {
    return
  }
  try {
    fs.mkdirSync(chatDir, { recursive: true })
    if (serialized.runStateJson) {
      writeFileAtomic(
        path.join(chatDir, RUN_STATE_FILENAME),
        serialized.runStateJson,
      )
    }
    if (serialized.messagesJson) {
      writeFileAtomic(
        path.join(chatDir, CHAT_MESSAGES_FILENAME),
        serialized.messagesJson,
      )
      writeChatMeta(chatDir, messages)
    }
  } catch (error) {
    logSaveWriteFailure(error, chatDir, 'Failed to save chat state')
  }
}

async function saveChatStateAsync(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string,
): Promise<void> {
  const serialized = serializeChatState(runState, messages, chatDir)
  if (!serialized.runStateJson && !serialized.messagesJson) {
    return
  }
  try {
    await fs.promises.mkdir(chatDir, { recursive: true })
    if (serialized.runStateJson) {
      await writeFileAtomicAsync(
        path.join(chatDir, RUN_STATE_FILENAME),
        serialized.runStateJson,
      )
    }
    if (serialized.messagesJson) {
      await writeFileAtomicAsync(
        path.join(chatDir, CHAT_MESSAGES_FILENAME),
        serialized.messagesJson,
      )
      writeChatMeta(chatDir, messages)
    }
  } catch (error) {
    logSaveWriteFailure(error, chatDir, 'Failed to save chat state (async)')
  }
}

const pendingCheckpoints = new Map<string, LiveChatState>()
let checkpointDrain: Promise<void> | null = null

async function drainCheckpoints(): Promise<void> {
  while (pendingCheckpoints.size > 0) {
    await new Promise<void>((resolve) => setImmediate(resolve))
    const entry = pendingCheckpoints.entries().next()
    if (entry.done) {
      break
    }
    const [chatDir, state] = entry.value
    pendingCheckpoints.delete(chatDir)
    await saveChatStateAsync(state.runState, state.messages, chatDir)
  }
}

export function scheduleCheckpointSave(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string = resolveCurrentChatDir(),
): void {
  pendingCheckpoints.set(chatDir, { runState, messages })
  if (!checkpointDrain) {
    checkpointDrain = drainCheckpoints().finally(() => {
      checkpointDrain = null
    })
  }
}

export async function settleCheckpointSave(): Promise<void> {
  await checkpointDrain
}

export function loadMostRecentChatState(
  chatId?: string,
): SavedChatState | null {
  try {
    let chatDir: string | null = chatDirOverride ?? null

    if (!chatDir && chatId && chatId.trim().length > 0) {
      const baseDir = path.join(getProjectDataDir(), 'chats')
      const candidateDir = path.join(baseDir, chatId.trim())
      if (
        fs.existsSync(candidateDir) &&
        fs.statSync(candidateDir).isDirectory()
      ) {
        chatDir = candidateDir
      } else {
        logger.debug(
          { candidateDir, chatId },
          'Requested chatId directory not found, falling back to most recent chat directory',
        )
      }
    }

    if (!chatDir) {
      chatDir = getMostRecentChatDir()
    }

    if (!chatDir) {
      logger.debug('No previous chat directory found')
      return null
    }

    const runStatePath = path.join(chatDir, RUN_STATE_FILENAME)
    const messagesPath = path.join(chatDir, CHAT_MESSAGES_FILENAME)

    let runState: RunState | null = null
    try {
      runState = JSON.parse(fs.readFileSync(runStatePath, 'utf8')) as RunState
    } catch (error) {
      logger.warn(
        {
          runStatePath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not read run state; restoring transcript without agent context',
      )
    }

    let messages: ChatMessage[] | null = null
    try {
      messages = JSON.parse(
        fs.readFileSync(messagesPath, 'utf8'),
      ) as ChatMessage[]
    } catch (error) {
      logger.warn(
        {
          messagesPath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not read chat messages; restoring agent context without transcript',
      )
    }

    if (!runState && !messages) {
      logger.debug(
        { runStatePath, messagesPath },
        'No readable state files in chat directory',
      )
      return null
    }

    runState ??= {
      output: {
        type: 'error',
        message: 'Previous run state could not be restored.',
      },
    } as RunState
    runState.traceSessionId ??= randomUUID()
    messages ??= []

    const resolvedChatId = path.basename(chatDir)

    logger.info(
      {
        runStatePath,
        messagesPath,
        messageCount: messages.length,
        chatId: resolvedChatId,
      },
      'Loaded chat state from chat directory',
    )

    return { runState, messages, chatId: resolvedChatId }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to load chat state',
    )
    return null
  }
}

export function clearChatState(): void {
  try {
    const runStatePath = getRunStatePath()
    const messagesPath = getChatMessagesPath()
    const metaPath = path.join(resolveCurrentChatDir(), CHAT_META_FILENAME)

    for (const filePath of [runStatePath, messagesPath, metaPath]) {
      fs.rmSync(filePath, { force: true })
    }

    logger.debug(
      { runStatePath, messagesPath, metaPath },
      'Cleared chat state files',
    )
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to clear chat state',
    )
  }
}
