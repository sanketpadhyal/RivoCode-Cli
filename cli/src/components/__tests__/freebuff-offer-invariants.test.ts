
import { describe, expect, test } from 'bun:test'

import { getFreebuffRootAgentIdForModel } from '@codebuff/common/constants/free-agents'
import {
  FREEBUFF_GLM_V52_MODEL_ID,
  resolveFreebuffModelForAccessTier,
} from '@codebuff/common/constants/freebuff-models'
import { freebuffOfferViolations } from '@codebuff/common/testing/freebuff-offer-invariants'

import { freebuffCliOfferedModelIds } from '../freebuff-model-selector'

describe('freebuff rows the CLI offers', () => {
  for (const accessTier of ['full', 'limited'] as const) {
    test(`are all usable on the ${accessTier} tier`, () => {
      expect(
        freebuffOfferViolations({
          surface: `cli picker + referral banner (${accessTier})`,
          accessTier,
          offered: freebuffCliOfferedModelIds(accessTier),
          accepts: (model) =>
            resolveFreebuffModelForAccessTier(model, accessTier) === model,
          rootAgentIdFor: getFreebuffRootAgentIdForModel,
          catalog: 'supported',
        }),
      ).toEqual([])
    })
  }

  test('are all usable on the limited tier for a subscriber', () => {
    expect(
      freebuffOfferViolations({
        surface: 'cli picker + referral banner (limited, subscriber)',
        accessTier: 'limited',
        hasPaidSubscription: true,
        offered: freebuffCliOfferedModelIds('limited', true),
        accepts: (model) =>
          resolveFreebuffModelForAccessTier(model, 'limited', true) === model,
        rootAgentIdFor: getFreebuffRootAgentIdForModel,
        catalog: 'supported',
      }),
    ).toEqual([])
  })

  test('the limited grid keeps every free row for a subscriber', () => {
    const free = freebuffCliOfferedModelIds('limited')
    const paid = freebuffCliOfferedModelIds('limited', true)
    for (const id of free) expect(paid).toContain(id)
    expect(paid.length).toBeGreaterThan(free.length)
  })

  test('the earned reward is offered on BOTH tiers, and the grid never shows it', () => {
    expect(freebuffCliOfferedModelIds('full')).toContain(FREEBUFF_GLM_V52_MODEL_ID)
    expect(freebuffCliOfferedModelIds('limited')).toContain(
      FREEBUFF_GLM_V52_MODEL_ID,
    )
  })

  test('the reward maps to its own root agent rather than the fallback', () => {
    expect(getFreebuffRootAgentIdForModel(FREEBUFF_GLM_V52_MODEL_ID)).toBe(
      'base2-free-glm',
    )
  })
})
