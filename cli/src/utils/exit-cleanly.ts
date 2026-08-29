import { flushAnalytics } from './analytics'
import { IS_FREEBUFF } from './constants'
import { stopEngagementTracking } from './engagement'
import { endFreebuffSessionBestEffort } from './freebuff-session-api'
import { drainClientLogs } from './log-shipper'
import { withTimeout } from './terminal-color-detection'

const EXIT_CLEANUP_TIMEOUT_MS = 1_000

type ExitCliDependencies = {
  isFreebuff: boolean
  cleanupLocal: () => void
  stopEngagementTracking: () => void
  flushAnalytics: () => Promise<void>
  drainClientLogs: () => Promise<void>
  endFreebuffSession: () => Promise<void>
  waitForRemoteCleanup: (tasks: Promise<void>[]) => Promise<void>
  exit: (code: number) => void
}

let localExitCleanup: (() => void) | undefined

export function registerExitCleanup(cleanup: () => void): void {
  localExitCleanup = cleanup
}

export function createExitCliCleanly(deps: ExitCliDependencies) {
  let exitPromise: Promise<void> | undefined

  return (exitCode = 0): Promise<void> => {
    if (exitPromise) return exitPromise

    exitPromise = Promise.resolve().then(async () => {
      try {
        deps.cleanupLocal()
      } catch {
      }
      if (deps.isFreebuff) {
        try {
          deps.stopEngagementTracking()
        } catch {}
      }

      const remoteTasks = [
        Promise.resolve().then(deps.flushAnalytics),
        Promise.resolve().then(deps.drainClientLogs),
      ]
      if (deps.isFreebuff) {
        remoteTasks.push(Promise.resolve().then(deps.endFreebuffSession))
      }

      try {
        await deps.waitForRemoteCleanup(remoteTasks)
      } finally {
        deps.exit(exitCode)
      }
    })

    return exitPromise
  }
}

export const exitCliCleanly = createExitCliCleanly({
  isFreebuff: IS_FREEBUFF,
  cleanupLocal: () => localExitCleanup?.(),
  stopEngagementTracking,
  flushAnalytics,
  drainClientLogs,
  endFreebuffSession: endFreebuffSessionBestEffort,
  waitForRemoteCleanup: async (tasks) => {
    await withTimeout(
      Promise.allSettled(tasks),
      EXIT_CLEANUP_TIMEOUT_MS,
      undefined,
    )
  },
  exit: (code) => process.exit(code),
})
