import { useKeyboard } from '@opentui/react'
import React, { useCallback, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
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
  const { contentMaxWidth } = useTerminalDimensions()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
  })

  const options = [
    {
      title: 'Trust & Launch RivoCode',
      desc: 'Grant file read, write, and command execution in this workspace',
      action: onTrust,
    },
    {
      title: 'Cancel and Exit',
      desc: 'Close the CLI session safely',
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
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ flexDirection: 'column', gap: 1 }}>
        <box style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 1 }}>
          <box style={{ flexShrink: 0 }}>
            {logoComponent}
          </box>
          <box style={{ flexDirection: 'column', gap: 0 }}>
            <text style={{ wrapMode: 'none' }}>
              <b>
                <span fg={theme.primary}>RivoCode</span>
                <span fg={theme.foreground}> · Workspace Security</span>
              </b>
            </text>
            <text style={{ wrapMode: 'none', fg: theme.muted }}>
              <span>Created by Sanket Padhyal</span>
            </text>
          </box>
        </box>

        <box
          style={{
            flexDirection: 'column',
            borderStyle: 'single',
            borderColor: theme.border,
            padding: 1,
            gap: 1,
            maxWidth: 68,
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            <text style={{ wrapMode: 'none', fg: theme.secondary }}>
              <span>Target Directory:</span>
            </text>
            <text style={{ wrapMode: 'none' }}>
              <b>
                <span fg={theme.primary}>{workspacePath}</span>
              </b>
            </text>
          </box>

          <box style={{ flexDirection: 'column', gap: 1, marginTop: 1 }}>
            {options.map((opt, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <box
                  key={idx}
                  style={{
                    flexDirection: 'column',
                    paddingLeft: 1,
                    borderStyle: isSelected ? 'single' : 'none',
                    borderColor: theme.primary,
                    backgroundColor: isSelected ? theme.background : undefined,
                  }}
                >
                  <text style={{ wrapMode: 'none' }}>
                    <span fg={isSelected ? theme.primary : theme.muted}>
                      {isSelected ? '● ' : '○ '}
                    </span>
                    <b>
                      <span fg={isSelected ? theme.primary : theme.foreground}>
                        {opt.title}
                      </span>
                    </b>
                  </text>
                  <text style={{ wrapMode: 'none', fg: theme.muted, paddingLeft: 2 }}>
                    <span>{opt.desc}</span>
                  </text>
                </box>
              )
            })}
          </box>

          <box style={{ marginTop: 1, paddingTop: 1, borderTop: true, borderColor: theme.border }}>
            <text style={{ wrapMode: 'none', fg: theme.muted }}>
              <span>[↑/↓] Select option  ·  [Enter] Confirm</span>
            </text>
          </box>
        </box>
      </box>

      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          width: '100%',
        }}
      >
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>No model selected</span>
        </text>
      </box>
    </box>
  )
}
