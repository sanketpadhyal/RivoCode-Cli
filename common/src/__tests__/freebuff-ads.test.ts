import { describe, expect, it } from 'bun:test'

import {
  AD_CAMPAIGN_STATUSES,
  AD_CAMPAIGN_STATUS_LABELS,
  AD_COMPARISON,
  AD_ENGAGEMENT_STATUSES,
  AD_ENGAGEMENT_STATUS_LABELS,
  AD_DAILY_BUDGET_STEP_CENTS,
  AD_ENGAGEMENT_PRICE_CENTS,
  AD_MAX_DAILY_BUDGET_CENTS,
  AD_MIN_DAILY_BUDGET_CENTS,
  AD_PLATFORMS,
  AD_PLATFORM_ACTIONS,
  AD_PLATFORM_LABELS,
  adEvidenceAttestation,
  engagementsForDailyBudget,
  isValidDailyBudgetCents,
  normalizeDailyBudgetCents,
  platformForUrl,
  platformRequiresComment,
} from '../constants/freebuff-ads'

describe('pricing', () => {
  it('makes the headline claim true by arithmetic', () => {
    expect(engagementsForDailyBudget(1_000)).toBe(20)
    expect(AD_COMPARISON.engagementsPerTenDollars).toBe(20)
    expect(AD_ENGAGEMENT_PRICE_CENTS).toBe(50)
  })

  it('never promises a fractional engagement', () => {
    for (let cents = 0; cents <= 5_000; cents += 37) {
      expect(Number.isInteger(engagementsForDailyBudget(cents))).toBe(true)
    }
  })
})

describe('normalizeDailyBudgetCents', () => {
  it('snaps a hand-rolled amount onto the ladder', () => {
    expect(normalizeDailyBudgetCents(1_037)).toBe(1_000)
    expect(normalizeDailyBudgetCents(1_260)).toBe(1_500)
    expect(normalizeDailyBudgetCents(2_499)).toBe(2_500)
  })

  it('clamps to the floor and the ceiling', () => {
    expect(normalizeDailyBudgetCents(0)).toBe(AD_MIN_DAILY_BUDGET_CENTS)
    expect(normalizeDailyBudgetCents(-5_000)).toBe(AD_MIN_DAILY_BUDGET_CENTS)
    expect(normalizeDailyBudgetCents(10_000_000)).toBe(AD_MAX_DAILY_BUDGET_CENTS)
  })

  it('always produces a value its own validator accepts', () => {
    for (const raw of [0, 1, 999, 1_001, 3_333, 99_999, 250_000]) {
      expect(isValidDailyBudgetCents(normalizeDailyBudgetCents(raw))).toBe(true)
    }
  })

  it('rejects amounts off the step ladder', () => {
    expect(isValidDailyBudgetCents(1_037)).toBe(false)
    expect(isValidDailyBudgetCents(AD_MIN_DAILY_BUDGET_CENTS - AD_DAILY_BUDGET_STEP_CENTS)).toBe(false)
    expect(isValidDailyBudgetCents(1_000.5)).toBe(false)
  })
})

describe('platformForUrl', () => {
  it('recognises the four platforms and their alternate hosts', () => {
    expect(platformForUrl('https://x.com/acme/status/123')).toBe('twitter')
    expect(platformForUrl('https://twitter.com/acme/status/123')).toBe('twitter')
    expect(platformForUrl('https://www.linkedin.com/posts/acme_x-activity-1')).toBe('linkedin')
    expect(platformForUrl('https://lnkd.in/p/gJpFPcbf')).toBe('linkedin')
    expect(platformForUrl('https://www.reddit.com/r/programming/comments/abc/')).toBe('reddit')
    expect(platformForUrl('https://redd.it/abc')).toBe('reddit')
    expect(platformForUrl('https://github.com/workweave/router')).toBe('github')
  })

  it('matches subdomains but not lookalike domains', () => {
    expect(platformForUrl('https://old.reddit.com/r/x/comments/y/')).toBe('reddit')
    expect(platformForUrl('https://x.com.evil.example/a')).toBeNull()
    expect(platformForUrl('https://notx.com/a')).toBeNull()
    expect(platformForUrl('https://mylinkedin.com/a')).toBeNull()
    expect(platformForUrl('https://mygithub.com/a')).toBeNull()
  })

  it('refuses anything that is not an http(s) URL', () => {
    expect(platformForUrl('javascript:alert(1)')).toBeNull()
    expect(platformForUrl('not a url')).toBeNull()
    expect(platformForUrl('')).toBeNull()
  })
})

describe('platform copy', () => {
  it('describes every platform it can detect', () => {
    for (const platform of AD_PLATFORMS) {
      expect(AD_PLATFORM_LABELS[platform]).toBeTruthy()
      expect(AD_PLATFORM_ACTIONS[platform].length).toBeGreaterThan(0)
    }
  })

  it('never asks a Reddit user to repost', () => {
    const reddit = AD_PLATFORM_ACTIONS.reddit.join(' ').toLowerCase()
    expect(reddit).not.toContain('repost')
    expect(reddit).toContain('upvote')
  })

  it('asks a GitHub user only to star — no comment, no repost', () => {
    const github = AD_PLATFORM_ACTIONS.github.join(' ').toLowerCase()
    expect(github).toContain('star')
    expect(github).not.toContain('comment')
    expect(github).not.toContain('repost')
  })

  it('knows which platforms involve writing a comment', () => {
    expect(platformRequiresComment('twitter')).toBe(true)
    expect(platformRequiresComment('linkedin')).toBe(true)
    expect(platformRequiresComment('reddit')).toBe(true)
    expect(platformRequiresComment('github')).toBe(false)
  })

  it('attests to the action the platform actually asks for', () => {
    expect(adEvidenceAttestation('twitter')).toContain('commented')
    expect(adEvidenceAttestation('github')).toContain('starred')
    expect(adEvidenceAttestation('github')).not.toContain('commented')
  })
})

describe('status unions mirror the database enums', () => {
  it('includes every engagement status the schema can store', () => {
    expect([...AD_ENGAGEMENT_STATUSES]).toEqual([
      'pending',
      'approved',
      'rejected',
      'skipped',
      'flagged',
    ])
  })

  it('labels every status it declares', () => {
    for (const status of AD_ENGAGEMENT_STATUSES) {
      expect(AD_ENGAGEMENT_STATUS_LABELS[status]).toBeTruthy()
    }
    for (const status of AD_CAMPAIGN_STATUSES) {
      expect(AD_CAMPAIGN_STATUS_LABELS[status]).toBeTruthy()
    }
  })
})
