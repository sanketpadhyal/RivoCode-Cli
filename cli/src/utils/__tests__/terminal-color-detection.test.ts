import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  parseOSCResponse,
  calculateBrightness,
  themeFromBgColor,
  themeFromFgColor,
  terminalSupportsOSC,
  withTimeout,
  getGlobalOscTimeout,
  getQueryOscTimeout,
} from '../terminal-color-detection'

describe('parseOSCResponse', () => {
  test('parses 8-bit RGB response (2 hex digits)', () => {
    const response = '\x1b]11;rgb:ff/00/80\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 0, 128])
  })

  test('parses 16-bit RGB response (4 hex digits)', () => {
    const response = '\x1b]11;rgb:ffff/0000/8080\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 0, 128])
  })

  test('parses response with ST terminator', () => {
    const response = '\x1b]11;rgb:00/ff/00\x1b\\'
    const result = parseOSCResponse(response)
    expect(result).toEqual([0, 255, 0])
  })

  test('parses black background', () => {
    const response = '\x1b]11;rgb:0000/0000/0000\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([0, 0, 0])
  })

  test('parses white background', () => {
    const response = '\x1b]11;rgb:ffff/ffff/ffff\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 255, 255])
  })

  test('returns null for invalid response', () => {
    expect(parseOSCResponse('')).toBeNull()
    expect(parseOSCResponse('invalid')).toBeNull()
    expect(parseOSCResponse('rgb:')).toBeNull()
    expect(parseOSCResponse('rgb:ff/ff')).toBeNull()
  })

  test('parses response with extra content', () => {
    const response = 'prefix \x1b]11;rgb:12/34/56\x07 suffix'
    const result = parseOSCResponse(response)
    expect(result).toEqual([18, 52, 86])
  })

  test('handles case-insensitive hex values', () => {
    const response = '\x1b]11;rgb:Aa/Bb/Cc\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([170, 187, 204])
  })
})

describe('calculateBrightness', () => {
  test('calculates brightness for black', () => {
    expect(calculateBrightness([0, 0, 0])).toBe(0)
  })

  test('calculates brightness for white', () => {
    expect(calculateBrightness([255, 255, 255])).toBe(254)
  })

  test('calculates brightness for pure red', () => {
    expect(calculateBrightness([255, 0, 0])).toBe(54)
  })

  test('calculates brightness for pure green', () => {
    expect(calculateBrightness([0, 255, 0])).toBe(182)
  })

  test('calculates brightness for pure blue', () => {
    expect(calculateBrightness([0, 0, 255])).toBe(18)
  })

  test('calculates brightness for mid-gray', () => {
    const result = calculateBrightness([128, 128, 128])
    expect(result).toBeGreaterThan(125)
    expect(result).toBeLessThan(130)
  })

  test('green contributes most to brightness (ITU-R BT.709)', () => {
    const redBrightness = calculateBrightness([255, 0, 0])
    const greenBrightness = calculateBrightness([0, 255, 0])
    const blueBrightness = calculateBrightness([0, 0, 255])

    expect(greenBrightness).toBeGreaterThan(redBrightness)
    expect(greenBrightness).toBeGreaterThan(blueBrightness)
    expect(redBrightness).toBeGreaterThan(blueBrightness)
  })
})

describe('themeFromBgColor', () => {
  test('returns dark for black background', () => {
    expect(themeFromBgColor([0, 0, 0])).toBe('dark')
  })

  test('returns light for white background', () => {
    expect(themeFromBgColor([255, 255, 255])).toBe('light')
  })

  test('returns dark for dark gray', () => {
    expect(themeFromBgColor([50, 50, 50])).toBe('dark')
  })

  test('returns light for light gray', () => {
    expect(themeFromBgColor([200, 200, 200])).toBe('light')
  })

  test('threshold is at 128', () => {
    expect(themeFromBgColor([127, 127, 127])).toBe('dark')
    expect(themeFromBgColor([130, 130, 130])).toBe('light')
  })

  test('handles common dark themes', () => {
    expect(themeFromBgColor([30, 30, 30])).toBe('dark')
    expect(themeFromBgColor([40, 42, 54])).toBe('dark')
    expect(themeFromBgColor([40, 44, 52])).toBe('dark')
  })

  test('handles common light themes', () => {
    expect(themeFromBgColor([255, 255, 255])).toBe('light')
    expect(themeFromBgColor([253, 246, 227])).toBe('light')
  })
})

describe('themeFromFgColor', () => {
  test('returns dark for bright foreground (indicates dark background)', () => {
    expect(themeFromFgColor([255, 255, 255])).toBe('dark')
    expect(themeFromFgColor([200, 200, 200])).toBe('dark')
  })

  test('returns light for dark foreground (indicates light background)', () => {
    expect(themeFromFgColor([0, 0, 0])).toBe('light')
    expect(themeFromFgColor([50, 50, 50])).toBe('light')
  })

  test('inverts the logic from themeFromBgColor', () => {
    const colors: [number, number, number][] = [
      [0, 0, 0],
      [128, 128, 128],
      [255, 255, 255],
    ]

    for (const color of colors) {
      const bgResult = themeFromBgColor(color)
      const fgResult = themeFromFgColor(color)
      if (bgResult === 'dark') {
        expect(fgResult).toBe('light')
      } else {
        expect(fgResult).toBe('dark')
      }
    }
  })
})

describe('withTimeout', () => {
  test('returns promise result if it resolves before timeout', async () => {
    const fastPromise = Promise.resolve('success')
    const result = await withTimeout(fastPromise, 1000, 'timeout')
    expect(result).toBe('success')
  })

  test('returns timeout value if promise takes too long', async () => {
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 500)
    })
    const result = await withTimeout(slowPromise, 50, 'timeout')
    expect(result).toBe('timeout')
  })

  test('returns null timeout value', async () => {
    const slowPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => resolve('late'), 500)
    })
    const result = await withTimeout(slowPromise, 50, null)
    expect(result).toBeNull()
  })

  test('clears timeout after promise resolves', async () => {
    const fastPromise = Promise.resolve('success')
    await withTimeout(fastPromise, 10000, 'timeout')
  })

  test('handles rejected promises', async () => {
    const failingPromise = Promise.reject(new Error('test error'))
    await expect(withTimeout(failingPromise, 1000, 'timeout')).rejects.toThrow(
      'test error',
    )
  })

  test('handles immediate resolution', async () => {
    const result = await withTimeout(Promise.resolve(42), 0, -1)
    expect(result).toBe(42)
  })
})

describe('terminalSupportsOSC', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns true for iTerm.app', () => {
    process.env.TERM_PROGRAM = 'iTerm.app'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for Apple_Terminal', () => {
    process.env.TERM_PROGRAM = 'Apple_Terminal'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for vscode', () => {
    process.env.TERM_PROGRAM = 'vscode'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for kitty via TERM', () => {
    process.env.TERM_PROGRAM = ''
    process.env.TERM = 'xterm-kitty'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for xterm-256color', () => {
    process.env.TERM_PROGRAM = ''
    process.env.TERM = 'xterm-256color'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for alacritty via TERM', () => {
    process.env.TERM_PROGRAM = ''
    process.env.TERM = 'alacritty'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for WezTerm', () => {
    process.env.TERM_PROGRAM = 'WezTerm'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('returns true for Ghostty', () => {
    process.env.TERM_PROGRAM = 'Ghostty'
    expect(terminalSupportsOSC()).toBe(true)
  })

  test('checks for partial match in TERM_PROGRAM', () => {
    process.env.TERM_PROGRAM = 'something-vscode-something'
    expect(terminalSupportsOSC()).toBe(true)
  })
})

describe('timeout constants', () => {
  test('global timeout is reasonable', () => {
    const timeout = getGlobalOscTimeout()
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(5000)
  })

  test('query timeout is less than global timeout', () => {
    const queryTimeout = getQueryOscTimeout()
    const globalTimeout = getGlobalOscTimeout()
    expect(queryTimeout).toBeLessThan(globalTimeout)
  })

  test('query timeout is reasonable', () => {
    const timeout = getQueryOscTimeout()
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(2000)
  })
})

describe('theme detection edge cases', () => {
  test('correctly identifies solarized dark', () => {
    const rgb: [number, number, number] = [0, 43, 54]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies solarized light', () => {
    const rgb: [number, number, number] = [253, 246, 227]
    expect(themeFromBgColor(rgb)).toBe('light')
  })

  test('correctly identifies monokai background', () => {
    const rgb: [number, number, number] = [39, 40, 34]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies nord background', () => {
    const rgb: [number, number, number] = [46, 52, 64]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies github light background', () => {
    const rgb: [number, number, number] = [255, 255, 255]
    expect(themeFromBgColor(rgb)).toBe('light')
  })

  test('correctly identifies gruvbox dark', () => {
    const rgb: [number, number, number] = [40, 40, 40]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies gruvbox light', () => {
    const rgb: [number, number, number] = [251, 241, 199]
    expect(themeFromBgColor(rgb)).toBe('light')
  })
})

describe('OSC response format variations', () => {
  test('handles response from iTerm2', () => {
    const response = '\x1b]11;rgb:1c1c/1c1c/1e1e\x07'
    const result = parseOSCResponse(response)
    expect(result).not.toBeNull()
    expect(themeFromBgColor(result!)).toBe('dark')
  })

  test('handles response from Terminal.app', () => {
    const response = '\x1b]11;rgb:ffff/ffff/ffff\x1b\\'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 255, 255])
  })

  test('handles response from kitty', () => {
    const response = '\x1b]11;rgb:00/00/00\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([0, 0, 0])
  })

  test('handles response with extra escape sequences', () => {
    const response = '\x1b[?1;2c\x1b]11;rgb:28/2c/34\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([40, 44, 52])
    expect(themeFromBgColor(result!)).toBe('dark')
  })

  test('handles tmux passthrough response', () => {
    const response = '\x1bPtmux;\x1b\x1b]11;rgb:1e/1e/2e\x1b\x1b\\\x1b\\'
    const result = parseOSCResponse(response)
    expect(result).toEqual([30, 30, 46])
  })
})
