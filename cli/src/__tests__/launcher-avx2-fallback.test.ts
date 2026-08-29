import { execFileSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test'

import { ensureCliTestEnv } from './test-utils'

ensureCliTestEnv()

const { createLauncher } = require('../../release-core/launcher.js')

let tempConfigDir: string
let originalPlatform: PropertyDescriptor | undefined
let originalArch: PropertyDescriptor | undefined

function makeLauncher(
  platform: NodeJS.Platform = 'win32',
  arch: string = 'x64',
) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  })
  Object.defineProperty(process, 'arch', { value: arch, configurable: true })
  return createLauncher({ packageName: 'freebuff', configDir: tempConfigDir })
    .__testing
}

async function waitFor(done: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (!done()) {
    if (Date.now() > deadline) throw new Error('timed out waiting')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const launcher = { lines: [] as string[], exitCodes: [] as (number | undefined)[] }
let restoreLauncherCapture = () => {}

function captureLauncherOutput() {
  const original = {
    error: console.error,
    write: process.stderr.write.bind(process.stderr),
    exit: process.exit,
  }
  launcher.lines = []
  launcher.exitCodes = []
  console.error = (...args: unknown[]) => launcher.lines.push(args.join(' '))
  ;(process.stderr as { write: unknown }).write = () => true
  ;(process as { exit: unknown }).exit = (code?: number) => {
    launcher.exitCodes.push(code)
  }
  return () => {
    console.error = original.error
    ;(process.stderr as { write: unknown }).write = original.write
    ;(process as { exit: unknown }).exit = original.exit
  }
}

function baselineTarball(script: string) {
  const stageDir = mkdtempSync(join(tmpdir(), 'launcher-baseline-'))
  writeFileSync(join(stageDir, 'freebuff.exe'), `#!/bin/sh\n${script}\n`, {
    mode: 0o755,
  })
  const archive = join(stageDir, 'out.tar.gz')
  execFileSync('tar', ['-czf', archive, '-C', stageDir, 'freebuff.exe'])
  return readFileSync(archive)
}

let releaseTarball: Buffer | null = null
let releaseServer: ReturnType<typeof createServer>
let restoreReleaseEnv = () => {}

beforeAll(async () => {
  releaseServer = createServer((request, response) => {
    const wantsBaseline = request.url?.endsWith(
      'freebuff-win32-x64-baseline.tar.gz',
    )
    if (releaseTarball && wantsBaseline) {
      response.writeHead(200)
      response.end(releaseTarball)
    } else {
      response.writeHead(404)
      response.end('missing')
    }
  })
  await new Promise<void>((resolve) =>
    releaseServer.listen(0, '127.0.0.1', resolve),
  )
  const { port } = releaseServer.address() as AddressInfo
  const original = {
    app: process.env.NEXT_PUBLIC_CODEBUFF_APP_URL,
    noProxy: process.env.NO_PROXY,
  }
  process.env.NEXT_PUBLIC_CODEBUFF_APP_URL = `http://127.0.0.1:${port}`
  process.env.NO_PROXY = '127.0.0.1'
  restoreReleaseEnv = () => {
    if (original.app === undefined) {
      delete process.env.NEXT_PUBLIC_CODEBUFF_APP_URL
    } else {
      process.env.NEXT_PUBLIC_CODEBUFF_APP_URL = original.app
    }
    if (original.noProxy === undefined) delete process.env.NO_PROXY
    else process.env.NO_PROXY = original.noProxy
  }
})

afterAll(async () => {
  restoreReleaseEnv()
  await new Promise<void>((resolve) => releaseServer.close(() => resolve()))
})

beforeEach(() => {
  tempConfigDir = mkdtempSync(join(tmpdir(), 'launcher-avx2-'))
  originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  originalArch = Object.getOwnPropertyDescriptor(process, 'arch')
  releaseTarball = null
  restoreLauncherCapture = captureLauncherOutput()
})

afterEach(() => {
  restoreLauncherCapture()
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
  }
  if (originalArch) Object.defineProperty(process, 'arch', originalArch)
  rmSync(tempConfigDir, { recursive: true, force: true })
})

describe('windows AVX2 detection', () => {
  test('assumes AVX2 on a machine it knows nothing about', () => {
    const t = makeLauncher()
    expect(t.detectMachineHasAvx2()).toBe(true)
    expect(t.readCachedAvx2()).toBe(null)
  })

  test('picks the optimized target while the answer is unknown', () => {
    const t = makeLauncher()
    expect(t.getDefaultTargetKey()).toBe('win32-x64')
  })

  test('recording a failure flips the answer and persists it', () => {
    const t = makeLauncher()
    t.recordMachineLacksAvx2()

    expect(t.detectMachineHasAvx2()).toBe(false)
    expect(t.readCachedAvx2()).toBe(false)
    expect(JSON.parse(readFileSync(t.getCpuFeatureCachePath(), 'utf8'))).toEqual(
      { avx2: false },
    )
  })

  test('a recorded failure selects baseline up front on the NEXT launch', () => {
    const first = makeLauncher()
    first.recordMachineLacksAvx2()

    const second = makeLauncher()
    expect(second.detectMachineHasAvx2()).toBe(false)
    expect(second.getDefaultTargetKey()).toBe('win32-x64-baseline')
  })

  test('a corrupt cache file is ignored rather than throwing', () => {
    const t = makeLauncher()
    const cachePath = t.getCpuFeatureCachePath()
    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(cachePath, 'not json{')

    expect(t.readCachedAvx2()).toBe(null)
    expect(t.detectMachineHasAvx2()).toBe(true)
  })

  test('a cache file without an avx2 boolean is ignored', () => {
    const t = makeLauncher()
    const cachePath = t.getCpuFeatureCachePath()
    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(cachePath, JSON.stringify({ avx2: 'yes' }))

    expect(t.readCachedAvx2()).toBe(null)
    expect(t.detectMachineHasAvx2()).toBe(true)
  })

  test('a recorded failure outranks CPU inference on linux too', () => {
    const t = makeLauncher('linux')
    expect(t.detectMachineHasAvx2()).toBe(true)

    t.recordMachineLacksAvx2()
    expect(makeLauncher('linux').detectMachineHasAvx2()).toBe(false)
    expect(makeLauncher('linux').getDefaultTargetKey()).toBe(
      'linux-x64-baseline',
    )
  })

  test('a cached true does not send us to baseline', () => {
    const t = makeLauncher()
    const cachePath = t.getCpuFeatureCachePath()
    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(cachePath, JSON.stringify({ avx2: true }))

    expect(t.detectMachineHasAvx2()).toBe(true)
    expect(t.getDefaultTargetKey()).toBe('win32-x64')
  })
})

describe('recovery after a recorded failure', () => {
  function installBinary(t: ReturnType<typeof makeLauncher>, target: string) {
    writeFileSync(t.CONFIG.metadataPath, JSON.stringify({ version: '1.2.3', target }))
    writeFileSync(t.CONFIG.binaryPath, 'pretend binary')
  }

  test('the installed AVX2 binary stops counting as usable', () => {
    const first = makeLauncher()
    installBinary(first, 'win32-x64')
    expect(first.getCurrentVersion()).toBe('1.2.3')

    first.recordMachineLacksAvx2()

    const next = makeLauncher()
    expect(next.isTargetAllowedForThisMachine('win32-x64')).toBe(false)
    expect(next.getCurrentVersion()).toBe(null)
    expect(next.getDefaultTargetKey()).toBe('win32-x64-baseline')
  })

  test('an installed baseline binary keeps working after the record', () => {
    const first = makeLauncher()
    first.recordMachineLacksAvx2()
    installBinary(first, 'win32-x64-baseline')

    const next = makeLauncher()
    expect(next.isTargetAllowedForThisMachine('win32-x64-baseline')).toBe(true)
    expect(next.getCurrentVersion()).toBe('1.2.3')
  })
})

describe('illegal-instruction detection', () => {
  test('recognizes STATUS_ILLEGAL_INSTRUCTION on windows', () => {
    const t = makeLauncher()
    expect(t.isIllegalInstructionExit(0xc000001d, null)).toBe(true)
    expect(t.isIllegalInstructionExit(-1073741795, null)).toBe(true)
  })

  test('does not treat ordinary failures as an AVX2 problem', () => {
    const t = makeLauncher()
    expect(t.isIllegalInstructionExit(1, null)).toBe(false)
    expect(t.isIllegalInstructionExit(0, null)).toBe(false)
    expect(t.isIllegalInstructionExit(0xc0000005, null)).toBe(false)
    expect(t.isIllegalInstructionExit(0xc0000409, null)).toBe(false)
  })

  test('honors SIGILL on POSIX', () => {
    const t = makeLauncher('linux')
    expect(t.isIllegalInstructionExit(null, 'SIGILL')).toBe(true)
    expect(t.isIllegalInstructionExit(null, 'SIGTERM')).toBe(false)
  })

  test('does not read the windows status code on POSIX', () => {
    const t = makeLauncher('linux')
    expect(t.isIllegalInstructionExit(0xc000001d, null)).toBe(false)
  })
})
describe('windows startup-abort detection', () => {
  test('recognizes an immediate 0xC0000409 as a CPU-feature suspect', () => {
    const t = makeLauncher()
    expect(t.isStartupCpuFeatureCrash(0xc0000409, null, 40)).toBe(true)
    expect(t.isStartupCpuFeatureCrash(-1073740791, null, 40)).toBe(true)
  })

  test('a crash long after startup is an ordinary bug, not the CPU', () => {
    const t = makeLauncher()
    expect(t.isStartupCpuFeatureCrash(0xc0000409, null, 60_000)).toBe(false)
    expect(t.isStartupCpuFeatureCrash(0xc0000409, null, Infinity)).toBe(false)
  })

  test('other native crashes and signals are not this one', () => {
    const t = makeLauncher()
    expect(t.isStartupCpuFeatureCrash(0xc0000005, null, 40)).toBe(false)
    expect(t.isStartupCpuFeatureCrash(0xc000001d, null, 40)).toBe(false)
    expect(t.isStartupCpuFeatureCrash(1, null, 40)).toBe(false)
    expect(t.isStartupCpuFeatureCrash(0xc0000409, 'SIGTERM', 40)).toBe(false)
  })

  test('does not read the windows status code on POSIX', () => {
    const t = makeLauncher('linux')
    expect(t.isStartupCpuFeatureCrash(0xc0000409, null, 40)).toBe(false)
  })
})

describe('what the fallback persists', () => {
  function installBinary(t: ReturnType<typeof makeLauncher>, target: string) {
    writeFileSync(
      t.CONFIG.metadataPath,
      JSON.stringify({ version: '1.2.3', target }),
    )
    writeFileSync(t.CONFIG.binaryPath, 'pretend binary')
  }

  test('a confirmed illegal instruction records the CPU verdict', async () => {
    const t = makeLauncher()
    installBinary(t, 'win32-x64')

    expect(await t.tryFallbackToBaseline(0xc000001d, null, 40)).toBe(false)
    expect(t.readCachedAvx2()).toBe(false)
  })

  test('a merely suspected abort records nothing about the CPU', async () => {
    const t = makeLauncher()
    installBinary(t, 'win32-x64')

    expect(await t.tryFallbackToBaseline(0xc0000409, null, 40)).toBe(false)
    expect(t.readCachedAvx2()).toBe(null)
  })

  test('does not fight an explicitly chosen target', async () => {
    const t = makeLauncher()
    installBinary(t, 'win32-x64')
    process.env.FREEBUFF_BINARY_TARGET = 'win32-x64'
    try {
      expect(await t.tryFallbackToBaseline(0xc000001d, null, 40)).toBe(false)
      expect(t.readCachedAvx2()).toBe(null)
    } finally {
      delete process.env.FREEBUFF_BINARY_TARGET
    }
  })

  test('gives up instead of looping when baseline crashes too', async () => {
    const t = makeLauncher()
    installBinary(t, 'win32-x64-baseline')
    expect(await t.tryFallbackToBaseline(0xc0000409, null, 40)).toBe(false)
  })
})

describe('the crash report a windows user sees', () => {
  function installCrashingBinary(
    t: ReturnType<typeof makeLauncher>,
    target: string,
    script: string,
  ) {
    writeFileSync(t.CONFIG.binaryPath, `#!/bin/sh\n${script}\nexit 3\n`, {
      mode: 0o755,
    })
    writeFileSync(
      t.CONFIG.metadataPath,
      JSON.stringify({ version: '1.2.3', target }),
    )
  }

  async function crashWith(
    t: ReturnType<typeof makeLauncher>,
    code: number,
  ): Promise<void> {
    const child = t.spawnInstalledBinary()
    await new Promise((resolve) => child.once('close', resolve))
    await t.attachExitHandler(child)(code, null)
  }

  test('keeps the panic text and names the CPU', async () => {
    const t = makeLauncher()
    installCrashingBinary(
      t,
      'win32-x64-baseline',
      'echo "panic(main thread): attempt to use null value" >&2\n' +
        'echo "CPU lacks AVX support." >&2',
    )

    await crashWith(t, 0xc0000409)

    const output = launcher.lines.join('\n')
    expect(output).toContain('exited immediately (code 3221226505)')
    expect(output).toContain('aborted while starting up')
    expect(output).toContain('panic(main thread): attempt to use null value')
    expect(output).toContain('already the older-CPU (baseline) build')
    expect(launcher.exitCodes).toContain(0xc0000409)
  })

  test('points a standard-build machine at the baseline override', async () => {
    const t = makeLauncher()
    installCrashingBinary(t, 'win32-x64', 'true')
    t.recordMachineLacksAvx2()

    await crashWith(t, 0xc0000409)

    const output = launcher.lines.join('\n')
    expect(output).toContain('without AVX2 support')
    expect(output).toContain('FREEBUFF_BINARY_TARGET=win32-x64-baseline')
    expect(output).toContain('AVX2:     no (recorded crash)')
  })

  test('never claims AVX2 is present on a machine it never asked', async () => {
    const t = makeLauncher()
    installCrashingBinary(t, 'win32-x64', 'true')

    await crashWith(t, 0xc0000409)

    expect(launcher.lines.join('\n')).toContain(
      'AVX2:     not checked (assumed present)',
    )
  })

  test('a long-lived abort is reported as an ordinary crash', async () => {
    const t = makeLauncher()
    installCrashingBinary(t, 'win32-x64', 'true')

    const child = t.spawnInstalledBinary()
    await new Promise((resolve) => child.once('close', resolve))
    child.launch.msAlive = () => 60_000
    await t.attachExitHandler(child)(0xc0000409, null)

    const output = launcher.lines.join('\n')
    expect(output).toContain('crashed with an abort signal')
    expect(output).not.toContain('without AVX2 support')
    expect(output).not.toContain('FREEBUFF_BINARY_TARGET=')
  })

  test('never lets captured escapes undo the terminal reset', async () => {
    const t = makeLauncher()
    installCrashingBinary(
      t,
      'win32-x64-baseline',
      String.raw`printf "\033[?1049h\033[?1003h\033[31mpanic: boom\033[0m\r\n" >&2`,
    )

    await crashWith(t, 0xc0000409)

    const output = launcher.lines.join('\n')
    expect(output).toContain('panic: boom')
    expect(output).not.toContain('\x1b')
    expect(output).not.toContain('\r')
  })

  test('the drained wait settles without leaning on a timer', async () => {
    const t = makeLauncher()
    installCrashingBinary(t, 'win32-x64-baseline', 'echo late >&2')

    const child = t.spawnInstalledBinary()
    await new Promise((resolve) => child.once('close', resolve))

    const settled = await Promise.race([
      child.launch.drained().then(() => 'drained'),
      new Promise((resolve) => setImmediate(() => resolve('timer'))),
    ])
    expect(settled).toBe('drained')
  })

  test('keeps only the tail of a chatty binary', async () => {
    const t = makeLauncher()
    installCrashingBinary(
      t,
      'win32-x64-baseline',
      'i=0; while [ $i -lt 3000 ]; do echo "line $i" >&2; i=$((i+1)); done',
    )

    await crashWith(t, 0xc0000409)

    const output = launcher.lines.join('\n')
    expect(output).toContain('line 2999')
    expect(output).not.toContain('line 0\n')
    expect(output.length).toBeLessThan(12_000)
  })
})

describe('recovering from the reported crash', () => {
  test('0xC0000409 during startup lands the user on the baseline build', async () => {
    const t = makeLauncher()
    const ranMarker = join(tempConfigDir, 'baseline-ran')
    releaseTarball = baselineTarball(`echo ran > ${ranMarker}`)

    writeFileSync(t.CONFIG.binaryPath, '#!/bin/sh\nexit 3\n', { mode: 0o755 })
    writeFileSync(
      t.CONFIG.metadataPath,
      JSON.stringify({ version: '1.2.3', target: 'win32-x64' }),
    )

    const child = t.spawnInstalledBinary()
    await new Promise((resolve) => child.once('close', resolve))
    await t.attachExitHandler(child)(0xc0000409, null)
    await waitFor(() => launcher.exitCodes.length > 0)

    expect(launcher.exitCodes).not.toContain(0xc0000409)
    expect(
      JSON.parse(readFileSync(t.CONFIG.metadataPath, 'utf8')),
    ).toMatchObject({ target: 'win32-x64-baseline' })
    expect(existsSync(ranMarker)).toBe(true)
    expect(t.readCachedAvx2()).toBe(null)
    const next = makeLauncher()
    expect(next.isTargetAllowedForThisMachine('win32-x64-baseline')).toBe(true)
    expect(next.getCurrentVersion()).toBe('1.2.3')
  }, 20000)
})

describe('the background update check', () => {
  test('stands down when the process it watches is already gone', async () => {
    const t = makeLauncher()
    const settled = await Promise.race([
      t
        .checkForUpdates({ exitCode: 3, signalCode: null })
        .then(() => 'stood down'),
      new Promise((resolve) => setImmediate(() => resolve('kept going'))),
    ])
    expect(settled).toBe('stood down')
  })
})
