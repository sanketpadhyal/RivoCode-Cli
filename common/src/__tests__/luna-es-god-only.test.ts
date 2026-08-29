import { describe, expect, it } from 'bun:test'

import {
  FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
  FREEBUFF_MODELS,
  FREEBUFF_WEB_ALL_MODELS,
  FREEBUFF_WEB_GOD_ONLY_MODELS,
  FREEBUFF_WEB_MODELS,
  FREEBUFF_WEB_PREMIUM_MODEL_IDS,
  FREEBUFF_STANDARD_MODEL_IDS,
  isFreebuffWebGodOnlyModelId,
  isFreebuffWebModelId,
  SUPPORTED_FREEBUFF_MODELS,
} from '../constants/freebuff-models'

const LUNA_ES_ID = FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID

describe('Luna-ES (Codex test route) is god-only on Freebuff Web', () => {
  it('is offered to god users and nobody else', () => {
    expect(isFreebuffWebGodOnlyModelId(LUNA_ES_ID)).toBe(true)
    expect(isFreebuffWebModelId(LUNA_ES_ID, { includeGodOnly: true })).toBe(
      true,
    )
    expect(isFreebuffWebModelId(LUNA_ES_ID, { includeGodOnly: false })).toBe(
      false,
    )
    expect(FREEBUFF_WEB_GOD_ONLY_MODELS.map((m) => m.id)).toContain(
      LUNA_ES_ID,
    )
    expect(FREEBUFF_WEB_MODELS.map((m) => m.id)).not.toContain(LUNA_ES_ID)
  })

  it('stays off every non-web surface', () => {
    expect(FREEBUFF_MODELS.map((m) => m.id)).not.toContain(LUNA_ES_ID)
    expect(SUPPORTED_FREEBUFF_MODELS.map((m) => m.id)).not.toContain(
      LUNA_ES_ID,
    )
    expect(FREEBUFF_WEB_ALL_MODELS.map((m) => m.id)).toContain(LUNA_ES_ID)
  })

  it('is metered by the premium pool, never the standard one', () => {
    expect(FREEBUFF_WEB_PREMIUM_MODEL_IDS).toContain(LUNA_ES_ID)
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(LUNA_ES_ID)
    const model = FREEBUFF_WEB_GOD_ONLY_MODELS.find((m) => m.id === LUNA_ES_ID)
    expect(model?.premium).toBe(true)
  })

  it('answers as Codex, so the label never says Luna', () => {
    const model = FREEBUFF_WEB_GOD_ONLY_MODELS.find((m) => m.id === LUNA_ES_ID)
    expect(model?.displayName).toBe('Codex (test)')
    expect(model?.displayName).not.toContain('Luna')
  })

  it('keeps its id distinct from every other catalog row', () => {
    const all = FREEBUFF_WEB_ALL_MODELS.map((m) => m.id)
    expect(new Set(all).size).toBe(all.length)
  })
})
