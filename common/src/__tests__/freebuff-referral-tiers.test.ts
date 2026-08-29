import { describe, expect, it } from 'bun:test'

import {
  MIN_GITHUB_ACCOUNT_AGE_MONTHS,
  isGithubAccountOldEnoughForReferral,
} from '../constants/freebuff-referral-tiers'

const NOW = Date.parse('2026-06-12T00:00:00Z')

function monthsAgo(months: number): number {
  const date = new Date(NOW)
  date.setUTCMonth(date.getUTCMonth() - months)
  return date.getTime()
}

describe('isGithubAccountOldEnoughForReferral', () => {
  it('accepts accounts at or beyond the age threshold', () => {
    expect(
      isGithubAccountOldEnoughForReferral(
        monthsAgo(MIN_GITHUB_ACCOUNT_AGE_MONTHS),
        NOW,
      ),
    ).toBe(true)
    expect(isGithubAccountOldEnoughForReferral(monthsAgo(36), NOW)).toBe(true)
  })

  it('rejects accounts younger than the threshold', () => {
    expect(
      isGithubAccountOldEnoughForReferral(
        monthsAgo(MIN_GITHUB_ACCOUNT_AGE_MONTHS - 1),
        NOW,
      ),
    ).toBe(false)
    expect(isGithubAccountOldEnoughForReferral(NOW, NOW)).toBe(false)
  })

  it('rejects missing or invalid creation dates', () => {
    expect(isGithubAccountOldEnoughForReferral(null, NOW)).toBe(false)
    expect(isGithubAccountOldEnoughForReferral(undefined, NOW)).toBe(false)
    expect(isGithubAccountOldEnoughForReferral(Number.NaN, NOW)).toBe(false)
  })
})
