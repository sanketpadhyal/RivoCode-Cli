import { TextAttributes, type KeyEvent } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useMemo, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { ProjectContextData } from './project-context'

interface ContinueWorkScreenProps {
  context: ProjectContextData
  onContinue: () => void
  onStartFresh: () => void
}

export const ContinueWorkScreen = ({
  context,
  onContinue,
  onStartFresh,
}: ContinueWorkScreenProps) => {
  const theme = useTheme()
  const { contentMaxWidth, terminalHeight } = useTerminalDimensions()
  const isCompact = terminalHeight < 24
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
  })

  const lastModelName = context.lastModel || 'gemini-3.6-flash'

  const options = useMemo(
    () => [
      {
        title: 'Resume Previous Session',
        badge: 'Recommended',
        desc: `Continue with saved chat history and model (${lastModelName})`,
        action: onContinue,
      },
      {
        title: 'Start Fresh Session',
        desc: 'Start clean in this folder with a new model and fresh context',
        action: onStartFresh,
      },
    ],
    [lastModelName, onContinue, onStartFresh],
  )

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (key.ctrl && key.name === 'c') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          void exitCliCleanly()
          return
        }

        if (key.name === 'up' || key.name === 'k') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) => (prev === 0 ? options.length - 1 : prev - 1))
          return
        }

        if (key.name === 'down' || key.name === 'j' || key.name === 'tab') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) => (prev === options.length - 1 ? 0 : prev + 1))
          return
        }

        if (key.name === '1') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          options[0].action()
          return
        }

        if (key.name === '2') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          options[1].action()
          return
        }

        if (isPlainEnterKey(key)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          options[selectedIndex].action()
        }
      },
      [options, selectedIndex],
    ),
  )

  const formatLastActive = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Recently'
    }
  }

  return (
    <box
      style={{
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexGrow: 1,
        width: '100%',
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ flexDirection: 'column' }}>
        {/* Logo (hidden if short terminal) */}
        {!isCompact && (
          <box style={{ marginBottom: 1 }}>
            {logoComponent}
          </box>
        )}

        {/* Title Header */}
        <text style={{ wrapMode: 'none', marginBottom: 1 }}>
          <span fg="#ffb703" attributes={TextAttributes.BOLD}>
            RivoCode
          </span>
          <span fg={theme.muted}> · Saved Workspace Found</span>
          {'\n'}
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            Previous workspace state was detected in this folder.
          </span>
          {'\n'}
          <span fg={theme.secondary}>
            How would you like to proceed?
          </span>
        </text>

        {/* Workspace Summary Box */}
        <box
          style={{
            borderStyle: 'single',
            borderColor: theme.surface,
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 0,
            paddingBottom: 0,
            flexDirection: 'column',
            marginBottom: 1,
            width: '100%',
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.muted}>Project : </span>
            <span fg="#55ff55" attributes={TextAttributes.BOLD}>
              {context.workName}
            </span>
            {'\n'}
            <span fg={theme.muted}>Path    : </span>
            <span fg={theme.secondary}>
              {context.projectPath}
            </span>
            {'\n'}
            <span fg={theme.muted}>Active  : </span>
            <span fg={theme.foreground}>
              {formatLastActive(context.lastActive)}
            </span>
            <span fg={theme.muted}> · Sessions: </span>
            <span fg={theme.foreground}>
              {context.sessionCount}
            </span>
            <span fg={theme.muted}> · Last Model: </span>
            <span fg="#38bdf8" attributes={TextAttributes.BOLD}>
              {lastModelName}
            </span>
          </text>
        </box>

        {/* Options List */}
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          {options.map((opt, idx) => {
            const isSelected = idx === selectedIndex

            return (
              <box
                key={opt.title}
                style={{
                  flexDirection: 'column',
                  marginBottom: 1,
                }}
              >
                <text style={{ wrapMode: 'none' }}>
                  <span
                    fg={isSelected ? '#55ff55' : theme.muted}
                    attributes={TextAttributes.BOLD}
                  >
                    {isSelected ? '▶ ' : '  '}
                    {idx + 1}. {opt.title}
                  </span>
                  {opt.badge && (
                    <span fg="#ffb703" attributes={TextAttributes.BOLD}>
                      {' '}[{opt.badge}]
                    </span>
                  )}
                  {'\n'}
                  <span fg={isSelected ? theme.foreground : theme.muted}>
                    {'     '}{opt.desc}
                  </span>
                </text>
              </box>
            )
          })}
        </box>
      </box>

      {/* Footer Navigation Bar */}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: 1,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>Press </span>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            1
          </span>
          <span fg={theme.muted}> or </span>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            2
          </span>
          <span fg={theme.muted}> / </span>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            ↑/↓
          </span>
          <span fg={theme.muted}> Navigate · </span>
          <span fg="#55ff55" attributes={TextAttributes.BOLD}>
            Enter
          </span>
          <span fg={theme.muted}> Confirm · </span>
          <span fg={theme.secondary}>
            Ctrl+C
          </span>
          <span fg={theme.muted}> Exit</span>
        </text>

        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>Model: </span>
          <span fg="#38bdf8">{lastModelName}</span>
        </text>
      </box>
    </box>
  )
}
