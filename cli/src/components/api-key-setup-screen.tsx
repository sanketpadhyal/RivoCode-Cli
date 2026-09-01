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
  saveFallbackKeys,
  testApiKeyConnection,
  resolveApiKey,
} from '../utils/real-ai-service'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function readSystemClipboard(): string {
  try {
    if (process.platform === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf-8' }).trim()
    } else if (process.platform === 'win32') {
      return execSync('powershell.exe -NoProfile -Command Get-Clipboard', { encoding: 'utf-8' }).trim()
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

export const ApiKeySetupScreen = ({ modelName, onComplete, onBack }: ApiKeySetupScreenProps) => {
  const theme = useTheme()
  const { contentMaxWidth, terminalHeight } = useTerminalDimensions()
  const isCompact = terminalHeight < 24

  const route = resolveModelRoute(modelName)
  const existingKey = resolveApiKey(route.provider) || ''

  const [step, setStep] = useState<'primary' | 'fallbacks'>('primary')
  const [inputKey, setInputKey] = useState(existingKey)
  const [fallback1, setFallback1] = useState('')
  const [fallback2, setFallback2] = useState('')
  const [activeFallback, setActiveFallback] = useState<1 | 2>(1)
  const [primaryKey, setPrimaryKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [spinnerIndex, setSpinnerIndex] = useState(0)

  const { component: logoComponent } = useLogo({ availableWidth: contentMaxWidth })

  useEffect(() => {
    if (status !== 'testing') return
    const timer = setInterval(() => setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length), 80)
    return () => clearInterval(timer)
  }, [status])

  const handlePasteClipboard = useCallback(() => {
    const clipboardText = readSystemClipboard()
    if (clipboardText) {
      if (step === 'primary') {
        setInputKey(clipboardText)
      } else if (activeFallback === 1) {
        setFallback1(clipboardText)
      } else {
        setFallback2(clipboardText)
      }
      setStatus('idle')
      setStatusMessage('Pasted from clipboard!')
    } else {
      setStatus('error')
      setStatusMessage('Clipboard is empty or could not be read.')
    }
  }, [step, activeFallback])

  const handleVerifyPrimary = useCallback(async (keyToTest: string) => {
    const trimmed = keyToTest.trim()
    if (!trimmed) {
      setStatus('error')
      setStatusMessage('Please enter or paste your API key first.')
      return
    }
    setStatus('testing')
    setStatusMessage('Verifying primary key...')
    const result = await testApiKeyConnection(route.provider, trimmed)
    if (result.success) {
      setStatus('success')
      setStatusMessage(`Primary key verified! (${result.message || 'Connected'})`)
      if (route.provider === 'groq') process.env.GROQ_API_KEY = trimmed
      else if (route.provider === 'gemini') process.env.GEMINI_API_KEY = trimmed
      else process.env.OPENROUTER_API_KEY = trimmed
      saveStoredApiKey(route.provider, trimmed)
      setPrimaryKey(trimmed)
      setTimeout(() => {
        setStatus('idle')
        setStatusMessage('')
        setStep('fallbacks')
      }, 900)
    } else {
      setStatus('error')
      setStatusMessage(result.error || 'Failed to verify API key.')
    }
  }, [route.provider])

  const handleFinishFallbacks = useCallback(async () => {
    const toTest: Array<{ key: string; label: string }> = []
    if (fallback1.trim()) toTest.push({ key: fallback1.trim(), label: 'Fallback 1' })
    if (fallback2.trim()) toTest.push({ key: fallback2.trim(), label: 'Fallback 2' })

    if (toTest.length === 0) {
      saveFallbackKeys(route.provider, [])
      onComplete()
      return
    }

    setStatus('testing')
    const failedKeys: string[] = []
    const validFallbacks: string[] = []

    for (const { key, label } of toTest) {
      setStatusMessage(`Testing ${label}...`)
      const res = await testApiKeyConnection(route.provider, key)
      if (res.success) {
        validFallbacks.push(key)
      } else {
        failedKeys.push(label)
      }
    }

    if (failedKeys.length > 0) {
      setStatus('error')
      setStatusMessage(`${failedKeys.join(', ')} failed and was not saved.`)
      saveFallbackKeys(route.provider, validFallbacks)
      setTimeout(() => onComplete(), 1800)
    } else {
      setStatus('success')
      setStatusMessage(`All ${validFallbacks.length} fallback key(s) verified! Key rotation active.`)
      saveFallbackKeys(route.provider, validFallbacks)
      setTimeout(() => onComplete(), 1200)
    }
  }, [fallback1, fallback2, route.provider, onComplete])

  const maskApiKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '•'.repeat(Math.min(8, key.length))
    return key.slice(0, 4) + '••••••••' + key.slice(-4)
  }

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (key.ctrl && key.name === 'c') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          void exitCliCleanly()
          return
        }
        if (status === 'testing') return

        if (((key.ctrl || key.meta) && (key.name === 'v' || key.name === 'p')) || key.name === 'tab') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          handlePasteClipboard()
          return
        }

        if (key.name === 'escape') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          if (step === 'fallbacks') {
            setStep('primary')
            setStatus('idle')
            setStatusMessage('')
          } else {
            onBack()
          }
          return
        }

        if (isPlainEnterKey(key)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          if (step === 'primary') {
            void handleVerifyPrimary(inputKey)
          } else {
            if (activeFallback === 1 && fallback1.trim()) {
              setActiveFallback(2)
            } else {
              void handleFinishFallbacks()
            }
          }
          return
        }

        if (step === 'fallbacks' && key.name === 'down') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          setActiveFallback(2)
          return
        }

        if (step === 'fallbacks' && key.name === 'up') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          setActiveFallback(1)
          return
        }

        if (key.name === 'backspace') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          if (step === 'primary') setInputKey((prev) => prev.slice(0, -1))
          else if (activeFallback === 1) setFallback1((prev) => prev.slice(0, -1))
          else setFallback2((prev) => prev.slice(0, -1))
          if (status === 'error') setStatus('idle')
          return
        }

        if ((key.name === 'p' || key.name === 'P') && !inputKey && step === 'primary') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          handlePasteClipboard()
          return
        }

        const char = (key as any).char || key.sequence || (key.name && key.name.length === 1 ? key.name : '')
        if (char && !key.ctrl && !key.meta) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') key.preventDefault()
          if (step === 'primary') setInputKey((prev) => prev + char)
          else if (activeFallback === 1) setFallback1((prev) => prev + char)
          else setFallback2((prev) => prev + char)
          if (status === 'error') setStatus('idle')
        }
      },
      [step, status, inputKey, fallback1, fallback2, activeFallback, handleVerifyPrimary, handleFinishFallbacks, handlePasteClipboard, onBack],
    ),
  )

  if (step === 'fallbacks') {
    return (
      <box
        style={{
          borderStyle: 'single',
          borderColor: theme.border,
          paddingLeft: 2,
          paddingRight: 2,
          paddingTop: 1,
          paddingBottom: 1,
          flexDirection: 'column',
          width: '100%',
        }}
      >
        {/* Title Header */}
        <box style={{ flexDirection: 'column', marginBottom: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg="#38bdf8" attributes={TextAttributes.BOLD}>
              🔑 Optional Fallback Keys
            </span>
            <span fg={theme.muted}>
              {' · Auto-switches on rate limits'}
            </span>
          </text>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.muted}>
              Add backup API keys to ensure uninterrupted coding (press Enter to skip)
            </span>
          </text>
        </box>

        {/* Primary Key Status Row */}
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.surface,
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            marginBottom: 1,
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg="#4ade80" attributes={TextAttributes.BOLD}>
              ✓ Primary Key:{' '}
            </span>
            <span fg={theme.foreground}>
              {maskApiKey(primaryKey)}
            </span>
            <span fg="#4ade80"> (Active)</span>
          </text>
        </box>

        {/* Fallback Input Rows */}
        <box style={{ flexDirection: 'column', marginBottom: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg={activeFallback === 1 ? '#38bdf8' : theme.muted} attributes={TextAttributes.BOLD}>
              {activeFallback === 1 ? '❯ ' : '  '}Fallback 1 (optional):{' '}
            </span>
            <span
              fg={activeFallback === 1 ? theme.foreground : theme.muted}
              bg={activeFallback === 1 ? theme.surface : undefined}
            >
              {fallback1 ? maskApiKey(fallback1) : (activeFallback === 1 ? '[paste or type key]' : '[empty]')}
            </span>
            {activeFallback === 1 && <span fg="#38bdf8" attributes={TextAttributes.BOLD}> █</span>}
          </text>

          <text style={{ wrapMode: 'none', marginTop: 1 }}>
            <span fg={activeFallback === 2 ? '#38bdf8' : theme.muted} attributes={TextAttributes.BOLD}>
              {activeFallback === 2 ? '❯ ' : '  '}Fallback 2 (optional):{' '}
            </span>
            <span
              fg={activeFallback === 2 ? theme.foreground : theme.muted}
              bg={activeFallback === 2 ? theme.surface : undefined}
            >
              {fallback2 ? maskApiKey(fallback2) : (activeFallback === 2 ? '[paste or type key]' : '[empty]')}
            </span>
            {activeFallback === 2 && <span fg="#38bdf8" attributes={TextAttributes.BOLD}> █</span>}
          </text>
        </box>

        {/* Validation Status messages */}
        {status === 'testing' && (
          <text style={{ wrapMode: 'none', marginBottom: 1 }}>
            <span fg="#38bdf8">{SPINNER_FRAMES[spinnerIndex]} </span>
            <span fg={theme.foreground}>{statusMessage}</span>
          </text>
        )}
        {status === 'success' && (
          <text style={{ wrapMode: 'none', marginBottom: 1 }}>
            <span fg="#4ade80" attributes={TextAttributes.BOLD}>✓ </span>
            <span fg="#4ade80">{statusMessage}</span>
          </text>
        )}
        {status === 'error' && (
          <text style={{ wrapMode: 'none', marginBottom: 1 }}>
            <span fg="#f87171" attributes={TextAttributes.BOLD}>✕ </span>
            <span fg="#f87171">{statusMessage}</span>
          </text>
        )}

        {/* Footer actions */}
        <box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>enter</span>
            <span fg={theme.muted}> Done / Skip · </span>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>↑/↓</span>
            <span fg={theme.muted}> Switch · </span>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>tab / ctrl+v</span>
            <span fg={theme.muted}> Paste · </span>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>esc</span>
            <span fg={theme.muted}> Back</span>
          </text>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.muted}>{route.displayName} · Rate Limit Rotation</span>
          </text>
        </box>
      </box>
    )
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
          <span fg="#ffb703" attributes={TextAttributes.BOLD}>RivoCode · API Key Setup</span>
          {'\n'}
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>Configure {route.displayName}</span>
          {'\n\n'}
          <span fg={theme.secondary}>Get a free API key from: </span>
          <span fg="#38bdf8" attributes={TextAttributes.UNDERLINE}>{route.apiKeyUrl}</span>
          {'\n\n'}
          <span fg={theme.foreground}>Enter or paste your API key below:</span>
          {'\n'}
        </text>

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
              <span fg={theme.foreground} attributes={TextAttributes.BOLD}>{maskApiKey(inputKey)}</span>
            ) : (
              <span fg={theme.muted}>[Paste clipboard with Tab / Cmd+V / Ctrl+V / p]</span>
            )}
            <span fg="#55ff55" attributes={TextAttributes.BOLD}> █</span>
          </text>
        </box>

        <box style={{ marginBottom: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg="#38bdf8" attributes={TextAttributes.BOLD}>[ 📋 Paste from Clipboard: Press Tab or Ctrl+V or p ]</span>
          </text>
        </box>

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

      <box style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%', paddingRight: 2 }}>
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>{route.displayName}</span>
        </text>
      </box>
    </box>
  )
}
