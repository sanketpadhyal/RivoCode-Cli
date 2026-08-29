import { useKeyboard, useRenderer } from '@opentui/react'
import React, { useCallback, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTheme } from '../hooks/use-theme'
import { DEFAULT_BYPASS_USER, saveUserCredentials, type User } from '../utils/auth'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'

interface LoginModalProps {
  onLoginSuccess: (user: User) => void
  hasInvalidCredentials?: boolean | null
}

export const LoginModal = ({
  onLoginSuccess,
}: LoginModalProps) => {
  const theme = useTheme()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const { component: logoComponent } = useLogo({
    availableWidth: 70,
    accentColor: theme.primary,
    blockColor: theme.foreground,
  })

  const handleSubmit = useCallback(
    (codeToTest: string) => {
      const trimmed = codeToTest.trim().toLowerCase()
      if (trimmed === 'sanket' || trimmed === '') {
        saveUserCredentials(DEFAULT_BYPASS_USER)
        onLoginSuccess(DEFAULT_BYPASS_USER)
      } else {
        setError('Invalid access code. Please type "sanket" and press Enter.')
      }
    },
    [onLoginSuccess],
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

        if (isPlainEnterKey(key)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          handleSubmit(passcode)
          return
        }

        if (key.name === 'backspace') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setPasscode((prev) => prev.slice(0, -1))
          setError(null)
          return
        }

        // Regular character typing
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setPasscode((prev) => prev + key.sequence)
          setError(null)
        }
      },
      [handleSubmit, passcode],
    ),
  )

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: 2,
        gap: 1,
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 1,
        }}
      >
        {logoComponent}
      </box>

      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          padding: 1,
          borderStyle: 'single',
          borderColor: theme.primary,
          width: 54,
          gap: 1,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <b>
            <span fg={theme.primary}>RivoCode Authentication</span>
          </b>
        </text>

        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.foreground}>Enter access code (</span>
          <span fg={theme.info}>sanket</span>
          <span fg={theme.foreground}>) to unlock:</span>
        </text>

        <box
          style={{
            flexDirection: 'row',
            width: 44,
            padding: 1,
            backgroundColor: theme.background,
            borderStyle: 'single',
            borderColor: error ? 'red' : theme.muted,
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.primary}>&gt; </span>
            <span fg={theme.foreground}>{passcode || ''}</span>
            <span fg={theme.primary}>_</span>
          </text>
        </box>

        {error ? (
          <text style={{ wrapMode: 'word' }}>
            <span fg="red">{error}</span>
          </text>
        ) : (
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.secondary}>Press Enter to submit</span>
          </text>
        )}

        <box
          style={{
            marginTop: 1,
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <box
            style={{
              paddingLeft: 2,
              paddingRight: 2,
              paddingTop: 0,
              paddingBottom: 0,
              backgroundColor: isHovered ? theme.primary : theme.muted,
            }}
            onMouseOver={() => setIsHovered(true)}
            onMouseOut={() => setIsHovered(false)}
            onClick={() => handleSubmit('sanket')}
          >
            <text style={{ wrapMode: 'none' }}>
              <span fg={isHovered ? theme.background : theme.foreground}>
                [ Unlock as Sanket Padhyal ]
              </span>
            </text>
          </box>
        </box>
      </box>
    </box>
  )
}
