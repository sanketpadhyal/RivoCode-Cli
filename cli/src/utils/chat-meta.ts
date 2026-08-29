import * as fs from 'fs'
import path from 'path'

import { z } from 'zod'

import { writeFileAtomic } from './write-file-atomic'

import type { ChatMessage } from '../types/chat'

export const CHAT_MESSAGES_FILENAME = 'chat-messages.json'
export const CHAT_META_FILENAME = 'chat-meta.json'

const chatMetaSchema = z.object({
  messageCount: z.number(),
  firstPrompt: z.string(),
  messagesSize: z.number(),
  messagesMtimeMs: z.number(),
})

export type ChatMeta = z.infer<typeof chatMetaSchema>

export function getFirstUserPrompt(messages: ChatMessage[]): string {
  for (const msg of messages) {
    if (msg?.variant === 'user' && msg.content) {
      const content = msg.content.trim()
      if (content.length > 100) {
        return content.slice(0, 97) + '...'
      }
      return content
    }
  }
  return '(empty chat)'
}

export function writeChatMeta(chatDir: string, messages: ChatMessage[]): void {
  const stats = fs.statSync(path.join(chatDir, CHAT_MESSAGES_FILENAME))
  const meta: ChatMeta = {
    messageCount: messages.length,
    firstPrompt: getFirstUserPrompt(messages),
    messagesSize: stats.size,
    messagesMtimeMs: stats.mtimeMs,
  }
  writeFileAtomic(path.join(chatDir, CHAT_META_FILENAME), JSON.stringify(meta))
}

export function readChatMeta(chatDir: string): ChatMeta | null {
  try {
    const raw = fs.readFileSync(path.join(chatDir, CHAT_META_FILENAME), 'utf8')
    const parsed = chatMetaSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return null
    }
    const meta = parsed.data
    const stats = fs.statSync(path.join(chatDir, CHAT_MESSAGES_FILENAME))
    if (
      stats.size !== meta.messagesSize ||
      stats.mtimeMs !== meta.messagesMtimeMs
    ) {
      return null
    }
    return meta
  } catch {
    return null
  }
}
