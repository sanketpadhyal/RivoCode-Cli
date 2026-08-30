import { execSync } from 'child_process'
import { TextAttributes, type KeyEvent } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useEffect, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'
import {
  resolveModelRoute,
  saveStoredApiKey,
  testApiKeyConnection,
  resolveApiKey,
} from '../utils/real-ai-service'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function readSystemClipboard(): string {
  try {
    if (process.platform === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf-8' }).trim()
    } else if (process.platform === 'win32') {
      return execSync('powershell.exe -NoProfile -Command Get-Clipboard', {
        encoding: 'utf-8',
      }).trim()
    } else {
      try {
        return execSync('wl-paste', { encoding: 'utf-8' }).trim()
      } catch {
        return execSync('xclip -selection clipboard -o', { encoding: 'utf-8' }).trim()
      }
    }
  } catch {
    return ''
  }
}

interface ApiKeySetupScreenProps {
  modelName: string
  onComplete: () => void
  onBack: () => void
}

export const ApiKeySetupScreen = ({
  modelName,
  onComplete,
  onBack,
}: ApiKeySetupScreenProps) => {
  const theme = useTheme()
  const { contentMaxWidth, terminalHeight } = useTerminalDimensions()
  const isCompact = terminalHeight < 24

  const route = resolveModelRoute(modelName)
  const existingKey = resolveApiKey(route.provider) || ''

  const [inputKey, setInputKey] = useState(existingKey)
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [spinnerIndex, setSpinnerIndex] = useState(0)

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
  })

  // Spinner animation for testing state
  useEffect(() => {
    if (status !== 'testing') return
    const timer = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [status])

  const handlePasteClipboard = useCallback(() => {
    const clipboardText = readSystemClipboard()
    if (clipboardText) {
      setInputKey(clipboardText)
      setStatus('idle')
      setStatusMessage('Pasted from clipboard!')
    } else {
      setStatus('error')
      setStatusMessage('Clipboard is empty or could not be read.')
    }
  }, [])

  const handleVerifyKey = useCallback(async (keyToTest: string) => {
    const trimmed = keyToTest.trim()
    if (!trimmed) {
      setStatus('error')
      setStatusMessage('Please enter or paste your API key first.')
      return
    }

    setStatus('testing')
    setStatusMessage('Sending demo test ping to verify connection...')

    const result = await testApiKeyConnection(route.provider, trimmed)

    if (result.success) {
      setStatus('success')
      setStatusMessage(
        `API Connected successfully! (Model replied: "${result.message || 'Connected'}")`,
      )

      // Save key in env and local storage
      if (route.provider === 'groq') {
        process.env.GROQ_API_KEY = trimmed
      } else if (route.provider === 'gemini') {
        process.env.GEMINI_API_KEY = trimmed
      } else {
        process.env.OPENROUTER_API_KEY = trimmed
      }
      saveStoredApiKey(route.provider, trimmed)

      setTimeout(() => {
        onComplete()
      }, 1200)
    } else {
      setStatus('error')
      setStatusMessage(result.error || 'Failed to verify API key. Please check the key.')
    }
  }, [route.provider, onComplete])

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

        if (status === 'testing') {
          return // Disable input while testing
        }

        // Paste shortcut: Ctrl+V or Cmd+V or Ctrl+P
        if (((key.ctrl || key.meta) && (key.name === 'v' || key.name === 'p')) || key.name === 'tab') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          handlePasteClipboard()
          return
        }

        if (key.name === 'escape' || (key.ctrl && key.name === 'b')) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          onBack()
          return
        }

        if (isPlainEnterKey(key)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          void handleVerifyKey(inputKey)
          return
        }

        if (key.name === 'backspace') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setInputKey((prev) => prev.slice(0, -1))
          if (status === 'error') setStatus('idle')
          return
        }

        // Quick 'p' paste if input is empty
        if ((key.name === 'p' || key.name === 'P') && !inputKey) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          handlePasteClipboard()
          return
        }

        // Regular character typing
        const char = key.char || (key.name && key.name.length === 1 ? key.name : '')
        if (char && !key.ctrl && !key.meta) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setInputKey((prev) => prev + char)
          if (status === 'error') setStatus('idle')
        }
      },
      [status, inputKey, handleVerifyKey, handlePasteClipboard, onBack],
    ),
  )

  const maskApiKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '•'.repeat(key.length)
    return key.slice(0, 4) + '•'.repeat(Math.max(4, key.length - 8)) + key.slice(-4)
  }

  return (
    <box
      style={{
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexGrow: 1,
        width: '100%',
        paddingLeft: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ flexDirection: 'column' }}>
        {!isCompact && (
          <box style={{ flexDirection: 'column', marginBottom: 1 }}>
            {logoComponent}
          </box>
        )}

        <text style={{ wrapMode: 'none' }}>
          <span fg="#ffb703" attributes={TextAttributes.BOLD}>
            RivoCode · API Key Setup
          </span>
          {'\n'}
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            Configure {route.displayName}
          </span>
          {'\n\n'}
          <span fg={theme.secondary}>
            Get a free API key from:
          </span>
          {' '}
          <span fg="#38bdf8" attributes={TextAttributes.UNDERLINE}>
            {route.apiKeyUrl}
          </span>
          {'\n\n'}
          <span fg={theme.foreground}>Enter or paste your API key below:</span>
          {'\n'}
        </text>

        {/* Input Box */}
        <box
          style={{
            flexDirection: 'column',
            marginTop: 1,
            marginBottom: 1,
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: theme.surface,
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg="#55ff55" attributes={TextAttributes.BOLD}>&gt; </span>
            {inputKey ? (
              <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
                {maskApiKey(inputKey)}
              </span>
            ) : (
              <span fg={theme.muted}>[Paste clipboard with Tab / Cmd+V / Ctrl+V / p]</span>
            )}
            <span fg="#55ff55" attributes={TextAttributes.BOLD}> █</span>
          </text>
        </box>

        {/* Paste helper button */}
        <box style={{ marginBottom: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg="#38bdf8" attributes={TextAttributes.BOLD}>
              [ 📋 Paste from Clipboard: Press Tab or Ctrl+V or p ]
            </span>
          </text>
        </box>

        {/* Status / Verification Feedback */}
        {status === 'testing' && (
          <text style={{ wrapMode: 'none' }}>
            <span fg="#ffb703">{SPINNER_FRAMES[spinnerIndex]} </span>
            <span fg={theme.foreground}>{statusMessage}</span>
          </text>
        )}

        {status === 'success' && (
          <text style={{ wrapMode: 'none' }}>
            <span fg="#55ff55" attributes={TextAttributes.BOLD}>✓ </span>
            <span fg="#55ff55">{statusMessage}</span>
          </text>
        )}

        {status === 'error' && (
          <text style={{ wrapMode: 'none' }}>
            <span fg="#ef4444" attributes={TextAttributes.BOLD}>✗ </span>
            <span fg="#ef4444">{statusMessage}</span>
          </text>
        )}

        <box style={{ marginTop: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.foreground}>enter</span>
            <span fg={theme.muted}> Verify &amp; Continue · </span>
            <span fg={theme.foreground}>tab</span>
            <span fg={theme.muted}> Paste · </span>
            <span fg={theme.foreground}>esc</span>
            <span fg={theme.muted}> Back</span>
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
          <span>{route.displayName}</span>
        </text>
      </box>
    </box>
  )
}
