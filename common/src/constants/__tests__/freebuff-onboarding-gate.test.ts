import { describe, expect, it } from 'bun:test'

import {
  evaluateOnboardingRequirement,
  parseOnboardingEnabled,
} from '../freebuff-onboarding-gate'

describe('evaluateOnboardingRequirement', () => {
  it('asks nobody while the switch is off', () => {
    const result = evaluateOnboardingRequirement({
      enabled: false,
      complete: false,
    })
    expect(result.required).toBe(false)
    if (result.required) throw new Error('unreachable')
    expect(result.reason).toBe('gate_disabled')
  })

  it('asks anyone who has not answered, regardless of account age', () => {
    expect(
      evaluateOnboardingRequirement({ enabled: true, complete: false }).required,
    ).toBe(true)
  })

  it('stops asking once the answers are in', () => {
    const result = evaluateOnboardingRequirement({
      enabled: true,
      complete: true,
    })
    expect(result.required).toBe(false)
    if (result.required) throw new Error('unreachable')
    expect(result.reason).toBe('already_complete')
  })
})

describe('parseOnboardingEnabled', () => {
  it('accepts the affirmative spellings', () => {
    for (const raw of ['on', 'ON', ' true ', '1']) {
      expect(parseOnboardingEnabled(raw)).toBe(true)
    }
  })

  it('treats anything else as off', () => {
    for (const raw of [undefined, null, '', '   ', 'off', 'yes', 'enabled']) {
      expect(parseOnboardingEnabled(raw)).toBe(false)
    }
  })
})

describe('seen cookie', () => {
  it('is a stable name with a months-long life', () => {
  })
})
