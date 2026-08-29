import { useCallback, useEffect, useRef, useState } from 'react'

import { logger } from '../utils/logger'

import type { PendingAttachment } from '../types/store'

export type StreamStatus = 'idle' | 'waiting' | 'streaming'

export type QueuedMessage = {
  id: string
  content: string
  attachments: PendingAttachment[]
}

const newQueueId = () => crypto.randomUUID()

const QUEUE_WATCHDOG_TIMEOUT_MS = 60 * 1000

export const useMessageQueue = (
  sendMessage: (message: QueuedMessage) => Promise<void>,
  isChainInProgressRef: React.MutableRefObject<boolean>,
  activeAgentStreamsRef: React.MutableRefObject<number>,
  opts: {
    sendBlocked?: boolean
  } = {},
) => {
  const sendBlocked = opts.sendBlocked ?? false
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')
  const [canProcessQueue, setCanProcessQueue] = useState<boolean>(true)
  const [queuePausedState, setQueuePausedState] = useState<boolean>(false)

  const queuedMessagesRef = useRef<QueuedMessage[]>([])
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamMessageIdRef = useRef<string | null>(null)
  const isProcessingQueueRef = useRef<boolean>(false)
  const queueProcessingOwnerRef = useRef<symbol | null>(null)
  const isQueuePausedRef = useRef<boolean>(false)
  const watchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const queuePaused = queuePausedState

  const writeQueue = useCallback((next: QueuedMessage[]) => {
    queuedMessagesRef.current = next
    setQueuedMessages(next)
  }, [])

  const clearStreaming = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
    streamMessageIdRef.current = null
    activeAgentStreamsRef.current = 0
    setStreamStatus('idle')
  }, [activeAgentStreamsRef])

  useEffect(() => {
    return () => {
      clearStreaming()
      if (watchdogTimeoutRef.current) {
        clearTimeout(watchdogTimeoutRef.current)
        watchdogTimeoutRef.current = null
      }
    }
  }, [clearStreaming])

  const processNextMessage = useCallback(() => {
    const queuedList = queuedMessagesRef.current
    const queueLength = queuedList.length

    if (queueLength === 0) {
      return
    }

    if (isQueuePausedRef.current) {
      logger.debug(
        { queueLength },
        '[message-queue] Queue blocked: user paused',
      )
      return
    }

    if (sendBlocked) {
      return
    }

    if (!canProcessQueue) {
      return
    }
    if (streamStatus !== 'idle') {
      logger.debug(
        { queueLength, streamStatus },
        '[message-queue] Queue blocked: stream not idle',
      )
      return
    }
    if (streamMessageIdRef.current) {
      logger.debug(
        { queueLength, streamMessageId: streamMessageIdRef.current },
        '[message-queue] Queue blocked: streamMessageId set',
      )
      return
    }
    if (isChainInProgressRef.current) {
      logger.debug(
        { queueLength, isChainInProgress: isChainInProgressRef.current },
        '[message-queue] Queue blocked: chain in progress',
      )
      return
    }
    if (activeAgentStreamsRef.current > 0) {
      logger.debug(
        { queueLength, activeAgentStreams: activeAgentStreamsRef.current },
        '[message-queue] Queue blocked: active agent streams',
      )
      return
    }

    if (isProcessingQueueRef.current) {
      logger.debug(
        { queueLength },
        '[message-queue] Queue blocked: already processing',
      )
      return
    }

    logger.info(
      { queueLength },
      '[message-queue] Processing next message from queue',
    )

    const processingOwner = Symbol('queue-processing-owner')
    queueProcessingOwnerRef.current = processingOwner
    isProcessingQueueRef.current = true

    if (watchdogTimeoutRef.current) {
      clearTimeout(watchdogTimeoutRef.current)
    }
    watchdogTimeoutRef.current = setTimeout(() => {
      if (queueProcessingOwnerRef.current !== processingOwner) return
      if (isProcessingQueueRef.current) {
        logger.warn(
          { stuckDurationMs: QUEUE_WATCHDOG_TIMEOUT_MS },
          '[message-queue] Watchdog: isProcessingQueueRef stuck for too long, forcing reset',
        )
        setCanProcessQueue(!isQueuePausedRef.current)
      }
      queueProcessingOwnerRef.current = null
      isProcessingQueueRef.current = false
      watchdogTimeoutRef.current = null
    }, QUEUE_WATCHDOG_TIMEOUT_MS)

    const messageToProcess = queuedMessagesRef.current[0]

    if (!messageToProcess) {
      queueProcessingOwnerRef.current = null
      isProcessingQueueRef.current = false
      if (watchdogTimeoutRef.current) {
        clearTimeout(watchdogTimeoutRef.current)
        watchdogTimeoutRef.current = null
      }
      return
    }

    writeQueue(queuedMessagesRef.current.slice(1))

    sendMessage(messageToProcess)
      .catch((err: unknown) => {
        logger.warn(
          { error: err },
          '[message-queue] sendMessage promise rejected',
        )
      })
      .finally(() => {
        if (queueProcessingOwnerRef.current !== processingOwner) return
        queueProcessingOwnerRef.current = null
        isProcessingQueueRef.current = false
        if (watchdogTimeoutRef.current) {
          clearTimeout(watchdogTimeoutRef.current)
          watchdogTimeoutRef.current = null
        }
        logger.debug('[message-queue] Processing lock released')
      })
  }, [
    canProcessQueue,
    streamStatus,
    sendMessage,
    sendBlocked,
    isChainInProgressRef,
    activeAgentStreamsRef,
    writeQueue,
  ])

  useEffect(() => {
    processNextMessage()
  }, [
    canProcessQueue,
    streamStatus,
    queuedMessages.length,
    processNextMessage,
    isChainInProgressRef,
  ])

  const addToQueue = useCallback(
    (message: string, attachments: PendingAttachment[] = []) => {
      const queuedMessage = {
        id: newQueueId(),
        content: message,
        attachments,
      }
      writeQueue([...queuedMessagesRef.current, queuedMessage])
    },
    [writeQueue],
  )

  const addToQueueFront = useCallback(
    (message: Omit<QueuedMessage, 'id'>) => {
      writeQueue([
        { ...message, id: newQueueId() },
        ...queuedMessagesRef.current,
      ])
    },
    [writeQueue],
  )

  const editQueuedMessage = useCallback(
    (id: string, content: string): boolean => {
      const current = queuedMessagesRef.current
      const index = current.findIndex((message) => message.id === id)
      if (index === -1) return false

      const next = [...current]
      next[index] = { ...next[index]!, content }
      writeQueue(next)
      return true
    },
    [writeQueue],
  )

  const removeQueuedMessage = useCallback(
    (id: string): boolean => {
      const current = queuedMessagesRef.current
      const next = current.filter((message) => message.id !== id)
      if (next.length === current.length) return false

      writeQueue(next)
      return true
    },
    [writeQueue],
  )

  const moveQueuedMessage = useCallback(
    (id: string, toIndex: number): boolean => {
      const current = queuedMessagesRef.current
      const from = current.findIndex((message) => message.id === id)
      if (from === -1) return false

      const to = Math.max(0, Math.min(current.length - 1, toIndex))
      if (to === from) return false

      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      writeQueue(next)
      return true
    },
    [writeQueue],
  )

  const pauseQueue = useCallback(() => {
    isQueuePausedRef.current = true
    setQueuePausedState(true)
    setCanProcessQueue(false)
  }, [])

  const pauseQueueIfPending = useCallback(() => {
    if (queuedMessagesRef.current.length === 0) return
    pauseQueue()
  }, [pauseQueue])

  const resumeQueue = useCallback(() => {
    isQueuePausedRef.current = false
    setQueuePausedState(false)
    setCanProcessQueue(true)
  }, [])

  const clearQueue = useCallback(() => {
    const current = queuedMessagesRef.current
    writeQueue([])
    return current
  }, [writeQueue])

  const discardQueue = useCallback(() => {
    writeQueue([])
    isQueuePausedRef.current = false
    setQueuePausedState(false)
    queueProcessingOwnerRef.current = null
    isProcessingQueueRef.current = false
    if (watchdogTimeoutRef.current) {
      clearTimeout(watchdogTimeoutRef.current)
      watchdogTimeoutRef.current = null
    }
    setCanProcessQueue(false)
  }, [writeQueue])

  const startStreaming = useCallback(() => {
    setStreamStatus('streaming')
    setCanProcessQueue(false)
  }, [])

  return {
    queuedMessages,
    streamStatus,
    canProcessQueue,
    queuePaused,
    streamMessageIdRef,
    addToQueue,
    addToQueueFront,
    editQueuedMessage,
    removeQueuedMessage,
    moveQueuedMessage,
    startStreaming,
    setStreamStatus,
    clearStreaming,
    setCanProcessQueue,
    pauseQueue,
    pauseQueueIfPending,
    resumeQueue,
    clearQueue,
    discardQueue,
    isQueuePausedRef,
    isProcessingQueueRef,
  }
}
