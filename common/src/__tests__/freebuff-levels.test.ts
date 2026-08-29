import { describe, expect, it } from 'bun:test'

import {
  FREEBUFF_LEVELS,
  FREEBUFF_LEVEL_0,
  FREEBUFF_LEVEL_SESSION_CEILING,
  FREEBUFF_MAX_LEVEL,
  FREEBUFF_TRUST_COST_PER_PROMPT,
  FREEBUFF_TRUST_ALLOW_NEGATIVE,
  FREEBUFF_TRUST_MIN_BALANCE,
  levelForTrust,
  levelProgress,
  levelSessionBonus,
  nextLevelAfter,
} from '../constants/freebuff-levels'
import * as freebuffModels from '../constants/freebuff-models'
import {
  FREEBUFF_LIMITED_SESSION_LIMIT,
  FREEBUFF_PREMIUM_SESSION_LIMIT,
  FREEBUFF_PRE_LEVELS_LIMITED_SESSION_LIMIT,
  FREEBUFF_PRE_LEVELS_PREMIUM_SESSION_LIMIT,
} from '../constants/freebuff-models'

describe('the ladder', () => {
  it('is strictly increasing in every axis that costs us money', () => {
    for (let i = 1; i < FREEBUFF_LEVELS.length; i++) {
      const lower = FREEBUFF_LEVELS[i - 1]!
      const higher = FREEBUFF_LEVELS[i]!
      expect(higher.level).toBe(lower.level + 1)
      expect(higher.trustRequired).toBeGreaterThan(lower.trustRequired)
      expect(higher.trustPerEngagement).toBeGreaterThanOrEqual(
        lower.trustPerEngagement,
      )
      expect(higher.freeSessionsPerDay).toBeGreaterThanOrEqual(
        lower.freeSessionsPerDay,
      )
      expect(higher.premiumSessionsPerDay).toBeGreaterThanOrEqual(
        lower.premiumSessionsPerDay,
      )
    }
  })

  it('starts exactly where the flat session bases start', () => {
    expect(FREEBUFF_LEVEL_0.trustRequired).toBe(0)
    expect(FREEBUFF_LEVEL_0.freeSessionsPerDay).toBe(
      FREEBUFF_LIMITED_SESSION_LIMIT,
    )
    expect(FREEBUFF_LEVEL_0.premiumSessionsPerDay).toBe(
      FREEBUFF_PREMIUM_SESSION_LIMIT,
    )
  })

  it('does not reintroduce a full-access standard limit', () => {
    expect(freebuffModels).not.toHaveProperty(
      'FREEBUFF_WEB_STANDARD_SESSION_LIMIT',
    )
    expect(freebuffModels).not.toHaveProperty('FREEBUFF_STANDARD_SESSION_LIMIT')
  })

  it('tops out at the ceiling the copy promises, on both pools', () => {
    expect(FREEBUFF_MAX_LEVEL.freeSessionsPerDay).toBe(
      FREEBUFF_LEVEL_SESSION_CEILING,
    )
    expect(FREEBUFF_MAX_LEVEL.premiumSessionsPerDay).toBe(
      FREEBUFF_LEVEL_SESSION_CEILING,
    )
    for (const tier of FREEBUFF_LEVELS) {
      expect(tier.freeSessionsPerDay).toBeLessThanOrEqual(
        FREEBUFF_LEVEL_SESSION_CEILING,
      )
      expect(tier.premiumSessionsPerDay).toBeLessThanOrEqual(
        FREEBUFF_LEVEL_SESSION_CEILING,
      )
    }
  })

  it('never takes a session away from where the base starts', () => {
    for (const tier of FREEBUFF_LEVELS) {
      expect(tier.freeSessionsPerDay).toBeGreaterThanOrEqual(
        FREEBUFF_LEVEL_0.freeSessionsPerDay,
      )
      expect(tier.premiumSessionsPerDay).toBeGreaterThanOrEqual(
        FREEBUFF_LEVEL_0.premiumSessionsPerDay,
      )
    }
  })

  it('climbs past what the pools paid BEFORE the reduction', () => {
    expect(FREEBUFF_MAX_LEVEL.premiumSessionsPerDay).toBeGreaterThan(
      FREEBUFF_PRE_LEVELS_PREMIUM_SESSION_LIMIT,
    )
    expect(FREEBUFF_MAX_LEVEL.freeSessionsPerDay).toBeGreaterThan(
      FREEBUFF_PRE_LEVELS_LIMITED_SESSION_LIMIT,
    )
  })

  it('gets a limited-region account back above the old base within a few levels', () => {
    const recovered = FREEBUFF_LEVELS.find(
      (tier) =>
        tier.freeSessionsPerDay >= FREEBUFF_PRE_LEVELS_LIMITED_SESSION_LIMIT,
    )
    expect(recovered).toBeDefined()
    expect(recovered!.level).toBeLessThanOrEqual(5)
  })

  it('adds nothing at level 0 and only ever adds above it', () => {
    expect(levelSessionBonus(0)).toEqual({ free: 0, premium: 0 })
    for (const tier of FREEBUFF_LEVELS) {
      const bonus = levelSessionBonus(tier.level)
      expect(bonus.free).toBeGreaterThanOrEqual(0)
      expect(bonus.premium).toBeGreaterThanOrEqual(0)
    }
  })

  it('treats an unknown level as level 0 rather than throwing', () => {
    expect(levelSessionBonus(999)).toEqual({ free: 0, premium: 0 })
    expect(levelSessionBonus(-3)).toEqual({ free: 0, premium: 0 })
  })
})

describe('levelForTrust', () => {
  it('holds a level from its threshold until the next one', () => {
    const first = FREEBUFF_LEVELS[1]!
    expect(levelForTrust(first.trustRequired - 1).level).toBe(0)
    expect(levelForTrust(first.trustRequired).level).toBe(1)
    expect(levelForTrust(first.trustRequired + 1).level).toBe(1)
  })

  it('clamps a negative balance to level 0', () => {
    expect(levelForTrust(-1).level).toBe(0)
    expect(levelForTrust(FREEBUFF_TRUST_MIN_BALANCE).level).toBe(0)
  })

  it('tops out rather than running off the end', () => {
    expect(levelForTrust(FREEBUFF_MAX_LEVEL.trustRequired * 10).level).toBe(
      FREEBUFF_MAX_LEVEL.level,
    )
    expect(nextLevelAfter(FREEBUFF_MAX_LEVEL.level)).toBeNull()
  })
})

describe('levelProgress', () => {
  it('measures from the CURRENT level floor, not from zero', () => {
    const second = FREEBUFF_LEVELS[2]!
    const justArrived = levelProgress(second.trustRequired)
    expect(justArrived.level).toBe(2)
    expect(justArrived.progress).toBeLessThan(0.05)

    const almostThere = levelProgress(FREEBUFF_LEVELS[3]!.trustRequired - 1)
    expect(almostThere.level).toBe(2)
    expect(almostThere.progress).toBeGreaterThan(0.95)
  })

  it('is full and terminal at the top rung', () => {
    const top = levelProgress(FREEBUFF_MAX_LEVEL.trustRequired)
    expect(top.progress).toBe(1)
    expect(top.nextLevelAt).toBeNull()
    expect(top.trustToNextLevel).toBeNull()
    expect(top.engagementsToNextLevel).toBeNull()
  })

  it('reports the remaining work in engagements, not just points', () => {
    const zero = levelProgress(0)
    expect(zero.engagementsToNextLevel).toBe(
      Math.ceil(
        FREEBUFF_LEVELS[1]!.trustRequired / FREEBUFF_LEVEL_0.trustPerEngagement,
      ),
    )
    expect(zero.engagementsToNextLevel).toBeLessThanOrEqual(3)
  })

  it('never reports negative work remaining', () => {
    const below = levelProgress(FREEBUFF_TRUST_MIN_BALANCE)
    expect(below.progress).toBeGreaterThanOrEqual(0)
    expect(below.trustToNextLevel).toBeGreaterThan(0)
  })

  it('clamps a negative rendered Trust score', () => {
    expect(levelProgress(-404).trust).toBe(FREEBUFF_TRUST_MIN_BALANCE)
  })
})

describe('prompt costs', () => {
  it('decays slower than it is earned, at every level', () => {
    for (const tier of FREEBUFF_LEVELS) {
      const premiumPrompts =
        tier.trustPerEngagement / FREEBUFF_TRUST_COST_PER_PROMPT.premium
      expect(premiumPrompts).toBeGreaterThanOrEqual(10)
    }
  })

  it('never prices a scarcer prompt below a cheaper one', () => {
    expect(FREEBUFF_TRUST_COST_PER_PROMPT.frontier).toBeGreaterThanOrEqual(
      FREEBUFF_TRUST_COST_PER_PROMPT.premium,
    )
    expect(FREEBUFF_TRUST_COST_PER_PROMPT.premium).toBeGreaterThanOrEqual(
      FREEBUFF_TRUST_COST_PER_PROMPT.standard,
    )
  })

  it('charges exactly 1 for a message, whatever it was sent to', () => {
    for (const cost of Object.values(FREEBUFF_TRUST_COST_PER_PROMPT)) {
      expect(cost).toBe(1)
    }
  })

  it('never lets a balance go below zero', () => {
    expect(FREEBUFF_TRUST_MIN_BALANCE).toBe(0)
    expect(FREEBUFF_TRUST_ALLOW_NEGATIVE).toBe(false)
  })

  it('puts a spent-out user at level 0 rather than below it', () => {
    expect(levelForTrust(FREEBUFF_TRUST_MIN_BALANCE).level).toBe(0)
    expect(levelForTrust(0).level).toBe(0)
  })
})
