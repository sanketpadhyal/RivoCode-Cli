import {
  createPostHogClient,
  type AnalyticsClientWithIdentify,
  type PostHogClientOptions,
} from '@rivocode/common/analytics-core'
import {
  env as defaultEnv,
  IS_PROD as defaultIsProd,
  DEBUG_ANALYTICS,
} from '@rivocode/common/env'
import { shouldTrackAnalyticsEvent } from '@rivocode/common/util/analytics-sampling'
import { shouldMirrorAnalyticsEvent } from '@rivocode/common/util/log-mirror'

import { getOrCreatePersistentAnonymousId } from './anonymous-id'
import { enqueueClientLog as defaultEnqueueClientLog } from './log-shipper'

import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'

import type { LogRecordInput } from '@rivocode/common/schemas/logs'

export type { AnalyticsClientWithIdentify as AnalyticsClient } from '@rivocode/common/analytics-core'

export enum AnalyticsErrorStage {
  Init = 'init',
  Track = 'track',
  Identify = 'identify',
  Flush = 'flush',
  CaptureException = 'captureException',
}

type AnalyticsErrorContext = {
  stage: AnalyticsErrorStage
} & Record<string, unknown>

type AnalyticsErrorLogger = (
  error: unknown,
  context: AnalyticsErrorContext,
) => void

type ResolvedAnalyticsDeps = {
  env: AnalyticsDeps['env']
  isProd: boolean
  createClient: AnalyticsDeps['createClient']
  generateAnonymousId: NonNullable<AnalyticsDeps['generateAnonymousId']>
  enqueueClientLog: NonNullable<AnalyticsDeps['enqueueClientLog']>
}

export interface AnalyticsDeps {
  env: {
    NEXT_PUBLIC_POSTHOG_API_KEY?: string
    NEXT_PUBLIC_POSTHOG_HOST_URL?: string
  }
  isProd: boolean
  createClient: (
    apiKey: string,
    options: PostHogClientOptions,
  ) => AnalyticsClientWithIdentify
  generateAnonymousId?: () => string
  enqueueClientLog?: (record: LogRecordInput) => void
}

let anonymousId: string | undefined
let currentUserId: string | undefined
let client: AnalyticsClientWithIdentify | undefined
let initializationState: 'not_started' | 'ready' | 'failed' = 'not_started'

let injectedDeps: AnalyticsDeps | undefined

function resolveDeps(): ResolvedAnalyticsDeps {
  return {
    env: injectedDeps?.env ?? defaultEnv,
    isProd: injectedDeps?.isProd ?? defaultIsProd,
    createClient: injectedDeps?.createClient ?? createPostHogClient,
    generateAnonymousId:
      injectedDeps?.generateAnonymousId ?? getOrCreatePersistentAnonymousId,
    enqueueClientLog: injectedDeps?.enqueueClientLog ?? defaultEnqueueClientLog,
  }
}

let loggerModulePromise: Promise<{
  logger: { debug: (data: any, msg?: string, ...args: any[]) => void }
}> | null = null

const loadLogger = () => {
  if (!loggerModulePromise) {
    loggerModulePromise = import('./logger')
  }
  return loggerModulePromise
}

function logAnalyticsDebug(message: string, data: Record<string, unknown>) {
  if (!DEBUG_ANALYTICS) {
    return
  }
  loadLogger()
    .then(({ logger }) => {
      logger.debug(data, message)
    })
    .catch((error) => {
      try {
        console.debug(message, data)
      } catch {
      }
      console.debug('Failed to load logger for analytics:', error)
    })
}

function getDistinctId(): string | undefined {
  return currentUserId ?? anonymousId
}

export function resetAnalyticsState(deps?: AnalyticsDeps) {
  anonymousId = undefined
  currentUserId = undefined
  client = undefined
  initializationState = 'not_started'
  injectedDeps = deps
  identified = false
}

export let identified: boolean = false
let analyticsErrorLogger: AnalyticsErrorLogger | undefined

export function setAnalyticsErrorLogger(loggerFn: AnalyticsErrorLogger) {
  analyticsErrorLogger = loggerFn
}

function logAnalyticsError(error: unknown, context: AnalyticsErrorContext) {
  try {
    analyticsErrorLogger?.(error, context)
  } catch {
  }
}

export function initAnalytics() {
  const { env, isProd, createClient, generateAnonymousId } = resolveDeps()
  client = undefined

  if (!env.NEXT_PUBLIC_POSTHOG_API_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST_URL) {
    initializationState = 'failed'
    const error = new Error(
      'NEXT_PUBLIC_POSTHOG_API_KEY or NEXT_PUBLIC_POSTHOG_HOST_URL is not set',
    )
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Init,
      missingEnv: true,
    })
    throw error
  }

  anonymousId = generateAnonymousId()
  identified = false

  try {
    client = createClient(env.NEXT_PUBLIC_POSTHOG_API_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST_URL,
      enableExceptionAutocapture: isProd,
    })
    initializationState = 'ready'
  } catch (error) {
    initializationState = 'failed'
    logAnalyticsError(error, { stage: AnalyticsErrorStage.Init })
    throw error
  }
}

export async function flushAnalytics() {
  if (!client) {
    return
  }
  try {
    await client.flush()
  } catch (error) {
    logAnalyticsError(error, { stage: AnalyticsErrorStage.Flush })
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, any>,
): boolean {
  const { isProd, generateAnonymousId, enqueueClientLog } = resolveDeps()
  let distinctId = getDistinctId()

  if (!client) {
    if (initializationState === 'failed') {
      if (!distinctId) {
        try {
          anonymousId = generateAnonymousId()
          distinctId = anonymousId
        } catch {
          return false
        }
      }
    } else if (isProd) {
      const error = new Error('Analytics client not initialized')
      logAnalyticsError(error, {
        stage: AnalyticsErrorStage.Track,
        event,
        properties,
      })
      throw error
    } else {
      return false
    }
  }

  if (!distinctId) {
    return false
  }

  if (!isProd) {
    if (DEBUG_ANALYTICS) {
      logAnalyticsDebug(`[analytics] ${event}`, {
        event,
        properties,
        distinctId,
      })
    }
    return false
  }

  if (!shouldTrackAnalyticsEvent({ event, distinctId, properties })) {
    return false
  }

  if (client) {
    try {
      client.capture({
        distinctId,
        event,
        properties,
      })
    } catch (error) {
      logAnalyticsError(error, {
        stage: AnalyticsErrorStage.Track,
        event,
        properties,
      })
    }
  }

  if (shouldMirrorAnalyticsEvent(event)) {
    try {
      enqueueClientLog({
        level: 'info',
        event,
        message: event,
        client_session_id: anonymousId ?? currentUserId,
        data: properties,
      })
      return true
    } catch {
    }
  }
  return false
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!client) {
    if (initializationState === 'failed') {
      currentUserId = userId
      identified = true
      return
    }
    const error = new Error('Analytics client not initialized')
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Identify,
      properties,
    })
    throw error
  }

  const { isProd } = resolveDeps()
  const previousAnonymousId = anonymousId

  currentUserId = userId
  identified = true

  if (!isProd) {
    if (DEBUG_ANALYTICS) {
      logAnalyticsDebug('[analytics] user identified', {
        userId,
        previousAnonymousId,
        properties,
      })
    }
    return
  }

  try {
    if (previousAnonymousId) {
      client.alias({
        distinctId: userId,
        alias: previousAnonymousId,
      })
    }

    client.identify({
      distinctId: userId,
      properties,
    })
  } catch (error) {
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Identify,
      properties,
    })
  }
}

export function logError(
  error: any,
  userId?: string,
  properties?: Record<string, any>,
) {
  if (!client) {
    return
  }

  try {
    client.captureException(
      error,
      userId ?? currentUserId ?? 'unknown',
      properties,
    )
  } catch (postHogError) {
    logAnalyticsError(postHogError, {
      stage: AnalyticsErrorStage.CaptureException,
      properties,
    })
  }
}
