import { randomUUID } from 'node:crypto'

import { useCallback, useEffect, useRef } from 'react'

import { setCurrentChatId } from '../project-files'
import { createStreamController } from './stream-state'
import { useChatStore } from '../state/chat-store'
import { getCodebuffClient } from '../utils/codebuff-client'
import {
  AGENT_MODE_TO_COST_MODE,
  AGENT_MODE_TO_ID,
} from '../utils/constants'
import { createEventHandlerState } from '../utils/create-event-handler-state'
import { createRunConfig } from '../utils/create-run-config'
import { loadAgentDefinitions } from '../utils/local-agent-registry'
import { logger } from '../utils/logger'
import { clearActiveRun, registerActiveRun } from '../utils/active-run'
import {
  clearLiveChatStateProvider,
  loadMostRecentChatState,
  resolveCurrentChatDir,
  saveChatState,
  scheduleCheckpointSave,
  setLiveChatStateProvider,
  settleCheckpointSave,
} from '../utils/run-state-storage'
import {
  autoCollapsePreviousMessages,
  createAiMessageShell,
  createErrorMessage as createErrorChatMessage,
  generateAiMessageId,
  sanitizeRestoredMessages,
} from '../utils/send-message-helpers'
import { createSendMessageTimerController } from '../utils/send-message-timer'
import {
  handleRunCompletion,
  handleRunError,
  prepareUserMessage as prepareUserMessageHelper,
  resetEarlyReturnState,
  setupStreamingContext,
} from './helpers/send-message'
import { executeRealAiStream } from '../utils/real-ai-service'
import { NETWORK_ERROR_ID } from '../utils/validation-error-helpers'
import { yieldToEventLoop } from '../utils/yield-to-event-loop'

import type { ElapsedTimeTracker } from './use-elapsed-time'
import type { StreamStatus } from './use-message-queue'
import type { PendingAttachment } from '../types/store'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { AgentMode } from '../utils/constants'
import type { SendMessageTimerEvent } from '../utils/send-message-timer'
import { STATE_SNAPSHOT_INTERRUPTION_MESSAGE } from '@rivocode/sdk'

import type { AgentDefinition, MessageContent, RunState } from '@rivocode/sdk'
import { isCoveredBySubscription } from '../utils/subscription'

import type { SubscriptionResponse } from './use-subscription-query'

interface UseSendMessageOptions {
  inputRef: React.MutableRefObject<any>
  activeSubagentsRef: React.MutableRefObject<Set<string>>
  isChainInProgressRef: React.MutableRefObject<boolean>
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  agentId?: string
  onBeforeMessageSend: () => Promise<{
    success: boolean
    errors: Array<{ id: string; message: string }>
  }>
  mainAgentTimer: ElapsedTimeTracker
  scrollToLatest: () => void
  onTimerEvent?: (event: SendMessageTimerEvent) => void
  isQueuePausedRef?: React.MutableRefObject<boolean>
  isProcessingQueueRef?: React.MutableRefObject<boolean>
  resumeQueue?: () => void
  requeueMessageAtFront?: (message: {
    content: string
    attachments: PendingAttachment[]
  }) => void
  continueChat: boolean
  continueChatId?: string
  subscriptionData?: SubscriptionResponse | null
  getClient?: typeof getCodebuffClient
}

const resolveAgent = (
  agentMode: AgentMode,
  agentId: string | undefined,
  agentDefinitions: AgentDefinition[],
): AgentDefinition | string => {
  const selectedAgentDefinition =
    agentId && agentDefinitions.length > 0
      ? agentDefinitions.find((definition) => definition.id === agentId)
      : undefined

  return selectedAgentDefinition ?? agentId ?? AGENT_MODE_TO_ID[agentMode]
}

const buildPromptWithContext = (
  promptWithBashContext: string,
  messageContent: MessageContent[] | undefined,
) => {
  const trimmedPrompt = promptWithBashContext.trim()
  if (trimmedPrompt.length > 0) {
    return promptWithBashContext
  }

  if (messageContent && messageContent.length > 0) {
    return 'See attached image(s)'
  }

  return ''
}

export const useSendMessage = ({
  inputRef,
  activeSubagentsRef,
  isChainInProgressRef,
  setStreamStatus,
  setCanProcessQueue,
  agentId,
  onBeforeMessageSend,
  mainAgentTimer,
  scrollToLatest,
  onTimerEvent = () => {},
  isQueuePausedRef,
  isProcessingQueueRef,
  resumeQueue,
  requeueMessageAtFront,
  continueChat,
  continueChatId,
  subscriptionData,
  getClient = getCodebuffClient,
}: UseSendMessageOptions): {
  sendMessage: SendMessageFn
  clearMessages: () => void
} => {
  const {
    setMessages,
    setFocusedAgentId,
    setInputFocused,
    setStreamingAgents,
    setActiveSubagents,
    setIsChainInProgress,
    setHasReceivedPlanResponse,
    setLastMessageMode,
    addSessionCredits,
    setRunState,
    setIsRetrying,
  } = useChatStore.getState()
  const previousRunStateRef = useRef<RunState | null>(
    useChatStore.getState().runState,
  )
  const streamRefsRef = useRef<ReturnType<
    typeof createStreamController
  > | null>(null)
  if (!streamRefsRef.current) {
    streamRefsRef.current = createStreamController()
  }
  const streamRefs = streamRefsRef.current

  useEffect(() => {
    if (continueChat && !previousRunStateRef.current) {
      const loadedState = loadMostRecentChatState(continueChatId ?? undefined)
      if (loadedState) {
        previousRunStateRef.current = loadedState.runState
        setRunState(loadedState.runState)
        setMessages(sanitizeRestoredMessages(loadedState.messages))
        if (loadedState.chatId) {
          setCurrentChatId(loadedState.chatId)
        }
      }
    }
  }, [continueChat, continueChatId, setMessages, setRunState])

  const updateChainInProgress = useCallback(
    (value: boolean) => {
      isChainInProgressRef.current = value
      setIsChainInProgress(value)
    },
    [setIsChainInProgress, isChainInProgressRef],
  )

  const updateActiveSubagents = useCallback(
    (mutate: (next: Set<string>) => void) => {
      setActiveSubagents((prev) => {
        const next = new Set(prev)
        mutate(next)
        activeSubagentsRef.current = next
        return next
      })
    },
    [setActiveSubagents, activeSubagentsRef],
  )

  const addActiveSubagent = useCallback(
    (subagentId: string) => {
      updateActiveSubagents((next) => next.add(subagentId))
    },
    [updateActiveSubagents],
  )

  const removeActiveSubagent = useCallback(
    (subagentId: string) => {
      updateActiveSubagents((next) => next.delete(subagentId))
    },
    [updateActiveSubagents],
  )

  function clearMessages() {
    previousRunStateRef.current = null
    setRunState(null)
  }

  const prepareUserMessage = useCallback(
    (params: {
      content: string
      agentMode: AgentMode
      postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
      attachments?: PendingAttachment[]
      signal?: AbortSignal
    }) => {
      const { lastMessageMode } = useChatStore.getState()
      return prepareUserMessageHelper({
        ...params,
        deps: {
          setMessages,
          lastMessageMode,
          setLastMessageMode,
          scrollToLatest,
          setHasReceivedPlanResponse,
        },
      })
    },
    [
      setMessages,
      setLastMessageMode,
      scrollToLatest,
      setHasReceivedPlanResponse,
    ],
  )

  const sendMessage = useCallback<SendMessageFn>(
    async ({ content, agentMode, postUserMessage, attachments }) => {
      useChatStore.getState().setLiveTokenCount(0)
      isChainInProgressRef.current = true
      updateChainInProgress(true)
      setCanProcessQueue(false)

      if (agentMode !== 'PLAN') {
        setHasReceivedPlanResponse(false)
      }

      const timerController = createSendMessageTimerController({
        mainAgentTimer,
        onTimerEvent,
        agentId,
      })
      setIsRetrying(false)

      const runOwnerId = randomUUID()
      const abortController = new AbortController()
      const runChatDir = resolveCurrentChatDir()
      const runChatIsCurrent = () => resolveCurrentChatDir() === runChatDir
      let latestRunStateSnapshot: RunState = previousRunStateRef.current ?? {
        traceSessionId: randomUUID(),
        output: {
          type: 'error',
          message: STATE_SNAPSHOT_INTERRUPTION_MESSAGE,
        },
      }
      let streamingStarted = false

      setLiveChatStateProvider(runOwnerId, () => ({
        runState: latestRunStateSnapshot,
        messages: useChatStore.getState().messages,
      }))

      const releaseRunOwnership = () => {
        clearLiveChatStateProvider(runOwnerId)
        clearActiveRun(runOwnerId)
      }

      registerActiveRun(runOwnerId, (reason) => {
        if (abortController.signal.aborted) return

        abortController.abort(reason)
        if (!streamingStarted) {
          setIsRetrying(false)
          setStreamStatus('idle')
          setStreamingAgents(() => new Set())
          updateChainInProgress(false)
          if (isProcessingQueueRef) isProcessingQueueRef.current = false
        }

        scheduleCheckpointSave(
          latestRunStateSnapshot,
          useChatStore.getState().messages,
          runChatDir,
        )
      })

      const releaseIfStopped = (): boolean => {
        if (!abortController.signal.aborted) return false
        releaseRunOwnership()
        return true
      }

      const finishPreflight = () => {
        resetEarlyReturnState({
          setCanProcessQueue,
          updateChainInProgress,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
        releaseRunOwnership()
      }

      let userMessageId: string
      let messageContent: MessageContent[] | undefined
      let bashContextForPrompt: string | undefined
      let finalContent: string

      try {
        const prepared = await prepareUserMessage({
          content,
          agentMode,
          postUserMessage,
          attachments,
          signal: abortController.signal,
        })
        userMessageId = prepared.userMessageId
        messageContent = prepared.messageContent
        bashContextForPrompt = prepared.bashContextForPrompt
        finalContent = prepared.finalContent
      } catch (error) {
        if (releaseIfStopped()) return
        logger.error(
          { error },
          '[send-message] prepareUserMessage failed with exception',
        )
        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            '⚠️ Failed to prepare message. Please try again.',
          ),
        ])
        finishPreflight()
        return
      }

      if (releaseIfStopped()) return

      const aiMessageId = generateAiMessageId()
      const aiMessage = createAiMessageShell(aiMessageId)

      const { updater, hasReceivedContentRef } = setupStreamingContext({
        aiMessageId,
        timerController,
        setMessages,
        streamRefs,
        abortController,
        setStreamStatus,
        setCanProcessQueue,
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress,
        setIsRetrying,
        setStreamingAgents,
      })
      streamingStarted = true
      setStreamStatus('waiting')
      setMessages((prev) => [
        ...autoCollapsePreviousMessages(prev, aiMessageId),
        aiMessage,
      ])

      try {
        await executeRealAiStream({
          prompt: finalContent,
          agentMode,
          aiMessageId,
          updater,
          signal: abortController.signal,
          onComplete: (runState) => {
            if (!abortController.signal.aborted && runChatIsCurrent()) {
              previousRunStateRef.current = runState
              setRunState(runState)
              setIsRetrying(false)
              saveChatState(runState, useChatStore.getState().messages, runChatDir)
            }
            handleRunCompletion({
              runState,
              actualCredits: 0,
              agentMode,
              timerController,
              updater,
              aiMessageId,
              wasAbortedByUser: abortController.signal.aborted,
              hasReceivedContent: true,
              setStreamStatus,
              setCanProcessQueue,
              updateChainInProgress,
              setHasReceivedPlanResponse,
              resumeQueue,
              isProcessingQueueRef,
              isQueuePausedRef,
            })
          },
        })
        return
      } catch (err) {
        logger.error({ err }, '[send-message] Real AI stream execution error')
      }

      try {
        const validationResult = await onBeforeMessageSend()

        if (releaseIfStopped()) return

        if (!validationResult.success) {
          logger.warn(
            { errors: validationResult.errors },
            '[send-message] Validation failed',
          )
          const errorsToAttach =
            validationResult.errors.length === 0
              ? [
                ]
              : validationResult.errors

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== userMessageId) {
                return msg
              }
              return {
                ...msg,
                validationErrors: errorsToAttach,
              }
            }),
          )
          releaseRunOwnership()
          return
        }
      } catch (error) {
        if (releaseIfStopped()) return
        logger.error(
          { error },
          '[send-message] Validation before message send failed with exception',
        )

        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            '⚠️ Agent validation failed unexpectedly. Please try again.',
          ),
        ])
        await yieldToEventLoop()
        if (releaseIfStopped()) return
        setTimeout(() => scrollToLatest(), 0)

        releaseRunOwnership()
        return
      }

      setFocusedAgentId(null)
      setInputFocused(true)
      inputRef.current?.focus()

      let client: Awaited<ReturnType<typeof getCodebuffClient>>
      try {
        client = await getClient()
      } catch (error) {
        if (releaseIfStopped()) return
        logger.error(
          { error },
          '[send-message] Failed to create Codebuff client',
        )
        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            '⚠️ Unable to create the client. Please check your authentication and try again.',
          ),
        ])
        releaseRunOwnership()
        return
      }

      if (releaseIfStopped()) return

      if (!client) {
        logger.error(
          {},
          '[send-message] No Codebuff client available. Please ensure you are authenticated.',
        )
        const brandName = 'RivoCode'
        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            `⚠️ Unable to connect to ${brandName}. Please check your authentication and try again.`,
          ),
        ])
        await yieldToEventLoop()
        if (releaseIfStopped()) return
        setTimeout(() => scrollToLatest(), 0)
        releaseRunOwnership()
        return
      }

      let actualCredits: number | undefined

      saveChatState(
        latestRunStateSnapshot,
        useChatStore.getState().messages,
        runChatDir,
      )

      try {
        const agentDefinitions = loadAgentDefinitions()
        const resolvedAgent = resolveAgent(agentMode, agentId, agentDefinitions)

        const promptWithBashContext = bashContextForPrompt
          ? bashContextForPrompt + finalContent
          : finalContent
        const effectivePrompt = buildPromptWithContext(
          promptWithBashContext,
          messageContent,
        )

        const eventHandlerState = createEventHandlerState({
          isActive: () => !abortController.signal.aborted && runChatIsCurrent(),
          streamRefs,
          setStreamingAgents,
          setStreamStatus,
          aiMessageId,
          updater,
          hasReceivedContentRef,
          addActiveSubagent,
          removeActiveSubagent,
          agentMode,
          setHasReceivedPlanResponse,
          logger,
          setIsRetrying,
          onTotalCost: (cost: number) => {
            actualCredits = cost
            if (!isCoveredBySubscription(subscriptionData)) {
              addSessionCredits(cost)
            }
          },
        })

        const runConfig = createRunConfig({
          logger,
          agent: resolvedAgent,
          prompt: effectivePrompt,
          content: messageContent,
          previousRunState: previousRunStateRef.current,
          agentDefinitions,
          eventHandlerState,
          signal: abortController.signal,
          costMode: AGENT_MODE_TO_COST_MODE[agentMode],
          onStateSnapshot: (snapshot) => {
            latestRunStateSnapshot = snapshot
            if (abortController.signal.aborted || !runChatIsCurrent()) {
              return
            }
            previousRunStateRef.current = snapshot
            scheduleCheckpointSave(
              snapshot,
              useChatStore.getState().messages,
              runChatDir,
            )
          },
        })

        logger.info(
          {
            runConfig: {
              agent:
                typeof resolvedAgent === 'string'
                  ? resolvedAgent
                  : resolvedAgent.id,
              promptLength: effectivePrompt.length,
              contentBlockCount: messageContent?.length ?? 0,
              previousMessageCount:
                previousRunStateRef.current?.sessionState?.mainAgentState
                  .messageHistory.length ?? 0,
              agentDefinitionCount: agentDefinitions.length,
              costMode: runConfig.costMode,
              maxAgentSteps: runConfig.maxAgentSteps,
            },
          },
          '[send-message] Sending message with sdk run config',
        )
        const runState = await client.run(runConfig)

        if (!abortController.signal.aborted && runChatIsCurrent()) {
          previousRunStateRef.current = runState
          setRunState(runState)
          setIsRetrying(false)

          await settleCheckpointSave()
          saveChatState(runState, useChatStore.getState().messages, runChatDir)
        }
        handleRunCompletion({
          runState,
          actualCredits,
          agentMode,
          timerController,
          updater,
          aiMessageId,
          wasAbortedByUser: abortController.signal.aborted,
          hasReceivedContent: hasReceivedContentRef.current,
          setStreamStatus,
          setCanProcessQueue,
          updateChainInProgress,
          setHasReceivedPlanResponse,
          resumeQueue,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
      } catch (error) {
        if (!abortController.signal.aborted) {
          handleRunError({
            error,
            timerController,
            updater,
            setIsRetrying,
            setStreamStatus,
            setCanProcessQueue,
            updateChainInProgress,
            isProcessingQueueRef,
            isQueuePausedRef,
            hasReceivedContent: hasReceivedContentRef.current,
          })
          if (runChatIsCurrent()) {
            await settleCheckpointSave()
            saveChatState(
              latestRunStateSnapshot,
              useChatStore.getState().messages,
              runChatDir,
            )
          }
        } else {
          logger.debug({ error }, '[send-message] Ignoring error after abort')
        }
      } finally {
        releaseRunOwnership()
        if (!abortController.signal.aborted) {
          if (isChainInProgressRef.current) {
            logger.warn(
              {},
              '[send-message] Chain still in progress after try/catch, forcing reset',
            )
            updateChainInProgress(false)
            setStreamStatus('idle')
            setCanProcessQueue(!isQueuePausedRef?.current)
          }
          if (isProcessingQueueRef) {
            isProcessingQueueRef.current = false
          }
        }
        updater.dispose()
      }
    },
    [
      addActiveSubagent,
      addSessionCredits,
      agentId,
      inputRef,
      isChainInProgressRef,
      isProcessingQueueRef,
      isQueuePausedRef,
      mainAgentTimer,
      onBeforeMessageSend,
      onTimerEvent,
      prepareUserMessage,
      removeActiveSubagent,
      requeueMessageAtFront,
      resumeQueue,
      scrollToLatest,
      setCanProcessQueue,
      setFocusedAgentId,
      setHasReceivedPlanResponse,
      setInputFocused,
      setIsRetrying,
      setMessages,
      getClient,
      setRunState,
      setStreamStatus,
      setStreamingAgents,
      streamRefs,
      updateChainInProgress,
    ],
  )

  return {
    sendMessage,
    clearMessages,
  }
}
