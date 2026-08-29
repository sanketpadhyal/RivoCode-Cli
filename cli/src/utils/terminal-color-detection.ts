
import { openSync, closeSync, writeSync, constants } from 'fs'

import { getCliEnv } from './env'

import type { CliEnv } from '../types/env'

const OSC_QUERY_TIMEOUT_MS = 500
const GLOBAL_OSC_TIMEOUT_MS = 2000

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutValue: T,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(timeoutValue)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

export function terminalSupportsOSC(
  env: CliEnv = getCliEnv(),
): boolean {
  const term = env.TERM || ''
  const termProgram = env.TERM_PROGRAM || ''

  const supportedPrograms = [
    'iTerm.app',
    'Apple_Terminal',
    'WezTerm',
    'Alacritty',
    'kitty',
    'Ghostty',
    'vscode',
  ]

  if (supportedPrograms.some((p) => termProgram.includes(p))) {
    return true
  }

  const supportedTerms = [
    'xterm-256color',
    'xterm-kitty',
    'alacritty',
    'wezterm',
    'ghostty',
  ]

  if (supportedTerms.some((t) => term.includes(t))) {
    return true
  }

  return process.stdin.isTTY === true
}

function buildOscQuery(oscCode: number): string {
  return `\x1b]${oscCode};?\x07`
}

async function sendOscQuery(
  ttyPath: string,
  query: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null)
      return
    }

    let ttyWriteFd: number | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false
    let response = ''
    let wasRawMode = false
    let dataHandler: ((data: Buffer) => void) | null = null

    const cleanup = () => {
      if (resolved) return
      resolved = true

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (dataHandler) {
        process.stdin.removeListener('data', dataHandler)
        dataHandler = null
      }

      if (process.stdin.isTTY && process.stdin.setRawMode) {
        try {
          process.stdin.setRawMode(wasRawMode)
        } catch {
        }
      }

      try {
        process.stdin.pause()
      } catch {
      }

      if (ttyWriteFd !== null) {
        try {
          closeSync(ttyWriteFd)
        } catch {
        }
        ttyWriteFd = null
      }
    }

    const resolveWith = (value: string | null) => {
      if (resolved) return
      cleanup()
      resolve(value)
    }

    try {
      try {
        ttyWriteFd = openSync(ttyPath, constants.O_WRONLY)
      } catch {
        resolveWith(null)
        return
      }

      wasRawMode = process.stdin.isRaw ?? false
      if (process.stdin.setRawMode) {
        try {
          process.stdin.setRawMode(true)
        } catch {
        }
      }

      timeoutId = setTimeout(() => {
        resolveWith(response.length > 0 ? response : null)
      }, OSC_QUERY_TIMEOUT_MS)

      dataHandler = (data: Buffer) => {
        if (resolved) return

        const chunk = data.toString('utf8')
        response += chunk

        const hasBEL = response.includes('\x07')
        const hasST = response.includes('\x1b\\')
        const hasRGB =
          /rgb:[0-9a-fA-F]{2,4}\/[0-9a-fA-F]{2,4}\/[0-9a-fA-F]{2,4}/.test(
            response,
          )

        if (hasRGB && (hasBEL || hasST || response.length > 30)) {
          resolveWith(response)
        }
      }

      process.stdin.on('data', dataHandler)
      process.stdin.resume()

      try {
        writeSync(ttyWriteFd, query)
      } catch {
        resolveWith(null)
        return
      }
    } catch {
      resolveWith(null)
    }
  })
}

export async function queryTerminalOSC(
  oscCode: number,
): Promise<string | null> {
  const ttyPath = process.platform === 'win32' ? 'CON' : '/dev/tty'
  const query = buildOscQuery(oscCode)
  return sendOscQuery(ttyPath, query)
}

export function parseOSCResponse(
  response: string,
): [number, number, number] | null {
  const match = response.match(
    /rgb:([0-9a-fA-F]{2,4})\/([0-9a-fA-F]{2,4})\/([0-9a-fA-F]{2,4})/,
  )

  if (!match) return null

  const [, rHex, gHex, bHex] = match
  if (!rHex || !gHex || !bHex) return null

  let r = parseInt(rHex, 16)
  let g = parseInt(gHex, 16)
  let b = parseInt(bHex, 16)

  if (rHex.length === 4) {
    r = Math.floor(r / 257)
    g = Math.floor(g / 257)
    b = Math.floor(b / 257)
  }

  return [r, g, b]
}

const XTERM_COLOR_STEPS = [0, 95, 135, 175, 215, 255]
const ANSI_16_COLORS: [number, number, number][] = [
  [0, 0, 0],
  [205, 0, 0],
  [0, 205, 0],
  [205, 205, 0],
  [0, 0, 238],
  [205, 0, 205],
  [0, 205, 205],
  [229, 229, 229],
  [127, 127, 127],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [92, 92, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
]

function xtermColorToRGB(index: number): [number, number, number] | null {
  if (!Number.isFinite(index) || index < 0) {
    return null
  }

  if (index < ANSI_16_COLORS.length) {
    return ANSI_16_COLORS[index]
  }

  if (index >= 16 && index <= 231) {
    const base = index - 16
    const r = Math.floor(base / 36)
    const g = Math.floor((base % 36) / 6)
    const b = base % 6
    return [
      XTERM_COLOR_STEPS[r] ?? 0,
      XTERM_COLOR_STEPS[g] ?? 0,
      XTERM_COLOR_STEPS[b] ?? 0,
    ]
  }

  if (index >= 232 && index <= 255) {
    const level = 8 + (index - 232) * 10
    return [level, level, level]
  }

  return null
}

function detectBgColorFromEnv(
  env: CliEnv = getCliEnv(),
): [number, number, number] | null {
  const termBackground = env.TERM_BACKGROUND?.toLowerCase()
  if (termBackground === 'dark') {
    return [0, 0, 0]
  }
  if (termBackground === 'light') {
    return [255, 255, 255]
  }

  const colorFgBg = env.COLORFGBG
  if (!colorFgBg) return null

  const parts = colorFgBg
    .split(';')
    .map((part) => parseInt(part, 10))
    .filter((value) => Number.isFinite(value))

  if (parts.length === 0) {
    return null
  }

  const bgIndex = parts[parts.length - 1]
  return xtermColorToRGB(bgIndex)
}

export function calculateBrightness([r, g, b]: [
  number,
  number,
  number,
]): number {
  const LUMINANCE_RED = 0.2126
  const LUMINANCE_GREEN = 0.7152
  const LUMINANCE_BLUE = 0.0722

  return Math.floor(
    LUMINANCE_RED * r + LUMINANCE_GREEN * g + LUMINANCE_BLUE * b,
  )
}

export function themeFromBgColor(
  rgb: [number, number, number],
): 'dark' | 'light' {
  const brightness = calculateBrightness(rgb)
  const THRESHOLD = 128

  return brightness > THRESHOLD ? 'light' : 'dark'
}

export function themeFromFgColor(
  rgb: [number, number, number],
): 'dark' | 'light' {
  const brightness = calculateBrightness(rgb)
  return brightness > 128 ? 'dark' : 'light'
}

async function detectTerminalThemeCore(
  env: CliEnv = getCliEnv(),
): Promise<'dark' | 'light' | null> {
  if (!terminalSupportsOSC(env)) {
    return null
  }

  const bgResponse = await queryTerminalOSC(11)
  if (bgResponse) {
    const bgRgb = parseOSCResponse(bgResponse)
    if (bgRgb) {
      return themeFromBgColor(bgRgb)
    }
  }

  const fgResponse = await queryTerminalOSC(10)
  if (fgResponse) {
    const fgRgb = parseOSCResponse(fgResponse)
    if (fgRgb) {
      return themeFromFgColor(fgRgb)
    }
  }

  const envBgRgb = detectBgColorFromEnv(env)
  if (envBgRgb) {
    return themeFromBgColor(envBgRgb)
  }

  return null
}

export async function detectTerminalTheme(): Promise<'dark' | 'light' | null> {
  try {
    return await withTimeout(
      detectTerminalThemeCore(),
      GLOBAL_OSC_TIMEOUT_MS,
      null,
    )
  } catch {
    return null
  }
}

export function getGlobalOscTimeout(): number {
  return GLOBAL_OSC_TIMEOUT_MS
}

export function getQueryOscTimeout(): number {
  return OSC_QUERY_TIMEOUT_MS
}
