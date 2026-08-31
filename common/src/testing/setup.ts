
import { setupAnalyticsMocks } from './mocks/analytics'
import { setupCryptoMocks } from './mocks/crypto'
import { setupDbSpies } from './mocks/database'
import { createMockLogger } from './mocks/logger'
import { resetToolCallIdCounter } from './mocks/stream'

import type {
  AnalyticsSpies,
  TrackEventFn,
  FlushAnalyticsFn,
} from './mocks/analytics'
import type { CryptoMockSpies } from './mocks/crypto'
import type { DbSpies } from './mocks/database'
import type { MockLogger } from './mocks/logger'

export interface CreateTestSetupOptions {
  analytics?: boolean

  crypto?: boolean

  database?: boolean

  dbModule?: {
    insert: (...args: unknown[]) => unknown
    update: (...args: unknown[]) => unknown
  }

  analyticsModule?: {
    trackEvent: TrackEventFn
    flushAnalytics: FlushAnalyticsFn
  }

  cryptoPrefix?: string
}

export interface TestSetupResult {
  logger: MockLogger

  analyticsSpy?: AnalyticsSpies

  cryptoSpy?: CryptoMockSpies

  dbSpy?: DbSpies

  beforeEach: () => void

  afterEach: () => void

  restore: () => void
}

export function createTestSetup(
  options: CreateTestSetupOptions = {},
): TestSetupResult {
  const {
    analytics = true,
    crypto = true,
    database = false,
    dbModule,
    analyticsModule,
    cryptoPrefix = 'test',
  } = options

  const logger = createMockLogger()
  let analyticsSpy: AnalyticsSpies | undefined
  let cryptoSpy: CryptoMockSpies | undefined
  let dbSpy: DbSpies | undefined

  const beforeEach = (): void => {
    resetToolCallIdCounter()

    if (analytics && analyticsModule) {
      analyticsSpy = setupAnalyticsMocks(analyticsModule)
    }

    if (crypto) {
      cryptoSpy = setupCryptoMocks({ prefix: cryptoPrefix, sequential: true })
    }

    if (database && dbModule) {
      dbSpy = setupDbSpies(dbModule)
    }
  }

  const afterEach = (): void => {
    analyticsSpy?.restore()
    cryptoSpy?.restore()
    dbSpy?.restore()

    analyticsSpy = undefined
    cryptoSpy = undefined
    dbSpy = undefined
  }

  const restore = afterEach

  return {
    logger,
    get analyticsSpy() {
      return analyticsSpy
    },
    get cryptoSpy() {
      return cryptoSpy
    },
    get dbSpy() {
      return dbSpy
    },
    beforeEach,
    afterEach,
    restore,
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 50,
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await sleep(interval)
  }

  throw new Error(`waitFor timed out after ${timeout}ms`)
}

export function captureCallArgs<T extends unknown[], R>(
  fn: (...args: T) => R,
): { fn: (...args: T) => R; calls: T[] } {
  const calls: T[] = []

  const wrappedFn = (...args: T): R => {
    calls.push(args)
    return fn(...args)
  }

  return { fn: wrappedFn, calls }
}
