
import { RECONNECTION_MESSAGE_DURATION_MS } from '@rivocode/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState, useTransition } from 'react'

import { authQueryKeys } from './use-auth-query'
import { useConnectionStatus } from './use-connection-status'
import { useExitHandler } from './use-exit-handler'
import { useQueueControls } from './use-queue-controls'
import { useQueueUi } from './use-queue-ui'
import { useTimeout } from './use-timeout'
import { useChatRuntime } from '../contexts/chat-runtime-context'

import type { QueuedMessage, StreamStatus } from './use-message-queue'
import type { PendingAttachment } from '../types/store'
import type { MutableRefObject } from 'react'

export interface UseChatStreamingOptions {
  inputValue: string
  setInputValue: (value: {
    text: string
    cursorPosition: number
    lastEditDueToNav: boolean
  }) => void
  terminalWidth: number
  separatorWidth: number
}

export interface UseChatStreamingReturn {
  isConnected: boolean
  showReconnectionMessage: boolean

  timerStartTime: number | null

  streamStatus: StreamStatus
  isWaitingForResponse: boolean
  isStreaming: boolean

  queuedMessages: QueuedMessage[]
  queuePaused: boolean
  streamMessageIdRef: MutableRefObject<string | null>
  addToQueue: (message: string, attachments?: PendingAttachment[]) => void
  setCanProcessQueue: (value: boolean | ((prev: boolean) => boolean)) => void
  clearQueue: () => QueuedMessage[]

  queuedCount: number
  shouldShowQueuePreview: boolean
  inputBoxTitle: string | undefined
  inputPlaceholder: string

  handleCtrlC: () => true
  ensureQueueActiveBeforeSubmit: () => boolean
  nextCtrlCWillExit: boolean
}

export function useChatStreaming({
  inputValue,
  setInputValue,
  terminalWidth,
  separatorWidth,
}: UseChatStreamingOptions): UseChatStreamingReturn {
  const queryClient = useQueryClient()
  const [, startUiTransition] = useTransition()
  const runtime = useChatRuntime()

  const [showReconnectionMessage, setShowReconnectionMessage] = useState(false)
  const reconnectionTimeout = useTimeout()

  const handleReconnection = useCallback(
    (isInitialConnection: boolean) => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all })

      startUiTransition(() => {
        if (!isInitialConnection) {
          setShowReconnectionMessage(true)
          reconnectionTimeout.setTimeout(
            'reconnection-message',
            () => {
              startUiTransition(() => {
                setShowReconnectionMessage(false)
              })
            },
            RECONNECTION_MESSAGE_DURATION_MS,
          )
        }
      })
    },
    [queryClient, reconnectionTimeout, startUiTransition],
  )

  const isConnected = useConnectionStatus(handleReconnection)

  const {
    timerStartTime,
    queuedMessages,
    streamStatus,
    isWaitingForResponse,
    isStreaming,
    queuePaused,
    streamMessageIdRef,
    addToQueue,
    setCanProcessQueue,
    resumeQueue,
    clearQueue,
  } = runtime

  const {
    queuedCount,
    shouldShowQueuePreview,
    inputBoxTitle,
    inputPlaceholder,
  } = useQueueUi({
    queuePaused,
    queuedMessages,
    separatorWidth,
    terminalWidth,
  })

  const { handleCtrlC: baseHandleCtrlC, nextCtrlCWillExit } = useExitHandler({
    inputValue,
    setInputValue,
  })

  const { handleCtrlC, ensureQueueActiveBeforeSubmit } = useQueueControls({
    queuePaused,
    queuedCount,
    clearQueue,
    resumeQueue,
    inputHasText: Boolean(inputValue),
    baseHandleCtrlC,
  })

  return {
    isConnected,
    showReconnectionMessage,

    timerStartTime,

    streamStatus,
    isWaitingForResponse,
    isStreaming,

    queuedMessages,
    queuePaused,
    streamMessageIdRef,
    addToQueue,
    setCanProcessQueue,
    clearQueue,

    queuedCount,
    shouldShowQueuePreview,
    inputBoxTitle,
    inputPlaceholder,

    handleCtrlC,
    ensureQueueActiveBeforeSubmit,
    nextCtrlCWillExit,
  }
}
