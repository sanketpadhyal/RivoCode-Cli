import { spawn } from 'child_process'
import { closeSync, existsSync, openSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'

import { TERMINAL_RESET_SEQUENCES } from './terminal-reset-sequences'
import { getCliEnv } from './env'
import { reportWindowsTerminalFailure } from './windows-terminal-health'

import type { ChildProcess } from 'child_process'

let watchdog: ChildProcess | null = null
let disarmFilePath: string | null = null
let armedFilePath: string | null = null
let armMonitor: ReturnType<typeof setTimeout> | null = null

const WINDOWS_ARM_TIMEOUT_MS = 10_000

export type TerminalWatchdogFailure = {
  stage: 'spawn' | 'bootstrap' | 'arming'
  failureCode:
    | 'enoent'
    | 'eacces'
    | 'eperm'
    | 'exit_nonzero'
    | 'terminated'
    | 'timeout'
    | 'unknown'
}

export function classifyTerminalWatchdogSpawnFailure(
  error: unknown,
): TerminalWatchdogFailure['failureCode'] {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as NodeJS.ErrnoException).code ?? '').toUpperCase()
      : ''
  if (code === 'ENOENT') return 'enoent'
  if (code === 'EACCES') return 'eacces'
  if (code === 'EPERM') return 'eperm'
  return 'unknown'
}

function reportTerminalWatchdogFailure(failure: TerminalWatchdogFailure): void {
  reportWindowsTerminalFailure(AnalyticsEvent.TERMINAL_WATCHDOG_FAILED, failure)
}

function clearArmMonitor(): void {
  if (armMonitor) clearTimeout(armMonitor)
  armMonitor = null
  if (armedFilePath) {
    try {
      rmSync(armedFilePath, { force: true })
    } catch {
    }
  }
  armedFilePath = null
}

export function getTerminalWatchdogDiagnostics() {
  const external = disarmFilePath !== null
  const childIsRunning = Boolean(
    watchdog?.pid && watchdog.exitCode === null && watchdog.signalCode === null,
  )
  return {
    armed: childIsRunning || external,
    external,
    pid: !external && childIsRunning ? watchdog?.pid : undefined,
  }
}

function printfPayload(): string {
  return TERMINAL_RESET_SEQUENCES.replace(/\x1b/g, '\\033')
}

function spawnPosixWatchdog(overrideFd: number | null): ChildProcess {
  const script = `cat >/dev/null 2>&1; printf '${printfPayload()}'`
  return spawn('/bin/sh', ['-c', script, 'terminal-reset-watchdog'], {
    detached: true,
    stdio: ['pipe', overrideFd ?? 'inherit', 'ignore'],
  })
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function spawnWindowsWatchdog(options: {
  ttyPath?: string
  disarmPath: string
  armedPath: string
  powershellPath?: string
}): ChildProcess {
  const payloadBytes = Array.from(
    Buffer.from(TERMINAL_RESET_SEQUENCES, 'ascii'),
  ).join(',')
  const writeResets = options.ttyPath
    ? `[System.IO.File]::WriteAllBytes(${psQuote(options.ttyPath)}, $b)`
    : '$s=[Console]::OpenStandardOutput(); $s.Write($b, 0, $b.Length); $s.Flush()'
  const armedMarker = `[System.IO.File]::WriteAllText(${psQuote(options.armedPath)}, 'armed'); `
  const watchdogScript =
    armedMarker +
    `try { Wait-Process -Id ${process.pid} -ErrorAction Stop } catch {}; ` +
    `if (Test-Path -LiteralPath ${psQuote(options.disarmPath)}) { ` +
    `Remove-Item -LiteralPath ${psQuote(options.disarmPath)} -Force -ErrorAction SilentlyContinue ` +
    `} else { ` +
    `$b=[byte[]](${payloadBytes}); ` +
    `${writeResets} }; ` +
    `Remove-Item -LiteralPath ${psQuote(options.armedPath)} -Force -ErrorAction SilentlyContinue`

  const powershell =
    options.powershellPath ??
    path.join(
      getCliEnv().SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    )

  const watchdogArgs = `-NoProfile -NonInteractive -Command "${watchdogScript}"`
  const bootstrapScript =
    `Start-Process -FilePath ${psQuote(powershell)} ` +
    `-ArgumentList ${psQuote(watchdogArgs)} -NoNewWindow`

  return spawn(
    powershell,
    ['-NoProfile', '-NonInteractive', '-Command', bootstrapScript],
    {
      stdio: ['ignore', 'ignore', 'ignore'],
    },
  )
}

const isTruthy = (value: string | undefined): boolean =>
  value === '1' || value?.toLowerCase() === 'true'

export function startTerminalWatchdog(options?: {
  ttyPath?: string
  reportFailure?: (failure: TerminalWatchdogFailure) => void
  windowsPowerShellPath?: string
}): void {
  if (watchdog) return
  const env = getCliEnv()
  if (isTruthy(env.CODEBUFF_NO_TERMINAL_WATCHDOG)) return
  if (!options?.ttyPath && !process.stdout.isTTY) return

  const reportFailure = options?.reportFailure ?? reportTerminalWatchdogFailure
  let overrideFd: number | null = null
  try {
    let child: ChildProcess
    if (process.platform === 'win32') {
      const disarmPath = path.join(
        os.tmpdir(),
        `codebuff-watchdog-disarm-${process.pid}-${Math.random().toString(36).slice(2)}`,
      )
      const armedPath = options?.ttyPath
        ? `${options.ttyPath}.armed`
        : `${disarmPath}.armed`
      child = spawnWindowsWatchdog({
        ttyPath: options?.ttyPath,
        disarmPath,
        armedPath,
        powershellPath: options?.windowsPowerShellPath,
      })
      disarmFilePath = disarmPath
      if (!options?.ttyPath) {
        armedFilePath = armedPath
      }
    } else {
      if (options?.ttyPath) {
        overrideFd = openSync(options.ttyPath, 'w')
      }
      child = spawnPosixWatchdog(overrideFd)
    }
    let failureReported = false
    const reportOnce = (failure: TerminalWatchdogFailure) => {
      if (failureReported) return
      failureReported = true
      reportFailure(failure)
    }
    const fail = (failure: TerminalWatchdogFailure) => {
      if (failureReported || watchdog !== child) return
      watchdog = null
      disarmFilePath = null
      clearArmMonitor()
      reportOnce(failure)
    }
    child.on('error', (error) => {
      fail({
        stage: 'spawn',
        failureCode: classifyTerminalWatchdogSpawnFailure(error),
      })
    })
    if (process.platform === 'win32') {
      child.on('exit', (code, signal) => {
        if (code === 0 || watchdog !== child) return
        fail({
          stage: 'bootstrap',
          failureCode: signal ? 'terminated' : 'exit_nonzero',
        })
      })
    }
    child.unref()
    child.stdin?.on('error', () => {})
    ;(child.stdin as { unref?: () => void } | null)?.unref?.()
    watchdog = child
    if (armedFilePath) {
      const expectedMarker = armedFilePath
      armMonitor = setTimeout(() => {
        if (watchdog !== child) return
        const armed = existsSync(expectedMarker)
        clearArmMonitor()
        if (!armed) {
          reportOnce({ stage: 'arming', failureCode: 'timeout' })
        }
      }, WINDOWS_ARM_TIMEOUT_MS)
      ;(armMonitor as { unref?: () => void }).unref?.()
    }
  } catch (error) {
    disarmFilePath = null
    clearArmMonitor()
    if (process.platform === 'win32') {
      reportFailure({
        stage: 'spawn',
        failureCode: classifyTerminalWatchdogSpawnFailure(error),
      })
    }
  } finally {
    if (overrideFd !== null) {
      try {
        closeSync(overrideFd)
      } catch {
      }
    }
  }
}

export function stopTerminalWatchdog(): void {
  const child = watchdog
  const disarm = disarmFilePath
  if (!child && !disarm) return
  watchdog = null
  disarmFilePath = null
  clearArmMonitor()
  if (disarm) {
    try {
      writeFileSync(disarm, '')
    } catch {
    }
  }
  if (child) {
    try {
      child.kill('SIGKILL')
    } catch {
    }
  }
}
