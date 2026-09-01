import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'
import type { TerminalSession } from '../types/store'

interface TerminalLogScreenProps {
  onBack: () => void
}

export const TerminalLogScreen: React.FC<TerminalLogScreenProps> = ({ onBack }) => {
  const theme = useTheme()
  const { terminalWidth, terminalHeight } = useTerminalDimensions()
  const sessions = useChatStore((state) => state.terminalSessions)
  const activeSessionId = useChatStore((state) => state.activeTerminalSessionId)
  const setActiveSessionId = useChatStore((state) => state.setActiveTerminalSessionId)
  const killSession = useChatStore((state) => state.killTerminalSession)
  const clearSessions = useChatStore((state) => state.clearTerminalSessions)

  const currentSession = useMemo(() => {
    return sessions.find((s: TerminalSession) => s.status === 'running') || sessions[0] || null
  }, [sessions])

  const [scrollOffset, setScrollOffset] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)

  const logs = currentSession ? currentSession.logs : ['No active or recent terminal sessions found.']
  const visibleLogLines = Math.max(8, terminalHeight - 12)

  const maxScroll = Math.max(0, logs.length - visibleLogLines)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(maxScroll)
    }
  }, [logs.length, maxScroll, autoScroll])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (key.name === 'escape' || (key.name === 'q' && !key.ctrl && !key.meta)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          onBack()
          return
        }

        if (key.name === 'up' || (key.ctrl && key.name === 'k')) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setAutoScroll(false)
          setScrollOffset((prev) => Math.max(0, prev - 1))
          return
        }

        if (key.name === 'down' || (key.ctrl && key.name === 'j')) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setScrollOffset((prev) => {
            const next = Math.min(maxScroll, prev + 1)
            if (next >= maxScroll) setAutoScroll(true)
            return next
          })
          return
        }

        if (key.name === 'pageup') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setAutoScroll(false)
          setScrollOffset((prev) => Math.max(0, prev - visibleLogLines))
          return
        }

        if (key.name === 'pagedown') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setScrollOffset((prev) => {
            const next = Math.min(maxScroll, prev + visibleLogLines)
            if (next >= maxScroll) setAutoScroll(true)
            return next
          })
          return
        }

        if (key.name === 'home') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setAutoScroll(false)
          setScrollOffset(0)
          return
        }

        if (key.name === 'end') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setAutoScroll(true)
          setScrollOffset(maxScroll)
          return
        }

        if ((key.ctrl && key.name === 'c') || key.name === 'k') {
          if (currentSession && currentSession.status === 'running') {
            if ('preventDefault' in key && typeof key.preventDefault === 'function') {
              key.preventDefault()
            }
            killSession(currentSession.id)
          }
          return
        }

        if (key.name === 'c' && !key.ctrl && !key.meta) {
          clearSessions()
          return
        }
      },
      [clearSessions, currentSession, killSession, maxScroll, onBack, visibleLogLines],
    ),
  )

  const displayedLogs = useMemo(() => {
    return logs.slice(scrollOffset, scrollOffset + visibleLogLines)
  }, [logs, scrollOffset, visibleLogLines])

  const elapsedSeconds = currentSession
    ? Math.round(((currentSession.endedAt || Date.now()) - currentSession.startedAt) / 1000)
    : 0

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        width: '100%',
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 0,
      }}
    >
      {/* Header: just LIVE / COMPLETED badge + return instruction */}
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
        <text style={{ wrapMode: 'none' }}>
          {currentSession?.status === 'running' ? (
            <span fg="#4ade80" attributes={TextAttributes.BOLD}>
              ● LIVE
            </span>
          ) : currentSession?.status === 'completed' ? (
            <span fg="#38bdf8" attributes={TextAttributes.BOLD}>
              ✓ COMPLETED
            </span>
          ) : (
            <span fg="#f87171" attributes={TextAttributes.BOLD}>
              ✕ FAILED
            </span>
          )}
        </text>

        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>
            {'Press Esc to return'}
          </span>
        </text>
      </box>

      {/* Terminal Output Log Window */}
      <box
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          borderStyle: 'single',
          borderColor: currentSession?.status === 'running' ? '#38bdf8' : theme.border,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          {displayedLogs.map((line: string, idx: number) => {
            const lineNum = scrollOffset + idx + 1
            const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')
            const isSuccess = line.toLowerCase().includes('success') || line.toLowerCase().includes('ready')
            const isPrompt = line.startsWith('$ ')
            const isInfo = line.startsWith('[') && line.endsWith(']')

            let lineFg = '#cbd5e1'
            if (isPrompt) lineFg = '#facc15'
            else if (isError) lineFg = '#f87171'
            else if (isSuccess) lineFg = '#4ade80'
            else if (isInfo) lineFg = '#38bdf8'

            return (
              <React.Fragment key={`log-${lineNum}-${idx}`}>
                <span fg="#64748b">
                  {String(lineNum).padStart(4, ' ')} │{' '}
                </span>
                <span fg={lineFg}>
                  {line || ' '}
                </span>
                {'\n'}
              </React.Fragment>
            )
          })}
        </text>
      </box>

      {/* Footer Navigation Bar */}
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1, marginBottom: 0 }}>
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            esc / q
          </span>
          <span fg={theme.muted}> return to chat · </span>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            ↑/↓
          </span>
          <span fg={theme.muted}> scroll · </span>
          {currentSession?.status === 'running' && (
            <>
              <span fg="#f87171" attributes={TextAttributes.BOLD}>
                ctrl+c / k
              </span>
              <span fg={theme.muted}> kill process · </span>
            </>
          )}
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            c
          </span>
          <span fg={theme.muted}> clear logs</span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>
            {`Lines ${scrollOffset + 1}-${Math.min(logs.length, scrollOffset + visibleLogLines)} of ${logs.length}`}
          </span>
        </text>
      </box>
    </box>
  )
}
