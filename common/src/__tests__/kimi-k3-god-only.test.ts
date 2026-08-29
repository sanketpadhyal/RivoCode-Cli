import { describe, expect, it } from 'bun:test'

import {
  FREEBUFF_KIMI_K3_ECO_MODEL_ID,
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

const KIMI_ID = FREEBUFF_KIMI_K3_ECO_MODEL_ID

describe('Kimi K3 is god-only on Freebuff Web', () => {
  it('is offered to god users and nobody else', () => {
    expect(isFreebuffWebGodOnlyModelId(KIMI_ID)).toBe(true)
    expect(isFreebuffWebModelId(KIMI_ID, { includeGodOnly: true })).toBe(true)
    expect(isFreebuffWebModelId(KIMI_ID, { includeGodOnly: false })).toBe(false)
    expect(FREEBUFF_WEB_GOD_ONLY_MODELS.map((m) => m.id)).toContain(KIMI_ID)
    expect(FREEBUFF_WEB_MODELS.map((m) => m.id)).not.toContain(KIMI_ID)
  })

  it('stays off every non-web surface', () => {
    expect(FREEBUFF_MODELS.map((m) => m.id)).not.toContain(KIMI_ID)
    expect(SUPPORTED_FREEBUFF_MODELS.map((m) => m.id)).not.toContain(KIMI_ID)
    expect(FREEBUFF_WEB_ALL_MODELS.map((m) => m.id)).toContain(KIMI_ID)
  })

  it('is metered by the premium pool, never the standard one', () => {
    expect(FREEBUFF_WEB_PREMIUM_MODEL_IDS).toContain(KIMI_ID)
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(KIMI_ID)
    const model = FREEBUFF_WEB_GOD_ONLY_MODELS.find((m) => m.id === KIMI_ID)
    expect(model?.premium).toBe(true)
  })

  it('displays as "Kimi K3" while the wire id keeps the -eco build', () => {
    const model = FREEBUFF_WEB_GOD_ONLY_MODELS.find((m) => m.id === KIMI_ID)
    expect(model?.displayName).toBe('Kimi K3')
    expect(model?.displayName).not.toContain('Eco')
    expect(KIMI_ID).toBe('crof/kimi-k3-eco')
  })

  it('is marked experimental, since it exists to be tested', () => {
    const model = FREEBUFF_WEB_GOD_ONLY_MODELS.find((m) => m.id === KIMI_ID)
    expect(model?.experimental).toBe(true)
  })

  it('keeps its id distinct from every other catalog row', () => {
    const all = FREEBUFF_WEB_ALL_MODELS.map((m) => m.id)
    expect(new Set(all).size).toBe(all.length)
  })
})
