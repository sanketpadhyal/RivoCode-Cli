import { describe, expect, test } from 'bun:test'

import {
  FREEBUFF_WEB_LIMITED_MODEL_IDS,
  LIMITED_FREEBUFF_MODEL_ID,
  getFreebuffModelsForAccessTier,
  isFreebuffSessionModelAllowedForAccessTier,
  isFreebuffWebModelAllowedForLimitedTier,
  resolveFreebuffSessionModelForAccessTier,
  resolveFreebuffWebModelForLimitedTier,
} from '../freebuff-models'
import { FREEBUFF_SUBSCRIPTION_MODEL_IDS } from '../freebuff-subscriptions'

describe('paid plans at limited access', () => {
  test('the limited catalog still excludes every plan model when unpaid', () => {
    for (const model of FREEBUFF_SUBSCRIPTION_MODEL_IDS) {
      expect(FREEBUFF_WEB_LIMITED_MODEL_IDS).not.toContain(model)
      expect(isFreebuffSessionModelAllowedForAccessTier(model, 'limited')).toBe(
        false,
      )
    }
  })

  test('a paid plan unlocks exactly the models it meters', () => {
    for (const model of FREEBUFF_SUBSCRIPTION_MODEL_IDS) {
      expect(
        isFreebuffSessionModelAllowedForAccessTier(model, 'limited', true),
      ).toBe(true)
    }
  })

  test('paying does not unlock anything the plan does not cover', () => {
    expect(
      isFreebuffSessionModelAllowedForAccessTier(
        'openai/gpt-5.6-luna-es',
        'limited',
        true,
      ),
    ).toBe(false)
  })

  test('full access is unaffected by the flag either way', () => {
    for (const paid of [false, true]) {
      expect(
        isFreebuffSessionModelAllowedForAccessTier(
          FREEBUFF_SUBSCRIPTION_MODEL_IDS[0]!,
          'full',
          paid,
        ),
      ).toBe(true)
    }
  })

  test('the duplicated plan-model list has not drifted from the catalog', () => {
    for (const model of FREEBUFF_SUBSCRIPTION_MODEL_IDS) {
      expect(
        isFreebuffSessionModelAllowedForAccessTier(model, 'limited', true),
      ).toBe(true)
    }
    expect(FREEBUFF_SUBSCRIPTION_MODEL_IDS).toHaveLength(4)
  })
})

describe('a plan model survives resolution, not just the allowlist', () => {
  test('unpaid limited access still coerces every plan model to MiMo', () => {
    for (const model of FREEBUFF_SUBSCRIPTION_MODEL_IDS) {
      expect(
        resolveFreebuffSessionModelForAccessTier(model, 'limited'),
      ).toBe(LIMITED_FREEBUFF_MODEL_ID)
    }
  })

  test('a paid plan keeps the pick intact', () => {
    for (const model of FREEBUFF_SUBSCRIPTION_MODEL_IDS) {
      expect(
        resolveFreebuffSessionModelForAccessTier(model, 'limited', {
          hasPaidSubscription: true,
        }),
      ).toBe(model)
    }
  })

  test('the Web picker offers and keeps plan rows for a subscriber', () => {
    for (const model of FREEBUFF_SUBSCRIPTION_MODEL_IDS) {
      expect(isFreebuffWebModelAllowedForLimitedTier(model)).toBe(false)
      expect(isFreebuffWebModelAllowedForLimitedTier(model, true)).toBe(true)
      expect(resolveFreebuffWebModelForLimitedTier(model, true)).toBe(model)
      expect(resolveFreebuffWebModelForLimitedTier(model)).toBe(
        LIMITED_FREEBUFF_MODEL_ID,
      )
    }
  })

  test('the CLI/Desktop tier catalog gains the plan rows and keeps the free ones', () => {
    const free = getFreebuffModelsForAccessTier('limited').map((m) => m.id)
    const paid = getFreebuffModelsForAccessTier('limited', true).map(
      (m) => m.id,
    )
    for (const id of free) expect(paid).toContain(id)
    expect(paid.slice(0, free.length)).toEqual(free)
    expect(paid.length).toBeGreaterThan(free.length)
    for (const id of paid) {
      expect(isFreebuffSessionModelAllowedForAccessTier(id, 'limited', true)).toBe(
        true,
      )
    }
  })

  test('full access is untouched by the widened catalog', () => {
    expect(getFreebuffModelsForAccessTier('full', true).map((m) => m.id)).toEqual(
      getFreebuffModelsForAccessTier('full').map((m) => m.id),
    )
  })
})
