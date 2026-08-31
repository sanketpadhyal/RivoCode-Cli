import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'

import { getCliEnv } from './env'

import type { LogRecordInput } from '@rivocode/common/schemas/logs'

type WindowsTerminalFailureEvent =
  | AnalyticsEvent.TERMINAL_BROKER_SPAWN_FAILED
  | AnalyticsEvent.TERMINAL_WATCHDOG_FAILED

export type WindowsTerminalFailure = {
  stage: 'spawn' | 'stdio' | 'completion' | 'bootstrap' | 'arming'
  failureCode:
    | 'failed_to_connect'
    | 'enoent'
    | 'eacces'
    | 'eperm'
    | 'epipe'
    | 'invalid_response'
    | 'protocol_missing'
    | 'response_too_large'
    | 'exit_nonzero'
    | 'terminated'
    | 'timeout'
    | 'unknown'
}

type WindowsTerminalFailureProperties = WindowsTerminalFailure & {
  version: string
  platform: 'win32'
}

export type WindowsTerminalHealthDeliveryDeps = {
  trackEvent?: (
    event: WindowsTerminalFailureEvent,
    properties: WindowsTerminalFailureProperties,
  ) => boolean | void
  getAnonymousId: () => string
  enqueueClientLog: (record: LogRecordInput) => void
  drainClientLogs: () => Promise<void>
}

export function sanitizeWindowsCliVersion(version: string): string {
  return /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,31}$/.test(version)
    ? version
    : 'unknown'
}

export async function deliverWindowsTerminalFailure(
  event: WindowsTerminalFailureEvent,
  properties: WindowsTerminalFailureProperties,
  deps: WindowsTerminalHealthDeliveryDeps,
): Promise<void> {
  let queuedByAnalytics = false
  if (deps.trackEvent) {
    try {
      queuedByAnalytics = deps.trackEvent(event, properties) !== false
    } catch {
    }
  }

  if (!queuedByAnalytics) {
    try {
      deps.enqueueClientLog({
        level: 'info',
        event,
        message: event,
        client_session_id: deps.getAnonymousId(),
        data: properties,
      })
    } catch {
    }
  }

  try {
    await deps.drainClientLogs()
  } catch {
  }
}

export function reportWindowsTerminalFailure(
  event: WindowsTerminalFailureEvent,
  failure: WindowsTerminalFailure,
): void {
  if (process.platform !== 'win32') return
  const env = getCliEnv()

  const properties: WindowsTerminalFailureProperties = {
    version: sanitizeWindowsCliVersion(env.CODEBUFF_CLI_VERSION ?? ''),
    platform: 'win32',
    stage: failure.stage,
    failureCode: failure.failureCode,
  }

  void Promise.all([
    import('./analytics').catch(() => null),
    import('./anonymous-id'),
    import('./log-shipper'),
  ])
    .then(([analytics, { getOrCreatePersistentAnonymousId }, logShipper]) => {
      return deliverWindowsTerminalFailure(event, properties, {
        trackEvent: analytics?.trackEvent,
        getAnonymousId: getOrCreatePersistentAnonymousId,
        enqueueClientLog: logShipper.enqueueClientLog,
        drainClientLogs: logShipper.drainClientLogs,
      })
    })
    .catch(() => {
    })
}
