import { spawn } from 'child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { TERMINAL_RESET_SEQUENCES } from '../utils/terminal-reset-sequences'
import { classifyTerminalWatchdogSpawnFailure } from '../utils/terminal-watchdog'
import { sanitizeWindowsCliVersion } from '../utils/windows-terminal-health'

import type { ChildProcess } from 'child_process'

const IS_WINDOWS = process.platform === 'win32'
const FIXTURE = join(import.meta.dir, 'helpers', 'terminal-watchdog-fixture.ts')
const tempDir = mkdtempSync(join(tmpdir(), 'terminal-watchdog-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

const READY_TIMEOUT_MS = IS_WINDOWS ? 60_000 : 15_000
const WRITE_TIMEOUT_MS = IS_WINDOWS ? 45_000 : 15_000
const DISARM_TIMEOUT_MS = 10_000
const DRAIN_TIMEOUT_MS = 2_000
const MAX_SETTLE_MS = 5_000
const SETUP_TIMEOUT_MS = IS_WINDOWS ? 150_000 : 60_000

type Scenario = {
  key: string
  mode: 'hang' | 'clean' | 'spawn-failure'
  env?: Record<string, string>
  kill: boolean
  expectWrite: boolean
}

const OPT_OUT_VALUES = ['1', 'true', 'TRUE']

const SCENARIOS: Scenario[] = [
  { key: 'unclean', mode: 'hang', kill: true, expectWrite: true },
  ...OPT_OUT_VALUES.map((value): Scenario => ({
    key: `optout-${value}`,
    mode: 'hang',
    env: { CODEBUFF_NO_TERMINAL_WATCHDOG: value },
    kill: true,
    expectWrite: false,
  })),
  {
    key: 'optout-noise',
    mode: 'hang',
    env: { CODEBUFF_NO_TERMINAL_WATCHDOG: '0' },
    kill: true,
    expectWrite: true,
  },
  { key: 'clean', mode: 'clean', kill: false, expectWrite: false },
  ...(IS_WINDOWS
    ? [
        {
          key: 'spawn-failure',
          mode: 'spawn-failure' as const,
          kill: false,
          expectWrite: false,
        },
      ]
    : []),
]

type Run = {
  scenario: Scenario
  child: ChildProcess
  pid: number | undefined
  ttyPath: string
  ready: boolean
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  content: string
  disarmFiles: string[]
  readyPromise: Promise<void>
  closePromise: Promise<void>
}

function readTty(ttyPath: string): string {
  try {
    return readFileSync(ttyPath, 'utf8')
  } catch {
    return ''
  }
}

function listTmp(): string[] {
  try {
    return readdirSync(tmpdir())
  } catch {
    return []
  }
}

function findDisarmFiles(pid: number | undefined, names = listTmp()): string[] {
  return names.filter((name) =>
    name.startsWith(`codebuff-watchdog-disarm-${pid}-`),
  )
}

async function waitUntil(
  condition: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return condition()
}

function startRun(scenario: Scenario, index: number): Run {
  const ttyPath = join(tempDir, `${index}-${scenario.key}.out`)
  const childEnv = { ...process.env }
  delete childEnv.CODEBUFF_NO_TERMINAL_WATCHDOG
  const child = spawn(process.execPath, [FIXTURE, scenario.mode, ttyPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...childEnv, ...scenario.env },
  })

  const run: Run = {
    scenario,
    child,
    pid: child.pid,
    ttyPath,
    ready: false,
    stderr: '',
    exitCode: null,
    signal: null,
    content: '',
    disarmFiles: [],
    readyPromise: Promise.resolve(),
    closePromise: Promise.resolve(),
  }

  child.stderr!.on('data', (chunk: Buffer) => {
    run.stderr += chunk.toString()
  })

  run.closePromise = new Promise<void>((resolve) => {
    child.on('exit', (code, signal) => {
      run.exitCode = code
      run.signal = signal
      const drain = setTimeout(resolve, DRAIN_TIMEOUT_MS)
      ;(drain as { unref?: () => void }).unref?.()
      child.on('close', () => {
        clearTimeout(drain)
        resolve()
      })
    })
    child.on('error', (error) => {
      run.stderr += `spawn error: ${error.message}\n`
      resolve()
    })
  })

  run.readyPromise = new Promise<void>((resolve) => {
    let out = ''
    const timer = setTimeout(resolve, READY_TIMEOUT_MS)
    ;(timer as { unref?: () => void }).unref?.()
    const finish = () => {
      clearTimeout(timer)
      resolve()
    }
    child.stdout!.on('data', (chunk: Buffer) => {
      out += chunk.toString()
      if (out.includes('ready')) {
        run.ready = true
        finish()
      }
    })
    run.closePromise.then(finish)
  })

  return run
}

function matchesExpectation(run: Run): boolean {
  if (run.scenario.expectWrite) return run.content === TERMINAL_RESET_SEQUENCES
  if (run.scenario.mode === 'spawn-failure') return run.content !== ''
  return run.content === '' && run.ready
}

function describeRun(run: Run): string {
  const content = run.content
  const shape =
    content === TERMINAL_RESET_SEQUENCES
      ? 'reset-sequences'
      : content === ''
        ? 'empty'
        : `${content.length} bytes: ${JSON.stringify(content.slice(0, 120))}`
  return [
    `  ${run.scenario.key}: ready=${run.ready} exit=${run.exitCode} signal=${run.signal}`,
    `    wrote: ${shape}`,
    `    disarm files: ${JSON.stringify(run.disarmFiles)}`,
    run.stderr.trim() ? `    stderr: ${run.stderr.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

let runs: Run[] = []
const runFor = (key: string): Run => {
  const run = runs.find((r) => r.scenario.key === key)
  if (!run) throw new Error(`no run recorded for scenario ${key}`)
  return run
}

describe('terminal watchdog', () => {
  test('bounds watchdog failure telemetry labels', () => {
    expect(
      classifyTerminalWatchdogSpawnFailure(
        Object.assign(new Error('private path'), { code: 'ENOENT' }),
      ),
    ).toBe('enoent')
    expect(
      classifyTerminalWatchdogSpawnFailure(new Error('private text')),
    ).toBe('unknown')
    expect(sanitizeWindowsCliVersion('0.0.142')).toBe('0.0.142')
    expect(sanitizeWindowsCliVersion('private/path')).toBe('unknown')
  })
})

describe('terminal watchdog (fixture processes)', () => {
  beforeAll(async () => {
    runs = SCENARIOS.map(startRun)
    await Promise.all(runs.map((run) => run.readyPromise))

    const killedAt = Date.now()
    for (const run of runs) {
      if (run.scenario.kill) run.child.kill('SIGKILL')
    }
    await Promise.all(runs.map((run) => run.closePromise))

    const writers = runs.filter((run) => run.scenario.expectWrite)
    if (writers.every((run) => run.ready)) {
      const wrote = await waitUntil(
        () =>
          writers.every(
            (run) => readTty(run.ttyPath) === TERMINAL_RESET_SEQUENCES,
          ),
        WRITE_TIMEOUT_MS,
      )
      if (wrote) {
        const settle = Math.min(
          Math.max(250, 2 * (Date.now() - killedAt)),
          MAX_SETTLE_MS,
        )
        await new Promise((r) => setTimeout(r, settle))
      }
    }
    await waitUntil(() => {
      const names = listTmp()
      return runs.every((run) => findDisarmFiles(run.pid, names).length === 0)
    }, DISARM_TIMEOUT_MS)

    const names = listTmp()
    for (const run of runs) {
      run.content = readTty(run.ttyPath)
      run.disarmFiles = findDisarmFiles(run.pid, names)
    }

    if (runs.some((run) => !matchesExpectation(run))) {
      console.error(
        `terminal watchdog fixtures did not behave as expected:\n${runs
          .map(describeRun)
          .join('\n')}`,
      )
    }
  }, SETUP_TIMEOUT_MS)

  test('writes reset sequences to the tty when the process dies uncleanly', () => {
    expect(runFor('unclean').ready).toBe(true)
    expect(runFor('unclean').content).toBe(TERMINAL_RESET_SEQUENCES)
  })

  test.each(OPT_OUT_VALUES)(
    'never arms when CODEBUFF_NO_TERMINAL_WATCHDOG=%s',
    (value) => {
      const run = runFor(`optout-${value}`)
      expect(run.ready).toBe(true)
      expect(run.content).toBe('')
      expect(run.disarmFiles).toEqual([])
    },
  )

  test('still arms when the opt-out is set to an unrelated value', () => {
    expect(runFor('optout-noise').ready).toBe(true)
    expect(runFor('optout-noise').content).toBe(TERMINAL_RESET_SEQUENCES)
  })

  test('stays silent when the process shuts down cleanly', () => {
    const run = runFor('clean')
    expect(run.exitCode).toBe(0)
    expect(run.content).toBe('')
    expect(run.disarmFiles).toEqual([])
  })

  test.skipIf(!IS_WINDOWS)(
    'reports a bounded failure when PowerShell cannot spawn',
    () => {
      const run = runFor('spawn-failure')
      expect(run.exitCode).toBe(0)
      expect(JSON.parse(run.content)).toEqual({
        stage: 'spawn',
        failureCode: 'enoent',
      })
      expect(run.disarmFiles).toEqual([])
    },
  )
})
