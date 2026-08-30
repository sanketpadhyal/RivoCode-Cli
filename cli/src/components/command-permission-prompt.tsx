import { TextAttributes, type KeyEvent } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useState } from 'react'
import { useTheme } from '../hooks/use-theme'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

interface CommandPermissionPromptProps {
  question: string
  options: string[]
  modelName?: string
  agentMode?: string
  onSubmit: (answer: string) => void
  onCancel: () => void
}

export const CommandPermissionPrompt: React.FC<CommandPermissionPromptProps> = ({
  question,
  options,
  modelName = 'Gemini 3.6 Flash',
  agentMode = 'high',
  onSubmit,
  onCancel,
}) => {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const preventDefault = () => {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
        }

        if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
          preventDefault()
          onCancel()
          return
        }

        const num = parseInt(key.char || key.name || '', 10)
        if (!isNaN(num) && num >= 1 && num <= options.length) {
          preventDefault()
          onSubmit(options[num - 1])
          return
        }

        if (key.name === 'up' || (key.ctrl && key.name === 'k')) {
          preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
          return
        }

        if (key.name === 'down' || (key.ctrl && key.name === 'j')) {
          preventDefault()
          setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
          return
        }

        const isEnter =
          key.name === 'return' ||
          key.name === 'enter' ||
          key.name === 'linefeed' ||
          key.sequence === '\r' ||
          key.sequence === '\n' ||
          isPlainEnterKey(key)

        if (isEnter || key.name === 'space') {
          preventDefault()
          onSubmit(options[selectedIndex])
          return
        }
      },
      [options, selectedIndex, onSubmit, onCancel],
    ),
  )

  return (
    <box
      style={{
        flexDirection: 'column',
        width: '100%',
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        gap: 0,
      }}
    >
      <text style={{ wrapMode: 'none' }}>
        <span fg="#ffb703" attributes={TextAttributes.BOLD}>
          Command
        </span>
        {'\n\n'}
        <span fg={theme.foreground}>
          {question}
        </span>
        {'\n'}
      </text>

      {/* Options */}
      <box style={{ flexDirection: 'column', marginTop: 0, marginBottom: 1 }}>
        {options.map((opt, idx) => {
          const isSelected = selectedIndex === idx
          return (
            <text key={idx} style={{ wrapMode: 'none' }}>
              {isSelected ? (
                <>
                  <span fg="#38bdf8" attributes={TextAttributes.BOLD}>
                    {`> ${opt}`}
                  </span>
                </>
              ) : (
                <>
                  <span fg={theme.muted}>
                    {`  ${opt}`}
                  </span>
                </>
              )}
            </text>
          )
        })}
      </box>

      {/* Footer */}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          marginTop: 0,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>↑/↓ Navigate · </span>
          <span fg="#38bdf8">enter</span>
          <span fg={theme.muted}> Select · </span>
          <span fg="#ef4444">esc</span>
          <span fg={theme.muted}> to cancel</span>
        </text>
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>{`${modelName} · ${agentMode.toLowerCase()}`}</span>
        </text>
      </box>
    </box>
  )
}
