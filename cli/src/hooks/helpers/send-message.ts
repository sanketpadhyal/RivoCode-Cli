import { FREEBUFF_PROVIDER_USAGE_MESSAGE } from '@rivocode/common/constants/freebuff-errors'
import { getErrorObject } from '@rivocode/common/util/error'

import { getProjectRoot } from '../../project-files'
import { useChatStore } from '../../state/chat-store'
import { IS_FREEBUFF } from '../../utils/constants'
import { processBashContext } from '../../utils/bash-context-processor'
import { markRunningAgentsAsCancelled } from '../../utils/block-operations'
import {
  getCountryBlockFromFreeModeError,
  getFreeModeUnavailableErrorMessage,
  getFreebuffGateErrorKind,
  getFreebuffRateLimitErrorMessage,
  isOutOfCreditsError,
  isFreebuffProviderUsageError,
  isFreeModeUnavailableError,
  OUT_OF_CREDITS_MESSAGE,
} from '../../utils/error-handling'
import { formatElapsedTime } from '../../utils/format-elapsed-time'
import { processImagesForMessage } from '../../utils/image-processor'
import { logger } from '../../utils/logger'
import { appendInterruptionNotice } from '../../utils/message-block-helpers'
import { getUserMessage } from '../../utils/message-history'
import {
  createBatchedMessageUpdater,
  type BatchedMessageUpdater,
} from '../../utils/message-updater'
import { createModeDividerMessage } from '../../utils/send-message-helpers'
import { yieldToEventLoop } from '../../utils/yield-to-event-loop'
import { invalidateActivityQuery } from '../use-activity-query'
import { usageQueryKeys } from '../use-usage-query'

import type {
  PendingAttachment,
  PendingFileAttachment,
  PendingImageAttachment,
  PendingTextAttachment,
} from '../../types/store'
import type { ChatMessage } from '../../types/chat'
import type { AgentMode } from '../../utils/constants'
import type { SendMessageTimerController } from '../../utils/send-message-timer'
import type { StreamController } from '../stream-state'
import type { StreamStatus } from '../use-message-queue'
import type { MessageContent, RunState } from '@rivocode/sdk'
import type { MutableRefObject, SetStateAction } from 'react'

export type ResetEarlyReturnStateParams = {
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
}

export const resetEarlyReturnState = (
  params: ResetEarlyReturnStateParams,
): void => {
  const {
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
  } = params

  updateChainInProgress(false)
  setCanProcessQueue(!isQueuePausedRef?.current)
  if (isProcessingQueueRef) {
    isProcessingQueueRef.current = false
  }
}

export type FinalizeQueueStateParams = {
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
  resumeQueue?: () => void
}

export const finalizeQueueState = (params: FinalizeQueueStateParams): void => {
  const {
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
    resumeQueue,
  } = params

  setStreamStatus('idle')
  if (isProcessingQueueRef) {
    isProcessingQueueRef.current = false
  }
  if (resumeQueue) {
    resumeQueue()
  } else {
    setCanProcessQueue(!isQueuePausedRef?.current)
  }
  updateChainInProgress(false)
}

const DEFAULT_RUN_OUTPUT_ERROR_MESSAGE = 'No output from agent run'

export type PrepareUserMessageDeps = {
  setMessages: (update: SetStateAction<ChatMessage[]>) => void
  lastMessageMode: AgentMode | null
  setLastMessageMode: (mode: AgentMode | null) => void
  scrollToLatest: () => void
  setHasReceivedPlanResponse: (value: boolean) => void
}

export const prepareUserMessage = async (params: {
  content: string
  agentMode: AgentMode
  postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
  attachments?: PendingAttachment[]
  signal?: AbortSignal
  deps: PrepareUserMessageDeps
}): Promise<{
  userMessageId: string
  messageContent: MessageContent[] | undefined
  bashContextForPrompt: string
  finalContent: string
}> => {
  const { content, agentMode, postUserMessage, attachments, signal, deps } =
    params
  const { setMessages, lastMessageMode, setLastMessageMode, scrollToLatest } =
    deps

  const { pendingBashMessages, clearPendingBashMessages } =
    useChatStore.getState()
  const { bashMessages, bashContextForPrompt } =
    processBashContext(pendingBashMessages)

  if (bashMessages.length > 0) {
    setMessages((prev) => [...prev, ...bashMessages])
  }
  clearPendingBashMessages()

  const allAttachments =
    attachments ?? useChatStore.getState().pendingAttachments
  if (!attachments && allAttachments.length > 0) {
    useChatStore.getState().clearPendingAttachments()
  }

  const pendingImages = allAttachments.filter(
    (a): a is PendingImageAttachment => a.kind === 'image',
  )
  const pendingTextAttachments = allAttachments.filter(
    (a): a is PendingTextAttachment => a.kind === 'text',
  )

  const pendingFileAttachments = allAttachments.filter(
    (a): a is PendingFileAttachment => a.kind === 'file',
  )

  let finalContent = content
  if (pendingTextAttachments.length > 0) {
    const textAttachmentContent = pendingTextAttachments
      .map((att) => `[Pasted Text]\n${att.content}`)
      .join('\n\n')
    finalContent = content
      ? `${content}\n\n${textAttachmentContent}`
      : textAttachmentContent
  }

  if (pendingFileAttachments.length > 0) {
    const fileAttachmentContent = pendingFileAttachments
      .filter((att) => att.status === 'ready')
      .map((att) =>
        att.isDirectory
          ? `[Directory: ${att.path}]\n${att.content}`
          : `[File: ${att.path}]\n${att.content}`,
      )
      .join('\n\n')
    if (fileAttachmentContent) {
      finalContent = finalContent
        ? `${finalContent}\n\n${fileAttachmentContent}`
        : fileAttachmentContent
    }
  }

  const { attachments: imageAttachments, messageContent } =
    await processImagesForMessage({
      content: finalContent,
      pendingImages,
      projectRoot: getProjectRoot(),
    })

  if (signal?.aborted) {
    throw new Error('Message preparation aborted')
  }

  const shouldInsertDivider =
    lastMessageMode === null || lastMessageMode !== agentMode

  const textAttachmentsForMessage = pendingTextAttachments.map((att) => ({
    id: att.id,
    content: att.content,
    preview: att.preview,
    charCount: att.charCount,
  }))

  const fileAttachmentsForMessage = pendingFileAttachments
    .filter((att) => att.status === 'ready')
    .map((att) => ({
      path: att.path,
      filename: att.filename,
      isDirectory: att.isDirectory,
      note: att.note,
    }))

  const userMessage = getUserMessage(
    content,
    imageAttachments,
    textAttachmentsForMessage,
    fileAttachmentsForMessage,
  )
  const userMessageId = userMessage.id
  if (imageAttachments.length > 0) {
    userMessage.attachments = imageAttachments
  }

  setMessages((prev) => {
    let next = [...prev]
    if (shouldInsertDivider) {
      next.push(createModeDividerMessage(agentMode))
    }
    next.push(userMessage)
    if (postUserMessage) {
      next = postUserMessage(next)
    }
    return next
  })

  setLastMessageMode(agentMode)
  await yieldToEventLoop()
  setTimeout(() => scrollToLatest(), 0)

  return {
    userMessageId,
    messageContent,
    bashContextForPrompt,
    finalContent,
  }
}

export const setupStreamingContext = (params: {
  aiMessageId: string
  timerController: SendMessageTimerController
  setMessages: (updater: (messages: ChatMessage[]) => ChatMessage[]) => void
  streamRefs: StreamController
  abortController?: AbortController
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  isQueuePausedRef?: MutableRefObject<boolean>
  isProcessingQueueRef?: MutableRefObject<boolean>
  updateChainInProgress: (value: boolean) => void
  setIsRetrying: (value: boolean) => void
  setStreamingAgents: (updater: (prev: Set<string>) => Set<string>) => void
}) => {
  const {
    timerController,
    setMessages,
    streamRefs,
    setStreamStatus,
    setCanProcessQueue,
    isQueuePausedRef,
    isProcessingQueueRef,
    updateChainInProgress,
    setIsRetrying,
    setStreamingAgents,
  } = params
  const { aiMessageId } = params

  streamRefs.reset()
  timerController.start(aiMessageId)
  const updater = createBatchedMessageUpdater(aiMessageId, setMessages)
  updater.clearUserError()
  const hasReceivedContentRef = { current: false }
  const abortController = params.abortController ?? new AbortController()

  abortController.signal.addEventListener('abort', () => {
    streamRefs.setters.setWasAbortedByUser(true)
    setIsRetrying(false)
    timerController.stop('aborted')

    setStreamStatus('idle')

    setStreamingAgents(() => new Set())

    updateChainInProgress(false)
    setCanProcessQueue(!isQueuePausedRef?.current)
    if (isProcessingQueueRef) {
      isProcessingQueueRef.current = false
    }

    updater.updateAiMessageBlocks((blocks) => {
      const cancelledBlocks = markRunningAgentsAsCancelled(blocks)
      return appendInterruptionNotice(cancelledBlocks)
    })
    updater.markComplete()
  })

  return { updater, hasReceivedContentRef, abortController }
}

export const handleRunCompletion = (params: {
  runState: RunState
  actualCredits: number | undefined
  agentMode: AgentMode
  timerController: SendMessageTimerController
  updater: BatchedMessageUpdater
  aiMessageId: string
  wasAbortedByUser: boolean
  hasReceivedContent?: boolean
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  setHasReceivedPlanResponse: (value: boolean) => void
  resumeQueue?: () => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
}) => {
  const {
    runState,
    actualCredits,
    agentMode,
    timerController,
    updater,
    wasAbortedByUser,
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    setHasReceivedPlanResponse,
    resumeQueue,
    isProcessingQueueRef,
    isQueuePausedRef,
  } = params

  if (wasAbortedByUser) {
    return
  }

  const output = runState.output
  const finalizeAfterError = () => {
    finalizeQueueState({
      setStreamStatus,
      setCanProcessQueue,
      updateChainInProgress,
      isProcessingQueueRef,
      isQueuePausedRef,
    })
    timerController.stop('error')
  }

  if (!output) {
    if (!wasAbortedByUser) {
      updater.setError(DEFAULT_RUN_OUTPUT_ERROR_MESSAGE)
      finalizeAfterError()
    }
    return
  }

  if (output.type === 'error') {
    if (IS_FREEBUFF && isFreebuffProviderUsageError(output)) {
      updater.setError(FREEBUFF_PROVIDER_USAGE_MESSAGE)
      finalizeAfterError()
      return
    }

    if (isOutOfCreditsError(output)) {
      updater.setError(OUT_OF_CREDITS_MESSAGE)
      useChatStore.getState().setInputMode('outOfCredits')
      invalidateActivityQuery(usageQueryKeys.current())
      finalizeAfterError()
      return
    }

    if (isFreeModeUnavailableError(output)) {
      updater.setError(getFreeModeUnavailableErrorMessage(output))
      finalizeAfterError()
      return
    }

    const gateKind = getFreebuffGateErrorKind(output)
    if (gateKind) {
      handleFreebuffGateError(gateKind, updater, {
        messageWasDropped: params.hasReceivedContent === false,
      })
      finalizeAfterError()
      return
    }

    const freebuffRateLimitMessage = IS_FREEBUFF
      ? getFreebuffRateLimitErrorMessage(output)
      : null
    if (freebuffRateLimitMessage) {
      updater.setError(freebuffRateLimitMessage)
      finalizeAfterError()
      return
    }

    updater.setError(output.message ?? DEFAULT_RUN_OUTPUT_ERROR_MESSAGE)

    finalizeAfterError()
    return
  }

  invalidateActivityQuery(usageQueryKeys.current())

  finalizeQueueState({
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
    resumeQueue,
  })
  const timerResult = timerController.stop('success')

  if (agentMode === 'PLAN') {
    setHasReceivedPlanResponse(true)
  }

  const elapsedMs = timerResult?.elapsedMs ?? 0
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  let completionTime: string | undefined
  if (elapsedSeconds > 0) {
    completionTime = formatElapsedTime(elapsedSeconds)
  }

  updater.markComplete({
    ...(completionTime && { completionTime }),
    ...(actualCredits !== undefined && { credits: actualCredits }),
    metadata: {
      runState,
    },
  })
}

export const handleRunError = (params: {
  error: unknown
  timerController: SendMessageTimerController
  updater: BatchedMessageUpdater
  setIsRetrying: (value: boolean) => void
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
  hasReceivedContent?: boolean
}) => {
  const {
    error,
    timerController,
    updater,
    setIsRetrying,
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
    hasReceivedContent,
  } = params

  const errorInfo = getErrorObject(error, { includeRawError: true })

  logger.error({ error: errorInfo }, 'SDK client.run() failed')
  setIsRetrying(false)
  finalizeQueueState({
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
  })
  timerController.stop('error')

  if (IS_FREEBUFF && isFreebuffProviderUsageError(error)) {
    updater.setError(FREEBUFF_PROVIDER_USAGE_MESSAGE)
    return
  }

  if (isOutOfCreditsError(error)) {
    updater.setError(OUT_OF_CREDITS_MESSAGE)
    useChatStore.getState().setInputMode('outOfCredits')
    invalidateActivityQuery(usageQueryKeys.current())
    return
  }

  if (isFreeModeUnavailableError(error)) {
    updater.setError(getFreeModeUnavailableErrorMessage(error))
    return
  }

  const gateKind = getFreebuffGateErrorKind(error)
  if (gateKind) {
    handleFreebuffGateError(gateKind, updater, {
      messageWasDropped: hasReceivedContent === false,
    })
    return
  }

  const freebuffRateLimitMessage = IS_FREEBUFF
    ? getFreebuffRateLimitErrorMessage(error)
    : null
  if (freebuffRateLimitMessage) {
    updater.setError(freebuffRateLimitMessage)
    return
  }

  const errorMessage = errorInfo.message || 'An unexpected error occurred'
  updater.setError(errorMessage)
}

function handleFreebuffGateError(
  kind: ReturnType<typeof getFreebuffGateErrorKind>,
  updater: BatchedMessageUpdater,
  opts: { messageWasDropped?: boolean } = {},
) {
  switch (kind) {
    case 'session_expired':
    case 'waiting_room_required':
    case 'session_model_mismatch':
      updater.markComplete()
      if (opts.messageWasDropped) {
        updater.setError(
          'Your session ended before this message was processed.',
        )
      }
      return
    case 'waiting_room_queued':
      updater.setError(
        'Connecting to model. Try again in a moment.',
      )
      return
    case 'session_superseded':
      updater.setError(
        'Session active in another terminal.',
      )
      return
    default:
      return
  }
}
