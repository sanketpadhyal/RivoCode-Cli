import { FREEBUFF_TIER_CHANGE_NOTICE } from '../util/freebuff-model-availability'
import { describe, expect, test } from 'bun:test'

import { isFreeModeAllowedAgentModel } from '../constants/free-agents'
import {
  DEFAULT_FREEBUFF_MODEL_ID,
  DEFAULT_FREEBUFF_WEB_MODEL_ID,
  FALLBACK_FREEBUFF_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_DESKTOP_SESSION_LIMITS,
  FREEBUFF_ENABLE_MIMO_MODELS_IN_UI,
  FREEBUFF_FABLE_5_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_IDS,
  FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  FREEBUFF_WEB_LIMITED_MODEL_IDS,
  FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS,
  FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MAX_PRICE,
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_PROVIDER_ROUTE,
  FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
  FREEBUFF_KIMI_K3_ECO_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
  FREEBUFF_MODELS,
  FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
  FREEBUFF_MUSE_SPARK_REASONING_EFFORT,
  FREEBUFF_OX_ALPHA_MODEL_ID,
  FREEBUFF_PER_MODEL_SESSION_CAPS,
  FREEBUFF_STANDARD_MODEL_IDS,
  FREEBUFF_WEB_ALL_MODELS,
  FREEBUFF_WEB_DEEMPHASIZED_MODEL_IDS,
  FREEBUFF_WEB_GOD_ONLY_MODELS,
  FREEBUFF_WEB_MODELS,
  FREEBUFF_WEB_RETIRED_PICKER_MODEL_IDS,
  LIMITED_FREEBUFF_MODEL_ID,
  LIMITED_FREEBUFF_MODEL_IDS,
  MUSE_SPARK_12_CONTRIBUTOR_UPSTREAM_MODEL_ID,
  MUSE_SPARK_FALLBACK_AFTER_MS,
  MUSE_SPARK_FALLBACK_MODEL_ID,
  MUSE_SPARK_FALLBACK_NOTICE,
  SUPPORTED_FREEBUFF_MODELS,
  FREEBUFF_WEB_PREMIUM_MODEL_IDS,
  isFreebuffDesktopPremiumBucketModelId,
  canFreebuffModelSpawnGeminiThinker,
  freebuffWithdrawnModelMessage,
  getFreebuffDeploymentAvailabilityLabel,
  getFreebuffDesktopSessionBucket,
  getFreebuffModel,
  getFreebuffModelImageSupport,
  getFreebuffModelReasoningEffort,
  getFreebuffModelSupersededBy,
  getFreebuffModelsForAccessTier,
  getFreebuffPerModelSessionCap,
  getFreebuffWebModel,
  getRecommendedFreebuffModelId,
  getRecommendedFreebuffWebModelId,
  isFreebuffDeploymentHours,
  isFreebuffGlmV52ModelId,
  isFreebuffGlmV53FlashModelId,
  isFreebuffGpt56LunaModelId,
  isFreebuffLimitedOfferModelId,
  isFreebuffModelAllowedForAccessTier,
  isFreebuffModelId,
  isFreebuffMultimodalModelId,
  isFreebuffPausedFreeModelId,
  isFreebuffPremiumModelId,
  isFreebuffSessionModelAllowedForAccessTier,
  isFreebuffSessionModelAvailable,
  freebuffModelUnavailableAt,
  freebuffModelUnavailableWindow,
  formatFreebuffModelUnavailableWindow,
  FREEBUFF_DEPLOYMENT_HOURS_LABEL,
  isFreebuffSessionModelId,
  isFreebuffTracedModelId,
  isFreebuffWebDeemphasizedModelId,
  isFreebuffWebGeoExemptModelId,
  isFreebuffWebGodOnlyModelId,
  isFreebuffWebModelAllowedForLimitedTier,
  isFreebuffWebModelId,
  isFreebuffWebMultimodalModelId,
  isFreebuffWebPremiumModelId,
  isFreebuffWebRememberableModelId,
  isFreebuffWebSelectableModelId,
  isMuseSparkModelId,
  isSupportedFreebuffModelId,
  migrateSupersededFreebuffModelPreference,
  resolveAvailableFreebuffModel,
  resolveFreebuffModelForAccessTier,
  resolveFreebuffSessionModelForAccessTier,
  resolveFreebuffWebModel,
  resolveFreebuffWebModelForLimitedTier,
  resolveRememberedFreebuffWebModel,
} from '../constants/freebuff-models'
import type { FreebuffModelOption } from '../constants/freebuff-models'
import { minimaxModels } from '../constants/model-config'

const FREEBUFF_KIMI_MODEL_ID = 'moonshotai/kimi-k2.7-code'
const FREEBUFF_MIMO_V25_PRO_MODEL_ID = 'mimo/mimo-v2.5-pro'
const FREEBUFF_CROF_GLM_V52_MODEL_ID = 'crof/glm-5.2'

const MINIMAX_M3_MODEL_ID = minimaxModels.minimaxM3

describe('freebuff model availability', () => {
  test('the default is joinable at every hour; the fallback is unlimited', () => {
    expect(DEFAULT_FREEBUFF_MODEL_ID).toBe(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)
    expect(FALLBACK_FREEBUFF_MODEL_ID).toBe(FREEBUFF_MIMO_V25_MODEL_ID)

    expect(
      isFreebuffSessionModelAvailable(
        DEFAULT_FREEBUFF_MODEL_ID,
        new Date('2026-08-21T02:00:00Z'),
      ),
    ).toBe(true)
    expect(
      isFreebuffSessionModelAvailable(
        DEFAULT_FREEBUFF_MODEL_ID,
        new Date('2026-08-21T12:00:00Z'),
      ),
    ).toBe(true)

    expect(
      Boolean(getFreebuffPerModelSessionCap(DEFAULT_FREEBUFF_MODEL_ID)),
    ).toBe(false)
    expect(
      Boolean(getFreebuffPerModelSessionCap(FALLBACK_FREEBUFF_MODEL_ID)),
    ).toBe(false)

    expect(isFreebuffPremiumModelId(DEFAULT_FREEBUFF_MODEL_ID)).toBe(true)
    expect(isFreebuffPremiumModelId(FALLBACK_FREEBUFF_MODEL_ID)).toBe(false)
  })

  test('desktop concurrency splits full access into 1 premium and 3 unlimited sessions', () => {
    expect(
      getFreebuffDesktopSessionBucket(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        'full',
      ),
    ).toBe('unlimited')
    expect(
      getFreebuffDesktopSessionBucket(FREEBUFF_MIMO_V25_MODEL_ID, 'full'),
    ).toBe('unlimited')
    expect(FREEBUFF_DESKTOP_SESSION_LIMITS).toEqual({
      premium: 1,
      unlimited: 3,
    })
    expect(
      getFreebuffDesktopSessionBucket(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        'limited',
      ),
    ).toBe('premium')
  })

  test('DeepSeek Pro keeps its AI-training warning while paused', () => {
    const deepseek = SUPPORTED_FREEBUFF_MODELS.find(
      (m) => m.id === FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
    )
    expect((deepseek as { warning?: string } | undefined)?.warning).toBe(
      'May use data for AI training',
    )
  })

  test('DeepSeek Flash carries the AI-training warning before selection', () => {
    const deepseek = FREEBUFF_MODELS.find(
      (m) => m.id === FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect((deepseek as { warning?: string } | undefined)?.warning).toBe(
      'May use data for AI training',
    )
  })

  test('only the DeepSeek family is trace-stored in free mode', () => {
    const mimo = FREEBUFF_MODELS.find(
      (m) => m.id === FREEBUFF_MIMO_V25_MODEL_ID,
    )
    expect((mimo as { warning?: string } | undefined)?.warning).toBeUndefined()
    expect(isFreebuffTracedModelId(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID)).toBe(
      true,
    )
    expect(isFreebuffTracedModelId(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)).toBe(
      true,
    )
    expect(isFreebuffTracedModelId(MINIMAX_M3_MODEL_ID)).toBe(false)
    expect(isFreebuffTracedModelId(FREEBUFF_KIMI_MODEL_ID)).toBe(false)
    expect(isFreebuffTracedModelId(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(false)
    expect(isFreebuffTracedModelId(null)).toBe(false)
  })

  test('trace storage follows machine-readable data-use metadata', () => {
    const models: readonly FreebuffModelOption[] = SUPPORTED_FREEBUFF_MODELS
    for (const model of models) {
      expect(isFreebuffTracedModelId(model.id)).toBe(
        model.dataUse === 'training',
      )
      if (model.id === FREEBUFF_OX_ALPHA_MODEL_ID) {
        expect(model.dataUse).toBe('service')
        expect(model.warning).toBeDefined()
        continue
      }
      expect(model.warning !== undefined).toBe(model.dataUse === 'training')
    }
  })

  test('DeepSeek V4 Flash is selectable and unlimited on full access', () => {
    expect(FREEBUFF_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect(isFreebuffModelId(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)).toBe(true)
    expect(isFreebuffPremiumModelId(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)).toBe(
      false,
    )
    expect(FREEBUFF_STANDARD_MODEL_IDS).toContain(
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect(FREEBUFF_MODELS.some((model) => !model.premium)).toBe(true)
  })

  test('the limited tier is unaffected by Flash going unlimited', () => {
    expect(LIMITED_FREEBUFF_MODEL_IDS).toContain(FREEBUFF_MIMO_V25_MODEL_ID)
    expect(LIMITED_FREEBUFF_MODEL_IDS).not.toContain(
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    expect(
      isFreebuffWebModelAllowedForLimitedTier(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      ),
    ).toBe(false)
  })

  test('the fallback stays available at every hour, not merely unmetered', () => {
    expect(FALLBACK_FREEBUFF_MODEL_ID).not.toBe(
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
    const fallback = SUPPORTED_FREEBUFF_MODELS.find(
      (model) => model.id === FALLBACK_FREEBUFF_MODEL_ID,
    )!
    expect(fallback.premium).toBe(false)
    expect(fallback.availability).toBe('always')
  })

  test('GLM 5.3 Flash trails the catalog and nothing is recommended', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    expect(all).toContain(FREEBUFF_GLM_V53_FLASH_MODEL_ID)
    expect(isFreebuffPremiumModelId(FREEBUFF_GLM_V53_FLASH_MODEL_ID)).toBe(false)
    expect(isFreebuffPausedFreeModelId(FREEBUFF_GLM_V53_FLASH_MODEL_ID)).toBe(
      false,
    )

    expect(all[all.length - 1]).toBe(FREEBUFF_GLM_V53_FLASH_MODEL_ID)
    expect(DEFAULT_FREEBUFF_MODEL_ID).not.toBe(FREEBUFF_GLM_V53_FLASH_MODEL_ID)
    expect(DEFAULT_FREEBUFF_WEB_MODEL_ID).not.toBe(
      FREEBUFF_GLM_V53_FLASH_MODEL_ID,
    )
  })

  test('the two GLM rows never share a pool or a predicate', () => {
    expect(isFreebuffGlmV52ModelId(FREEBUFF_GLM_V53_FLASH_MODEL_ID)).toBe(false)
    expect(isFreebuffGlmV53FlashModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(false)
    expect(FREEBUFF_GLM_V52_MODEL_IDS).not.toContain(
      FREEBUFF_GLM_V53_FLASH_MODEL_ID,
    )
    expect(isFreebuffPremiumModelId(FREEBUFF_GLM_V53_FLASH_MODEL_ID)).toBe(false)
    expect(isFreebuffPremiumModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(false)
    expect(
      (FREEBUFF_STANDARD_MODEL_IDS as readonly string[]).includes(
        FREEBUFF_GLM_V53_FLASH_MODEL_ID,
      ),
    ).toBe(true)
    expect(
      (FREEBUFF_STANDARD_MODEL_IDS as readonly string[]).includes(
        FREEBUFF_GLM_V52_MODEL_ID,
      ),
    ).toBe(false)
    expect(isFreebuffGlmV53FlashModelId('z-ai/glm-5.3-flash-20260601')).toBe(
      true,
    )
    expect(isFreebuffGlmV52ModelId('z-ai/glm-5.3-flash-20260601')).toBe(false)
  })

  test('GLM 5.3 Flash is UNMETERED, and the two flags that say so agree', () => {
    expect(
      getFreebuffPerModelSessionCap(FREEBUFF_GLM_V53_FLASH_MODEL_ID),
    ).toBeUndefined()
    expect(isFreebuffPremiumModelId(FREEBUFF_GLM_V53_FLASH_MODEL_ID)).toBe(false)
    expect(
      (FREEBUFF_STANDARD_MODEL_IDS as readonly string[]).includes(
        FREEBUFF_GLM_V53_FLASH_MODEL_ID,
      ),
    ).toBe(true)
  })

  test('GLM 5.3 Flash: unmetered for FULL access, still closed to LIMITED', () => {
    const id = FREEBUFF_GLM_V53_FLASH_MODEL_ID

    expect(getFreebuffPerModelSessionCap(id)).toBeUndefined()
    expect(isFreebuffPremiumModelId(id)).toBe(false)
    expect((FREEBUFF_STANDARD_MODEL_IDS as readonly string[])).toContain(id)

    expect(isFreebuffPremiumModelId(id)).toBe(
      isFreebuffPremiumModelId(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
    )
    expect((FREEBUFF_STANDARD_MODEL_IDS as readonly string[])).toContain(
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )

    expect(LIMITED_FREEBUFF_MODEL_IDS as readonly string[]).not.toContain(id)
    expect(FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS as readonly string[]).not.toContain(id)
    expect(FREEBUFF_WEB_LIMITED_MODEL_IDS as readonly string[]).not.toContain(id)
    expect(isFreebuffWebModelAllowedForLimitedTier(id, false)).toBe(false)

    expect(FREEBUFF_MODELS.map((m) => m.id)).toContain(id)
    expect(isFreebuffPausedFreeModelId(id)).toBe(false)
    expect(FREEBUFF_MODELS.find((m) => m.id === id)?.availability).toBe('always')
  })

  test('every model is premium-listed and premium-flagged, or neither', () => {
    for (const model of FREEBUFF_MODELS) {
      expect({
        id: model.id,
        listed: isFreebuffPremiumModelId(model.id),
      }).toEqual({ id: model.id, listed: Boolean(model.premium) })
    }
  })

  test('every capped model, if any, owns its pool and stays premium-listed', () => {
    const pools = Object.values(FREEBUFF_PER_MODEL_SESSION_CAPS).map(
      (entry) => entry.pool,
    )
    expect(new Set(pools).size).toBe(pools.length)
    for (const id of Object.keys(FREEBUFF_PER_MODEL_SESSION_CAPS)) {
      expect(isFreebuffPremiumModelId(id)).toBe(true)
    }
  })

  test('no model supersedes any other', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    for (const id of all) {
      expect(getFreebuffModelSupersededBy(id, all)).toBeUndefined()
    }
  })

  test('V4 Flash, GLM 5.3 Flash and Luna are full-access only', () => {
    for (const id of [
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      FREEBUFF_GLM_V53_FLASH_MODEL_ID,
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    ]) {
      expect(isFreebuffSessionModelAllowedForAccessTier(id, 'limited')).toBe(
        false,
      )
      expect(isFreebuffSessionModelAllowedForAccessTier(id, 'full')).toBe(true)
    }
    expect(LIMITED_FREEBUFF_MODEL_IDS).not.toContain(
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    )
  })

  test('V4 Pro and V4 Flash are never both closed', () => {
    for (const hour of [0, 2, 5, 9, 10, 12, 18, 23]) {
      const at = new Date(Date.UTC(2026, 7, 22, hour, 0, 0))
      const pro = isFreebuffSessionModelAvailable(
        FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
        at,
      )
      const flash = isFreebuffSessionModelAvailable(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        at,
      )
      expect(pro || flash, `both closed at ${hour}:00 UTC`).toBe(true)
    }
    const peak = new Date('2026-08-22T02:00:00Z')
    expect(
      isFreebuffSessionModelAvailable(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID, peak),
    ).toBe(true)
    expect(
      isFreebuffSessionModelAvailable(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        peak,
      ),
    ).toBe(true)
  })

  test('any row that closes redirects to an OPEN premium row, not the unlimited one', () => {
    const peak = new Date('2026-08-22T02:00:00Z')
    for (const model of FREEBUFF_MODELS) {
      if (isFreebuffSessionModelAvailable(model.id, peak)) continue
      const landed = resolveAvailableFreebuffModel(model.id, peak)
      expect(landed, `${model.id} redirect`).not.toBe(model.id)
      expect(isFreebuffSessionModelAvailable(landed, peak)).toBe(true)
    }
  })

  test('no model is capped; every picker row uses the shared pool alone', () => {
    expect(Object.keys(FREEBUFF_PER_MODEL_SESSION_CAPS)).toEqual([])
    for (const model of FREEBUFF_MODELS) {
      expect(FREEBUFF_PER_MODEL_SESSION_CAPS[model.id]).toBeUndefined()
    }
    expect(
      FREEBUFF_PER_MODEL_SESSION_CAPS[FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID],
    ).toBeUndefined()
  })

  test('the tier notice quotes a number for exactly the capped models', () => {
    for (const model of FREEBUFF_MODELS) {
      const cap = FREEBUFF_PER_MODEL_SESSION_CAPS[model.id]
      const label = FREEBUFF_PER_MODEL_SESSION_CAPS[model.id]?.poolLabel
      if (cap) {
        expect(FREEBUFF_TIER_CHANGE_NOTICE).toContain(String(cap.limit))
        expect(label && FREEBUFF_TIER_CHANGE_NOTICE).toBeTruthy()
      }
    }
    expect(FREEBUFF_TIER_CHANGE_NOTICE).not.toContain('Pro is 1 session')
    expect(FREEBUFF_TIER_CHANGE_NOTICE).not.toMatch(/V4 Pro is \d/)

    if (Object.keys(FREEBUFF_PER_MODEL_SESSION_CAPS).length === 0) {
      expect(FREEBUFF_TIER_CHANGE_NOTICE).not.toMatch(/\d+\s*sessions?\s*a\s*day/i)
    }
  })

  test('MiMo 2.5 remains supported and follows the UI rollout flag', () => {
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_MIMO_V25_MODEL_ID,
    )

    if (FREEBUFF_ENABLE_MIMO_MODELS_IN_UI) {
      expect(FREEBUFF_MODELS.map((model) => model.id)).toContain(
        FREEBUFF_MIMO_V25_MODEL_ID,
      )
    } else {
      expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
        FREEBUFF_MIMO_V25_MODEL_ID,
      )
    }

    expect(isFreebuffPremiumModelId(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(false)
    expect(getFreebuffModelImageSupport(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(true)
  })

  test('MiMo 2.5 Pro is fully removed from Freebuff', () => {
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_MIMO_V25_PRO_MODEL_ID,
    )
    expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_MIMO_V25_PRO_MODEL_ID,
    )
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_MIMO_V25_PRO_MODEL_ID,
    )
    expect(isFreebuffModelId(FREEBUFF_MIMO_V25_PRO_MODEL_ID)).toBe(false)
    expect(isSupportedFreebuffModelId(FREEBUFF_MIMO_V25_PRO_MODEL_ID)).toBe(
      false,
    )
    expect(isFreebuffSessionModelId(FREEBUFF_MIMO_V25_PRO_MODEL_ID)).toBe(false)
    expect(isFreebuffPremiumModelId(FREEBUFF_MIMO_V25_PRO_MODEL_ID)).toBe(false)
    expect(isFreebuffSessionModelId(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(true)
  })

  test('reports image support only for known Freebuff models', () => {
    expect(
      getFreebuffModelImageSupport(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe(false)
    expect(getFreebuffModelImageSupport(MINIMAX_M3_MODEL_ID)).toBe(true)
    expect(
      getFreebuffModelImageSupport('vendor/new-vision-model'),
    ).toBeUndefined()

    for (const model of SUPPORTED_FREEBUFF_MODELS) {
      expect(isFreebuffMultimodalModelId(model.id)).toBe(model.multimodal)
    }
    for (const model of FREEBUFF_WEB_ALL_MODELS) {
      expect(isFreebuffWebMultimodalModelId(model.id)).toBe(model.multimodal)
    }
  })

  test('Kimi K2.7 Code is fully removed from Freebuff', () => {
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_KIMI_MODEL_ID,
    )
    expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_KIMI_MODEL_ID,
    )
    expect(
      getFreebuffModelsForAccessTier('full').map((m) => m.id),
    ).not.toContain(FREEBUFF_KIMI_MODEL_ID)
    expect(isFreebuffModelId(FREEBUFF_KIMI_MODEL_ID)).toBe(false)
    expect(isSupportedFreebuffModelId(FREEBUFF_KIMI_MODEL_ID)).toBe(false)
    expect(getFreebuffWebModel(FREEBUFF_KIMI_MODEL_ID).id).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
    expect(isFreebuffPremiumModelId(FREEBUFF_KIMI_MODEL_ID)).toBe(false)
    expect(
      isFreebuffModelAllowedForAccessTier(FREEBUFF_KIMI_MODEL_ID, 'full'),
    ).toBe(false)
    expect(
      resolveFreebuffModelForAccessTier(FREEBUFF_KIMI_MODEL_ID, 'full'),
    ).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    expect(
      isFreebuffSessionModelAllowedForAccessTier(
        FREEBUFF_KIMI_MODEL_ID,
        'full',
      ),
    ).toBe(false)
    expect(
      resolveFreebuffSessionModelForAccessTier(FREEBUFF_KIMI_MODEL_ID, 'full', {
        includeGodOnly: false,
      }),
    ).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    expect(isSupportedFreebuffModelId('moonshotai/kimi-k2.6')).toBe(false)
    expect(
      isFreebuffModelAllowedForAccessTier('moonshotai/kimi-k2.6', 'full'),
    ).toBe(false)
    expect(
      resolveFreebuffModelForAccessTier('moonshotai/kimi-k2.6', 'full'),
    ).not.toBe('moonshotai/kimi-k2.6')
  })

  test('both HY3 routes are fully removed from Freebuff', () => {
    for (const hy3Id of ['tencent/hy3:free', 'tencent/hy3']) {
      expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(hy3Id)
      expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
        hy3Id,
      )
      expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).not.toContain(hy3Id)
      expect(
        FREEBUFF_WEB_GOD_ONLY_MODELS.map((model) => model.id),
      ).not.toContain(hy3Id)
      expect(FREEBUFF_WEB_ALL_MODELS.map((model) => model.id)).not.toContain(
        hy3Id,
      )

      expect(isFreebuffModelId(hy3Id)).toBe(false)
      expect(isSupportedFreebuffModelId(hy3Id)).toBe(false)
      expect(isFreebuffWebModelId(hy3Id, { includeGodOnly: true })).toBe(false)
      expect(isFreebuffWebGodOnlyModelId(hy3Id)).toBe(false)
      expect(isFreebuffSessionModelId(hy3Id)).toBe(false)
      expect(isFreebuffWebPremiumModelId(hy3Id)).toBe(false)
      expect(isFreebuffPremiumModelId(hy3Id)).toBe(false)
      expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(hy3Id)
      expect(resolveFreebuffWebModel(hy3Id, { includeGodOnly: true })).toBe(
        FALLBACK_FREEBUFF_MODEL_ID,
      )
      expect(getFreebuffWebModel(hy3Id).id).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    }
  })

  test('the picker-retirement list is empty, and that is deliberate', () => {
    expect(FREEBUFF_WEB_RETIRED_PICKER_MODEL_IDS).toEqual([])
    for (const model of FREEBUFF_WEB_ALL_MODELS) {
      expect(isFreebuffWebSelectableModelId(model.id)).toBe(true)
    }
  })

  test('GLM 5.2 is referral-only and reachable by exactly one model id', () => {
    expect(isFreebuffWebSelectableModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(true)
    expect(
      isFreebuffWebSelectableModelId(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe(true)
  })

  test('CLI access-tier resolver preserves GLM at every tier', () => {
    expect(
      resolveFreebuffModelForAccessTier(FREEBUFF_GLM_V52_MODEL_ID, 'full'),
    ).toBe(FREEBUFF_GLM_V52_MODEL_ID)
    expect(
      resolveFreebuffModelForAccessTier(FREEBUFF_GLM_V52_MODEL_ID, 'limited'),
    ).toBe(FREEBUFF_GLM_V52_MODEL_ID)
    expect(
      resolveFreebuffModelForAccessTier(FREEBUFF_KIMI_MODEL_ID, 'limited'),
    ).toBe(LIMITED_FREEBUFF_MODEL_ID)
  })

  test('the CrofAI GLM 5.2 wire id is fully removed', () => {
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_CROF_GLM_V52_MODEL_ID,
    )
    expect(FREEBUFF_WEB_ALL_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_CROF_GLM_V52_MODEL_ID,
    )
    expect(isFreebuffWebModelId(FREEBUFF_CROF_GLM_V52_MODEL_ID)).toBe(false)
    expect(isFreebuffSessionModelId(FREEBUFF_CROF_GLM_V52_MODEL_ID)).toBe(false)
    expect(isFreebuffWebPremiumModelId(FREEBUFF_CROF_GLM_V52_MODEL_ID)).toBe(
      false,
    )
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(
      FREEBUFF_CROF_GLM_V52_MODEL_ID,
    )
    expect(resolveFreebuffWebModel(FREEBUFF_CROF_GLM_V52_MODEL_ID)).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
    expect(isFreebuffGlmV52ModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(true)
    expect(isFreebuffSessionModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(true)
  })

  test('GLM 5.2 is never remembered as the default model', () => {
    expect(isFreebuffWebRememberableModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(
      false,
    )
    expect(resolveRememberedFreebuffWebModel(FREEBUFF_GLM_V52_MODEL_ID)).toBe(
      DEFAULT_FREEBUFF_WEB_MODEL_ID,
    )
    expect(
      resolveRememberedFreebuffWebModel(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    expect(
      isFreebuffWebRememberableModelId(FREEBUFF_GLM_V53_FLASH_MODEL_ID),
    ).toBe(true)
    expect(resolveRememberedFreebuffWebModel(FREEBUFF_KIMI_MODEL_ID)).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
    expect(
      resolveRememberedFreebuffWebModel(FREEBUFF_KIMI_K3_ECO_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(FREEBUFF_KIMI_K3_ECO_MODEL_ID)
    expect(resolveRememberedFreebuffWebModel('some/retired-model')).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
  })

  test('every Web/Cloud model falls into exactly one quota group', () => {
    for (const model of FREEBUFF_WEB_ALL_MODELS) {
      const groups = [
        isFreebuffGlmV52ModelId(model.id),
        isFreebuffWebPremiumModelId(model.id),
      ].filter(Boolean)
      expect({ id: model.id, groups: groups.length }).toEqual({
        id: model.id,
        groups: model.premium ? 1 : 0,
      })
    }
  })

  test('the removed CrofAI GLM 5.2 id is admitted at no access tier', () => {
    for (const tier of ['limited', 'full'] as const) {
      expect(
        isFreebuffSessionModelAllowedForAccessTier(
          FREEBUFF_CROF_GLM_V52_MODEL_ID,
          tier,
        ),
      ).toBe(false)
    }
    expect(
      isFreebuffWebModelAllowedForLimitedTier(FREEBUFF_CROF_GLM_V52_MODEL_ID),
    ).toBe(false)
    expect(isFreebuffWebGeoExemptModelId(FREEBUFF_CROF_GLM_V52_MODEL_ID)).toBe(
      false,
    )
    expect(
      resolveFreebuffWebModelForLimitedTier(FREEBUFF_CROF_GLM_V52_MODEL_ID),
    ).toBe(LIMITED_FREEBUFF_MODEL_ID)
  })

  test('bounty GLM 5.2 survives the Web limited-tier coercion', () => {
    expect(
      isFreebuffWebModelAllowedForLimitedTier(FREEBUFF_GLM_V52_MODEL_ID),
    ).toBe(true)
    expect(
      resolveFreebuffWebModelForLimitedTier(FREEBUFF_GLM_V52_MODEL_ID),
    ).toBe(FREEBUFF_GLM_V52_MODEL_ID)

    expect(
      isFreebuffWebModelAllowedForLimitedTier(FREEBUFF_CROF_GLM_V52_MODEL_ID),
    ).toBe(false)
  })

  test('Kimi K3 is a god-only Freebuff Web/Cloud test model', () => {
    expect(FREEBUFF_KIMI_K3_ECO_MODEL_ID).toBe('crof/kimi-k3-eco')

    expect(FREEBUFF_WEB_GOD_ONLY_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_KIMI_K3_ECO_MODEL_ID,
    )
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_KIMI_K3_ECO_MODEL_ID,
    )
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_KIMI_K3_ECO_MODEL_ID,
    )

    expect(isFreebuffWebModelId(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(false)
    expect(
      isFreebuffWebModelId(FREEBUFF_KIMI_K3_ECO_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(true)
    expect(isFreebuffWebGodOnlyModelId(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(
      true,
    )
    expect(isFreebuffWebPremiumModelId(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(
      true,
    )
    expect(isFreebuffPremiumModelId(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(false)
    expect(isFreebuffModelId(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(false)
    expect(
      isFreebuffWebModelAllowedForLimitedTier(FREEBUFF_KIMI_K3_ECO_MODEL_ID),
    ).toBe(false)

    expect(resolveFreebuffWebModel(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
    expect(
      resolveFreebuffWebModel(FREEBUFF_KIMI_K3_ECO_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(FREEBUFF_KIMI_K3_ECO_MODEL_ID)

    const model = getFreebuffWebModel(FREEBUFF_KIMI_K3_ECO_MODEL_ID)
    expect(model.displayName).toBe('Kimi K3')
    expect(model.tagline).toBe('Via CrofAI')
    expect(model.experimental).toBe(true)
    expect(model.multimodal).toBe(false)
    expect(getFreebuffModelImageSupport(FREEBUFF_KIMI_K3_ECO_MODEL_ID)).toBe(
      false,
    )
  })

  test('Codex (test)/Luna-ES is a god-only Freebuff Web/Cloud test model', () => {
    expect(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID).toBe('openai/gpt-5.6-luna-es')

    expect(FREEBUFF_WEB_GOD_ONLY_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
    )
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
    )
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
    )

    expect(isFreebuffWebModelId(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)).toBe(false)
    expect(
      isFreebuffWebModelId(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(true)
    expect(isFreebuffWebGodOnlyModelId(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)).toBe(
      true,
    )
    expect(isFreebuffWebPremiumModelId(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)).toBe(
      true,
    )
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(
      FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
    )
    expect(isFreebuffPremiumModelId(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)).toBe(
      false,
    )
    expect(isFreebuffModelId(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)).toBe(false)
    expect(
      isFreebuffWebModelAllowedForLimitedTier(
        FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
      ),
    ).toBe(false)

    expect(resolveFreebuffWebModel(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
    expect(
      resolveFreebuffWebModel(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID, {
        includeGodOnly: true,
      }),
    ).toBe(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)

    const model = getFreebuffWebModel(FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID)
    expect(model.displayName).toBe('Codex (test)')
    expect(model.multimodal).toBe(false)
  })

  test('Ling 3.0 Flash and Greg 2 are fully removed from Freebuff', () => {
    for (const removedId of [
      'inclusionai/ling-3.0-flash:free',
      'crof/greg-2-ultra',
      'crof/greg-2-super',
    ]) {
      expect(FREEBUFF_WEB_ALL_MODELS.map((model) => model.id)).not.toContain(
        removedId,
      )
      expect(
        FREEBUFF_WEB_GOD_ONLY_MODELS.map((model) => model.id),
      ).not.toContain(removedId)
      expect(isFreebuffWebModelId(removedId, { includeGodOnly: true })).toBe(
        false,
      )
      expect(isFreebuffWebGodOnlyModelId(removedId)).toBe(false)
      expect(isFreebuffSessionModelId(removedId)).toBe(false)
      expect(isFreebuffWebPremiumModelId(removedId)).toBe(false)
      expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(removedId)
      expect(resolveFreebuffWebModel(removedId, { includeGodOnly: true })).toBe(
        FALLBACK_FREEBUFF_MODEL_ID,
      )
    }
  })

  test('KAT Coder Pro V2 is fully retired from Freebuff Web and Cloud', () => {
    const retiredKatModelId = 'kwaipilot/kat-coder-pro-v2'
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).not.toContain(
      retiredKatModelId,
    )
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      retiredKatModelId,
    )
    expect(isFreebuffWebModelId(retiredKatModelId)).toBe(false)
    expect(isFreebuffWebPremiumModelId(retiredKatModelId)).toBe(false)
    expect(resolveFreebuffWebModel(retiredKatModelId)).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
  })

  test('MiniMax M2.7 support is fully removed', () => {
    const legacyMinimaxM27 = 'minimax/minimax-m2.7'
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      legacyMinimaxM27,
    )
    expect(isFreebuffModelId(legacyMinimaxM27)).toBe(false)
    expect(isSupportedFreebuffModelId(legacyMinimaxM27)).toBe(false)
    expect(isFreebuffModelAllowedForAccessTier(legacyMinimaxM27, 'full')).toBe(
      false,
    )
    expect(resolveFreebuffModelForAccessTier(legacyMinimaxM27, 'full')).toBe(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
  })

  test('MiniMax M3 is withdrawn: recognised, refused, served to nobody', () => {
    expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      MINIMAX_M3_MODEL_ID,
    )
    expect(isFreebuffModelId(MINIMAX_M3_MODEL_ID)).toBe(false)
    expect(isFreebuffPremiumModelId(MINIMAX_M3_MODEL_ID)).toBe(false)
    expect(
      isFreebuffSessionModelAllowedForAccessTier(MINIMAX_M3_MODEL_ID, 'full'),
    ).toBe(false)

    expect(isFreebuffSessionModelId(MINIMAX_M3_MODEL_ID)).toBe(true)
    expect(isFreebuffPausedFreeModelId(MINIMAX_M3_MODEL_ID)).toBe(true)
    expect(freebuffWithdrawnModelMessage(MINIMAX_M3_MODEL_ID)).toContain(
      'no longer available in Freebuff',
    )
    expect(freebuffWithdrawnModelMessage(MINIMAX_M3_MODEL_ID)).toContain(
      'GPT-5.6 Luna',
    )

    expect(
      isFreeModeAllowedAgentModel('base2-free-minimax-m3', MINIMAX_M3_MODEL_ID),
    ).toBe(true)
  })

  test('the recommended default leads FREEBUFF_MODELS, and the fallback is in it', () => {
    expect(FREEBUFF_MODELS[0]!.id).toBe(DEFAULT_FREEBUFF_MODEL_ID)
    expect(FREEBUFF_MODELS.map((model) => model.id)).toContain(
      FALLBACK_FREEBUFF_MODEL_ID,
    )
  })

  test('GPT-5.6 Luna is a premium model on every full-access surface', () => {
    expect(FREEBUFF_GPT_5_6_LUNA_MODEL_ID).toBe('openai/gpt-5.6-luna')

    expect(FREEBUFF_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(getFreebuffModelsForAccessTier('full').map((m) => m.id)).toContain(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(isFreebuffWebGodOnlyModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(
      false,
    )
    expect(isFreebuffWebSelectableModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(
      true,
    )

    expect(isFreebuffPremiumModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(true)
    expect(isFreebuffWebPremiumModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(
      true,
    )
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(isFreebuffGlmV52ModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(false)
    expect(
      isFreebuffPremiumModelId(`${FREEBUFF_GPT_5_6_LUNA_MODEL_ID}-20260709`),
    ).toBe(true)
    expect(
      isFreebuffGpt56LunaModelId(`${FREEBUFF_GPT_5_6_LUNA_MODEL_ID}-20260709`),
    ).toBe(true)
    expect(isFreebuffGpt56LunaModelId(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(false)

    const model = getFreebuffWebModel(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)
    expect(model.displayName).toBe('GPT-5.6 Luna')
    expect(model.dataUse).toBe('service')
    expect(model.warning).toBeUndefined()
    expect(isFreebuffTracedModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(false)
    expect(getFreebuffModelImageSupport(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)).toBe(
      true,
    )
    expect(
      isFreebuffWebDeemphasizedModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID),
    ).toBe(false)

    expect(
      isFreebuffWebModelAllowedForLimitedTier(FREEBUFF_GPT_5_6_LUNA_MODEL_ID),
    ).toBe(false)
    expect(
      isFreebuffModelAllowedForAccessTier(
        FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
        'limited',
      ),
    ).toBe(false)
  })

  test('GPT-5.6 Luna carries its pinned OpenAI route, price ceiling, and effort', () => {
    expect(FREEBUFF_GPT_5_6_LUNA_PROVIDER_ROUTE).toBe('openai')
    expect(FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT).toBe('high')

    const { prompt, completion } = FREEBUFF_GPT_5_6_LUNA_MAX_PRICE
    expect(prompt).toBeGreaterThan(0.1)
    expect(completion).toBeGreaterThan(0.6)
    expect(prompt).toBeLessThan(1.0)
    expect(completion).toBeLessThan(6.0)
  })

  test('limited access exposes non-Pro MiMo 2.5, and not the paused Flash', () => {
    expect(LIMITED_FREEBUFF_MODEL_ID).toBe(FREEBUFF_MIMO_V25_MODEL_ID)
    expect(LIMITED_FREEBUFF_MODEL_IDS).toEqual([FREEBUFF_MIMO_V25_MODEL_ID])
    expect(getFreebuffModelsForAccessTier('limited').map((m) => m.id)).toEqual([
      FREEBUFF_MIMO_V25_MODEL_ID,
    ])
    expect(
      isFreebuffModelAllowedForAccessTier(FREEBUFF_OX_ALPHA_MODEL_ID, 'limited'),
    ).toBe(false)
    expect(
      isFreebuffModelAllowedForAccessTier(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        'limited',
      ),
    ).toBe(false)
    expect(
      isFreebuffModelAllowedForAccessTier(MINIMAX_M3_MODEL_ID, 'limited'),
    ).toBe(false)
    expect(
      isFreebuffModelAllowedForAccessTier(
        FREEBUFF_MIMO_V25_MODEL_ID,
        'limited',
      ),
    ).toBe(true)
    expect(
      isFreebuffModelAllowedForAccessTier(
        FREEBUFF_MIMO_V25_PRO_MODEL_ID,
        'limited',
      ),
    ).toBe(false)
    expect(
      resolveFreebuffModelForAccessTier(FREEBUFF_MIMO_V25_MODEL_ID, 'limited'),
    ).toBe(FREEBUFF_MIMO_V25_MODEL_ID)
    expect(
      resolveFreebuffModelForAccessTier(MINIMAX_M3_MODEL_ID, 'limited'),
    ).toBe(FREEBUFF_MIMO_V25_MODEL_ID)
    expect(
      resolveFreebuffModelForAccessTier(
        FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        'limited',
      ),
    ).toBe(FREEBUFF_MIMO_V25_MODEL_ID)
    expect(
      getFreebuffModelSupersededBy(FREEBUFF_MIMO_V25_MODEL_ID, [
        ...LIMITED_FREEBUFF_MODEL_IDS,
      ]),
    ).toBeUndefined()
  })

  test('the picker hero is joinable and in-tier', () => {
    expect(getRecommendedFreebuffModelId('full')).toBe(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(getRecommendedFreebuffModelId(undefined)).toBe(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(
      getRecommendedFreebuffModelId('full', { premiumExhausted: true }),
    ).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    expect(
      isFreebuffPremiumModelId(
        getRecommendedFreebuffModelId('full', { premiumExhausted: true }),
      ),
    ).toBe(false)
    expect(getRecommendedFreebuffModelId('limited')).toBe(
      FREEBUFF_MIMO_V25_MODEL_ID,
    )
    expect(
      getFreebuffModelsForAccessTier('limited').some(
        (m) => m.id === getRecommendedFreebuffModelId('limited'),
      ),
    ).toBe(true)
    expect(
      getRecommendedFreebuffModelId('limited', { premiumExhausted: true }),
    ).toBe(FREEBUFF_MIMO_V25_MODEL_ID)
  })

  test('every surface starts on GPT-5.6 Luna, on two separate constants', () => {
    expect(DEFAULT_FREEBUFF_WEB_MODEL_ID).toBe(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(DEFAULT_FREEBUFF_MODEL_ID).toBe(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)
    expect(getRecommendedFreebuffWebModelId('full')).toBe(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(getRecommendedFreebuffWebModelId(undefined)).toBe(
      FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    )
    expect(isFreebuffPausedFreeModelId(DEFAULT_FREEBUFF_MODEL_ID)).toBe(false)
    expect(isFreebuffPausedFreeModelId(DEFAULT_FREEBUFF_WEB_MODEL_ID)).toBe(
      false,
    )
    expect(
      getFreebuffModelSupersededBy(
        DEFAULT_FREEBUFF_WEB_MODEL_ID,
        FREEBUFF_WEB_MODELS.map((model) => model.id),
      ),
    ).toBeUndefined()
    expect(getRecommendedFreebuffWebModelId('limited')).toBe(
      LIMITED_FREEBUFF_MODEL_ID,
    )
    expect(
      getRecommendedFreebuffWebModelId('full', { premiumExhausted: true }),
    ).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    expect(
      isFreebuffPremiumModelId(
        getRecommendedFreebuffWebModelId('full', { premiumExhausted: true }),
      ),
    ).toBe(false)
    expect(isFreebuffWebModelId(DEFAULT_FREEBUFF_WEB_MODEL_ID)).toBe(true)
    expect(
      isFreebuffWebModelAllowedForLimitedTier(DEFAULT_FREEBUFF_WEB_MODEL_ID),
    ).toBe(false)
  })

  test('de-emphasizes nothing, and never the default', () => {
    expect(FREEBUFF_WEB_DEEMPHASIZED_MODEL_IDS).toEqual([])
    expect(isFreebuffWebDeemphasizedModelId(MINIMAX_M3_MODEL_ID)).toBe(false)
    expect(
      isFreebuffWebDeemphasizedModelId(`${FREEBUFF_KIMI_MODEL_ID}-20260301`),
    ).toBe(false)
    expect(
      isFreebuffWebDeemphasizedModelId(DEFAULT_FREEBUFF_WEB_MODEL_ID),
    ).toBe(false)
    expect(
      isFreebuffWebDeemphasizedModelId(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe(false)
    expect(isFreebuffWebDeemphasizedModelId(null)).toBe(false)
    expect(
      isFreebuffWebDeemphasizedModelId(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe(false)
    for (const id of FREEBUFF_WEB_DEEMPHASIZED_MODEL_IDS) {
      expect(isFreebuffWebModelId(id)).toBe(true)
      expect(isFreebuffModelAllowedForAccessTier(id, 'full')).toBe(true)
    }
  })

  test('a withdrawn model is not offered as anyone else’s switch target', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    expect(all).not.toContain(MINIMAX_M3_MODEL_ID)
    for (const id of all) {
      const superseded = getFreebuffModelSupersededBy(id, all)
      if (!superseded) continue
      expect(superseded.modelId).not.toBe(MINIMAX_M3_MODEL_ID)
      expect(all).toContain(superseded.modelId)
    }
    expect(
      getFreebuffModelSupersededBy(DEFAULT_FREEBUFF_MODEL_ID, all),
    ).toBeUndefined()
  })

  test('does not steer users off GPT-5.6 Luna, which is now the recommendation', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    expect(
      getFreebuffModelSupersededBy(FREEBUFF_GPT_5_6_LUNA_MODEL_ID, all),
    ).toBeUndefined()
    expect(
      migrateSupersededFreebuffModelPreference(
        FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
        all,
      ),
    ).toBeNull()
    expect(all).toContain(FREEBUFF_GPT_5_6_LUNA_MODEL_ID)
    expect(
      isFreebuffWebDeemphasizedModelId(FREEBUFF_GPT_5_6_LUNA_MODEL_ID),
    ).toBe(false)
  })

  test('never steers a saved pick toward a paused model', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    for (const id of all) {
      const superseded = getFreebuffModelSupersededBy(id, all)
      if (!superseded) continue
      expect(isFreebuffPausedFreeModelId(superseded.modelId)).toBe(false)
      expect(all).toContain(superseded.modelId)
    }
  })

  test('gives every desktop-selectable metered model a one-tab slot', () => {
    const desktopSelectable: readonly string[] = SUPPORTED_FREEBUFF_MODELS.map(
      (model) => model.id,
    )
    for (const id of FREEBUFF_WEB_PREMIUM_MODEL_IDS) {
      if (!desktopSelectable.includes(id)) continue
      expect(isFreebuffDesktopPremiumBucketModelId(id)).toBe(true)
    }
  })

  test('marks both new DeepSeek builds as NEW and dates their names', () => {
    const dated = [[FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID, '07/31']] as const
    const catalog: readonly FreebuffModelOption[] = FREEBUFF_MODELS
    for (const [id, date] of dated) {
      const model = catalog.find((candidate) => candidate.id === id)!
      expect(model.isNew).toBe(true)
      expect(model.displayName).toContain(date)
    }
    const undatedNew = [FREEBUFF_GLM_V53_FLASH_MODEL_ID]
    expect(
      catalog.filter(
        (model) => model.isNew && !undatedNew.includes(model.id),
      ),
    ).toHaveLength(dated.length)
  })

  test('migrates no saved pick anywhere, now that nothing supersedes', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    for (const current of [...all, MINIMAX_M3_MODEL_ID, undefined]) {
      expect(migrateSupersededFreebuffModelPreference(current, all)).toBeNull()
    }
    expect(
      migrateSupersededFreebuffModelPreference(FALLBACK_FREEBUFF_MODEL_ID, all),
    ).toBeNull()
    expect(
      migrateSupersededFreebuffModelPreference(MINIMAX_M3_MODEL_ID, [
        MINIMAX_M3_MODEL_ID,
      ]),
    ).toBeNull()
  })

  test('never de-emphasizes a model we still recommend', () => {
    const all = FREEBUFF_MODELS.map((model) => model.id)
    for (const model of FREEBUFF_MODELS) {
      if (isFreebuffWebDeemphasizedModelId(model.id)) {
        expect(getFreebuffModelSupersededBy(model.id, all)).toBeDefined()
      }
    }
    expect(isFreebuffWebDeemphasizedModelId(DEFAULT_FREEBUFF_MODEL_ID)).toBe(
      false,
    )
    expect(
      getFreebuffModelSupersededBy(DEFAULT_FREEBUFF_MODEL_ID, all),
    ).toBeUndefined()
  })

  test('never offers a switch to a model the surface cannot select', () => {
    expect(
      getFreebuffModelSupersededBy(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID, [
        FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      ]),
    ).toBeUndefined()
    expect(getFreebuffModelSupersededBy(undefined, [])).toBeUndefined()
    expect(getFreebuffModelSupersededBy('vendor/unknown', [])).toBeUndefined()
  })

  test('full-access freebuff models can spawn the gemini-thinker subagent', () => {
    expect(canFreebuffModelSpawnGeminiThinker(FREEBUFF_KIMI_MODEL_ID)).toBe(
      false,
    )
    expect(
      canFreebuffModelSpawnGeminiThinker(FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID),
    ).toBe(true)
    expect(
      canFreebuffModelSpawnGeminiThinker(FREEBUFF_MIMO_V25_PRO_MODEL_ID),
    ).toBe(false)
    expect(canFreebuffModelSpawnGeminiThinker(MINIMAX_M3_MODEL_ID)).toBe(true)
    expect(
      canFreebuffModelSpawnGeminiThinker(FREEBUFF_GPT_5_6_LUNA_MODEL_ID),
    ).toBe(true)

    expect(
      canFreebuffModelSpawnGeminiThinker(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe(false)
    expect(canFreebuffModelSpawnGeminiThinker(FREEBUFF_MIMO_V25_MODEL_ID)).toBe(
      false,
    )
  })

  test('does not support GLM 5.1 for freebuff sessions', () => {
    const glm = 'z-ai/glm-5.1'
    expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(glm)
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      glm,
    )
    expect(isFreebuffModelId(glm)).toBe(false)
    expect(isSupportedFreebuffModelId(glm)).toBe(false)
  })

  test('surfaces referral-gated GLM 5.2 only in the Web and Cloud picker', () => {
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_GLM_V52_MODEL_ID,
    )
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_GLM_V52_MODEL_ID,
    )
    expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_GLM_V52_MODEL_ID,
    )
    expect(isFreebuffWebPremiumModelId(FREEBUFF_GLM_V52_MODEL_ID)).toBe(false)
  })

  test('formats the close time in the user local timezone while deployment is open', () => {
    expect(
      getFreebuffDeploymentAvailabilityLabel(new Date('2026-01-05T18:00:00Z'), {
        locale: 'en-US',
        timeZone: 'America/Los_Angeles',
      }),
    ).toBe('until 5:00 PM')
  })

  test('formats the next open time in the user local timezone while deployment is closed', () => {
    expect(
      getFreebuffDeploymentAvailabilityLabel(new Date('2026-01-05T12:00:00Z'), {
        locale: 'en-US',
        timeZone: 'America/Los_Angeles',
      }),
    ).toBe('opens 6:00 AM')
  })

  test('includes the weekday when the next opening is on a later local day', () => {
    expect(
      getFreebuffDeploymentAvailabilityLabel(new Date('2026-01-11T03:00:00Z'), {
        locale: 'en-US',
        timeZone: 'America/Los_Angeles',
      }),
    ).toBe('opens Sun 6:00 AM')
  })

  test('tracks deployment hours correctly across the open and close boundaries', () => {
    expect(isFreebuffDeploymentHours(new Date('2026-01-05T13:59:00Z'))).toBe(
      false,
    )
    expect(isFreebuffDeploymentHours(new Date('2026-01-05T14:00:00Z'))).toBe(
      true,
    )
    expect(isFreebuffDeploymentHours(new Date('2026-01-06T00:59:00Z'))).toBe(
      true,
    )
    expect(isFreebuffDeploymentHours(new Date('2026-01-06T01:00:00Z'))).toBe(
      false,
    )
    expect(isFreebuffDeploymentHours(new Date('2026-01-10T20:00:00Z'))).toBe(
      true,
    )
  })
})

describe('limited-offer models (Claude Fable 5)', () => {
  test('is deliberately absent from every client picker catalog', () => {
    expect(FREEBUFF_MODELS.map((m) => m.id)).not.toContain(
      FREEBUFF_FABLE_5_MODEL_ID,
    )
    expect(isFreebuffModelId(FREEBUFF_FABLE_5_MODEL_ID)).toBe(false)
    expect(FREEBUFF_WEB_ALL_MODELS.map((m) => m.id)).not.toContain(
      FREEBUFF_FABLE_5_MODEL_ID,
    )
    expect(
      getFreebuffModelsForAccessTier('full').map((m) => m.id),
    ).not.toContain(FREEBUFF_FABLE_5_MODEL_ID)
  })

  test('is still a model the session and chat layers accept', () => {
    expect(isSupportedFreebuffModelId(FREEBUFF_FABLE_5_MODEL_ID)).toBe(true)
    expect(
      isFreebuffSessionModelAllowedForAccessTier(
        FREEBUFF_FABLE_5_MODEL_ID,
        'full',
      ),
    ).toBe(true)
    expect(getFreebuffModel(FREEBUFF_FABLE_5_MODEL_ID).displayName).toBe(
      'Claude Fable 5',
    )
  })

  test('an explicit pick survives resolution instead of silently downgrading', () => {
    expect(
      resolveFreebuffModelForAccessTier(FREEBUFF_FABLE_5_MODEL_ID, 'full'),
    ).toBe(FREEBUFF_FABLE_5_MODEL_ID)
  })

  test('limited-region users cannot reach it', () => {
    expect(
      isFreebuffSessionModelAllowedForAccessTier(
        FREEBUFF_FABLE_5_MODEL_ID,
        'limited',
      ),
    ).toBe(false)
    expect(
      resolveFreebuffSessionModelForAccessTier(
        FREEBUFF_FABLE_5_MODEL_ID,
        'limited',
      ),
    ).toBe(LIMITED_FREEBUFF_MODEL_ID)
  })

  test('traces are collected, which is the point of running the wave at all', () => {
    expect(isFreebuffTracedModelId(FREEBUFF_FABLE_5_MODEL_ID)).toBe(true)
    const fable = SUPPORTED_FREEBUFF_MODELS.find(
      (m) => m.id === FREEBUFF_FABLE_5_MODEL_ID,
    )
    expect((fable as { warning?: string } | undefined)?.warning).toBe(
      'May use data for AI training',
    )
  })

  test('is metered by its own pool, never the shared daily premium one', () => {
    expect(isFreebuffPremiumModelId(FREEBUFF_FABLE_5_MODEL_ID)).toBe(false)
    expect(isFreebuffWebPremiumModelId(FREEBUFF_FABLE_5_MODEL_ID)).toBe(false)
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(FREEBUFF_FABLE_5_MODEL_ID)
    expect(isFreebuffLimitedOfferModelId(FREEBUFF_FABLE_5_MODEL_ID)).toBe(true)
  })

  test('the offer predicate tolerates dated provider snapshots', () => {
    expect(
      isFreebuffLimitedOfferModelId(`${FREEBUFF_FABLE_5_MODEL_ID}-20260815`),
    ).toBe(true)
    expect(
      isFreebuffLimitedOfferModelId(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe(false)
    expect(isFreebuffLimitedOfferModelId(null)).toBe(false)
  })
})

describe('Meta Muse Spark 1.2 Contributor', () => {
  test('is a Freebuff Web model and reachable from no other surface', () => {
    expect(FREEBUFF_WEB_MODELS.map((model) => model.id)).toContain(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(SUPPORTED_FREEBUFF_MODELS.map((model) => model.id)).not.toContain(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(
      isSupportedFreebuffModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(false)
    expect(
      isFreebuffSessionModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(true)

    expect(
      isFreebuffWebModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(true)
    expect(
      isFreebuffWebGodOnlyModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(false)
    expect(
      isFreebuffWebSelectableModelId(
        FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
      ),
    ).toBe(true)
  })

  test('is metered by the Web premium pool and no other', () => {
    expect(
      isFreebuffWebPremiumModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(true)
    expect(FREEBUFF_STANDARD_MODEL_IDS).not.toContain(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(
      isFreebuffGlmV52ModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(false)
    expect(
      isFreebuffPremiumModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(false)
  })

  test('carries a reasoning effort that the server can actually resolve', () => {
    const model = getFreebuffWebModel(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(model.reasoningEffort).toBe(FREEBUFF_MUSE_SPARK_REASONING_EFFORT)
    expect(
      getFreebuffModelReasoningEffort(
        FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
      ),
    ).toBe(FREEBUFF_MUSE_SPARK_REASONING_EFFORT)

    expect(FREEBUFF_MUSE_SPARK_REASONING_EFFORT).not.toBe('none')
    expect(['minimal', 'low', 'medium', 'high', 'xhigh']).toContain(
      FREEBUFF_MUSE_SPARK_REASONING_EFFORT,
    )

    expect(
      getFreebuffModelReasoningEffort(
        `${FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID}-20260901`,
      ),
    ).toBe(FREEBUFF_MUSE_SPARK_REASONING_EFFORT)

    expect(
      getFreebuffModelReasoningEffort(FREEBUFF_KIMI_K3_ECO_MODEL_ID),
    ).toBeNull()
  })

  test('discloses the Contributor tier training terms', () => {
    const model = getFreebuffWebModel(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(model.displayName).toBe('Muse Spark 1.2')
    expect(model.dataUse).toBe('training')
    expect(model.warning).toBe('May use data for AI training')
  })

  test('has exactly one wire id, and the predicate tolerates dated snapshots', () => {
    expect(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID).toBe(
      'meta/muse-spark-1.2-contributor',
    )
    expect(
      FREEBUFF_WEB_ALL_MODELS.map((model): string => model.id),
    ).not.toContain(MUSE_SPARK_12_CONTRIBUTOR_UPSTREAM_MODEL_ID)

    expect(
      isMuseSparkModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(true)
    expect(
      isMuseSparkModelId(
        `${FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID}-20260901`,
      ),
    ).toBe(true)
    expect(isMuseSparkModelId('meta/muse-spark-1.2')).toBe(false)
    expect(isMuseSparkModelId(null)).toBe(false)
  })
})

describe('Muse Spark rate-limit fallback', () => {
  test('reroutes only to a model the caller is already entitled to', () => {
    expect(
      isFreebuffWebPremiumModelId(MUSE_SPARK_FALLBACK_MODEL_ID) ||
        FREEBUFF_STANDARD_MODEL_IDS.includes(MUSE_SPARK_FALLBACK_MODEL_ID),
    ).toBe(true)
    expect(
      isFreebuffWebPremiumModelId(FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID),
    ).toBe(true)
    expect(isFreebuffGlmV52ModelId(MUSE_SPARK_FALLBACK_MODEL_ID)).toBe(false)
    expect(FREEBUFF_GLM_V52_MODEL_IDS).not.toContain(
      MUSE_SPARK_FALLBACK_MODEL_ID,
    )
    expect(isFreebuffWebModelId(MUSE_SPARK_FALLBACK_MODEL_ID)).toBe(true)
    expect(MUSE_SPARK_FALLBACK_MODEL_ID).not.toBe(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
  })

  test('the picker promises exactly what the server does', () => {
    const model = getFreebuffWebModel(
      FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    )
    expect(model.tagline).toBe('Queue')
    expect(model.taglineTooltip).toBe(MUSE_SPARK_FALLBACK_NOTICE)
    expect(MUSE_SPARK_FALLBACK_NOTICE).toContain(
      getFreebuffWebModel(MUSE_SPARK_FALLBACK_MODEL_ID).displayName.replace(
        /\s+\d{2}\/\d{2}$/,
        '',
      ),
    )
    expect(model.isNew).toBeUndefined()
    expect(MUSE_SPARK_FALLBACK_AFTER_MS).toBe(10_000)
  })
})

describe('the unavailability window matches the reason for the closure', () => {
  const peak = new Date('2026-08-25T08:00:00Z')

  test('no model is peak-closed, so no row can quote a peak window', () => {
    expect(
      freebuffModelUnavailableWindow(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID, peak),
    ).not.toContain('again at')
  })

  test('an unrecognised closure falls back to the staffing label, not a guess', () => {
    expect(freebuffModelUnavailableWindow('mimo/mimo-v2.5', peak)).toBe(
      FREEBUFF_DEPLOYMENT_HOURS_LABEL,
    )
  })
})
