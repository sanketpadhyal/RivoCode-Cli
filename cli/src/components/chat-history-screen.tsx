import { TextAttributes } from '@opentui/core'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from './button'
import { MultilineInput } from './multiline-input'
import { SelectableList } from './selectable-list'
import { useSearchableList } from '../hooks/use-searchable-list'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import {
  deleteChatSession,
  formatRelativeTime,
  getAllChats,
} from '../utils/chat-history'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { SelectableListItem } from './selectable-list'

const LAYOUT = {
  CONTENT_PADDING: 4,
  COMPACT_MODE_THRESHOLD: 20,
  NARROW_WIDTH_THRESHOLD: 70,
  MAIN_CONTENT_PADDING: 2,
  INITIAL_CHATS: 25,
  BACKGROUND_CHATS: 475,
  MAX_RENDERED_CHATS: 100,
  TIME_COL_WIDTH: 12,
  MSGS_COL_WIDTH: 8,
  DELETE_COL_WIDTH: 6,
  GAP_WIDTH: 3,
} as const

interface ChatHistoryScreenProps {
  onSelectChat: (chatId: string) => void
  onCancel: () => void
  onNewChat: () => void
}

export const ChatHistoryScreen: React.FC<ChatHistoryScreenProps> = ({
  onSelectChat,
  onCancel,
  onNewChat,
}) => {
  const theme = useTheme()
  const { terminalWidth, terminalHeight } = useTerminalLayout()

  const contentWidth = terminalWidth - LAYOUT.CONTENT_PADDING

  const [chats, setChats] = useState(() => getAllChats(LAYOUT.INITIAL_CHATS))
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setChats(getAllChats(LAYOUT.INITIAL_CHATS + LAYOUT.BACKGROUND_CHATS))
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleDeleteChat = useCallback((chatId: string) => {
    const deleted = deleteChatSession(chatId)
    if (deleted) {
      setChats((prev) => prev.filter((chat) => chat.chatId !== chatId))
      setStatusMessage('Chat deleted')
      return
    }

    setStatusMessage('Could not delete chat')
  }, [])

  const reservedWidth =
    LAYOUT.TIME_COL_WIDTH +
    LAYOUT.MSGS_COL_WIDTH +
    LAYOUT.DELETE_COL_WIDTH +
    LAYOUT.GAP_WIDTH * 2 +
    5
  const maxPromptWidth = Math.max(20, contentWidth - reservedWidth)

  const truncateText = (text: string, maxLen: number): string => {
    const singleLine = text.replace(/\n/g, ' ').trim()
    if (singleLine.length <= maxLen) return singleLine
    return singleLine.slice(0, maxLen - 1) + '…'
  }

  const padRight = (text: string, width: number): string => {
    const len = Array.from(text).length
    if (len >= width) return text
    return text + ' '.repeat(width - len)
  }

  const chatItems: SelectableListItem[] = useMemo(
    () =>
      chats.map((chat) => {
        const time = padRight(
          formatRelativeTime(chat.timestamp),
          LAYOUT.TIME_COL_WIDTH,
        )
        const msgs = padRight(
          chat.unreadable ? '—' : `${chat.messageCount} msgs`,
          LAYOUT.MSGS_COL_WIDTH,
        )
        const prompt = padRight(
          truncateText(chat.lastPrompt, maxPromptWidth),
          maxPromptWidth,
        )

        return {
          id: chat.chatId,
          label: `${time}${' '.repeat(LAYOUT.GAP_WIDTH)}${msgs}${' '.repeat(LAYOUT.GAP_WIDTH)}${prompt}`,
          icon: undefined,
          secondary: chat.lastPrompt,
          hideSecondary: true,
        }
      }),
    [chats, maxPromptWidth],
  )

  const filterByPrompt = useCallback(
    (item: SelectableListItem, query: string) =>
      (item.secondary ?? '').toLowerCase().includes(query.toLowerCase()),
    [],
  )

  const {
    searchQuery,
    setSearchQuery,
    focusedIndex,
    setFocusedIndex,
    filteredItems,
    handleFocusChange,
  } = useSearchableList({
    items: chatItems,
    filterFn: filterByPrompt,
  })

  const isCompactMode = terminalHeight < LAYOUT.COMPACT_MODE_THRESHOLD
  const isNarrowWidth = terminalWidth < LAYOUT.NARROW_WIDTH_THRESHOLD

  const unreadableChatIds = useMemo(
    () => new Set(chats.filter((chat) => chat.unreadable).map((c) => c.chatId)),
    [chats],
  )

  const selectChat = useCallback(
    (chatId: string) => {
      if (unreadableChatIds.has(chatId)) {
        setStatusMessage("Chat file is corrupted and can't be opened")
        return
      }
      onSelectChat(chatId)
    },
    [onSelectChat, unreadableChatIds],
  )

  const handleChatSelect = useCallback(
    (item: SelectableListItem) => {
      selectChat(item.id)
    },
    [selectChat],
  )

  const handleChatDelete = useCallback(
    (item: SelectableListItem) => {
      handleDeleteChat(item.id)
    },
    [handleDeleteChat],
  )

  const handleKeyIntercept = useCallback(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      if (key.name === 'escape') {
        if (searchQuery.length > 0) {
          setSearchQuery('')
        } else {
          onCancel()
        }
        return true
      }
      if (key.name === 'up') {
        setFocusedIndex((prev) => Math.max(0, prev - 1))
        return true
      }
      if (key.name === 'down') {
        const maxIndex =
          Math.min(filteredItems.length, LAYOUT.MAX_RENDERED_CHATS) - 1
        setFocusedIndex((prev) => Math.min(maxIndex, prev + 1))
        return true
      }
      if (isPlainEnterKey(key)) {
        const focused = filteredItems[focusedIndex]
        if (focused) {
          selectChat(focused.id)
        }
        return true
      }
      if (key.name === 'c' && key.ctrl) {
        onCancel()
        return true
      }
      return false
    },
    [
      searchQuery,
      setSearchQuery,
      setFocusedIndex,
      filteredItems,
      focusedIndex,
      selectChat,
      onCancel,
    ],
  )

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.surface,
        padding: 0,
        flexDirection: 'column',
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          paddingLeft: 2,
          paddingRight: 2,
          paddingTop: isCompactMode ? 0 : 1,
          paddingBottom: 0,
          gap: 0,
          flexGrow: 1,
          flexShrink: 1,
        }}
      >
        {!isCompactMode && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 1,
              marginTop: 1,
              flexShrink: 0,
            }}
          >
            <text
              style={{ fg: theme.foreground, attributes: TextAttributes.BOLD }}
            >
              Select a chat to resume
            </text>
          </box>
        )}

        <box
          style={{
            width: contentWidth,
            flexShrink: 0,
            marginBottom: 0,
          }}
        >
          <MultilineInput
            value={searchQuery}
            onChange={({ text }) => setSearchQuery(text)}
            onSubmit={() => {}}
            onPaste={() => {}}
            onKeyIntercept={handleKeyIntercept}
            placeholder="Search chats..."
            focused={true}
            maxHeight={1}
            minHeight={1}
            cursorPosition={searchQuery.length}
          />
        </box>

        <box
          style={{
            flexDirection: 'column',
            width: contentWidth,
            borderStyle: 'single',
            borderColor: theme.muted,
            flexGrow: 1,
            flexShrink: 1,
            overflow: 'hidden',
          }}
          border={['top', 'bottom', 'left', 'right']}
        >
          <SelectableList
            items={filteredItems.slice(0, LAYOUT.MAX_RENDERED_CHATS)}
            focusedIndex={focusedIndex}
            onSelect={handleChatSelect}
            actionLabel="[×]"
            onAction={handleChatDelete}
            onFocusChange={handleFocusChange}
            emptyMessage={
              chats.length === 0
                ? 'No chat history yet'
                : searchQuery
                  ? 'No matching chats'
                  : 'No chats found'
            }
          />
        </box>
      </box>

      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          paddingTop: 0,
          paddingBottom: 0,
          borderStyle: 'single',
          borderColor: theme.border,
          flexShrink: 0,
          backgroundColor: theme.surface,
        }}
        border={['top']}
      >
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: contentWidth,
          }}
        >
          <box style={{ flexGrow: 1, flexShrink: 1 }}>
            <text style={{ fg: theme.muted }}>
              ↑↓ navigate · Enter select · Click [×] to remove · Esc cancel
            </text>
            {statusMessage && (
              <text style={{ fg: theme.muted }}>
                {' · '}
                {statusMessage}
              </text>
            )}
          </box>

          {!isNarrowWidth && (
            <box style={{ flexDirection: 'row', gap: 1 }}>
              <Button
                onClick={onNewChat}
                style={{
                  paddingLeft: 2,
                  paddingRight: 2,
                  paddingTop: 0,
                  paddingBottom: 0,
                  borderStyle: 'single',
                  borderColor: theme.primary,
                }}
                border={['top', 'bottom', 'left', 'right']}
              >
                <text style={{ fg: theme.primary }}>New Chat</text>
              </Button>
              <Button
                onClick={onCancel}
                style={{
                  paddingLeft: 2,
                  paddingRight: 2,
                  paddingTop: 0,
                  paddingBottom: 0,
                  borderStyle: 'single',
                  borderColor: theme.muted,
                }}
                border={['top', 'bottom', 'left', 'right']}
              >
                <text style={{ fg: theme.muted }}>Cancel</text>
              </Button>
            </box>
          )}
        </box>
      </box>
    </box>
  )
}
