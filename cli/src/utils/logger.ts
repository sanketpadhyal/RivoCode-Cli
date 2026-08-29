import { appendFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import path, { dirname } from 'path'
import { format as stringFormat } from 'util'

import { env, IS_DEV, IS_TEST, IS_CI } from '@codebuff/common/env'
import { createAnalyticsDispatcher } from '@codebuff/common/util/analytics-dispatcher'
import { getAnalyticsEventId } from '@codebuff/common/util/analytics-log'
import { getAxiomOnlyLogEvent } from '@codebuff/common/util/axiom-only-log'
import {
  isFullTelemetryEnabled,
  summarizeAnalyticsValue,
} from '@codebuff/common/util/analytics-sampling'
import { pino } from 'pino'

import {
  flushAnalytics,
  logError,
  setAnalyticsErrorLogger,
  trackEvent,
} from './analytics'
import { enqueueClientLog } from './log-shipper'
import { getCurrentChatDir, getProjectRoot } from '../project-files'

import type { LogRecordInput } from '@codebuff/common/schemas/logs'

export const CHAT_LOG_FILENAME = 'log.jsonl'

export interface LoggerContext {
  userId?: string
  userEmail?: string
  clientSessionId?: string
  fingerprintId?: string
  clientRequestId?: string
  [key: string]: any
}

export const loggerContext: LoggerContext = {}

let logPath: string | undefined = undefined
let pinoLogger: any = undefined

const loggingLevels = ['info', 'debug', 'warn', 'error', 'fatal'] as const
type LogLevel = (typeof loggingLevels)[number]
const analyticsDispatcher = createAnalyticsDispatcher({
  envName: env.NEXT_PUBLIC_CB_ENVIRONMENT,
  bufferWhenNoUser: true,
})

function safeStringify(obj: unknown): string {
  const seen = new WeakSet()
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}

function isEmptyObject(value: any): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
}

function setLogPath(p: string): void {
  if (p === logPath) return

  logPath = p
  mkdirSync(dirname(p), { recursive: true })

  const fileStream = pino.destination({
    dest: p,
    mkdir: true,
    sync: true,
  })

  pinoLogger = pino(
    {
      level: 'debug',
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
    fileStream,
  )
}

export function clearLogFile(): void {
  const projectRoot = getProjectRoot()
  const debugDir = path.join(projectRoot, 'debug')
  const targets = new Set<string>()

  if (logPath) {
    targets.add(logPath)
  }
  targets.add(path.join(debugDir, 'cli.jsonl'))
  targets.add(path.join(debugDir, 'trace.jsonl'))

  for (const target of targets) {
    try {
      if (existsSync(target)) {
        unlinkSync(target)
      }
    } catch {
    }
  }

  logPath = undefined
  pinoLogger = undefined
}

function sendAnalyticsAndLog(
  level: LogLevel,
  data: any,
  msg?: string,
  ...args: any[]
): void {
  if (!IS_CI && !IS_TEST) {
    let projectRoot: string | undefined
    try {
      projectRoot = getProjectRoot()
    } catch {
      projectRoot = undefined
    }
    if (projectRoot) {
      const logTarget =
        IS_DEV
          ? path.join(projectRoot, 'debug', 'cli.jsonl')
          : path.join(getCurrentChatDir(), CHAT_LOG_FILENAME)

      setLogPath(logTarget)
    }
  }

  const isStringOnly = typeof data === 'string' && msg === undefined
  const normalizedData = isStringOnly ? undefined : data
  const normalizedMsg = isStringOnly ? (data as string) : msg
  const includeData = normalizedData != null && !isEmptyObject(normalizedData)
  const axiomOnlyLogEvent = getAxiomOnlyLogEvent(normalizedData)

  const toTrack = {
    ...(includeData ? { data: normalizedData } : {}),
    level,
    loggerContext,
    msg: stringFormat(normalizedMsg, ...args),
  }

  logAsErrorIfNeeded(toTrack)

  if (!IS_DEV && includeData && typeof normalizedData === 'object') {
    const analyticsPayloads = analyticsDispatcher.process({
      data: normalizedData,
      level,
      msg: stringFormat(normalizedMsg ?? '', ...args),
      fallbackUserId: loggerContext.userId,
    })

    analyticsPayloads.forEach((payload) => {
      trackEvent(payload.event, payload.properties)
    })
  }

  if (
    !IS_DEV &&
    !IS_TEST &&
    !IS_CI &&
    loggerContext.userId &&
    level !== 'debug'
  ) {
    const analyticsEventId =
      includeData && typeof normalizedData === 'object'
        ? getAnalyticsEventId(normalizedData)
        : null
    const includeRawData =
      isFullTelemetryEnabled({
        distinctId: loggerContext.userId,
        properties: loggerContext,
      }) ||
      level === 'error' ||
      level === 'fatal'
    const shipData = axiomOnlyLogEvent
      ? axiomOnlyLogEvent.data
      : includeData
        ? includeRawData
          ? normalizedData
          : summarizeAnalyticsValue(normalizedData)
        : undefined
    const record: LogRecordInput = {
      timestamp: new Date().toISOString(),
      level,
      event:
        axiomOnlyLogEvent?.event ??
        (analyticsEventId ? String(analyticsEventId) : undefined),
      message: stringFormat(normalizedMsg ?? '', ...args),
      client_session_id:
        (axiomOnlyLogEvent?.data.client_session_id as string | undefined) ??
        loggerContext.clientSessionId,
      client_request_id:
        (axiomOnlyLogEvent?.data.client_request_id as string | undefined) ??
        loggerContext.clientRequestId,
      fingerprint_id: loggerContext.fingerprintId,
      data: shipData,
    }
    enqueueClientLog(record)
  }

  if (IS_DEV && logPath) {
    const logEntry = safeStringify({
      level: level.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...loggerContext,
      ...(includeData ? { data: normalizedData } : {}),
      msg: stringFormat(normalizedMsg ?? '', ...args),
    })
    try {
      appendFileSync(logPath, logEntry + '\n')
    } catch {
    }
  } else if (pinoLogger !== undefined) {
    const base = { ...loggerContext }
    const obj = includeData ? { ...base, data: normalizedData } : base
    pinoLogger[level](obj, normalizedMsg as any, ...args)
  }
}

function logAsErrorIfNeeded(toTrack: {
  data?: any
  level: LogLevel
  loggerContext: LoggerContext
  msg: string
}) {
  if (toTrack.level === 'error' || toTrack.level === 'fatal') {
    logError(
      new Error(toTrack.msg),
      toTrack.loggerContext.userId ?? 'unknown',
      { ...(toTrack.data ?? {}), context: toTrack.loggerContext },
    )
    flushAnalytics()
  }
}

export const logger: Record<LogLevel, pino.LogFn> = Object.fromEntries(
  loggingLevels.map((level) => {
    return [
      level,
      (data: any, msg?: string, ...args: any[]) =>
        sendAnalyticsAndLog(level, data, msg, ...args),
    ]
  }),
) as Record<LogLevel, pino.LogFn>

setAnalyticsErrorLogger((error, context) => {
  const err =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown analytics error')

  logger.warn(
    {
      analyticsError: true,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      context,
    },
    '[analytics] error',
  )
})
