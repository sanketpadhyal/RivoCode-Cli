import * as fs from 'fs'
import path from 'path'

import {
  CHAT_MESSAGES_FILENAME,
  getFirstUserPrompt,
  readChatMeta,
} from './chat-meta'
import { CHAT_LOG_FILENAME, logger } from './logger'
import { getProjectDataDir } from '../project-files'

import type { ChatMessage } from '../types/chat'

export interface ChatHistoryEntry {
  chatId: string
  lastPrompt: string
  timestamp: Date
  messageCount: number
  unreadable?: boolean
}

function getChatsDir(dataDir: string = getProjectDataDir()): string {
  return path.join(dataDir, 'chats')
}

interface ChatDirInfo {
  chatId: string
  chatPath: string
  messagesPath: string
  mtime: Date
}

export function getAllChats(
  maxChats: number = 500,
  dataDir?: string,
): ChatHistoryEntry[] {
  try {
    const chatsDir = getChatsDir(dataDir)

    if (!fs.existsSync(chatsDir)) {
      return []
    }

    const chatDirs = fs.readdirSync(chatsDir)

    const chatDirInfos: ChatDirInfo[] = []
    for (const chatId of chatDirs) {
      const chatPath = path.join(chatsDir, chatId)
      try {
        const stat = fs.statSync(chatPath)
        if (!stat.isDirectory()) continue

        chatDirInfos.push({
          chatId,
          chatPath,
          messagesPath: path.join(chatPath, CHAT_MESSAGES_FILENAME),
          mtime: stat.mtime,
        })
      } catch {
      }
    }

    chatDirInfos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    const chats: ChatHistoryEntry[] = []
    const chatsToLoad = chatDirInfos.slice(0, maxChats)

    for (const info of chatsToLoad) {
      try {
        let messageCount = 0
        let lastPrompt = '(empty chat)'

        if (fs.existsSync(info.messagesPath)) {
          const meta = readChatMeta(info.chatPath)
          if (meta) {
            messageCount = meta.messageCount
            lastPrompt = meta.firstPrompt
          } else {
            const content = fs.readFileSync(info.messagesPath, 'utf8')
            const messages = JSON.parse(content) as ChatMessage[]
            if (!Array.isArray(messages)) {
              throw new Error('chat-messages.json is not an array')
            }
            messageCount = messages.length
            lastPrompt = getFirstUserPrompt(messages)
          }
        }

        if (messageCount > 0) {
          chats.push({
            chatId: info.chatId,
            lastPrompt,
            timestamp: info.mtime,
            messageCount,
          })
        }
      } catch (error) {
        logger.debug(
          {
            chatId: info.chatId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to read chat messages',
        )
        chats.push({
          chatId: info.chatId,
          lastPrompt: '(unreadable chat)',
          timestamp: info.mtime,
          messageCount: 0,
          unreadable: true,
        })
      }
    }

    return chats
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to list chats',
    )
    return []
  }
}

const MAX_LOG_FILE_BYTES = 10 * 1024 * 1024
const MIN_LOG_AGE_MS = 14 * 24 * 60 * 60 * 1000

export function trimOversizedChatLogs(dataDir?: string): void {
  let chatsDir: string
  let chatIds: string[]
  try {
    chatsDir = getChatsDir(dataDir)
    chatIds = fs.readdirSync(chatsDir)
  } catch {
    return
  }

  const deleteBefore = Date.now() - MIN_LOG_AGE_MS
  for (const chatId of chatIds) {
    const logFile = path.join(chatsDir, chatId, CHAT_LOG_FILENAME)
    try {
      const stats = fs.statSync(logFile, { throwIfNoEntry: false })
      if (
        stats &&
        stats.size > MAX_LOG_FILE_BYTES &&
        stats.mtimeMs < deleteBefore
      ) {
        fs.unlinkSync(logFile)
      }
    } catch {
    }
  }
}

export function deleteChatSession(chatId: string, dataDir?: string): boolean {
  try {
    const safeChatId = chatId.trim()
    if (
      !safeChatId ||
      safeChatId === '.' ||
      safeChatId === '..' ||
      path.basename(safeChatId) !== safeChatId
    ) {
      logger.warn({ chatId }, 'Refusing to delete invalid chat id')
      return false
    }

    const chatsDir = getChatsDir(dataDir)
    const chatPath = path.join(chatsDir, safeChatId)

    if (!fs.existsSync(chatPath)) {
      return false
    }

    const stat = fs.statSync(chatPath)
    if (!stat.isDirectory()) {
      logger.warn(
        { chatId, chatPath },
        'Refusing to delete non-directory chat path',
      )
      return false
    }

    fs.rmSync(chatPath, { recursive: true, force: false })
    return true
  } catch (error) {
    logger.error(
      { chatId, error: error instanceof Error ? error.message : String(error) },
      'Failed to delete chat session',
    )
    return false
  }
}

export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
