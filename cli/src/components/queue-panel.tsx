import { pluralize } from '@codebuff/common/util/string'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from './button'
import { ClickableTitleBox } from './clickable-title-box'
import { MultilineInput } from './multiline-input'
import { useTheme } from '../hooks/use-theme'
import { truncateToSingleLinePreview } from '../utils/agent-display'
import { clamp } from '../utils/math'
import { resolveQueuePanelAction } from '../utils/queue-panel-actions'
import { createPasteHandler } from '../utils/strings'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { QueuedMessage } from '../hooks/use-message-queue'
import type { KeyEvent, MouseEvent } from '@opentui/core'

interface QueuePanelProps {
  queuedMessages: QueuedMessage[]
  onEdit: (id: string, content: string) => boolean
  onDelete: (id: string) => boolean
  onMove: (id: string, toIndex: number) => boolean
  onClose: () => void
  width: number
  maxVisibleRows?: number
}

const DEFAULT_MAX_VISIBLE_ROWS = 8
const TOO_LATE = 'That message already started running.'

function windowStart(
  selectedIndex: number,
  total: number,
  visible: number,
): number {
  if (total <= visible) return 0
  return clamp(selectedIndex - Math.floor(visible / 2), 0, total - visible)
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queuedMessages,
  onEdit,
  onDelete,
  onMove,
  onClose,
  width,
  maxVisibleRows = DEFAULT_MAX_VISIBLE_ROWS,
}) => {
  const theme = useTheme()

  const [selectedId, setSelectedId] = useState<string | null>(
    queuedMessages[0]?.id ?? null,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ text: '', cursorPosition: 0 })
  const [notice, setNotice] = useState<string | null>(null)

  const beginEdit = useCallback((message: QueuedMessage) => {
    setSelectedId(message.id)
    setEditingId(message.id)
    setDraft({
      text: message.content,
      cursorPosition: message.content.length,
    })
  }, [])

  const selectedIndex = Math.max(
    0,
    queuedMessages.findIndex((message) => message.id === selectedId),
  )
  const selected = queuedMessages[selectedIndex]

  useEffect(() => {
    if (queuedMessages.length === 0) onClose()
  }, [queuedMessages.length, onClose])

  const editingExists = queuedMessages.some(
    (message) => message.id === editingId,
  )
  useEffect(() => {
    if (editingId && !editingExists) {
      setEditingId(null)
      setNotice(`${TOO_LATE} Your edit was not applied.`)
    }
  }, [editingId, editingExists])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    const next = draft.text.trim()
    setEditingId(null)

    const keepsAttachments = queuedMessages.some(
      (message) => message.id === editingId && message.attachments.length > 0,
    )
    const applied =
      next || keepsAttachments ? onEdit(editingId, next) : onDelete(editingId)
    if (!applied) setNotice(TOO_LATE)
  }, [editingId, draft.text, queuedMessages, onEdit, onDelete])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      const action = resolveQueuePanelAction(key, {
        editing: editingId !== null,
      })
      if (action.type === 'none') return
      setNotice(null)

      switch (action.type) {
        case 'cancel-edit':
          setEditingId(null)
          return
        case 'close':
          onClose()
          return
        case 'select': {
          const to = clamp(
            selectedIndex + action.delta,
            0,
            queuedMessages.length - 1,
          )
          setSelectedId(queuedMessages[to]?.id ?? null)
          return
        }
        case 'move':
          if (selected) onMove(selected.id, selectedIndex + action.delta)
          return
        case 'move-to-top':
          if (selected) onMove(selected.id, 0)
          return
        case 'edit':
          if (selected) beginEdit(selected)
          return
        case 'delete': {
          if (!selected) return
          const successor =
            queuedMessages[selectedIndex + 1] ??
            queuedMessages[selectedIndex - 1]
          if (onDelete(selected.id)) setSelectedId(successor?.id ?? null)
          else setNotice(TOO_LATE)
          return
        }
      }
    },
    [
      editingId,
      beginEdit,
      onClose,
      onDelete,
      onMove,
      queuedMessages,
      selected,
      selectedIndex,
    ],
  )

  useKeyboard(handleKey)

  const pasteIntoDraft = useMemo(
    () =>
      createPasteHandler({
        text: draft.text,
        cursorPosition: draft.cursorPosition,
        onChange: (value) =>
          setDraft({
            text: value.text,
            cursorPosition: value.cursorPosition,
          }),
      }),
    [draft.text, draft.cursorPosition],
  )

  const numberWidth = String(queuedMessages.length).length
  const promptWidth = Math.max(10, width - 8 - numberWidth)
  const position = (index: number) =>
    `${String(index + 1).padStart(numberWidth)}.`

  const editing = editingId !== null
  const start = windowStart(
    selectedIndex,
    queuedMessages.length,
    maxVisibleRows,
  )
  const visible = queuedMessages.slice(start, start + maxVisibleRows)
  const hiddenBelow = queuedMessages.length - (start + visible.length)

  return (
    <ClickableTitleBox
      title={` ▾ Queue — ${pluralize(queuedMessages.length, 'message')} `}
      titleAlignment="center"
      onTitleClick={editing ? undefined : onClose}
      style={{
        width: '100%',
        borderStyle: 'single',
        borderColor: theme.border,
        customBorderChars: BORDER_CHARS,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'column',
      }}
    >
      {editing ? (
        <>
          <text style={{ fg: theme.info }}>
            {`❯ ${position(selectedIndex)} editing`}
          </text>
          <MultilineInput
            value={draft.text}
            cursorPosition={draft.cursorPosition}
            onChange={(value) =>
              setDraft({
                text: value.text,
                cursorPosition: value.cursorPosition,
              })
            }
            onSubmit={commitEdit}
            onPaste={pasteIntoDraft}
            focused
            maxHeight={5}
          />
        </>
      ) : (
        <>
          {start > 0 && (
            <text style={{ fg: theme.muted }}>{`  ↑ ${start} more`}</text>
          )}

          {visible.map((message, offset) => {
            const index = start + offset
            const isSelected = index === selectedIndex
            const attachments = message.attachments.length
            const suffix = attachments > 0 ? ` 📎${attachments}` : ''
            const body =
              truncateToSingleLinePreview(
                message.content,
                promptWidth - suffix.length,
              ) ?? ''

            return (
              <Button
                key={message.id}
                onClick={(event) => {
                  if ((event as MouseEvent | undefined)?.button === 0) {
                    beginEdit(message)
                  }
                }}
                onMouseOver={() => setSelectedId(message.id)}
                style={{
                  width: '100%',
                  height: 1,
                  backgroundColor: isSelected ? theme.surface : undefined,
                }}
              >
                <text
                  style={{
                    fg: isSelected ? theme.info : theme.foreground,
                    wrapMode: 'none',
                  }}
                >
                  {isSelected ? '❯ ' : '  '}
                  {position(index)} {body}
                  {suffix}
                </text>
              </Button>
            )
          })}

          {hiddenBelow > 0 && (
            <text style={{ fg: theme.muted }}>{`  ↓ ${hiddenBelow} more`}</text>
          )}
        </>
      )}

      {notice && <text style={{ fg: theme.warning }}>{notice}</text>}

      <text style={{ fg: theme.muted }}>
        {editing
          ? 'Enter save · Esc cancel · emptying it deletes'
          : 'click a row to edit · ⇧↑↓ reorder · d delete · esc close'}
      </text>
    </ClickableTitleBox>
  )
}
