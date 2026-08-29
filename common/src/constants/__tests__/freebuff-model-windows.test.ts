import { describe, expect, test } from 'bun:test'

import {
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
} from '../freebuff-model-ids'
import {
  getFreebuffModelAvailabilityWindowLabel,
  isFreebuffPausedFreeModelId,
} from '../freebuff-models'
import { FREEBUFF_GPT_5_6_LUNA_MODEL_ID } from '../freebuff-models'
import { getFreebuffPlanPauseWindowLabel } from '../freebuff-subscriptions'

describe('model availability windows', () => {
  const now = new Date('2026-08-26T20:00:00Z')
  const TZ = 'America/Los_Angeles'

  test('Flash, reopened at all hours, advertises no window at all', () => {
    expect(
      getFreebuffModelAvailabilityWindowLabel(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        now,
        { timeZone: TZ },
      ),
    ).toBeUndefined()
  })

  test('Flash needs no plan-pause line either', () => {
    expect(
      getFreebuffPlanPauseWindowLabel(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        now,
        TZ,
      ),
    ).toBeUndefined()
  })

  test('a WITHDRAWN row advertises no hours of either kind', () => {
    expect(isFreebuffPausedFreeModelId(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID)).toBe(
      true,
    )
    expect(
      getFreebuffModelAvailabilityWindowLabel(
        FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
        now,
        { timeZone: TZ },
      ),
    ).toBeUndefined()
    expect(
      getFreebuffPlanPauseWindowLabel(
        FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
        now,
        TZ,
      ),
    ).toBeUndefined()
  })

  test('a model with no time restriction says nothing at all', () => {
    expect(
      getFreebuffModelAvailabilityWindowLabel(
        FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
        now,
        { timeZone: TZ },
      ),
    ).toBeUndefined()
    expect(
      getFreebuffPlanPauseWindowLabel(FREEBUFF_GPT_5_6_LUNA_MODEL_ID, now, TZ),
    ).toBeUndefined()
  })
})
