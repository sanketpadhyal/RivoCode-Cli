import { describe, expect, test } from 'bun:test'

import {
  DEEPSEEK_EXPENSIVE_WINDOW_UTC,
  deepSeekExpensiveWindowEndsAt,
  deepseekPricingWindow,
  formatDeepSeekExpensiveWindowLocal,
  formatDeepSeekExpensiveWindowReturn,
  formatDeepSeekOffPeakWindowLocal,
  isDeepSeekExpensiveWindow,
} from '../constants/freebuff-peak-hours'

const at = (hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 7, 20, hour, minute))

describe('the peak windows', () => {
  test.each([
    [0, 'off-peak'],
    [1, 'peak'],
    [3, 'peak'],
    [4, 'off-peak'],
    [5, 'off-peak'],
    [6, 'peak'],
    [9, 'peak'],
    [10, 'off-peak'],
    [23, 'off-peak'],
  ])('%i:00 UTC is %s', (hour, window) => {
    expect(deepseekPricingWindow(at(hour as number))).toBe(window as any)
  })

  test('treats boundaries as half-open, so the closing hour is already off-peak', () => {
    expect(deepseekPricingWindow(at(3, 59))).toBe('peak')
    expect(deepseekPricingWindow(at(4, 0))).toBe('off-peak')
    expect(deepseekPricingWindow(at(9, 59))).toBe('peak')
    expect(deepseekPricingWindow(at(10, 0))).toBe('off-peak')
  })
})

describe('the expensive window', () => {
  test('runs an hour ahead of the first peak through the last one’s close', () => {
    expect(DEEPSEEK_EXPENSIVE_WINDOW_UTC).toEqual([0, 10])
  })

  test.each([
    [0, true],
    [2, true],
    [5, true],
    [9, true],
    [10, false],
    [23, false],
  ])('%i:00 UTC expensive=%p', (hour, expensive) => {
    expect(isDeepSeekExpensiveWindow(at(hour as number))).toBe(
      expensive as boolean,
    )
  })

  test('reports the close, and leaves instants outside it alone', () => {
    expect(deepSeekExpensiveWindowEndsAt(at(2)).toISOString()).toBe(
      at(10).toISOString(),
    )
    expect(deepSeekExpensiveWindowEndsAt(at(14)).toISOString()).toBe(
      at(14).toISOString(),
    )
  })
})

test.each(['2026-08-29T02:00:00Z', '2026-08-30T02:00:00Z'])(
  '%s uses weekend rates in Beijing',
  (instant) => {
    const date = new Date(instant)
    expect(deepseekPricingWindow(date)).toBe('off-peak')
    expect(isDeepSeekExpensiveWindow(date)).toBe(false)
  },
)

describe('every window names the clock it is quoted in', () => {
  const insideWindow = at(8)

  test('the return time says UTC when the caller asks for UTC', () => {
    expect(formatDeepSeekExpensiveWindowReturn(insideWindow, 'UTC')).toBe(
      'again at 10:00 AM UTC',
    )
  })

  test('the same instant, quoted for a reader in Berlin, is noon — and says so', () => {
    const berlin = formatDeepSeekExpensiveWindowReturn(
      insideWindow,
      'Europe/Berlin',
    )
    expect(berlin).toContain('12:00 PM')
    expect(berlin).not.toContain('10:00 AM')
    expect(berlin).toMatch(/GMT\+2|CEST/)
  })

  test('a range labels its zone ONCE, at the end', () => {
    const closed = formatDeepSeekExpensiveWindowLocal(insideWindow, 'UTC')
    expect(closed).toBe('12:00 AM – 10:00 AM UTC')
    expect(closed.match(/UTC/g)).toHaveLength(1)
  })

  test('the open window is the closed one inverted, and labelled too', () => {
    expect(formatDeepSeekOffPeakWindowLocal(insideWindow, 'UTC')).toBe(
      '10:00 AM – 12:00 AM UTC',
    )
  })

  test('an unknown zone falls back to UTC rather than to the host process', () => {
    expect(formatDeepSeekExpensiveWindowReturn(insideWindow, 'UTC')).toBe(
      formatDeepSeekExpensiveWindowReturn(insideWindow, 'Etc/UTC'),
    )
  })
})
