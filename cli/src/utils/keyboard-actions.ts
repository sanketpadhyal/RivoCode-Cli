import { getInputModeConfig, type InputMode } from './input-modes'
import { isPlainEnterKey } from './terminal-enter-detection'
import type { KeyEvent } from '@opentui/core'

export type ChatKeyboardState = {
  inputMode: InputMode
  inputValue: string
  cursorPosition: number

  isStreaming: boolean
  isWaitingForResponse: boolean

  feedbackMode: boolean

  focusedAgentId: string | null

  slashMenuActive: boolean
  mentionMenuActive: boolean
  slashSelectedIndex: number
  agentSelectedIndex: number
  slashMatchesLength: number
  totalMentionMatches: number
  disableSlashSuggestions: boolean

  queuePaused: boolean
  queuedCount: number

  historyNavUpEnabled: boolean
  historyNavDownEnabled: boolean

  nextCtrlCWillExit: boolean
}

export type ChatKeyboardAction =
  | { type: 'exit-input-mode' }
  | { type: 'exit-feedback-mode' }
  | { type: 'clear-feedback-input' }

  | { type: 'clear-input' }
  | { type: 'backspace-exit-mode' }

  | { type: 'interrupt-stream' }

  | { type: 'slash-menu-down' }
  | { type: 'slash-menu-up' }
  | { type: 'slash-menu-select' }
  | { type: 'slash-menu-complete' }
  | { type: 'mention-menu-down' }
  | { type: 'mention-menu-up' }
  | { type: 'mention-menu-tab' }
  | { type: 'mention-menu-shift-tab' }
  | { type: 'mention-menu-select' }
  | { type: 'mention-menu-complete' }
  | { type: 'open-file-menu-with-tab' }

  | { type: 'history-up' }
  | { type: 'history-down' }

  | { type: 'toggle-agent-mode' }
  | { type: 'toggle-auto-accept-edits' }
  | { type: 'unfocus-agent' }

  | { type: 'toggle-all' }

  | { type: 'clear-queue' }
  | { type: 'open-queue-panel' }

  | { type: 'exit-app-warning' }
  | { type: 'exit-app' }

  | { type: 'bash-history-up' }
  | { type: 'bash-history-down' }

  | { type: 'scroll-up' }
  | { type: 'scroll-down' }

  | { type: 'paste' }

  | { type: 'open-buy-credits' }

  | { type: 'none' }

const hasModifier = (key: KeyEvent) =>
  Boolean(key.ctrl || key.meta || key.option)

export function resolveChatKeyboardAction(
  key: KeyEvent,
  state: ChatKeyboardState,
): ChatKeyboardAction {
  const isEscape = key.name === 'escape'
  const isCtrlC = key.ctrl && key.name === 'c'
  const isCtrlV = key.ctrl && key.name === 'v'
  const isBackspace = key.name === 'backspace'
  const isUp = key.name === 'up' && !hasModifier(key)
  const isDown = key.name === 'down' && !hasModifier(key)
  const isTab = key.name === 'tab' && !hasModifier(key)
  const isShiftTab =
    key.name === 'tab' && key.shift && !key.ctrl && !key.meta && !key.option
  const isEnter = isPlainEnterKey(key)
  const isPageUp = key.name === 'pageup' && !hasModifier(key)
  const isPageDown = key.name === 'pagedown' && !hasModifier(key)

  if (state.inputMode === 'outOfCredits') {
    if (isEnter) {
      return { type: 'open-buy-credits' }
    }
    if (isEscape || isCtrlC) {
      return { type: 'exit-input-mode' }
    }
    return { type: 'none' }
  }

  if (state.feedbackMode) {
    if (isEscape) {
      return { type: 'exit-feedback-mode' }
    }
    if (isCtrlC) {
      return state.inputValue.length === 0
        ? { type: 'exit-feedback-mode' }
        : { type: 'clear-feedback-input' }
    }
    if (isCtrlV) {
      return { type: 'paste' }
    }
    return { type: 'none' }
  }

  const modeConfig = getInputModeConfig(state.inputMode)
  if (isEscape && state.inputMode !== 'default' && !modeConfig.blockKeyboardExit) {
    return { type: 'exit-input-mode' }
  }

  if (key.ctrl && key.name === 'q' && !key.meta && !key.option) {
    return state.queuedCount > 0
      ? { type: 'open-queue-panel' }
      : { type: 'none' }
  }

  if (isCtrlC && state.inputValue.trim().length > 0) {
    return { type: 'clear-input' }
  }

  if (
    (isEscape || isCtrlC) &&
    (state.isStreaming || state.isWaitingForResponse)
  ) {
    return { type: 'interrupt-stream' }
  }

  if (
    isBackspace &&
    state.cursorPosition === 0 &&
    state.inputMode !== 'default' &&
    !modeConfig.blockKeyboardExit &&
    state.inputValue.length === 0
  ) {
    return { type: 'backspace-exit-mode' }
  }

  if (
    state.slashMenuActive &&
    state.slashMatchesLength > 0 &&
    !state.disableSlashSuggestions
  ) {
    if (isDown && !state.historyNavDownEnabled) {
      return state.slashSelectedIndex < state.slashMatchesLength - 1
        ? { type: 'slash-menu-down' }
        : { type: 'none' }
    }
    if (isUp && !state.historyNavUpEnabled) {
      return state.slashSelectedIndex > 0
        ? { type: 'slash-menu-up' }
        : { type: 'none' }
    }
    if (isTab || isShiftTab) {
      return { type: 'slash-menu-complete' }
    }
    if (isEnter) {
      return { type: 'slash-menu-select' }
    }
  }

  if (state.mentionMenuActive && state.totalMentionMatches > 0) {
    if (isDown && !state.historyNavDownEnabled) {
      return state.agentSelectedIndex < state.totalMentionMatches - 1
        ? { type: 'mention-menu-down' }
        : { type: 'none' }
    }
    if (isUp && !state.historyNavUpEnabled) {
      return state.agentSelectedIndex > 0
        ? { type: 'mention-menu-up' }
        : { type: 'none' }
    }
    if (isShiftTab) {
      return { type: 'mention-menu-shift-tab' }
    }
    if (isTab) {
      if (state.totalMentionMatches > 1) {
        return { type: 'mention-menu-tab' }
      }
      return { type: 'mention-menu-complete' }
    }
    if (isEnter) {
      return { type: 'mention-menu-select' }
    }
  }

  if (
    isTab &&
    !key.shift &&
    !state.mentionMenuActive &&
    !state.slashMenuActive &&
    !state.disableSlashSuggestions
  ) {
    return { type: 'open-file-menu-with-tab' }
  }

  if (isCtrlC && state.queuePaused && state.queuedCount > 0) {
    return { type: 'clear-queue' }
  }

  if (state.inputMode === 'bash') {
    if (isUp && state.historyNavUpEnabled) {
      return { type: 'bash-history-up' }
    }
    if (isDown && state.historyNavDownEnabled) {
      return { type: 'bash-history-down' }
    }
  }

  if (isUp && state.historyNavUpEnabled) {
    return { type: 'history-up' }
  }
  if (isDown && state.historyNavDownEnabled) {
    return { type: 'history-down' }
  }

  const isCtrlT = key.ctrl && key.name === 't' && !key.meta && !key.option

  if (isCtrlT) {
    return { type: 'toggle-all' }
  }

  if (
    isShiftTab &&
    !state.slashMenuActive &&
    !state.mentionMenuActive
  ) {
    return { type: 'toggle-auto-accept-edits' }
  }

  if (
    isTab &&
    !state.slashMenuActive &&
    !state.mentionMenuActive
  ) {
    return { type: 'toggle-agent-mode' }
  }

  if (isEscape && state.focusedAgentId !== null) {
    return { type: 'unfocus-agent' }
  }

  if (isPageUp) {
    return { type: 'scroll-up' }
  }
  if (isPageDown) {
    return { type: 'scroll-down' }
  }

  if (isCtrlV) {
    return { type: 'paste' }
  }

  if (isCtrlC) {
    if (state.nextCtrlCWillExit) {
      return { type: 'exit-app' }
    }
    return { type: 'exit-app-warning' }
  }

  return { type: 'none' }
}

export function createDefaultChatKeyboardState(): ChatKeyboardState {
  return {
    inputMode: 'default',
    inputValue: '',
    cursorPosition: 0,
    isStreaming: false,
    isWaitingForResponse: false,
    feedbackMode: false,
    focusedAgentId: null,
    slashMenuActive: false,
    mentionMenuActive: false,
    slashSelectedIndex: 0,
    agentSelectedIndex: 0,
    slashMatchesLength: 0,
    totalMentionMatches: 0,
    disableSlashSuggestions: false,
    queuePaused: false,
    queuedCount: 0,
    historyNavUpEnabled: false,
    historyNavDownEnabled: false,
    nextCtrlCWillExit: false,
  }
}
