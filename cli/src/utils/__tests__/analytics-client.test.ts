import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'
import { describe, test, expect, beforeEach, mock } from 'bun:test'

import {
  initAnalytics,
  trackEvent,
  identifyUser,
  resetAnalyticsState,
  type AnalyticsDeps,
} from '../analytics'

import type { AnalyticsClientWithIdentify } from '@rivocode/common/analytics-core'

describe('analytics with PostHog alias', () => {
  let captureMock: ReturnType<typeof mock>
  let identifyMock: ReturnType<typeof mock>
  let aliasMock: ReturnType<typeof mock>
  let flushMock: ReturnType<typeof mock>
  let captureExceptionMock: ReturnType<typeof mock>

  const TEST_ANONYMOUS_ID = 'anon_test-uuid-1234'

  function createMockClient(): AnalyticsClientWithIdentify {
    return {
      capture: captureMock,
      identify: identifyMock,
      alias: aliasMock,
      flush: flushMock,
      captureException: captureExceptionMock,
    }
  }

  function createTestDeps(): AnalyticsDeps {
    return {
      env: {
        NEXT_PUBLIC_POSTHOG_API_KEY: 'test-api-key',
        NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://test.posthog.com',
      },
      isProd: true,
      createClient: () => createMockClient(),
      generateAnonymousId: () => TEST_ANONYMOUS_ID,
    }
  }

  beforeEach(() => {
    captureMock = mock(() => {})
    identifyMock = mock(() => {})
    aliasMock = mock(() => {})
    flushMock = mock(() => Promise.resolve())
    captureExceptionMock = mock(() => {})

    resetAnalyticsState(createTestDeps())
  })

  describe('anonymous tracking before identification', () => {
    test('should send events immediately with anonymous ID', () => {
      initAnalytics()

      trackEvent(AnalyticsEvent.APP_LAUNCHED, { test: 'value1' })
      trackEvent(AnalyticsEvent.LOGIN_STARTED, { test: 'value2' })

      expect(captureMock).toHaveBeenCalledTimes(2)
      expect(captureMock).toHaveBeenCalledWith({
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.APP_LAUNCHED,
        properties: { test: 'value1' },
      })
      expect(captureMock).toHaveBeenCalledWith({
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.LOGIN_STARTED,
        properties: { test: 'value2' },
      })
    })

    test('should generate anonymous ID on init', () => {
      initAnalytics()

      trackEvent(AnalyticsEvent.APP_LAUNCHED)

      expect(captureMock).toHaveBeenCalledWith({
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.APP_LAUNCHED,
        properties: undefined,
      })
    })
  })

  describe('user identification with alias', () => {
    test('should call identify and alias when user logs in', () => {
      initAnalytics()

      trackEvent(AnalyticsEvent.APP_LAUNCHED)

      identifyUser('user-123', { email: 'test@example.com' })

      expect(identifyMock).toHaveBeenCalledWith({
        distinctId: 'user-123',
        properties: { email: 'test@example.com' },
      })

      expect(aliasMock).toHaveBeenCalledWith({
        distinctId: 'user-123',
        alias: TEST_ANONYMOUS_ID,
      })
    })

    test('should use real user ID for events after identification', () => {
      initAnalytics()
      identifyUser('user-456')

      captureMock.mockClear()

      trackEvent(AnalyticsEvent.FEEDBACK_SUBMITTED, { rating: 5 })

      expect(captureMock).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: AnalyticsEvent.FEEDBACK_SUBMITTED,
        properties: { rating: 5 },
      })
    })

    test('should not fail when identifying without prior anonymous events', () => {
      initAnalytics()

      expect(() => {
        identifyUser('user-789')
      }).not.toThrow()

      expect(identifyMock).toHaveBeenCalledTimes(1)
      expect(aliasMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('event tracking after identification', () => {
    test('should send events directly with user ID', () => {
      initAnalytics()
      identifyUser('user-direct')
      captureMock.mockClear()

      trackEvent(AnalyticsEvent.APP_LAUNCHED)
      trackEvent(AnalyticsEvent.LOGIN)
      trackEvent(AnalyticsEvent.CHANGE_DIRECTORY)

      expect(captureMock).toHaveBeenCalledTimes(3)

      const calls = captureMock.mock.calls
      expect((calls[0][0] as { distinctId: string }).distinctId).toBe(
        'user-direct',
      )
      expect((calls[1][0] as { distinctId: string }).distinctId).toBe(
        'user-direct',
      )
      expect((calls[2][0] as { distinctId: string }).distinctId).toBe(
        'user-direct',
      )
    })
  })

  describe('edge cases', () => {
    test('should handle events with undefined properties', () => {
      initAnalytics()

      trackEvent(AnalyticsEvent.APP_LAUNCHED, undefined)

      expect(captureMock).toHaveBeenCalledWith({
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.APP_LAUNCHED,
        properties: undefined,
      })
    })

    test('should handle events with empty properties object', () => {
      initAnalytics()

      trackEvent(AnalyticsEvent.APP_LAUNCHED, {})

      expect(captureMock).toHaveBeenCalledWith({
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.APP_LAUNCHED,
        properties: {},
      })
    })

    test('should throw when tracking events before initAnalytics in prod', () => {
      resetAnalyticsState(createTestDeps())

      expect(() => {
        trackEvent(AnalyticsEvent.APP_LAUNCHED)
      }).toThrow('Analytics client not initialized')
    })

    test('should throw when identifying before initAnalytics in prod', () => {
      resetAnalyticsState(createTestDeps())

      expect(() => {
        identifyUser('user-123')
      }).toThrow('Analytics client not initialized')
    })
  })

  describe('complete user journey', () => {
    test('should track full journey from anonymous to identified', () => {
      initAnalytics()

      trackEvent(AnalyticsEvent.APP_LAUNCHED, { stage: 'startup' })
      trackEvent(AnalyticsEvent.LOGIN_STARTED, { stage: 'pre-login' })

      identifyUser('user-journey', { plan: 'pro' })

      trackEvent(AnalyticsEvent.FEEDBACK_SUBMITTED, { stage: 'post-login' })

      expect(captureMock).toHaveBeenCalledTimes(3)

      expect(captureMock).toHaveBeenNthCalledWith(1, {
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.APP_LAUNCHED,
        properties: { stage: 'startup' },
      })
      expect(captureMock).toHaveBeenNthCalledWith(2, {
        distinctId: TEST_ANONYMOUS_ID,
        event: AnalyticsEvent.LOGIN_STARTED,
        properties: { stage: 'pre-login' },
      })

      expect(captureMock).toHaveBeenNthCalledWith(3, {
        distinctId: 'user-journey',
        event: AnalyticsEvent.FEEDBACK_SUBMITTED,
        properties: { stage: 'post-login' },
      })

      expect(aliasMock).toHaveBeenCalledWith({
        distinctId: 'user-journey',
        alias: TEST_ANONYMOUS_ID,
      })
    })
  })
})
