import { describe, expect, it } from 'bun:test'

import {
  clampTerminalTimeoutSeconds,
  MAX_TERMINAL_TIMEOUT_SECONDS,
} from '../run-terminal-command'

describe('clampTerminalTimeoutSeconds', () => {
  it('clamps the exaggerated budgets models actually pick', () => {
    expect(clampTerminalTimeoutSeconds(3000)).toBe(MAX_TERMINAL_TIMEOUT_SECONDS)
    expect(clampTerminalTimeoutSeconds(1800)).toBe(MAX_TERMINAL_TIMEOUT_SECONDS)
    expect(clampTerminalTimeoutSeconds(601)).toBe(MAX_TERMINAL_TIMEOUT_SECONDS)
  })

  it('leaves ordinary budgets alone', () => {
    expect(clampTerminalTimeoutSeconds(30)).toBe(30)
    expect(clampTerminalTimeoutSeconds(180)).toBe(180)
    expect(clampTerminalTimeoutSeconds(MAX_TERMINAL_TIMEOUT_SECONDS)).toBe(
      MAX_TERMINAL_TIMEOUT_SECONDS,
    )
  })

  it('preserves the -1 no-timeout sentinel', () => {
    expect(clampTerminalTimeoutSeconds(-1)).toBe(-1)
  })

  it('leaves an absent value to the schema default', () => {
    expect(clampTerminalTimeoutSeconds(undefined)).toBeUndefined()
  })

  it('treats nonsense values as the default rather than an instant timeout', () => {
    expect(clampTerminalTimeoutSeconds(0)).toBe(30)
    expect(clampTerminalTimeoutSeconds(-5)).toBe(30)
    expect(clampTerminalTimeoutSeconds(Number.NaN)).toBe(
      MAX_TERMINAL_TIMEOUT_SECONDS,
    )
    expect(clampTerminalTimeoutSeconds(Number.POSITIVE_INFINITY)).toBe(
      MAX_TERMINAL_TIMEOUT_SECONDS,
    )
  })
})
