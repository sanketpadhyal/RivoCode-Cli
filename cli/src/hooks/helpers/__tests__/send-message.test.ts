import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test'
import { FREEBUFF_PROVIDER_USAGE_MESSAGE } from '@rivocode/common/constants/freebuff-errors'

import type { ChatMessage } from '../../../types/chat'
import type { SendMessageTimerController } from '../../../utils/send-message-timer'
import type { StreamStatus } from '../../use-message-queue'

const ensureEnv = () => {
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT =
    process.env.NEXT_PUBLIC_CB_ENVIRONMENT || 'test'
  process.env.NEXT_PUBLIC_CODEBUFF_APP_URL =
    process.env.NEXT_PUBLIC_CODEBUFF_APP_URL || 'https://app.codebuff.test'
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@codebuff.test'
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY =
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_test_key'
  process.env.NEXT_PUBLIC_POSTHOG_HOST_URL =
    process.env.NEXT_PUBLIC_POSTHOG_HOST_URL || 'https://posthog.codebuff.test'
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
  process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL =
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL ||
    'https://stripe.codebuff.test'
  process.env.NEXT_PUBLIC_WEB_PORT = process.env.NEXT_PUBLIC_WEB_PORT || '3000'
}

ensureEnv()

const { useChatStore } = await import('../../../state/chat-store')
const { IS_FREEBUFF } = await import('../../../utils/constants')
const { createStreamController } = await import('../../stream-state')
const {
  setupStreamingContext,
  handleRunCompletion,
  handleRunError,
  finalizeQueueState,
  resetEarlyReturnState,
} = await import('../send-message')
const { createBatchedMessageUpdater } =
  await import('../../../utils/message-updater')
import { createPaymentRequiredError } from '@rivocode/sdk'
import type { RunState } from '@rivocode/sdk'

const createMockTimerController = (): SendMessageTimerController & {
  startCalls: string[]
  stopCalls: Array<'success' | 'error' | 'aborted'>
} => {
  const startCalls: string[] = []
  const stopCalls: Array<'success' | 'error' | 'aborted'> = []

  return {
    startCalls,
    stopCalls,
    start: (messageId: string) => {
      startCalls.push(messageId)
    },
    stop: (outcome: 'success' | 'error' | 'aborted') => {
      stopCalls.push(outcome)
      return { finishedAt: Date.now(), elapsedMs: 100 }
    },
    pause: () => {},
    resume: () => {},
    isActive: () => startCalls.length > stopCalls.length,
  }
}

const createBaseMessages = (): ChatMessage[] => [
  {
    id: 'ai-1',
    variant: 'ai',
    content: 'Partial streamed content',
    blocks: [{ type: 'text', content: 'Some text' }],
    timestamp: 'now',
  },
]

describe('setupStreamingContext', () => {
  describe('abort flow', () => {
    test('abort handler appends interruption notice, marks complete, and releases chain lock', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      let streamStatus: StreamStatus = 'idle'
      let canProcessQueue = false
      let chainInProgress = true
      let isRetrying = true

      const { updater, abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        setStreamStatus: (status: StreamStatus) => {
          streamStatus = status
        },
        setCanProcessQueue: (can: boolean) => {
          canProcessQueue = can
        },
        updateChainInProgress: (value: boolean) => {
          chainInProgress = value
        },
        setIsRetrying: (value: boolean) => {
          isRetrying = value
        },
        setStreamingAgents: () => {},
      })

      abortController.abort()

      expect(streamRefs.state.wasAbortedByUser).toBe(true)

      expect(streamStatus).toBe('idle')

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(true)

      expect(isRetrying).toBe(false)

      expect(timerController.stopCalls).toContain('aborted')

      updater.flush()

      const aiMessage = messages.find((m: ChatMessage) => m.id === 'ai-1')
      expect(aiMessage).toBeDefined()

      const lastBlock = aiMessage!.blocks?.[aiMessage!.blocks.length - 1]
      expect(lastBlock?.type).toBe('text')
      const textBlock = lastBlock as { type: 'text'; content: string }
      expect(textBlock?.content).toContain('[response interrupted]')

      expect(aiMessage!.isComplete).toBe(true)
    })

    test('abort sets canProcessQueue based on queue pause state', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const isQueuePausedRef = { current: true }
      let canProcessQueue = false
      let canProcessQueueCallCount = 0

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        setStreamStatus: () => {},
        setCanProcessQueue: (can: boolean) => {
          canProcessQueue = can
          canProcessQueueCallCount++
        },
        isQueuePausedRef,
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      abortController.abort()

      expect(canProcessQueueCallCount).toBe(1)
      expect(canProcessQueue).toBe(false)
    })

    test('abort resets isProcessingQueueRef', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const isProcessingQueueRef = { current: true }

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        isProcessingQueueRef,
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      expect(isProcessingQueueRef.current).toBe(true)

      abortController.abort()

      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('abort releases chain lock and processing state, respects queue pause', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: true }
      let streamStatus = 'streaming' as StreamStatus
      let canProcessQueue = true
      let chainInProgress = true
      let isRetrying = true

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        setStreamStatus: (status) => {
          streamStatus = status
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setIsRetrying: (value) => {
          isRetrying = value
        },
        setStreamingAgents: () => {},
      })

      expect(isProcessingQueueRef.current).toBe(true)
      expect(isQueuePausedRef.current).toBe(true)
      expect(streamStatus).toBe('streaming')
      expect(canProcessQueue).toBe(true)
      expect(chainInProgress).toBe(true)
      expect(isRetrying).toBe(true)

      abortController.abort()

      expect(isProcessingQueueRef.current).toBe(false)
      expect(canProcessQueue).toBe(false)
      expect(chainInProgress).toBe(false)
      expect(isRetrying).toBe(false)
      expect(streamStatus).toBe('idle')
    })

    test('uses the run controller supplied by the owner', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      const timerController = createMockTimerController()
      const ownedAbortController = new AbortController()

      const { abortController } = setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        abortController: ownedAbortController,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      expect(abortController).toBe(ownedAbortController)
    })

    test('setupStreamingContext resets streamRefs and starts timer', () => {
      let messages = createBaseMessages()
      const streamRefs = createStreamController()
      streamRefs.state.rootStreamBuffer = 'some old content'
      streamRefs.state.rootStreamSeen = true

      const timerController = createMockTimerController()

      setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController,
        setMessages: (fn: any) => {
          messages = fn(messages)
        },
        streamRefs,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        updateChainInProgress: () => {},
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

      expect(streamRefs.state.rootStreamBuffer).toBe('')
      expect(streamRefs.state.rootStreamSeen).toBe(false)

      expect(timerController.startCalls).toContain('ai-1')
    })
  })
})

describe('handleRunCompletion', () => {
  describe('abort path', () => {
    test('skips finalizeQueueState when wasAbortedByUser is true (abort handler already released locks)', () => {
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
      const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
        messages = fn(messages)
      })

      let streamStatus: StreamStatus = 'idle'
      let canProcessQueue = true
      let chainInProgress = false
      const isProcessingQueueRef = { current: false }
      const isQueuePausedRef = { current: false }
      let hasReceivedPlanResponse = false

      let setStreamStatusCalled = false
      let setCanProcessQueueCalled = false
      let updateChainInProgressCalled = false

      const runState = {
        traceSessionId: 'trace-test',
        sessionState: undefined,
        output: { type: 'lastMessage' as const, value: [] },
      }

      handleRunCompletion({
        runState,
        actualCredits: undefined,
        agentMode: 'DEFAULT' as any,
        timerController,
        updater,
        aiMessageId: 'ai-1',
        wasAbortedByUser: true,
        setStreamStatus: (status: StreamStatus) => {
          setStreamStatusCalled = true
          streamStatus = status
        },
        setCanProcessQueue: (can: boolean) => {
          setCanProcessQueueCalled = true
          canProcessQueue = can
        },
        updateChainInProgress: (value: boolean) => {
          updateChainInProgressCalled = true
          chainInProgress = value
        },
        setHasReceivedPlanResponse: (value: boolean) => {
          hasReceivedPlanResponse = value
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(setStreamStatusCalled).toBe(false)
      expect(setCanProcessQueueCalled).toBe(false)
      expect(updateChainInProgressCalled).toBe(false)
    })

    test('does not process server response when wasAbortedByUser is true', () => {
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
      const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
        messages = fn(messages)
      })

      let hasReceivedPlanResponse = false

      const runState = {
        traceSessionId: 'trace-test',
        sessionState: undefined,
        output: {
          type: 'lastMessage' as const,
          value: [
            {
              type: 'text' as const,
              text: 'Server response that should be ignored',
            },
          ],
        },
      }

      handleRunCompletion({
        runState,
        actualCredits: 42,
        agentMode: 'PLAN' as any,
        timerController,
        updater,
        aiMessageId: 'ai-1',
        wasAbortedByUser: true,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {},
        updateChainInProgress: () => {},
        setHasReceivedPlanResponse: (value: boolean) => {
          hasReceivedPlanResponse = value
        },
      })

      expect(hasReceivedPlanResponse).toBe(false)

      expect(timerController.stopCalls).not.toContain('success')
      expect(timerController.stopCalls).not.toContain('error')
    })

    test('does not call resumeQueue in abort path (abort handler already released locks)', () => {
      const timerController = createMockTimerController()
      let messages = createBaseMessages()
      const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
        messages = fn(messages)
      })

      let resumeQueueCalled = false
      let canProcessQueueCalled = false

      const runState = {
        traceSessionId: 'trace-test',
        sessionState: undefined,
        output: { type: 'lastMessage' as const, value: [] },
      }

      handleRunCompletion({
        runState,
        actualCredits: undefined,
        agentMode: 'DEFAULT' as any,
        timerController,
        updater,
        aiMessageId: 'ai-1',
        wasAbortedByUser: true,
        setStreamStatus: () => {},
        setCanProcessQueue: () => {
          canProcessQueueCalled = true
        },
        updateChainInProgress: () => {},
        setHasReceivedPlanResponse: () => {},
        resumeQueue: () => {
          resumeQueueCalled = true
        },
      })

      expect(resumeQueueCalled).toBe(false)
      expect(canProcessQueueCalled).toBe(false)
    })
  })

  test('provider credit wording follows the Freebuff client policy', () => {
    let messages = createBaseMessages()
    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    handleRunCompletion({
      runState: {
        traceSessionId: 'trace-test',
        sessionState: undefined,
        output: {
          type: 'error',
          statusCode: 401,
          message: 'Not Enough Credits',
        },
      },
      actualCredits: undefined,
      agentMode: 'DEFAULT' as any,
      timerController,
      updater,
      aiMessageId: 'ai-1',
      wasAbortedByUser: false,
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
      setHasReceivedPlanResponse: () => {},
    })

    expect(messages[0]?.userError).toBe(
      IS_FREEBUFF ? FREEBUFF_PROVIDER_USAGE_MESSAGE : 'Not Enough Credits',
    )
  })
})

describe('finalizeQueueState', () => {
  test('sets stream status to idle and resets queue state', () => {
    let streamStatus = 'streaming' as StreamStatus
    let canProcessQueue = false
    let chainInProgress = true
    const isProcessingQueueRef = { current: true }

    finalizeQueueState({
      setStreamStatus: (status) => {
        streamStatus = status
      },
      setCanProcessQueue: (can) => {
        canProcessQueue = can
      },
      updateChainInProgress: (value) => {
        chainInProgress = value
      },
      isProcessingQueueRef,
    })

    expect(streamStatus).toBe('idle')
    expect(canProcessQueue).toBe(true)
    expect(chainInProgress).toBe(false)
    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('calls resumeQueue instead of setCanProcessQueue when provided', () => {
    let streamStatus = 'streaming' as StreamStatus
    let canProcessQueueCalled = false
    let resumeQueueCalled = false
    let chainInProgress = true

    finalizeQueueState({
      setStreamStatus: (status) => {
        streamStatus = status
      },
      setCanProcessQueue: () => {
        canProcessQueueCalled = true
      },
      updateChainInProgress: (value) => {
        chainInProgress = value
      },
      resumeQueue: () => {
        resumeQueueCalled = true
      },
    })

    expect(streamStatus).toBe('idle')
    expect(resumeQueueCalled).toBe(true)
    expect(canProcessQueueCalled).toBe(false)
    expect(chainInProgress).toBe(false)
  })

  test('respects isQueuePausedRef when no resumeQueue provided', () => {
    let canProcessQueue = true
    const isQueuePausedRef = { current: true }

    finalizeQueueState({
      setStreamStatus: () => {},
      setCanProcessQueue: (can) => {
        canProcessQueue = can
      },
      updateChainInProgress: () => {},
      isQueuePausedRef,
    })

    expect(canProcessQueue).toBe(false)
  })
})

describe('handleRunError', () => {
  let originalGetState: typeof useChatStore.getState

  beforeEach(() => {
    originalGetState = useChatStore.getState
  })

  afterEach(() => {
    useChatStore.getState = originalGetState
  })

  test('stores error in userError field for regular errors', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'Partial streamed content',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    let streamStatus: StreamStatus = 'idle'
    let canProcessQueue = false
    let chainInProgress = true
    let isRetrying = true

    handleRunError({
      error: new Error('Network timeout'),
      timerController,
      updater,
      setIsRetrying: (value: boolean) => {
        isRetrying = value
      },
      setStreamStatus: (status: StreamStatus) => {
        streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        canProcessQueue = can
      },
      updateChainInProgress: (value: boolean) => {
        chainInProgress = value
      },
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    expect(aiMessage).toBeDefined()

    expect(aiMessage!.content).toBe('Partial streamed content')
    expect(aiMessage!.userError).toBe('Network timeout')

    expect(streamStatus).toBe('idle')
    expect(canProcessQueue).toBe(true)
    expect(chainInProgress).toBe(false)
    expect(isRetrying).toBe(false)

    expect(timerController.stopCalls).toContain('error')

    expect(aiMessage!.isComplete).toBe(true)
  })

  test('handles empty existing content gracefully', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    handleRunError({
      error: new Error('Something failed'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    expect(aiMessage!.userError).toBe('Something failed')
    expect(aiMessage!.isComplete).toBe(true)
  })

  test('handles regular errors without switching input mode', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    const setInputModeMock = mock(() => {})
    useChatStore.getState = () => ({
      ...originalGetState(),
      setInputMode: setInputModeMock,
    })

    handleRunError({
      error: new Error('Regular error'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })

    expect(setInputModeMock).not.toHaveBeenCalled()
  })

  test('resets isProcessingQueueRef to false on error', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })
    const isProcessingQueueRef = { current: true }

    expect(isProcessingQueueRef.current).toBe(true)

    handleRunError({
      error: new Error('Some error'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
      isProcessingQueueRef,
    })

    expect(isProcessingQueueRef.current).toBe(false)
  })

  test('respects isQueuePausedRef when setting canProcessQueue on error', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })
    const isQueuePausedRef = { current: true }
    let canProcessQueue = true

    handleRunError({
      error: new Error('Some error'),
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: (can: boolean) => {
        canProcessQueue = can
      },
      updateChainInProgress: () => {},
      isQueuePausedRef,
    })

    expect(canProcessQueue).toBe(false)
  })

  test('context length exceeded error (AI_APICallError) stores error in userError and preserves content', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'Partial streamed content before error',
        blocks: [{ type: 'text', content: 'some block content' }],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    const contextLengthError = Object.assign(
      new Error(
        'This endpoint\'s maximum context length is 200000 tokens. However, you requested about 201209 tokens (158536 of text input, 10673 of tool input, 32000 in the output). Please reduce the length of either one, or use the "middle-out" transform to compress your prompt automatically.',
      ),
      {
        name: 'AI_APICallError',
        statusCode: 400,
      },
    )

    let streamStatus = 'streaming' as StreamStatus
    let canProcessQueue = false
    let chainInProgress = true
    let isRetrying = true

    handleRunError({
      error: contextLengthError,
      timerController,
      updater,
      setIsRetrying: (value: boolean) => {
        isRetrying = value
      },
      setStreamStatus: (status: StreamStatus) => {
        streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        canProcessQueue = can
      },
      updateChainInProgress: (value: boolean) => {
        chainInProgress = value
      },
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    expect(aiMessage).toBeDefined()

    expect(aiMessage!.content).toBe('Partial streamed content before error')

    expect(aiMessage!.blocks).toEqual([
      { type: 'text', content: 'some block content' },
    ])

    expect(aiMessage!.userError).toContain(
      'maximum context length is 200000 tokens',
    )
    expect(aiMessage!.userError).toContain('201209 tokens')

    expect(aiMessage!.isComplete).toBe(true)

    expect(streamStatus).toBe('idle')
    expect(canProcessQueue).toBe(true)
    expect(chainInProgress).toBe(false)
    expect(isRetrying).toBe(false)

    expect(timerController.stopCalls).toContain('error')
  })

  test('Payment required error (402) uses the billing policy for this client', () => {
    let messages: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'Partial streamed content',
        blocks: [{ type: 'text', content: 'some block' }],
        timestamp: 'now',
      },
    ]

    const timerController = createMockTimerController()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    const setInputModeMock = mock(() => {})
    useChatStore.getState = () => ({
      ...originalGetState(),
      setInputMode: setInputModeMock,
    })

    const paymentError = createPaymentRequiredError('Out of credits')

    handleRunError({
      error: paymentError,
      timerController,
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })

    const aiMessage = messages.find((m) => m.id === 'ai-1')
    expect(aiMessage).toBeDefined()

    expect(aiMessage!.content).toBe('Partial streamed content')
    expect(aiMessage!.userError).toContain(
      IS_FREEBUFF ? FREEBUFF_PROVIDER_USAGE_MESSAGE : 'Out of credits',
    )

    expect(aiMessage!.blocks).toEqual([{ type: 'text', content: 'some block' }])

    expect(aiMessage!.isComplete).toBe(true)

    if (IS_FREEBUFF) {
      expect(setInputModeMock).not.toHaveBeenCalled()
    } else {
      expect(setInputModeMock).toHaveBeenCalledWith('outOfCredits')
    }

    expect(timerController.stopCalls).toContain('error')
  })
})

describe('CLI-level race condition: abort run A, attempt run B before A resolves', () => {
  const canQueueProcessNextMessage = (opts: {
    isChainInProgress: boolean
    canProcessQueue: boolean
    streamStatus: StreamStatus
    isProcessingQueue: boolean
    isQueuePaused: boolean
  }): boolean => {
    if (opts.isQueuePaused) return false
    if (!opts.canProcessQueue) return false
    if (opts.streamStatus !== 'idle') return false
    if (opts.isChainInProgress) return false
    if (opts.isProcessingQueue) return false
    return true
  }

  test('run B can proceed immediately after abort (chain lock released by abort handler)', () => {
    let streamStatus: StreamStatus = 'idle'
    let canProcessQueue = false
    let chainInProgress = true
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }

    const setStreamStatus = (status: StreamStatus) => {
      streamStatus = status
    }
    const setCanProcessQueue = (can: boolean) => {
      canProcessQueue = can
    }
    const updateChainInProgress = (value: boolean) => {
      chainInProgress = value
    }

    let messagesA = createBaseMessages()
    const streamRefsA = createStreamController()
    const timerControllerA = createMockTimerController()

    const { updater: updaterA, abortController: abortControllerA } =
      setupStreamingContext({
        aiMessageId: 'ai-1',
        timerController: timerControllerA,
        setMessages: (fn: any) => {
          messagesA = fn(messagesA)
        },
        streamRefs: streamRefsA,
        setStreamStatus,
        setCanProcessQueue,
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress,
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

    streamStatus = 'streaming'

    expect(streamStatus).toBe('streaming')
    expect(chainInProgress).toBe(true)

    abortControllerA.abort()

    expect(streamRefsA.state.wasAbortedByUser).toBe(true)
    expect(streamStatus as StreamStatus).toBe('idle')
    expect(chainInProgress).toBe(false)
    expect(canProcessQueue).toBe(true)

    const canProcessRunB = canQueueProcessNextMessage({
      isChainInProgress: chainInProgress,
      canProcessQueue,
      streamStatus,
      isProcessingQueue: isProcessingQueueRef.current,
      isQueuePaused: isQueuePausedRef.current,
    })

    expect(canProcessRunB).toBe(true)
  })

  test('handleRunCompletion does not interfere after abort (no-op for aborted runs)', () => {

    let streamStatus: StreamStatus = 'idle'
    let canProcessQueue = true
    let chainInProgress = false
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }

    const timerController = createMockTimerController()
    let messages = createBaseMessages()
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      messages = fn(messages)
    })

    let setStreamStatusCallCount = 0
    let updateChainInProgressCallCount = 0

    const runState: RunState = {
      traceSessionId: 'trace-test',
      sessionState: {} as any,
      output: { type: 'lastMessage' as const, value: [] },
    }

    handleRunCompletion({
      runState,
      actualCredits: undefined,
      agentMode: 'DEFAULT' as any,
      timerController,
      updater,
      aiMessageId: 'ai-1',
      wasAbortedByUser: true,
      setStreamStatus: () => {
        setStreamStatusCallCount++
      },
      setCanProcessQueue: (can: boolean) => {
        canProcessQueue = can
      },
      updateChainInProgress: () => {
        updateChainInProgressCallCount++
      },
      setHasReceivedPlanResponse: () => {},
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    expect(setStreamStatusCallCount).toBe(0)
    expect(updateChainInProgressCallCount).toBe(0)
    expect(chainInProgress).toBe(false)
    expect(canProcessQueue).toBe(true)
  })

  test('aborted run A finally block must not clear isProcessingQueueRef owned by run B', () => {

    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }
    let chainInProgress = true
    let canProcessQueue = false
    let streamStatus: StreamStatus = 'idle'

    let messagesA = createBaseMessages()
    const sharedStreamRefs = createStreamController()
    const timerA = createMockTimerController()

    const { abortController: abortA } = setupStreamingContext({
      aiMessageId: 'ai-run-a',
      timerController: timerA,
      setMessages: (fn: any) => {
        messagesA = fn(messagesA)
      },
      streamRefs: sharedStreamRefs,
      setStreamStatus: (status: StreamStatus) => {
        streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        canProcessQueue = can
      },
      isQueuePausedRef,
      isProcessingQueueRef,
      updateChainInProgress: (value: boolean) => {
        chainInProgress = value
      },
      setIsRetrying: () => {},
      setStreamingAgents: () => {},
    })

    abortA.abort()
    expect(chainInProgress).toBe(false)
    expect(isProcessingQueueRef.current).toBe(false)

    isProcessingQueueRef.current = true
    chainInProgress = true
    canProcessQueue = false

    expect(abortA.signal.aborted).toBe(true)

    if (!abortA.signal.aborted) {
      isProcessingQueueRef.current = false
    }

    expect(isProcessingQueueRef.current).toBe(true)
    expect(chainInProgress).toBe(true)
  })

  test('reject-after-abort must not run handleRunError cleanup that could clobber run B', () => {

    let streamStatus: StreamStatus = 'idle'
    let canProcessQueue = true
    let chainInProgress = false
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }

    const abortController = new AbortController()
    abortController.abort()
    expect(abortController.signal.aborted).toBe(true)

    chainInProgress = true
    canProcessQueue = false
    isProcessingQueueRef.current = true
    streamStatus = 'streaming'

    const error = new Error('AbortError: The operation was aborted')

    if (!abortController.signal.aborted) {
      handleRunError({
        error,
        timerController: createMockTimerController(),
        updater: createBatchedMessageUpdater('ai-1', () => {}),
        setIsRetrying: () => {},
        setStreamStatus: (status: StreamStatus) => {
          streamStatus = status
        },
        setCanProcessQueue: (can: boolean) => {
          canProcessQueue = can
        },
        updateChainInProgress: (value: boolean) => {
          chainInProgress = value
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })
    }

    expect(chainInProgress).toBe(true)
    expect(canProcessQueue).toBe(false)
    expect(isProcessingQueueRef.current).toBe(true)
    expect(streamStatus).toBe('streaming')
  })

  test('handleRunError WOULD clobber run B state if called without abort guard (documents why guard is needed)', () => {

    let streamStatus: StreamStatus = 'streaming'
    let canProcessQueue = false
    let chainInProgress = true
    const isProcessingQueueRef = { current: true }
    const isQueuePausedRef = { current: false }

    handleRunError({
      error: new Error('AbortError'),
      timerController: createMockTimerController(),
      updater: createBatchedMessageUpdater('ai-1', (fn: any) => {}),
      setIsRetrying: () => {},
      setStreamStatus: (status: StreamStatus) => {
        streamStatus = status
      },
      setCanProcessQueue: (can: boolean) => {
        canProcessQueue = can
      },
      updateChainInProgress: (value: boolean) => {
        chainInProgress = value
      },
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    expect(chainInProgress).toBe(false)
    expect(canProcessQueue).toBe(true)
    expect(isProcessingQueueRef.current).toBe(false)
    expect(streamStatus as StreamStatus).toBe('idle')
  })

  test('full two-run lifecycle with shared streamRefs: run A abort → run B starts immediately', () => {

    let streamStatus: StreamStatus = 'idle'
    let canProcessQueue = false
    let chainInProgress = true
    const isProcessingQueueRef = { current: false }
    const isQueuePausedRef = { current: false }
    let previousRunState: RunState | null = null

    const setStreamStatus = (status: StreamStatus) => {
      streamStatus = status
    }
    const setCanProcessQueue = (can: boolean) => {
      canProcessQueue = can
    }
    const updateChainInProgress = (value: boolean) => {
      chainInProgress = value
    }

    const sharedStreamRefs = createStreamController()

    let messagesA = createBaseMessages()
    const timerA = createMockTimerController()

    const { updater: updaterA, abortController: abortA } =
      setupStreamingContext({
        aiMessageId: 'ai-run-a',
        timerController: timerA,
        setMessages: (fn: any) => {
          messagesA = fn(messagesA)
        },
        streamRefs: sharedStreamRefs,
        setStreamStatus,
        setCanProcessQueue,
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress,
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

    streamStatus = 'streaming'

    abortA.abort()
    expect(chainInProgress).toBe(false)
    expect(canProcessQueue).toBe(true)
    expect(sharedStreamRefs.state.wasAbortedByUser).toBe(true)

    chainInProgress = true
    canProcessQueue = false

    let messagesB: ChatMessage[] = [
      {
        id: 'ai-run-b',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: 'now',
      },
    ]
    const timerB = createMockTimerController()

    const { updater: updaterB, abortController: abortB } =
      setupStreamingContext({
        aiMessageId: 'ai-run-b',
        timerController: timerB,
        setMessages: (fn: any) => {
          messagesB = fn(messagesB)
        },
        streamRefs: sharedStreamRefs,
        setStreamStatus,
        setCanProcessQueue,
        isQueuePausedRef,
        isProcessingQueueRef,
        updateChainInProgress,
        setIsRetrying: () => {},
        setStreamingAgents: () => {},
      })

    expect(sharedStreamRefs.state.wasAbortedByUser).toBe(false)

    const runStateA: RunState = {
      traceSessionId: 'trace-test-a',
      sessionState: {
        id: 'session-abc',
        messages: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'partial response before cancel' },
        ],
      } as any,
      output: { type: 'lastMessage' as const, value: [] },
    }
    previousRunState = runStateA

    handleRunCompletion({
      runState: runStateA,
      actualCredits: undefined,
      agentMode: 'DEFAULT' as any,
      timerController: timerA,
      updater: updaterA,
      aiMessageId: 'ai-run-a',
      wasAbortedByUser: abortA.signal.aborted,
      setStreamStatus,
      setCanProcessQueue,
      updateChainInProgress,
      setHasReceivedPlanResponse: () => {},
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    expect(chainInProgress).toBe(true)

    const runStateB: RunState = {
      traceSessionId: 'trace-test-b',
      sessionState: {
        id: 'session-abc',
        messages: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'partial response before cancel' },
          { role: 'user', content: 'second message' },
          { role: 'assistant', content: 'full response to second message' },
        ],
      } as any,
      output: {
        type: 'lastMessage' as const,
        value: [{ type: 'text' as const, text: 'full response' }],
      },
    }
    previousRunState = runStateB

    handleRunCompletion({
      runState: runStateB,
      actualCredits: 5,
      agentMode: 'DEFAULT' as any,
      timerController: timerB,
      updater: updaterB,
      aiMessageId: 'ai-run-b',
      wasAbortedByUser: abortB.signal.aborted,
      setStreamStatus,
      setCanProcessQueue,
      updateChainInProgress,
      setHasReceivedPlanResponse: () => {},
      isProcessingQueueRef,
      isQueuePausedRef,
    })

    expect(previousRunState!.sessionState as any).toEqual({
      id: 'session-abc',
      messages: [
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'partial response before cancel' },
        { role: 'user', content: 'second message' },
        { role: 'assistant', content: 'full response to second message' },
      ],
    })
    expect(chainInProgress).toBe(false)
    expect(canProcessQueue).toBe(true)
  })
})

describe('resetEarlyReturnState', () => {
  describe('prepareUserMessage exception path', () => {
    test('resets chain in progress to false', () => {
      let chainInProgress = true

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: () => {},
      })

      expect(chainInProgress).toBe(false)
    })

    test('sets canProcessQueue to true when queue is not paused', () => {
      let canProcessQueue = false
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isQueuePausedRef,
      })

      expect(canProcessQueue).toBe(true)
    })

    test('sets canProcessQueue to false when queue is paused', () => {
      let canProcessQueue = true
      const isQueuePausedRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isQueuePausedRef,
      })

      expect(canProcessQueue).toBe(false)
    })

    test('resets isProcessingQueueRef to false', () => {
      const isProcessingQueueRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: () => {},
        isProcessingQueueRef,
      })

      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('handles missing isProcessingQueueRef gracefully', () => {
      expect(() => {
        resetEarlyReturnState({
          updateChainInProgress: () => {},
          setCanProcessQueue: () => {},
        })
      }).not.toThrow()
    })

    test('handles missing isQueuePausedRef gracefully (defaults to canProcessQueue=true)', () => {
      let canProcessQueue = false

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
      })

      expect(canProcessQueue).toBe(true)
    })
  })

  describe('validation failure path (success: false)', () => {
    test('resets all queue state correctly when processing queued message', () => {
      let chainInProgress = true
      let canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('respects queue paused state after validation failure', () => {
      let chainInProgress = true
      let canProcessQueue = true
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(false)
      expect(isProcessingQueueRef.current).toBe(false)
    })
  })

  describe('validation exception path', () => {
    test('resets all queue state correctly when validation throws', () => {
      let chainInProgress = true
      let canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('preserves queue pause state when validation throws', () => {
      let canProcessQueue = true
      const isQueuePausedRef = { current: true }
      const isProcessingQueueRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: () => {},
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(canProcessQueue).toBe(false)
      expect(isProcessingQueueRef.current).toBe(false)
    })
  })

  describe('complete early return scenarios', () => {
    test('queue can process next message after prepareUserMessage exception', () => {
      let chainInProgress = true
      let canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('queue can process next message after validation returns success=false', () => {
      let chainInProgress = true
      let canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('queue can process next message after validation throws exception', () => {
      let chainInProgress = true
      let canProcessQueue = false
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: false }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(true)
      expect(isProcessingQueueRef.current).toBe(false)
    })

    test('queue remains blocked after error if user had paused it', () => {
      let chainInProgress = true
      let canProcessQueue = true
      const isProcessingQueueRef = { current: true }
      const isQueuePausedRef = { current: true }

      resetEarlyReturnState({
        updateChainInProgress: (value) => {
          chainInProgress = value
        },
        setCanProcessQueue: (can) => {
          canProcessQueue = can
        },
        isProcessingQueueRef,
        isQueuePausedRef,
      })

      expect(chainInProgress).toBe(false)
      expect(canProcessQueue).toBe(false)
      expect(isProcessingQueueRef.current).toBe(false)
    })
  })
})

describe('freebuff gate errors', () => {
  const makeUpdater = (messages: ChatMessage[]) => {
    const updater = createBatchedMessageUpdater('ai-1', (fn: any) => {
      const next = fn(messages)
      messages.length = 0
      messages.push(...next)
    })
    return updater
  }

  const baseMessage = (): ChatMessage[] => [
    {
      id: 'ai-1',
      variant: 'ai',
      content: '',
      blocks: [],
      timestamp: 'now',
    },
  ]

  const gateError = (kind: string, statusCode: number) => ({
    error: kind,
    statusCode,
    message: 'server said so',
  })

  test('handleRunError maps 409 session_superseded to the restart-required message', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('session_superseded', 409),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toContain('Another freebuff CLI took over')
  })

  test('handleRunError suppresses the inline error for 410 session_expired (ended banner takes over)', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('session_expired', 410),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toBeUndefined()
  })

  test('handleRunError suppresses the inline error for 428 waiting_room_required (ended banner takes over)', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('waiting_room_required', 428),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toBeUndefined()
  })

  test('handleRunError maps 429 waiting_room_queued to the session-pending message', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    handleRunError({
      error: gateError('waiting_room_queued', 429),
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toContain('still being set up')
  })

  test('handleRunError ignores gate-shaped errors with non-matching status code', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    const err = Object.assign(new Error('oops'), {
      error: 'session_superseded',
      statusCode: 500,
    })
    handleRunError({
      error: err,
      timerController: createMockTimerController(),
      updater,
      setIsRetrying: () => {},
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toBe('oops')
    expect(messages[0].userError).not.toContain('took over')
  })

  test('handleRunCompletion with gate error output routes through the gate handler', () => {
    const messages = baseMessage()
    const updater = makeUpdater(messages)
    const runState: RunState = {
      traceSessionId: 'trace-test',
      sessionState: undefined as any,
      output: {
        type: 'error',
        message: 'server said so',
        error: 'session_expired',
        statusCode: 410,
      } as any,
    }
    handleRunCompletion({
      runState,
      actualCredits: undefined,
      agentMode: 'LITE',
      timerController: createMockTimerController(),
      updater,
      aiMessageId: 'ai-1',
      wasAbortedByUser: false,
      setStreamStatus: () => {},
      setCanProcessQueue: () => {},
      updateChainInProgress: () => {},
      setHasReceivedPlanResponse: () => {},
    })
    updater.flush()
    expect(messages[0].userError).toBeUndefined()
  })
})
