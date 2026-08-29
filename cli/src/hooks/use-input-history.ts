import { useRef, useCallback, useEffect } from 'react'

import {
  loadMessageHistory,
  saveMessageHistory,
} from '../utils/message-history'

import type { InputValue } from '../types/store'
import type { InputMode } from '../utils/input-modes'

function parseHistoryItem(item: string): {
  mode: InputMode
  displayText: string
} {
  if (item.startsWith('!') && item.length > 1) {
    return { mode: 'bash', displayText: item.slice(1) }
  }
  return { mode: 'default', displayText: item }
}

export const useInputHistory = (
  inputValue: string,
  setInputValue: (value: InputValue) => void,
  options?: {
    inputMode?: InputMode
    setInputMode?: (mode: InputMode) => void
  },
) => {
  const { inputMode, setInputMode } = options ?? {}
  const messageHistoryRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)
  const currentDraftRef = useRef<string>('')
  const currentDraftModeRef = useRef<InputMode>('default')
  const isInitializedRef = useRef<boolean>(false)
  const isNavigatingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      const savedHistory = loadMessageHistory()
      messageHistoryRef.current = savedHistory
    }
  }, [])

  const resetHistoryNavigation = useCallback(() => {
    historyIndexRef.current = -1
    currentDraftRef.current = ''
    currentDraftModeRef.current = 'default'
  }, [])

  useEffect(() => {
    if (!isNavigatingRef.current) {
      resetHistoryNavigation()
    }
  }, [inputMode, resetHistoryNavigation])

  const saveToHistory = useCallback((message: string) => {
    const diskHistory = loadMessageHistory()
    const newHistory = [...diskHistory, message]
    messageHistoryRef.current = newHistory
    historyIndexRef.current = -1
    currentDraftRef.current = ''
    currentDraftModeRef.current = 'default'

    saveMessageHistory(newHistory)
  }, [])

  const navigateUp = useCallback(() => {
    const history = messageHistoryRef.current
    if (history.length === 0) return

    isNavigatingRef.current = true

    if (historyIndexRef.current === -1) {
      currentDraftRef.current =
        inputMode === 'bash' ? '!' + inputValue : inputValue
      currentDraftModeRef.current = inputMode ?? 'default'
      historyIndexRef.current = history.length - 1
    } else if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1
    }

    const historyMessage = history[historyIndexRef.current]
    if (historyMessage === undefined) {
      isNavigatingRef.current = false
      return
    }

    const { mode, displayText } = parseHistoryItem(historyMessage)

    if (setInputMode && mode !== inputMode) {
      setInputMode(mode)
    }

    setInputValue({
      text: displayText,
      cursorPosition: displayText.length,
      lastEditDueToNav: true,
    })

    setTimeout(() => {
      isNavigatingRef.current = false
    }, 0)
  }, [inputValue, inputMode, setInputValue, setInputMode])

  const navigateDown = useCallback(() => {
    const history = messageHistoryRef.current
    if (history.length === 0) return
    if (historyIndexRef.current === -1) return

    isNavigatingRef.current = true

    if (historyIndexRef.current < history.length - 1) {
      historyIndexRef.current += 1
      const historyMessage = history[historyIndexRef.current]
      if (historyMessage === undefined) {
        isNavigatingRef.current = false
        return
      }

      const { mode, displayText } = parseHistoryItem(historyMessage)

      if (setInputMode && mode !== inputMode) {
        setInputMode(mode)
      }

      setInputValue({
        text: displayText,
        cursorPosition: displayText.length,
        lastEditDueToNav: true,
      })
    } else {
      historyIndexRef.current = -1
      const draft = currentDraftRef.current
      const draftMode = currentDraftModeRef.current

      if (setInputMode && draftMode !== inputMode) {
        setInputMode(draftMode)
      }

      const textToShow =
        draftMode === 'bash' && draft.startsWith('!') ? draft.slice(1) : draft

      setInputValue({
        text: textToShow,
        cursorPosition: textToShow.length,
        lastEditDueToNav: true,
      })
    }

    setTimeout(() => {
      isNavigatingRef.current = false
    }, 0)
  }, [inputMode, setInputValue, setInputMode])

  return { saveToHistory, navigateUp, navigateDown, resetHistoryNavigation }
}
