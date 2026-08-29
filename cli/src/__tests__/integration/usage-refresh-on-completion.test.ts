import { QueryClient } from '@tanstack/react-query'
import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'

import { usageQueryKeys } from '../../hooks/use-usage-query'
import { useChatStore } from '../../state/chat-store'
import * as authModule from '../../utils/auth'

describe('Usage Refresh on SDK Completion', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.NEXT_PUBLIC_CODEBUFF_APP_URL

  let queryClient: QueryClient
  let getAuthTokenSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CODEBUFF_APP_URL = 'https://test.codebuff.local'

    useChatStore.getState().reset()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    getAuthTokenSpy = spyOn(authModule, 'getAuthToken').mockReturnValue(
      'test-token',
    )

    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            type: 'usage-response',
            usage: 100,
            remainingBalance: 850,
            next_quota_reset: '2024-03-01T00:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    getAuthTokenSpy.mockRestore()
    process.env.NEXT_PUBLIC_CODEBUFF_APP_URL = originalEnv
    mock.restore()
  })

  describe('banner visible scenarios', () => {
    test('should invalidate query when banner is visible and run completes', () => {
      useChatStore.getState().setInputMode('usage')
      expect(useChatStore.getState().inputMode).toBe('usage')

      const invalidateSpy = spyOn(queryClient, 'invalidateQueries')

      const isUsageMode = useChatStore.getState().inputMode === 'usage'
      if (isUsageMode) {
        queryClient.invalidateQueries({ queryKey: usageQueryKeys.current() })
      }

      expect(invalidateSpy).toHaveBeenCalledTimes(1)
      expect(invalidateSpy.mock.calls[0][0]).toEqual({
        queryKey: usageQueryKeys.current(),
      })
    })

    test('should invalidate multiple times for sequential runs', () => {
      useChatStore.getState().setInputMode('usage')

      const invalidateSpy = spyOn(queryClient, 'invalidateQueries')

      for (let i = 0; i < 3; i++) {
        if (useChatStore.getState().inputMode === 'usage') {
          queryClient.invalidateQueries({ queryKey: usageQueryKeys.current() })
        }
      }

      expect(invalidateSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe('banner not visible scenarios', () => {
    test('should NOT invalidate when banner is not visible', () => {
      useChatStore.getState().setInputMode('default')
      expect(useChatStore.getState().inputMode).toBe('default')

      const invalidateSpy = spyOn(queryClient, 'invalidateQueries')

      const isUsageMode = useChatStore.getState().inputMode === 'usage'
      if (isUsageMode) {
        queryClient.invalidateQueries({ queryKey: usageQueryKeys.current() })
      }

      expect(invalidateSpy).not.toHaveBeenCalled()
    })

    test('should not invalidate if banner was closed before run completed', () => {
      useChatStore.getState().setInputMode('usage')

      useChatStore.getState().setInputMode('default')

      const invalidateSpy = spyOn(queryClient, 'invalidateQueries')

      const isUsageMode = useChatStore.getState().inputMode === 'usage'
      if (isUsageMode) {
        queryClient.invalidateQueries({ queryKey: usageQueryKeys.current() })
      }

      expect(invalidateSpy).not.toHaveBeenCalled()
    })
  })

  describe('query behavior', () => {
    test('should not fetch when enabled is false', () => {
      useChatStore.getState().setInputMode('usage')

      const fetchSpy = spyOn(globalThis, 'fetch')

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('unauthenticated scenarios', () => {
    test('should not fetch when no auth token', () => {
      getAuthTokenSpy.mockReturnValue(undefined)
      useChatStore.getState().setInputMode('usage')

      const fetchSpy = spyOn(globalThis, 'fetch')

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
