import { execFile } from 'child_process'

import { resetTerminalTitle } from './terminal-title'
import { stopActiveRun } from './active-run'
import { getCliEnv } from './env'
import { exitCliCleanly, registerExitCleanup } from './exit-cleanly'
import { flushLiveChatState } from './run-state-storage'
import { reportFatalErrorSync, writeTerminalControlSync } from './terminal-io'
import { TERMINAL_RESET_SEQUENCES } from './terminal-reset-sequences'
import { stopTerminalWatchdog } from './terminal-watchdog'

import type { CliRenderer } from '@opentui/core'

let renderer: CliRenderer | null = null
let handlersInstalled = false
let cleanupStarted = false

function isProcessRunning(pid: number, onResult: (running: boolean) => void) {
  if (process.platform === 'win32') {
    execFile(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          onResult(true)
          return
        }
        onResult(new RegExp(`(?:^|\\D)${pid}(?:\\D|$)`).test(stdout))
      },
    )
    return
  }

  try {
    process.kill(pid, 0)
    onResult(true)
  } catch (error) {
    onResult((error as NodeJS.ErrnoException).code === 'EPERM')
  }
}

function resetTerminalState(): boolean {
  try {
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(false)
    }
  } catch {
  }
  try {
    resetTerminalTitle()
    if (!process.stdout.isTTY) return true

    const resetCompletedSynchronously = writeTerminalControlSync(
      TERMINAL_RESET_SEQUENCES,
    )
    if (!resetCompletedSynchronously) {
      process.stdout.write(TERMINAL_RESET_SEQUENCES)
    }
    return resetCompletedSynchronously
  } catch {
    return false
  }
}

function destroyRendererAndResetTerminal(): boolean {
  const activeRenderer = renderer
  renderer = null
  try {
    if (!activeRenderer || activeRenderer.isDestroyed) {
      return resetTerminalState()
    }

    let destroyReturned = false
    let destroyFinalized = false
    activeRenderer.once('destroy', () => {
      destroyFinalized = true
      if (destroyReturned) {
        queueMicrotask(resetTerminalState)
      }
    })

    activeRenderer.destroy()
    destroyReturned = true
    return destroyFinalized ? resetTerminalState() : false
  } catch {
    return resetTerminalState()
  }
}

function cleanup(): boolean {
  if (cleanupStarted) {
    return resetTerminalState()
  }
  cleanupStarted = true

  try {
    stopActiveRun('process-exit')
  } catch {
  }

  try {
    flushLiveChatState()
  } catch {
  }

  return destroyRendererAndResetTerminal()
}

export function exitCliWithFatalError(label: string, error: unknown): never {
  const resetCompletedSynchronously = cleanup() || resetTerminalState()
  if (resetCompletedSynchronously) {
    stopTerminalWatchdog()
  }
  reportFatalErrorSync(label, error)
  process.exit(1)
}

export function installProcessCleanupHandlers(cliRenderer: CliRenderer): void {
  if (handlersInstalled) return
  handlersInstalled = true
  renderer = cliRenderer
  registerExitCleanup(cleanup)

  const handleExitRequest = () => {
    void exitCliCleanly()
  }

  const launcherPid = Number(getCliEnv().CODEBUFF_LAUNCHER_PID)
  if (
    Number.isInteger(launcherPid) &&
    launcherPid > 0 &&
    launcherPid !== process.pid
  ) {
    let launcherCheckInFlight = false
    const launcherMonitor = setInterval(() => {
      if (launcherCheckInFlight) return
      launcherCheckInFlight = true
      isProcessRunning(launcherPid, (running) => {
        launcherCheckInFlight = false
        if (running) return
        clearInterval(launcherMonitor)
        handleExitRequest()
      })
    }, 500)
    launcherMonitor.unref()
  }

  process.on('SIGTERM', handleExitRequest)

  process.on('SIGHUP', handleExitRequest)

  process.on('SIGINT', handleExitRequest)

  process.on('beforeExit', () => {
    cleanup()
  })

  process.on('exit', () => {
    if (cleanup()) {
      stopTerminalWatchdog()
    }
  })

  process.on('uncaughtException', (error) => {
    exitCliWithFatalError('Uncaught exception', error)
  })

  process.on('unhandledRejection', (reason) => {
    exitCliWithFatalError('Unhandled rejection', reason)
  })
}
