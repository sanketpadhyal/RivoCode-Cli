
import { mock, spyOn } from 'bun:test'

import type { Mock } from 'bun:test'

export type EventProperties = Record<string, unknown>

export type TrackEventFn = (
  eventName: string,
  properties?: EventProperties,
) => void

export type FlushAnalyticsFn = () => Promise<void>

export type IdentifyUserFn = (
  userId: string,
  traits?: Record<string, unknown>,
) => void

export interface MockAnalytics {
  trackEvent: Mock<TrackEventFn>
  flushAnalytics: Mock<FlushAnalyticsFn>
  identifyUser: Mock<IdentifyUserFn>
}

export interface TrackedEvent {
  name: string
  properties?: EventProperties
  timestamp: Date
}

export interface CreateMockAnalyticsOptions {
  captureEvents?: boolean
}

export function createMockAnalytics(
  options: CreateMockAnalyticsOptions = {},
): MockAnalytics {
  return {
    trackEvent: mock(() => {}),
    flushAnalytics: mock(async () => {}),
    identifyUser: mock(() => {}),
  }
}

export interface MockAnalyticsWithCapture {
  analytics: MockAnalytics
  events: TrackedEvent[]
  clearEvents: () => void
  getEventsByName: (name: string) => TrackedEvent[]
  hasEvent: (name: string) => boolean
  getLastEvent: () => TrackedEvent | undefined
}

export function createMockAnalyticsWithCapture(): MockAnalyticsWithCapture {
  const events: TrackedEvent[] = []

  const analytics: MockAnalytics = {
    trackEvent: mock((name: string, properties?: EventProperties) => {
      events.push({
        name,
        properties,
        timestamp: new Date(),
      })
    }),
    flushAnalytics: mock(async () => {}),
    identifyUser: mock(() => {}),
  }

  return {
    analytics,
    events,
    clearEvents: () => {
      events.length = 0
    },
    getEventsByName: (name: string) => events.filter((e) => e.name === name),
    hasEvent: (name: string) => events.some((e) => e.name === name),
    getLastEvent: () => events[events.length - 1],
  }
}

export interface AnalyticsSpies {
  trackEvent: ReturnType<typeof spyOn>
  flushAnalytics: ReturnType<typeof spyOn>
  restore: () => void
  clear: () => void
}

export function setupAnalyticsMocks(analyticsModule: {
  trackEvent: TrackEventFn
  flushAnalytics: FlushAnalyticsFn
}): AnalyticsSpies {
  const trackEventSpy = spyOn(analyticsModule, 'trackEvent').mockImplementation(
    () => {},
  )
  const flushAnalyticsSpy = spyOn(
    analyticsModule,
    'flushAnalytics',
  ).mockImplementation(async () => {})

  return {
    trackEvent: trackEventSpy,
    flushAnalytics: flushAnalyticsSpy,
    restore: () => {
      trackEventSpy.mockRestore()
      flushAnalyticsSpy.mockRestore()
    },
    clear: () => {
      trackEventSpy.mockClear()
      flushAnalyticsSpy.mockClear()
    },
  }
}

export function restoreMockAnalytics(analytics: MockAnalytics): void {
  analytics.trackEvent.mockRestore()
  analytics.flushAnalytics.mockRestore()
  analytics.identifyUser.mockRestore()
}
