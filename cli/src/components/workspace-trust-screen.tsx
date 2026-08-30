import { useKeyboard } from '@opentui/react'
import React, { useCallback, useState } from 'react'

import { useTheme } from '../hooks/use-theme'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'

interface WorkspaceTrustScreenProps {
  workspacePath: string
  onTrust: () => void
}

export const WorkspaceTrustScreen = ({
  workspacePath,
  onTrust,
}: WorkspaceTrustScreenProps) => {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const options = [
    { label: 'Yes, I trust this folder', action: onTrust },
    {
      label: 'No, exit',
      action: () => {
        void exitCliCleanly()
      },
    },
  ]

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

  return (
    <box
      style={{
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        width: '100%',
        paddingLeft: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ flexDirection: 'column', gap: 1 }}>
        <box style={{ flexDirection: 'column' }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg="#ffb703">
              <b>Accessing workspace:</b>
            </span>
          </text>
          <text style={{ wrapMode: 'none', fg: theme.foreground }}>
            <b>{workspacePath}</b>
          </text>
        </box>

        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <text style={{ wrapMode: 'none', fg: theme.foreground }}>
            <b>Do you trust the contents of this project?</b>
          </text>
          <text style={{ wrapMode: 'word' }}>
            <span fg="#55ff55">Rivo CLI</span>
            <span fg={theme.secondary}> requires permission to read, edit, and execute files here.</span>
          </text>
        </box>

        <box style={{ flexDirection: 'column', marginTop: 1, gap: 0 }}>
          {options.map((opt, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <text key={idx} style={{ wrapMode: 'none' }}>
                {isSelected ? (
                  <>
                    <span fg="#55ff55">&gt; </span>
                    <b>
                      <span fg="#55ff55">{opt.label}</span>
                    </b>
                  </>
                ) : (
                  <>
                    <span>  </span>
                    <span fg={theme.muted}>{opt.label}</span>
                  </>
                )}
              </text>
            )
          })}
        </box>

        <box style={{ marginTop: 1 }}>
          <text style={{ wrapMode: 'none', fg: theme.muted }}>
            <span>↑/↓ Navigate · </span>
            <span fg={theme.foreground}>enter</span>
            <span> Confirm</span>
          </text>
        </box>
      </box>

      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          width: '100%',
          paddingRight: 2,
        }}
      >
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>No model selected</span>
        </text>
      </box>
    </box>
  )
}
