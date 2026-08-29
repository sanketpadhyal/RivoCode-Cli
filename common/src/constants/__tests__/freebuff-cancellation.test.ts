import { describe, expect, test } from 'bun:test'

import {
  FREEBUFF_BETA_RATE_LOCK_MULTIPLIER,
  FREEBUFF_CANCELLATION_REASONS,
  isFreebuffCancellationReason,
} from '../freebuff-subscriptions'

describe('cancellation reasons', () => {
  test('every rendered option is one the server will accept', () => {
    for (const option of FREEBUFF_CANCELLATION_REASONS) {
      expect(isFreebuffCancellationReason(option.id)).toBe(true)
    }
  })

  test('anything else is refused, including empty and near-misses', () => {
    for (const value of ['', 'too expensive', 'TOO_EXPENSIVE', null, 7, {}]) {
      expect(isFreebuffCancellationReason(value)).toBe(false)
    }
  })

  test('the list keeps an escape hatch, or the form cannot be completed', () => {
    expect(FREEBUFF_CANCELLATION_REASONS.some((r) => r.id === 'other')).toBe(
      true,
    )
  })

  test('the rate-lock multiple is a plain number the copy can state', () => {
    expect(FREEBUFF_BETA_RATE_LOCK_MULTIPLIER).toBeGreaterThan(1)
  })
})
