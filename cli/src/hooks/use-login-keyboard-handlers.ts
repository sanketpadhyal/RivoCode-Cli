import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'

interface UseLoginKeyboardHandlersParams {
  loginUrl: string | null
  hasOpenedBrowser: boolean
  loading: boolean
  onFetchLoginUrl: () => void
  onCopyUrl: (url: string) => Promise<void> | void
}

export function useLoginKeyboardHandlers({
  loginUrl,
  hasOpenedBrowser,
  loading,
  onFetchLoginUrl,
  onCopyUrl,
}: UseLoginKeyboardHandlersParams) {
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const isEnter = isPlainEnterKey(key)

        const isCKey = key.name === 'c' && !key.ctrl && !key.meta && !key.shift
        const isCtrlC = key.ctrl && key.name === 'c'

        if (isCtrlC) {
          if (
            'preventDefault' in key &&
            typeof key.preventDefault === 'function'
          ) {
            key.preventDefault()
          }
          void exitCliCleanly()
        }

        if (isEnter && !hasOpenedBrowser && !loading) {
          if (
            'preventDefault' in key &&
            typeof key.preventDefault === 'function'
          ) {
            key.preventDefault()
          }

          onFetchLoginUrl()
        }

        if (isCKey && loginUrl && hasOpenedBrowser) {
          if (
            'preventDefault' in key &&
            typeof key.preventDefault === 'function'
          ) {
            key.preventDefault()
          }

          void Promise.resolve(onCopyUrl(loginUrl)).catch(() => {})
        }
      },
      [loginUrl, hasOpenedBrowser, loading, onCopyUrl, onFetchLoginUrl],
    ),
  )
}
