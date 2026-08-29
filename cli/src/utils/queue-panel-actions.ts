import { isPlainEnterKey } from './terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'

export type QueuePanelAction =
  | { type: 'close' }
  | { type: 'cancel-edit' }
  | { type: 'select'; delta: number }
  | { type: 'move'; delta: number }
  | { type: 'move-to-top' }
  | { type: 'edit' }
  | { type: 'delete' }
  | { type: 'none' }

export type QueuePanelKeyboardState = {
  editing: boolean
}

export function resolveQueuePanelAction(
  key: KeyEvent,
  state: QueuePanelKeyboardState,
): QueuePanelAction {
  const isEscape = key.name === 'escape'
  const isCtrlC = key.ctrl && key.name === 'c'

  if (state.editing) {
    if (isEscape || isCtrlC) return { type: 'cancel-edit' }
    return { type: 'none' }
  }

  if (isEscape || isCtrlC || key.name === 'q') return { type: 'close' }

  const reorder = key.shift || key.ctrl
  if ((key.name === 'up' && reorder) || key.sequence === 'K') {
    return { type: 'move', delta: -1 }
  }
  if ((key.name === 'down' && reorder) || key.sequence === 'J') {
    return { type: 'move', delta: 1 }
  }

  if (key.name === 'up' || key.name === 'k') return { type: 'select', delta: -1 }
  if (key.name === 'down' || key.name === 'j') return { type: 'select', delta: 1 }

  if (key.name === 't') return { type: 'move-to-top' }

  if (key.name === 'e' || isPlainEnterKey(key)) return { type: 'edit' }

  if (
    key.name === 'd' ||
    key.name === 'delete' ||
    (key.name === 'backspace' && !key.ctrl && !key.meta && !key.option)
  ) {
    return { type: 'delete' }
  }

  return { type: 'none' }
}
