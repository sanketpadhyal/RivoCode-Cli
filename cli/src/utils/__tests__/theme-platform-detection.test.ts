import { afterEach, describe, expect, test } from 'bun:test'

import { ensureCliTestEnv } from '../../__tests__/test-utils'
import { detectPlatformTheme } from '../theme-system'

ensureCliTestEnv()

let originalPlatform: PropertyDescriptor | undefined
const originalSpawnSync = Bun.spawnSync
const originalWhich = Bun.which

function captureSpawns(stdout = ''): string[][] {
  const calls: string[][] = []
  ;(Bun as { which: unknown }).which = ((binary: string) =>
    binary) as typeof Bun.which
  ;(Bun as { spawnSync: unknown }).spawnSync = ((options: unknown) => {
    const cmd = (options as { cmd?: string[] })?.cmd ?? []
    calls.push(cmd)
    return { exitCode: 0, stdout, stderr: '' } as unknown
  }) as unknown as typeof Bun.spawnSync
  return calls
}

function setPlatform(platform: NodeJS.Platform) {
  originalPlatform ??= Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  })
}

afterEach(() => {
  ;(Bun as { spawnSync: unknown }).spawnSync = originalSpawnSync
  ;(Bun as { which: unknown }).which = originalWhich
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
    originalPlatform = undefined
  }
})

describe('detectPlatformTheme on windows', () => {
  test('starts no subprocess at all', () => {
    setPlatform('win32')
    const calls = captureSpawns()

    detectPlatformTheme()

    expect(calls).toEqual([])
  })

  test('falls back to dark', () => {
    setPlatform('win32')
    captureSpawns()

    expect(detectPlatformTheme()).toBe('dark')
  })
})

describe('detectPlatformTheme on other platforms', () => {
  test('still asks macOS for AppleInterfaceStyle', () => {
    setPlatform('darwin')
    const calls = captureSpawns('Dark')

    expect(detectPlatformTheme()).toBe('dark')
    expect(calls[0]).toEqual([
      'defaults',
      'read',
      '-g',
      'AppleInterfaceStyle',
    ])
  })

  test('treats a missing macOS AppleInterfaceStyle as light', () => {
    setPlatform('darwin')
    captureSpawns('')

    expect(detectPlatformTheme()).toBe('light')
  })

  test('still asks GNOME for its color-scheme', () => {
    setPlatform('linux')
    const calls = captureSpawns("'prefer-dark'")

    expect(detectPlatformTheme()).toBe('dark')
    expect(calls[0]).toEqual([
      'gsettings',
      'get',
      'org.gnome.desktop.interface',
      'color-scheme',
    ])
  })
})
