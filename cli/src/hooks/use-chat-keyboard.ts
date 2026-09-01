import { statSync } from 'fs'

import { useKeyboard } from '@opentui/react'
import { useCallback, useRef } from 'react'

import { getProjectRoot } from '../project-files'
import { reportActivity } from '../utils/activity-tracker'
import { hasClipboardImage, readClipboardText, readClipboardFilePath, getImageFilePathFromText } from '../utils/clipboard-image'
import { isImageFile } from '../utils/image-handler'
import {
  resolveChatKeyboardAction,
  type ChatKeyboardState,
  type ChatKeyboardAction,
} from '../utils/keyboard-actions'
import { markReturnKeySeenForKey } from '../utils/terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'

const KEYBOARD_ACTIVITY_THROTTLE_MS = 1000

export type ChatKeyboardHandlers = {
  onExitInputMode: () => void
  onExitFeedbackMode: () => void
  onClearFeedbackInput: () => void

  onClearInput: () => void
  onBackspaceExitMode: () => void

  onInterruptStream: () => void

  onSlashMenuDown: () => void
  onSlashMenuUp: () => void
  onSlashMenuSelect: () => Promise<void> | void
  onSlashMenuComplete: () => void

  onMentionMenuDown: () => void
  onMentionMenuUp: () => void
  onMentionMenuTab: () => void
  onMentionMenuShiftTab: () => void
  onMentionMenuSelect: () => void
  onMentionMenuComplete: () => void

  onOpenFileMenuWithTab: () => boolean

  onHistoryUp: () => void
  onHistoryDown: () => void

  onToggleAgentMode: () => void
  onToggleAutoAcceptEdits?: () => void
  onUnfocusAgent: () => void

  onClearQueue: () => void
  onOpenQueuePanel: () => void

  onExitAppWarning: () => void
  onExitApp: () => void

  onBashHistoryUp: () => void
  onBashHistoryDown: () => void

  onPasteImage: () => void
  onPasteImagePath: (imagePath: string) => void
  onPasteFilePath: (filePath: string, isDirectory: boolean) => void
  onPasteText: (text: string) => void

  onScrollUp: () => void
  onScrollDown: () => void

  onToggleAll: () => void

  onOpenBuyCredits: () => void
  onOpenTerminalLogs?: () => void
}

export type UseChatKeyboardOptions = {
  state: ChatKeyboardState
  handlers: ChatKeyboardHandlers
  disabled?: boolean
}

function assertNever(action: never): never {
  throw new Error(`Unhandled chat keyboard action: ${String(action)}`)
}

function dispatchAction(
  action: ChatKeyboardAction,
  handlers: ChatKeyboardHandlers,
): boolean {
  switch (action.type) {
    case 'exit-input-mode':
      handlers.onExitInputMode()
      return true
    case 'exit-feedback-mode':
      handlers.onExitFeedbackMode()
      return true
    case 'clear-feedback-input':
      handlers.onClearFeedbackInput()
      return true
    case 'clear-input':
      handlers.onClearInput()
      return true
    case 'backspace-exit-mode':
      handlers.onBackspaceExitMode()
      return true
    case 'interrupt-stream':
      handlers.onInterruptStream()
      return true
    case 'slash-menu-down':
      handlers.onSlashMenuDown()
      return true
    case 'slash-menu-up':
      handlers.onSlashMenuUp()
      return true
    case 'slash-menu-select':
      handlers.onSlashMenuSelect()
      return true
    case 'slash-menu-complete':
      handlers.onSlashMenuComplete()
      return true
    case 'mention-menu-down':
      handlers.onMentionMenuDown()
      return true
    case 'mention-menu-up':
      handlers.onMentionMenuUp()
      return true
    case 'mention-menu-tab':
      handlers.onMentionMenuTab()
      return true
    case 'mention-menu-shift-tab':
      handlers.onMentionMenuShiftTab()
      return true
    case 'mention-menu-select':
      handlers.onMentionMenuSelect()
      return true
    case 'mention-menu-complete':
      handlers.onMentionMenuComplete()
      return true
    case 'open-file-menu-with-tab': {
      const opened = handlers.onOpenFileMenuWithTab()
      if (!opened) {
        handlers.onToggleAgentMode()
      }
      return true
    }
    case 'history-up':
      handlers.onHistoryUp()
      return true
    case 'history-down':
      handlers.onHistoryDown()
      return true
    case 'toggle-agent-mode':
      handlers.onToggleAgentMode()
      return true
    case 'toggle-auto-accept-edits':
      handlers.onToggleAutoAcceptEdits?.()
      return true
    case 'unfocus-agent':
      handlers.onUnfocusAgent()
      return true
    case 'clear-queue':
      handlers.onClearQueue()
      return true
    case 'open-queue-panel':
      handlers.onOpenQueuePanel()
      return true
    case 'exit-app-warning':
      handlers.onExitAppWarning()
      return true
    case 'exit-app':
      handlers.onExitApp()
      return true
    case 'bash-history-up':
      handlers.onBashHistoryUp()
      return true
    case 'bash-history-down':
      handlers.onBashHistoryDown()
      return true
    case 'paste': {
      const cwd = getProjectRoot() ?? process.cwd()

      const copiedFilePath = readClipboardFilePath()
      if (copiedFilePath) {
        if (isImageFile(copiedFilePath)) {
          handlers.onPasteImagePath(copiedFilePath)
          return true
        }
        try {
          const fileStats = statSync(copiedFilePath)
          handlers.onPasteFilePath(copiedFilePath, fileStats.isDirectory())
          return true
        } catch {
        }
      }

      const rawText = readClipboardText()
      const text = rawText ? Bun.stripANSI(rawText) : null
      if (text) {
        const imagePath = getImageFilePathFromText(text, cwd)
        if (imagePath) {
          handlers.onPasteImagePath(imagePath)
          return true
        }
      }

      if (hasClipboardImage()) {
        handlers.onPasteImage()
        return true
      }

      if (text) {
        handlers.onPasteText(text)
        return true
      }
      return true
    }
    case 'scroll-up':
      handlers.onScrollUp()
      return true
    case 'scroll-down':
      handlers.onScrollDown()
      return true
    case 'toggle-all':
      handlers.onToggleAll()
      return true
    case 'open-buy-credits':
      handlers.onOpenBuyCredits()
      return true
    case 'open-terminal-logs':
      handlers.onOpenTerminalLogs?.()
      return true
    case 'none':
      return false
  }

  return assertNever(action)
}

export function useChatKeyboard({
  state,
  handlers,
  disabled = false,
}: UseChatKeyboardOptions): void {
  const lastKeyboardActivityRef = useRef<number>(0)

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (disabled) return

        const now = Date.now()
        if (now - lastKeyboardActivityRef.current > KEYBOARD_ACTIVITY_THROTTLE_MS) {
          lastKeyboardActivityRef.current = now
          reportActivity()
        }

        markReturnKeySeenForKey(key)

        const action = resolveChatKeyboardAction(key, state)
        const handled = dispatchAction(action, handlers)

        if (
          handled &&
          'preventDefault' in key &&
          typeof key.preventDefault === 'function'
        ) {
          key.preventDefault()
        }
      },
      [state, handlers, disabled],
    ),
  )
}
