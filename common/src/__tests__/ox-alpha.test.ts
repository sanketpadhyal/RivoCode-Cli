import { describe, expect, it } from 'bun:test'

import type { FreebuffModelOption } from '../constants/freebuff-models'
import {
  DEFAULT_FREEBUFF_MODEL_ID,
  FREEBUFF_MODELS,
  FREEBUFF_PAUSED_FREE_MODEL_IDS,
  FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS,
  FREEBUFF_WEB_LIMITED_MODEL_IDS,
  freebuffWithdrawnModelMessage,
  isFreebuffPausedFreeModelId,
  isFreebuffSessionModelAllowedForAccessTier,
  isFreebuffWebModelAllowedForLimitedTier,
  isSupportedFreebuffModelId,
  LIMITED_FREEBUFF_MODEL_IDS,
  FREEBUFF_MODEL_CONTEXT_WINDOWS,
  FREEBUFF_OX_ALPHA_MAX_PRICE,
  FREEBUFF_OX_ALPHA_MODEL_ID,
  FREEBUFF_STANDARD_MODEL_IDS,
  FREEBUFF_TRACED_MODEL_IDS,
  FREEBUFF_WEB_ALL_MODELS,
  FREEBUFF_WEB_MODELS,
  FREEBUFF_WEB_PREMIUM_MODEL_IDS,
  isFreebuffOxAlphaModelId,
  isFreebuffWebModelId,
  resolveFreebuffSessionModelForAccessTier,
  SUPPORTED_FREEBUFF_MODELS,
} from '../constants/freebuff-models'
import {
  FREEBUFF_ROOT_AGENT_IDS,
  FREEBUFF_ROOT_AGENT_ID_BY_MODEL,
  FREEBUFF_WEB_BASE3_AGENT_ID_BY_MODEL,
  FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL,
  FREE_MODE_AGENT_MODELS,
} from '../constants/free-agents'

const OX = FREEBUFF_OX_ALPHA_MODEL_ID
const row = SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === OX)

describe('Ox Alpha is withdrawn from every surface', () => {
  it('is in no picker list on any surface', () => {
    expect(FREEBUFF_MODELS.map((m) => m.id)).not.toContain(OX)
    expect(FREEBUFF_WEB_MODELS.map((m) => m.id)).not.toContain(OX)
    expect(FREEBUFF_WEB_ALL_MODELS.map((m) => m.id)).not.toContain(OX)
    expect(isFreebuffWebModelId(OX)).toBe(false)
    expect(isFreebuffWebModelId(OX, { includeGodOnly: true })).toBe(false)
  })

  it('is in no quota list, so nothing meters a row nothing may admit', () => {
    expect(FREEBUFF_WEB_PREMIUM_MODEL_IDS as readonly string[]).not.toContain(
      OX,
    )
    expect(FREEBUFF_STANDARD_MODEL_IDS as readonly string[]).not.toContain(OX)
  })

  it('reaches neither limited catalog, and the two still agree', () => {
    expect(LIMITED_FREEBUFF_MODEL_IDS as readonly string[]).not.toContain(OX)
    expect(
      FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS as readonly string[],
    ).not.toContain(OX)
    expect(FREEBUFF_WEB_LIMITED_MODEL_IDS).not.toContain(OX)
    expect(isFreebuffWebModelAllowedForLimitedTier(OX)).toBe(false)
    expect(isFreebuffSessionModelAllowedForAccessTier(OX, 'limited')).toBe(
      false,
    )
  })

  it('is refused at full access too', () => {
    expect(isFreebuffSessionModelAllowedForAccessTier(OX, 'full')).toBe(false)
  })
})

describe('Ox Alpha is PAUSED, not deleted', () => {
  it('is on the pause list and answers the predicate', () => {
    expect(FREEBUFF_PAUSED_FREE_MODEL_IDS).toContain(OX)
    expect(isFreebuffPausedFreeModelId(OX)).toBe(true)
  })

  it('stays a recognised id, so admission can explain rather than refuse', () => {
    expect(row).toBeDefined()
    expect(isSupportedFreebuffModelId(OX)).toBe(true)
    expect(resolveFreebuffSessionModelForAccessTier(OX, 'full')).toBe(OX)
    const message = freebuffWithdrawnModelMessage(OX)
    expect(message).toContain('Ox Alpha')
    expect(message).toContain('no longer available')
    expect(message).not.toContain(OX)
    expect(message).not.toBe(freebuffWithdrawnModelMessage('nonexistent/model'))
  })

  it('coerces to the tier default at limited access', () => {
    expect(resolveFreebuffSessionModelForAccessTier(OX, 'limited')).not.toBe(OX)
  })

  it('keeps its roots wired so live sessions drain instead of failing', () => {
    expect(FREEBUFF_ROOT_AGENT_ID_BY_MODEL[OX]).toBe('base2-free-ox-alpha')
    expect(FREEBUFF_WEB_BASE3_AGENT_ID_BY_MODEL[OX]).toBe('base3-free-ox-alpha')
    expect(FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL[OX]).toBe('base3-free-ox-alpha')
    for (const id of ['base2-free-ox-alpha', 'base3-free-ox-alpha']) {
      expect(FREEBUFF_ROOT_AGENT_IDS as readonly string[]).toContain(id)
      expect([...(FREE_MODE_AGENT_MODELS[id] ?? [])]).toEqual([OX])
    }
  })

  it('is not the default anywhere, and never was', () => {
    expect(DEFAULT_FREEBUFF_MODEL_ID).not.toBe(OX)
    expect(FREEBUFF_MODELS[0]?.id).not.toBe(OX)
  })
})

describe('the fence and the row survive the withdrawal', () => {
  it('still fences the price at exactly zero', () => {
    expect(FREEBUFF_OX_ALPHA_MAX_PRICE.prompt).toBe(0)
    expect(FREEBUFF_OX_ALPHA_MAX_PRICE.completion).toBe(0)
  })

  it('still matches dated builds, so a variant cannot escape the pause', () => {
    expect(isFreebuffOxAlphaModelId(OX)).toBe(true)
    expect(isFreebuffOxAlphaModelId('stealth/ox-alpha-20260820')).toBe(true)
    expect(isFreebuffOxAlphaModelId('stealth/ox-beta')).toBe(false)
    expect(isFreebuffOxAlphaModelId(null)).toBe(false)
    expect(isFreebuffPausedFreeModelId('stealth/ox-alpha-20260820')).toBe(true)
  })

  it('keeps its context window and its data disclosure', () => {
    expect(FREEBUFF_MODEL_CONTEXT_WINDOWS[OX]).toBe(1_000_000)
    expect(row?.warning).toBe('Anonymous provider retains prompts')
    expect(row?.dataUse).toBe('service')
    expect(FREEBUFF_TRACED_MODEL_IDS as readonly string[]).not.toContain(OX)
  })

  it('no longer claims to be NEW', () => {
    expect((row as FreebuffModelOption | undefined)?.isNew).toBeUndefined()
    expect(row?.experimental).toBe(true)
  })
})
