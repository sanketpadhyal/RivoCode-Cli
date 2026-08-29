import {
  addDaysToYmd,
  getUtcForZonedTime,
  getZonedParts,
  type ZonedDateParts,
} from '../util/zoned-time'
import {
  deepSeekExpensiveWindowEndsAt,
  FALLBACK_WINDOW_TIME_ZONE,
  formatDeepSeekExpensiveWindowReturn,
  formatDeepSeekOffPeakWindowLocal,
  formatWindowTimeZoneLabel,
  isDeepSeekExpensiveWindow,
} from './freebuff-peak-hours'
import { mimoModels } from './model-config'
import {
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_MINIMAX_M3_MODEL_ID,
} from './freebuff-model-ids'
import {
  FREEBUFF_AI_TRAINING_NOTICE,
  type FreebuffModelDataUse,
} from './freebuff-data-use'
import { clampReasoningEffort, type ReasoningEffort } from './reasoning-effort'

export {
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_MINIMAX_M3_MODEL_ID,
} from './freebuff-model-ids'

export interface FreebuffModelOption {
  id: string
  displayName: string
  tagline: string
  availability: 'always' | 'deployment_hours' | 'off_peak_only'
  unavailableFallback?: string
  warning?: string
  dataUse: FreebuffModelDataUse
  premium: boolean
  multimodal: boolean
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  efforts?: readonly ReasoningEffort[]
  defaultEffort?: ReasoningEffort
  experimental?: boolean
  taglineTooltip?: string
  isNew?: boolean
  supersededBy?: {
    modelId: string
    notice: string
    actionLabel: string
  }
}

export const FREEBUFF_DEPLOYMENT_HOURS_LABEL = '9am ET-5pm PT every day'
export const FREEBUFF_GEMINI_PRO_MODEL_ID = 'google/gemini-3.1-pro-preview'
export const FREEBUFF_DEEPSEEK_V4_FLASH_FIREWORKS_MODEL_ID =
  'fireworks/deepseek-v4-flash'
export const FREEBUFF_MIMO_V25_MODEL_ID = mimoModels.mimoV25
export const FREEBUFF_GLM_V52_MODEL_ID = 'z-ai/glm-5.2'
export const FREEBUFF_GLM_V53_FLASH_MODEL_ID = 'z-ai/glm-5.3-flash'
export const FREEBUFF_GLM_V53_FLASH_MAX_PRICE = {
  prompt: 0.1,
  completion: 0.3,
} as const
export const FREEBUFF_GPT_5_6_LUNA_MODEL_ID = 'openai/gpt-5.6-luna'
export const FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID = 'openai/gpt-5.6-luna-es'
export const FREEBUFF_GPT_5_6_LUNA_PROVIDER_ROUTE = 'openai'
export const FREEBUFF_GPT_5_6_LUNA_MAX_PRICE = {
  prompt: 0.5,
  completion: 3.0,
} as const
export const FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT = 'high' as const
export const FREEBUFF_SOLAR_PRO_4_MODEL_ID = 'upstage/solar-pro4'
export const FREEBUFF_KIMI_K3_ECO_MODEL_ID = 'crof/kimi-k3-eco'
export const FREEBUFF_DEEPSEEK_V4_PRO_MAX_MODEL_ID =
  'deepseek/deepseek-v4-pro-max'
export const FREEBUFF_DEEPSEEK_V4_FLASH_MAX_MODEL_ID =
  'deepseek/deepseek-v4-flash-max'
export const FREEBUFF_GPT_5_6_LUNA_MAX_MODEL_ID = 'openai/gpt-5.6-luna-max'

export const FREEBUFF_FABLE_5_MODEL_ID = 'anthropic/claude-fable-5'

export const FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID =
  'meta/muse-spark-1.2-contributor'
export const MUSE_SPARK_12_CONTRIBUTOR_UPSTREAM_MODEL_ID =
  'muse-spark-1.2-contributor'
export const MUSE_SPARK_CONTRIBUTOR_RPM = 60
export const FREEBUFF_MUSE_SPARK_REASONING_EFFORT = 'xhigh' as const

export const FREEBUFF_OX_ALPHA_MODEL_ID = 'stealth/ox-alpha'
export const FREEBUFF_OX_ALPHA_MAX_PRICE = {
  prompt: 0,
  completion: 0,
} as const

export const EFFORTS_THROUGH_HIGH = ['low', 'medium', 'high'] as const
export const EFFORTS_THROUGH_XHIGH = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const
export const EFFORTS_THROUGH_MAX = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const
const DEEPSEEK_V4_REASONING_EFFORTS = ['low', 'high', 'max'] as const
const OX_ALPHA_REASONING_EFFORTS = ['low', 'high', 'max'] as const
export const MUSE_SPARK_RATE_LIMITED_ERROR_CODE = 'muse_spark_rate_limited'

export const MUSE_SPARK_FALLBACK_MODEL_ID = FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID

export const MUSE_SPARK_FALLBACK_AFTER_MS = 10_000

export const MUSE_SPARK_FALLBACK_NOTICE =
  'Falls back to DeepSeek V4 Flash if the queue is too long.'

export const FREEBUFF_ENABLE_MIMO_MODELS_IN_UI = true
export const FREEBUFF_ENABLE_STREAK_IN_UI = true
export const FREEBUFF_FORCE_LIMITED_MODE = false
export const FREEBUFF_PREMIUM_SESSION_LIMIT = 4
export const FREEBUFF_LIMITED_SESSION_LIMIT = 3

export const FREEBUFF_PRE_LEVELS_PREMIUM_SESSION_LIMIT = 5
export const FREEBUFF_PRE_LEVELS_LIMITED_SESSION_LIMIT = 6
export const FREEBUFF_PREMIUM_SESSION_RESET_TIMEZONE = 'America/Los_Angeles'
export const FREEBUFF_PREMIUM_SESSION_PERIOD = 'pacific_day'
export const FREEBUFF_GLM_V52_SESSION_PERIOD = FREEBUFF_PREMIUM_SESSION_PERIOD
export const FREEBUFF_GLM_V52_SESSION_RESET_TIMEZONE =
  FREEBUFF_PREMIUM_SESSION_RESET_TIMEZONE
export const FREEBUFF_GLM_V52_SESSION_WINDOW_HOURS = 24
export const FREEBUFF_GLM_V52_MAX_DAILY_SESSIONS = 1
export const FREEBUFF_GLM_V52_REFERRAL_ENABLED = true
export const FREEBUFF_GLM_V52_SESSION_LENGTH_MS = 60 * 60 * 1000
export const FREEBUFF_LIMITED_SESSION_RESET_TIMEZONE =
  FREEBUFF_PREMIUM_SESSION_RESET_TIMEZONE
export const FREEBUFF_LIMITED_SESSION_PERIOD = FREEBUFF_PREMIUM_SESSION_PERIOD

export const FREEBUFF_STREAK_REWARD_INTERVAL_DAYS = 7
export const FREEBUFF_STREAK_GLM_BONUS_MAX_MULTIPLIER = 4
export const FREEBUFF_STREAK_REWARDS_ENABLED = true
export const FREEBUFF_STREAK_GLM_BONUS_ENABLED = true
export const FREEBUFF_STREAK_BONUS_SESSION_UNITS = 1

export const FREEBUFF_USAGE_MAP_DAYS = 365

export const FREEBUFF_RECENT_TOKENS_DAYS = 7

export type FreebuffStreakRewardPool = 'premium' | 'limited' | 'glm'
export const FREEBUFF_PREMIUM_SESSION_WINDOW_HOURS = 24
export const FREEBUFF_LIMITED_SESSION_WINDOW_HOURS =
  FREEBUFF_PREMIUM_SESSION_WINDOW_HOURS

const FREEBUFF_EASTERN_TIMEZONE = 'America/New_York'
const FREEBUFF_PACIFIC_TIMEZONE = 'America/Los_Angeles'

interface LocalTimeFormatOptions {
  locale?: string
  timeZone?: string
}

export const FREEBUFF_GEMINI_THINKER_PARENT_MODELS = new Set<string>([
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_MINIMAX_M3_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
])

export function canFreebuffModelSpawnGeminiThinker(modelId: string): boolean {
  return FREEBUFF_GEMINI_THINKER_PARENT_MODELS.has(modelId)
}

export const FREEBUFF_MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  [FREEBUFF_MINIMAX_M3_MODEL_ID]: 524_288,
  [FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]: 1_048_576,
  [FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]: 1_048_576,
  [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: 1_000_000,
  [FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID]: 372_000,
  [FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID]: 1_000_000,
  [FREEBUFF_OX_ALPHA_MODEL_ID]: 1_000_000,
  [FREEBUFF_GLM_V53_FLASH_MODEL_ID]: 1_000_000,
  [FREEBUFF_SOLAR_PRO_4_MODEL_ID]: 500_000,
}

export const FREEBUFF_DEFAULT_CONTEXT_WINDOW = 131_072

const DEEPSEEK_V4_PRO_MODEL = {
  id: FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  displayName: 'DeepSeek V4 Pro',
  tagline: 'Deep reasoning',
  availability: 'always',
  warning: FREEBUFF_AI_TRAINING_NOTICE,
  dataUse: 'training',
  premium: true,
  multimodal: false,
  reasoningEffort: 'high',
  efforts: DEEPSEEK_V4_REASONING_EFFORTS,
  defaultEffort: 'high',
} as const satisfies FreebuffModelOption

const MIMO_V25_MODEL = {
  id: FREEBUFF_MIMO_V25_MODEL_ID,
  displayName: 'MiMo 2.5',
  tagline: 'Balanced',
  availability: 'always',
  dataUse: 'service',
  premium: false,
  multimodal: true,
} as const satisfies FreebuffModelOption

const DEEPSEEK_V4_FLASH_MODEL = {
  id: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  displayName: 'DeepSeek V4 Flash 07/31',
  tagline: 'Smart & Fast',
  availability: 'always',
  unavailableFallback: FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  warning: FREEBUFF_AI_TRAINING_NOTICE,
  dataUse: 'training',
  premium: false,
  multimodal: false,
  reasoningEffort: 'high',
  efforts: DEEPSEEK_V4_REASONING_EFFORTS,
  defaultEffort: 'high',
  isNew: true,
} as const satisfies FreebuffModelOption

const DEEPSEEK_V4_PRO_MAX_MODEL = {
  id: FREEBUFF_DEEPSEEK_V4_PRO_MAX_MODEL_ID,
  displayName: 'DeepSeek V4 Pro (Max context)',
  tagline: 'Extended context',
  availability: 'always',
  warning: FREEBUFF_AI_TRAINING_NOTICE,
  dataUse: 'training',
  premium: false,
  multimodal: false,
  reasoningEffort: 'high',
  defaultEffort: 'high',
} as const satisfies FreebuffModelOption

const DEEPSEEK_V4_FLASH_MAX_MODEL = {
  id: FREEBUFF_DEEPSEEK_V4_FLASH_MAX_MODEL_ID,
  displayName: 'DeepSeek V4 Flash (Max context)',
  tagline: 'Extended context',
  availability: 'always',
  warning: FREEBUFF_AI_TRAINING_NOTICE,
  dataUse: 'training',
  premium: false,
  multimodal: false,
  reasoningEffort: 'high',
  defaultEffort: 'high',
} as const satisfies FreebuffModelOption

const GPT_5_6_LUNA_MAX_MODEL = {
  id: FREEBUFF_GPT_5_6_LUNA_MAX_MODEL_ID,
  displayName: 'GPT-5.6 Luna (Max context)',
  tagline: 'Extended context',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: false,
  reasoningEffort: FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
} as const satisfies FreebuffModelOption

export const FREEBUFF_PROVISIONED_MODELS = [
  DEEPSEEK_V4_PRO_MAX_MODEL,
  DEEPSEEK_V4_FLASH_MAX_MODEL,
  GPT_5_6_LUNA_MAX_MODEL,
] as const satisfies readonly FreebuffModelOption[]

const MINIMAX_M3_MODEL = {
  id: FREEBUFF_MINIMAX_M3_MODEL_ID,
  displayName: 'MiniMax M3',
  tagline: 'Fastest',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: true,
} as const satisfies FreebuffModelOption

const GPT_5_6_LUNA_MODEL = {
  id: FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  displayName: 'GPT-5.6 Luna',
  tagline: 'Strong all-around',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: true,
  reasoningEffort: FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
  efforts: EFFORTS_THROUGH_MAX,
  defaultEffort: FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
} as const satisfies FreebuffModelOption

const SOLAR_PRO_4_MODEL = {
  id: FREEBUFF_SOLAR_PRO_4_MODEL_ID,
  displayName: 'Solar Pro 4',
  tagline: 'Limited-time trial',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: false,
  experimental: true,
} as const satisfies FreebuffModelOption

const GLM_V52_MODEL = {
  id: FREEBUFF_GLM_V52_MODEL_ID,
  displayName: 'GLM 5.2',
  tagline: 'Unlock by referring friends',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: false,
} as const satisfies FreebuffModelOption

const GLM_V53_FLASH_MODEL = {
  id: FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  displayName: 'GLM 5.3 Flash',
  tagline: 'Deep reasoning',
  availability: 'always',
  dataUse: 'service',
  premium: false,
  multimodal: true,
  isNew: true,
} as const satisfies FreebuffModelOption

const GPT_5_6_LUNA_ES_MODEL = {
  id: FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
  displayName: 'Codex (test)',
  tagline: 'Novita route — evaluation only',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: false,
  reasoningEffort: FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
} as const satisfies FreebuffModelOption

const KIMI_K3_ECO_MODEL = {
  id: FREEBUFF_KIMI_K3_ECO_MODEL_ID,
  displayName: 'Kimi K3',
  tagline: 'Via CrofAI',
  availability: 'always',
  dataUse: 'service',
  premium: true,
  multimodal: false,
  experimental: true,
} as const satisfies FreebuffModelOption

const FABLE_5_MODEL = {
  id: FREEBUFF_FABLE_5_MODEL_ID,
  displayName: 'Claude Fable 5',
  tagline: "Anthropic's most intelligent model",
  availability: 'always',
  warning: FREEBUFF_AI_TRAINING_NOTICE,
  dataUse: 'training',
  premium: true,
  multimodal: true,
  efforts: EFFORTS_THROUGH_MAX,
  defaultEffort: 'high',
  isNew: true,
} as const satisfies FreebuffModelOption

const MUSE_SPARK_12_CONTRIBUTOR_MODEL = {
  id: FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
  displayName: 'Muse Spark 1.2',
  tagline: 'Queue',
  taglineTooltip: MUSE_SPARK_FALLBACK_NOTICE,
  availability: 'always',
  warning: FREEBUFF_AI_TRAINING_NOTICE,
  dataUse: 'training',
  premium: true,
  multimodal: false,
  reasoningEffort: FREEBUFF_MUSE_SPARK_REASONING_EFFORT,
  efforts: EFFORTS_THROUGH_XHIGH,
  defaultEffort: FREEBUFF_MUSE_SPARK_REASONING_EFFORT,
} as const satisfies FreebuffModelOption

const OX_ALPHA_MODEL = {
  id: FREEBUFF_OX_ALPHA_MODEL_ID,
  displayName: 'Ox Alpha',
  tagline: '1M context',
  availability: 'always',
  warning: 'Anonymous provider retains prompts',
  dataUse: 'service',
  premium: false,
  multimodal: true,
  reasoningEffort: 'high',
  efforts: OX_ALPHA_REASONING_EFFORTS,
  defaultEffort: 'high',
  experimental: true,
} as const satisfies FreebuffModelOption

export const SUPPORTED_FREEBUFF_MODELS = [
  OX_ALPHA_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
  MINIMAX_M3_MODEL,
  GPT_5_6_LUNA_MODEL,
  SOLAR_PRO_4_MODEL,
  GLM_V52_MODEL,
  GLM_V53_FLASH_MODEL,
  DEEPSEEK_V4_FLASH_MODEL,
  MIMO_V25_MODEL,
  FABLE_5_MODEL,
] as const satisfies readonly FreebuffModelOption[]

export const FREEBUFF_MODELS = [
  GPT_5_6_LUNA_MODEL,
  DEEPSEEK_V4_FLASH_MODEL,
  ...(FREEBUFF_ENABLE_MIMO_MODELS_IN_UI ? [MIMO_V25_MODEL] : []),
  SOLAR_PRO_4_MODEL,
  GLM_V53_FLASH_MODEL,
] as const satisfies readonly FreebuffModelOption[]

export const FREEBUFF_PREMIUM_MODEL_IDS = [
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_SOLAR_PRO_4_MODEL_ID,
] as const

export const FREEBUFF_PER_MODEL_SESSION_CAPS: Readonly<
  Record<string, { limit: number; pool: string; poolLabel: string }>
> = {
}

export function getFreebuffPerModelSessionCap(
  model: string | null | undefined,
): { limit: number; pool: string; poolLabel: string } | undefined {
  if (!model) return undefined
  return FREEBUFF_PER_MODEL_SESSION_CAPS[model]
}

export const FREEBUFF_DEEPSEEK_SESSION_PERIOD = FREEBUFF_PREMIUM_SESSION_PERIOD
export const FREEBUFF_DEEPSEEK_SESSION_RESET_TIMEZONE =
  FREEBUFF_PREMIUM_SESSION_RESET_TIMEZONE
export const FREEBUFF_DEEPSEEK_SESSION_WINDOW_HOURS =
  FREEBUFF_PREMIUM_SESSION_WINDOW_HOURS

export const FREEBUFF_PAUSED_FREE_MODEL_IDS: readonly string[] = [
  FREEBUFF_MINIMAX_M3_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_OX_ALPHA_MODEL_ID,
]

export function freebuffWithdrawnModelMessage(id: string): string {
  const model = SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === id)
  const name = model?.displayName ?? id
  const replacement =
    SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === DEFAULT_FREEBUFF_MODEL_ID)
      ?.displayName ?? DEFAULT_FREEBUFF_MODEL_ID
  return `${name} is no longer available in Freebuff. We recommend using ${replacement} instead.`
}

export function freebuffWithdrawnModelAvailabilityLabel(): string {
  const replacement =
    SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === DEFAULT_FREEBUFF_MODEL_ID)
      ?.displayName ?? DEFAULT_FREEBUFF_MODEL_ID
  return `no longer offered in free mode — we recommend ${replacement}`
}

export function isFreebuffPausedFreeModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_PAUSED_FREE_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export const FREEBUFF_LIMITED_OFFER_MODEL_IDS = [
  FREEBUFF_FABLE_5_MODEL_ID,
] as const

export type FreebuffLimitedOfferModelId =
  (typeof FREEBUFF_LIMITED_OFFER_MODEL_IDS)[number]

export function isFreebuffLimitedOfferModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_LIMITED_OFFER_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export const FREEBUFF_LIMITED_OFFER_SESSION_LIMIT = 1

export const FREEBUFF_LIMITED_OFFER_SESSION_PERIOD =
  FREEBUFF_PREMIUM_SESSION_PERIOD
export const FREEBUFF_LIMITED_OFFER_SESSION_RESET_TIMEZONE =
  FREEBUFF_PREMIUM_SESSION_RESET_TIMEZONE
export const FREEBUFF_LIMITED_OFFER_SESSION_WINDOW_HOURS =
  FREEBUFF_PREMIUM_SESSION_WINDOW_HOURS

export const FREEBUFF_WEB_MODELS = [
  MUSE_SPARK_12_CONTRIBUTOR_MODEL,
  GLM_V52_MODEL,
  ...FREEBUFF_MODELS,
] as const satisfies readonly FreebuffModelOption[]

export const FREEBUFF_WEB_GOD_ONLY_MODELS = [
  KIMI_K3_ECO_MODEL,
  GPT_5_6_LUNA_ES_MODEL,
] as const satisfies readonly FreebuffModelOption[]

export const FREEBUFF_WEB_ALL_MODELS = [
  ...FREEBUFF_WEB_GOD_ONLY_MODELS,
  ...FREEBUFF_WEB_MODELS,
] as const satisfies readonly FreebuffModelOption[]

export const FREEBUFF_WEB_GOD_ONLY_MODEL_IDS = Object.freeze(
  FREEBUFF_WEB_GOD_ONLY_MODELS.map((model) => model.id),
)

export const FREEBUFF_WEB_RETIRED_PICKER_MODEL_IDS = [] as const

export function isFreebuffWebSelectableModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return !FREEBUFF_WEB_RETIRED_PICKER_MODEL_IDS.some(
    (modelId) => modelId === id,
  )
}

export const FREEBUFF_WEB_PREMIUM_MODEL_IDS = [
  ...FREEBUFF_PREMIUM_MODEL_IDS,
  FREEBUFF_KIMI_K3_ECO_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
  FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
] as const

export const FREEBUFF_STANDARD_MODEL_IDS = Object.freeze(
  FREEBUFF_WEB_ALL_MODELS.filter((model) => !model.premium).map(
    (model) => model.id,
  ),
)

export const FREEBUFF_GLM_V52_MODEL_IDS = [FREEBUFF_GLM_V52_MODEL_ID] as const

export const FREEBUFF_DESKTOP_PREMIUM_BUCKET_MODEL_IDS = [
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  FREEBUFF_SOLAR_PRO_4_MODEL_ID,
] as const

export const FREEBUFF_DESKTOP_SESSION_LIMITS = {
  premium: 1,
  unlimited: 3,
} as const
export type FreebuffDesktopSessionBucket =
  keyof typeof FREEBUFF_DESKTOP_SESSION_LIMITS

export function occupiesFreebuffDesktopSlot(
  model: string,
  accessTier: FreebuffAccessTier | null | undefined,
): boolean {
  return (
    accessTier === 'limited' || isFreebuffDesktopPremiumBucketModelId(model)
  )
}

export function getFreebuffDesktopSessionBucket(
  model: string,
  accessTier: FreebuffAccessTier | null | undefined,
): FreebuffDesktopSessionBucket {
  return occupiesFreebuffDesktopSlot(model, accessTier)
    ? 'premium'
    : 'unlimited'
}

export const FREEBUFF_INSTANCE_HEADER = 'x-freebuff-instance-id'
export const FREEBUFF_MODEL_HEADER = 'x-freebuff-model'
export const FREEBUFF_ACTING_USER_HEADER = 'x-freebuff-acting-user-id'
export const FREEBUFF_PRIVILEGED_USER_HEADER = 'x-freebuff-privileged-user'
export const FREEBUFF_INCLUDE_UNUSED_RATE_LIMITS_HEADER =
  'x-freebuff-include-unused-rate-limits'
export const FREEBUFF_COMPACT_SESSION_HEADER = 'x-freebuff-compact-session'
export const FREEBUFF_MULTI_SESSION_HEADER = 'x-freebuff-multi-session'
export const FREEBUFF_HEARTBEAT_HEADER = 'x-freebuff-heartbeat'
export const FREEBUFF_SESSION_HEARTBEAT_INTERVAL_MS = 45_000
export const FREEBUFF_TAKEOVER_INSTANCE_HEADER =
  'x-freebuff-takeover-instance-id'
export const FREEBUFF_SESSION_GRACE_MS = 30 * 60 * 1000

export const FREEBUFF_DESKTOP_IDLE_RELEASE_MS = 10 * 60 * 1000

export const FREEBUFF_MULTIMODAL_MODEL_IDS = Object.freeze(
  SUPPORTED_FREEBUFF_MODELS.filter((model) => model.multimodal).map(
    (model) => model.id,
  ),
)

export const FREEBUFF_WEB_MULTIMODAL_MODEL_IDS = Object.freeze(
  FREEBUFF_WEB_ALL_MODELS.filter((model) => model.multimodal).map(
    (model) => model.id,
  ),
)

export const FREEBUFF_TRACED_MODEL_IDS = SUPPORTED_FREEBUFF_MODELS.filter(
  (model: FreebuffModelOption) => model.dataUse === 'training',
).map((model) => model.id)

export type FreebuffModelId = (typeof FREEBUFF_MODELS)[number]['id']
export type SupportedFreebuffModelId =
  (typeof SUPPORTED_FREEBUFF_MODELS)[number]['id']
export type FreebuffPremiumModelId = (typeof FREEBUFF_PREMIUM_MODEL_IDS)[number]
export type FreebuffWebModelId = (typeof FREEBUFF_WEB_ALL_MODELS)[number]['id']
export type FreebuffWebPremiumModelId =
  (typeof FREEBUFF_WEB_PREMIUM_MODEL_IDS)[number]

export const DEFAULT_FREEBUFF_MODEL_ID: FreebuffModelId =
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID

export const DEFAULT_FREEBUFF_WEB_MODEL_ID: FreebuffWebModelId =
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID

export const FREEBUFF_WEB_DEEMPHASIZED_MODEL_IDS: readonly FreebuffModelId[] =
  []

export function isFreebuffWebDeemphasizedModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_WEB_DEEMPHASIZED_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export const FALLBACK_FREEBUFF_MODEL_ID: FreebuffModelId =
  FREEBUFF_MIMO_V25_MODEL_ID

export const LIMITED_FREEBUFF_MODEL_ID: FreebuffModelId =
  FREEBUFF_MIMO_V25_MODEL_ID
export const LIMITED_FREEBUFF_MODEL_IDS = [
  FREEBUFF_MIMO_V25_MODEL_ID,
] as const
export const LIMITED_FREEBUFF_MODELS = LIMITED_FREEBUFF_MODEL_IDS.map(
  (modelId) => SUPPORTED_FREEBUFF_MODELS.find((model) => model.id === modelId)!,
)

export type FreebuffAccessTier = 'full' | 'limited'

export type FreebuffWebAccessTier = FreebuffAccessTier | 'blocked'

export const FREEBUFF_MAX_CONCURRENT_PROJECTS = 1

export const FREEBUFF_WEB_PROJECT_DAILY_LIMIT = 5

export const FREEBUFF_WEB_MAX_OPEN_SANDBOXES = 2

export const FREEBUFF_CLOUD_BLANK_PROJECT_DAILY_LIMIT = 10

export const FREEBUFF_CLOUD_PLANNER_TURN_LIMIT = 12

export const FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS = [
  FREEBUFF_MIMO_V25_MODEL_ID,
] as const

export function isFreebuffWebGeoExemptModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS.some((modelId) => modelId === id)
}

export const FREEBUFF_WEB_LIMITED_MODEL_IDS = [
  ...new Set<string>([
    ...FREEBUFF_WEB_GEO_EXEMPT_MODEL_IDS,
    ...LIMITED_FREEBUFF_MODEL_IDS,
  ]),
]

export function isFreebuffWebModelAllowedForLimitedTier(
  id: string | null | undefined,
  hasPaidSubscription = false,
): boolean {
  if (!id) return false
  return (
    isGlmRedeemableAtLimitedTier(id) ||
    FREEBUFF_WEB_LIMITED_MODEL_IDS.some((modelId) => modelId === id) ||
    (hasPaidSubscription && isFreebuffSubscriptionModelIdForAccessTier(id))
  )
}

export function resolveFreebuffWebModelForLimitedTier(
  id: string | null | undefined,
  hasPaidSubscription = false,
): string {
  return isFreebuffWebModelAllowedForLimitedTier(id, hasPaidSubscription)
    ? (id as string)
    : LIMITED_FREEBUFF_MODEL_ID
}

export function getFreebuffModelsForAccessTier(
  accessTier: FreebuffAccessTier | null | undefined,
  hasPaidSubscription = false,
): readonly FreebuffModelOption[] {
  if (accessTier !== 'limited') return FREEBUFF_MODELS
  if (!hasPaidSubscription) return LIMITED_FREEBUFF_MODELS
  const planModels = FREEBUFF_MODELS.filter(
    (model) =>
      isFreebuffSubscriptionModelIdForAccessTier(model.id) &&
      !LIMITED_FREEBUFF_MODELS.some((limited) => limited.id === model.id),
  )
  return [...LIMITED_FREEBUFF_MODELS, ...planModels]
}

export function getRecommendedFreebuffModelId(
  accessTier: FreebuffAccessTier | null | undefined,
  options: { premiumExhausted?: boolean } = {},
): SupportedFreebuffModelId {
  if (accessTier === 'limited') return LIMITED_FREEBUFF_MODEL_ID
  if (options.premiumExhausted) return FALLBACK_FREEBUFF_MODEL_ID
  return DEFAULT_FREEBUFF_MODEL_ID
}

export function getRecommendedFreebuffWebModelId(
  accessTier: FreebuffAccessTier | null | undefined,
  options: { premiumExhausted?: boolean } = {},
): FreebuffWebModelId {
  if (accessTier === 'limited') return LIMITED_FREEBUFF_MODEL_ID
  if (options.premiumExhausted) return FALLBACK_FREEBUFF_MODEL_ID
  return DEFAULT_FREEBUFF_WEB_MODEL_ID
}

export function isGlmRedeemableAtLimitedTier(
  model: string | null | undefined,
): boolean {
  return FREEBUFF_GLM_V52_MODEL_IDS.some((modelId) => modelId === model)
}

export function isFreebuffModelAllowedForAccessTier(
  model: string | null | undefined,
  accessTier: FreebuffAccessTier | null | undefined,
  hasPaidSubscription = false,
): boolean {
  if (!model) return false
  if (accessTier !== 'limited') return isFreebuffModelId(model)
  return (
    isGlmRedeemableAtLimitedTier(model) ||
    LIMITED_FREEBUFF_MODEL_IDS.some((modelId) => modelId === model) ||
    (hasPaidSubscription &&
      isFreebuffSubscriptionModelIdForAccessTier(model) &&
      isFreebuffModelId(model))
  )
}

export function isFreebuffSessionModelId(
  id: string | null | undefined,
): id is SupportedFreebuffModelId | FreebuffWebModelId {
  return (
    isSupportedFreebuffModelId(id) ||
    isFreebuffWebModelId(id, {
      includeGodOnly: true,
    })
  )
}

export function isFreebuffSessionModelAllowedForAccessTier(
  model: string | null | undefined,
  accessTier: FreebuffAccessTier | null | undefined,
  hasPaidSubscription = false,
): boolean {
  if (!model) return false
  if (isFreebuffPausedFreeModelId(model)) return false
  if (accessTier !== 'limited') return isFreebuffSessionModelId(model)
  return (
    isGlmRedeemableAtLimitedTier(model) ||
    FREEBUFF_WEB_LIMITED_MODEL_IDS.some((modelId) => modelId === model) ||
    (hasPaidSubscription && isFreebuffSubscriptionModelIdForAccessTier(model))
  )
}

export function isFreebuffSubscriptionModelIdForAccessTier(
  model: string | null | undefined,
): boolean {
  if (!model) return false
  return (
    model === FREEBUFF_GLM_V53_FLASH_MODEL_ID ||
    model === FREEBUFF_GPT_5_6_LUNA_MODEL_ID ||
    model === FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID ||
    model === FREEBUFF_KIMI_K3_ECO_MODEL_ID
  )
}

export function isFreebuffModelId(
  id: string | null | undefined,
): id is FreebuffModelId {
  if (!id) return false
  return FREEBUFF_MODELS.some((m) => m.id === id)
}

export function isFreebuffWebModelId(
  id: string | null | undefined,
  options: { includeGodOnly?: boolean } = {},
): id is FreebuffWebModelId {
  if (!id) return false
  const models = options.includeGodOnly
    ? FREEBUFF_WEB_ALL_MODELS
    : FREEBUFF_WEB_MODELS
  return models.some((m) => m.id === id)
}

export function isFreebuffWebGodOnlyModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_WEB_GOD_ONLY_MODEL_IDS.some((modelId) => modelId === id)
}

export function resolveFreebuffModel(
  id: string | null | undefined,
): FreebuffModelId {
  return isFreebuffModelId(id) ? id : FALLBACK_FREEBUFF_MODEL_ID
}

export function resolveFreebuffWebModel(
  id: string | null | undefined,
  options: { includeGodOnly?: boolean } = {},
): FreebuffWebModelId {
  return isFreebuffWebModelId(id, options)
    ? id
    : (FALLBACK_FREEBUFF_MODEL_ID as FreebuffWebModelId)
}

export function resolveFreebuffModelForAccessTier(
  id: string | null | undefined,
  accessTier: FreebuffAccessTier | null | undefined,
  hasPaidSubscription = false,
):
  | FreebuffModelId
  | typeof FREEBUFF_GLM_V52_MODEL_ID
  | FreebuffLimitedOfferModelId {
  if (accessTier === 'limited') {
    if (id === FREEBUFF_GLM_V52_MODEL_ID) return id
    return isFreebuffModelAllowedForAccessTier(id, accessTier, hasPaidSubscription)
      ? (id as FreebuffModelId)
      : LIMITED_FREEBUFF_MODEL_ID
  }
  if (id === FREEBUFF_GLM_V52_MODEL_ID) return id
  const limitedOffer = FREEBUFF_LIMITED_OFFER_MODEL_IDS.find(
    (modelId) => modelId === id,
  )
  if (limitedOffer) return limitedOffer
  return resolveFreebuffModel(id)
}

export function resolveFreebuffSessionModelForAccessTier(
  id: string | null | undefined,
  accessTier: FreebuffAccessTier | null | undefined,
  options: {
    includeGodOnly?: boolean
    hasPaidSubscription?: boolean
  } = {},
): SupportedFreebuffModelId | FreebuffWebModelId {
  if (accessTier === 'limited') {
    return isFreebuffSessionModelAllowedForAccessTier(
      id,
      accessTier,
      options.hasPaidSubscription ?? false,
    )
      ? (id as SupportedFreebuffModelId)
      : LIMITED_FREEBUFF_MODEL_ID
  }
  if (isSupportedFreebuffModelId(id)) return id
  return resolveFreebuffWebModel(id, {
    includeGodOnly: options.includeGodOnly ?? true,
  })
}

export function isSupportedFreebuffModelId(
  id: string | null | undefined,
): id is SupportedFreebuffModelId {
  if (!id) return false
  return SUPPORTED_FREEBUFF_MODELS.some((m) => m.id === id)
}

export function freebuffModelIdMatches(
  candidate: string | null | undefined,
  baseId: string,
): boolean {
  if (!candidate) return false
  if (candidate === baseId) return true
  const prefix = baseId + '-'
  if (!candidate.startsWith(prefix)) return false
  return /^\d{6,8}(?:$|[-:])/.test(candidate.slice(prefix.length))
}

export function isFreebuffGeminiProModelId(
  id: string | null | undefined,
): boolean {
  return freebuffModelIdMatches(id, FREEBUFF_GEMINI_PRO_MODEL_ID)
}

export function isFreebuffPremiumModelId(
  id: string | null | undefined,
): id is FreebuffPremiumModelId {
  if (!id) return false
  return FREEBUFF_PREMIUM_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export function isFreebuffWebPremiumModelId(
  id: string | null | undefined,
): id is FreebuffWebPremiumModelId {
  if (!id) return false
  return FREEBUFF_WEB_PREMIUM_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export function isMuseSparkModelId(id: string | null | undefined): boolean {
  if (!id) return false
  return freebuffModelIdMatches(id, FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID)
}

export function isFreebuffSessionPremiumModelId(
  id: string | null | undefined,
): boolean {
  return isFreebuffWebPremiumModelId(id)
}

export function isFreebuffDesktopPremiumBucketModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_DESKTOP_PREMIUM_BUCKET_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export function isFreebuffGlmV52ModelId(
  id: string | null | undefined,
): boolean {
  return FREEBUFF_GLM_V52_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export function isFreebuffGlmV53FlashModelId(
  id: string | null | undefined,
): boolean {
  return freebuffModelIdMatches(id, FREEBUFF_GLM_V53_FLASH_MODEL_ID)
}

export function isFreebuffGpt56LunaModelId(
  id: string | null | undefined,
): boolean {
  return freebuffModelIdMatches(id, FREEBUFF_GPT_5_6_LUNA_MODEL_ID)
}

export const FREEBUFF_SERVICE_ONLY_MODEL_IDS = [] as const satisfies readonly string[]

export function isFreebuffServiceOnlyModelId(
  id: string | null | undefined,
): boolean {
  return FREEBUFF_SERVICE_ONLY_MODEL_IDS.some((modelId) =>
    freebuffModelIdMatches(id, modelId),
  )
}

export function isFreebuffOxAlphaModelId(
  id: string | null | undefined,
): boolean {
  return freebuffModelIdMatches(id, FREEBUFF_OX_ALPHA_MODEL_ID)
}

function findFreebuffModelOption(
  id: string | null | undefined,
): FreebuffModelOption | undefined {
  return (
    SUPPORTED_FREEBUFF_MODELS.find((m) => freebuffModelIdMatches(id, m.id)) ??
    FREEBUFF_WEB_ALL_MODELS.find((m) => freebuffModelIdMatches(id, m.id))
  )
}

export function getFreebuffModelEfforts(
  id: string | null | undefined,
): readonly ReasoningEffort[] | null {
  const efforts = findFreebuffModelOption(id)?.efforts
  return efforts && efforts.length > 0 ? efforts : null
}

export function getFreebuffModelDefaultEffort(
  id: string | null | undefined,
): ReasoningEffort | null {
  const entry = findFreebuffModelOption(id)
  if (!entry?.efforts?.length) return null
  return entry.defaultEffort ?? entry.efforts[entry.efforts.length - 1]!
}

export function resolveFreebuffReasoningEffort(
  modelId: string | null | undefined,
  requested: unknown,
): ReasoningEffort | null {
  const efforts = getFreebuffModelEfforts(modelId)
  if (!efforts) return null
  const fallback = getFreebuffModelDefaultEffort(modelId)
  if (!fallback) return null
  if (
    requested === 'medium' &&
    (freebuffModelIdMatches(modelId, FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID) ||
      freebuffModelIdMatches(modelId, FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID))
  ) {
    return 'high'
  }
  return clampReasoningEffort(requested, efforts, fallback)
}

export function getFreebuffModelReasoningEffort(
  id: string | null | undefined,
): NonNullable<FreebuffModelOption['reasoningEffort']> | null {
  const entry: FreebuffModelOption | undefined =
    SUPPORTED_FREEBUFF_MODELS.find((m) => freebuffModelIdMatches(id, m.id)) ??
    FREEBUFF_WEB_ALL_MODELS.find((m) => freebuffModelIdMatches(id, m.id))
  return entry?.reasoningEffort ?? null
}

export function isFreebuffWebRememberableModelId(
  id: string | null | undefined,
): boolean {
  return !isFreebuffGlmV52ModelId(id)
}

export function resolveRememberedFreebuffWebModel(
  id: string | null | undefined,
  options: { includeGodOnly?: boolean } = {},
): FreebuffWebModelId {
  const resolved = resolveFreebuffWebModel(id, options)
  return isFreebuffWebRememberableModelId(resolved)
    ? resolved
    : DEFAULT_FREEBUFF_WEB_MODEL_ID
}

export function isFreebuffMultimodalModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_MULTIMODAL_MODEL_IDS.some((modelId) => modelId === id)
}

export function getFreebuffModelImageSupport(
  id: string | null | undefined,
): boolean | undefined {
  if (!id) return undefined

  if (
    freebuffModelIdMatches(id, FREEBUFF_DEEPSEEK_V4_FLASH_FIREWORKS_MODEL_ID)
  ) {
    return false
  }

  const model =
    SUPPORTED_FREEBUFF_MODELS.find((option) =>
      freebuffModelIdMatches(id, option.id),
    ) ??
    FREEBUFF_WEB_ALL_MODELS.find((option) =>
      freebuffModelIdMatches(id, option.id),
    )
  return model?.multimodal
}

export function isFreebuffWebMultimodalModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_WEB_MULTIMODAL_MODEL_IDS.some((modelId) => modelId === id)
}

export function isFreebuffTracedModelId(
  id: string | null | undefined,
): boolean {
  if (!id) return false
  return FREEBUFF_TRACED_MODEL_IDS.some((modelId) => modelId === id)
}

export function resolveSupportedFreebuffModel(
  id: string | null | undefined,
): SupportedFreebuffModelId {
  return isSupportedFreebuffModelId(id) ? id : FALLBACK_FREEBUFF_MODEL_ID
}

export function getFreebuffModel(id: string): FreebuffModelOption {
  return (
    SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === id) ??
    FREEBUFF_MODELS.find((m) => m.id === FALLBACK_FREEBUFF_MODEL_ID)!
  )
}

export function getFreebuffWebModel(id: string): FreebuffModelOption {
  return (
    FREEBUFF_WEB_ALL_MODELS.find((m) => m.id === id) ??
    FREEBUFF_WEB_ALL_MODELS.find((m) => m.id === FALLBACK_FREEBUFF_MODEL_ID)!
  )
}

export function getFreebuffModelSupersededBy(
  id: string | null | undefined,
  selectableModelIds: readonly string[],
): FreebuffModelOption['supersededBy'] | undefined {
  if (!id) return undefined
  const catalog: readonly FreebuffModelOption[] = [
    ...SUPPORTED_FREEBUFF_MODELS,
    ...FREEBUFF_WEB_ALL_MODELS,
  ]
  const supersededBy = catalog.find(
    (candidate) => candidate.id === id,
  )?.supersededBy
  if (!supersededBy) return undefined
  return selectableModelIds.includes(supersededBy.modelId)
    ? supersededBy
    : undefined
}

export function getFreebuffModelUnavailableLabel(
  id: string,
  now: Date = new Date(),
  options: LocalTimeFormatOptions = {},
): string | undefined {
  if (isFreebuffSessionModelAvailable(id, now)) return undefined
  const model =
    SUPPORTED_FREEBUFF_MODELS.find((candidate) => candidate.id === id) ??
    getFreebuffWebModel(id)
  if (model.availability === 'off_peak_only') {
    const back = deepSeekExpensiveWindowEndsAt(now)
    return `Back at ${formatLocalTime(back, now, options)} ${formatWindowTimeZoneLabel(
      back,
      options.timeZone,
    )}`
  }
  return getFreebuffDeploymentAvailabilityLabel(now, options)
}

export function getFreebuffModelAvailabilityWindowLabel(
  id: string,
  now: Date = new Date(),
  options: LocalTimeFormatOptions = {},
): string | undefined {
  const model =
    SUPPORTED_FREEBUFF_MODELS.find((candidate) => candidate.id === id) ??
    getFreebuffWebModel(id)
  if (model.availability === 'off_peak_only') {
    return `Open ${formatDeepSeekOffPeakWindowLocal(now, options.timeZone)}`
  }
  if (model.availability === 'deployment_hours') {
    return getFreebuffDeploymentAvailabilityLabel(now, options)
  }
  return undefined
}

export function migrateSupersededFreebuffModelPreference(
  id: string | null | undefined,
  selectableModelIds: readonly string[],
): string | null {
  return getFreebuffModelSupersededBy(id, selectableModelIds)?.modelId ?? null
}

function getNextFreebuffDeploymentStart(now: Date): Date {
  const easternNow = getZonedParts(now, FREEBUFF_EASTERN_TIMEZONE)
  const isBeforeTodayOpen = easternNow.hour < 9

  const offset = isBeforeTodayOpen ? 0 : 1

  return getUtcForZonedTime(
    addDaysToYmd(easternNow.year, easternNow.month, easternNow.day, offset),
    FREEBUFF_EASTERN_TIMEZONE,
    9,
    0,
  )
}

function getCurrentFreebuffDeploymentEnd(now: Date): Date {
  const pacificNow = getZonedParts(now, FREEBUFF_PACIFIC_TIMEZONE)
  return getUtcForZonedTime(pacificNow, FREEBUFF_PACIFIC_TIMEZONE, 17, 0)
}

function isSameLocalDay(left: Date, right: Date, timeZone?: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(left) === formatter.format(right)
}

function formatLocalTime(
  date: Date,
  referenceNow: Date,
  options: LocalTimeFormatOptions = {},
): string {
  const shouldShowWeekday = !isSameLocalDay(
    date,
    referenceNow,
    options.timeZone,
  )
  return new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timeZone,
    weekday: shouldShowWeekday ? 'short' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function getFreebuffDeploymentAvailabilityLabel(
  now: Date = new Date(),
  options: LocalTimeFormatOptions = {},
): string {
  if (isFreebuffDeploymentHours(now)) {
    const closesAt = getCurrentFreebuffDeploymentEnd(now)
    return `until ${formatLocalTime(closesAt, now, options)}`
  }

  const opensAt = getNextFreebuffDeploymentStart(now)
  return `opens ${formatLocalTime(opensAt, now, options)}`
}

export function isFreebuffDeploymentHours(now: Date = new Date()): boolean {
  const eastern = getZonedParts(now, FREEBUFF_EASTERN_TIMEZONE)
  const pacific = getZonedParts(now, FREEBUFF_PACIFIC_TIMEZONE)
  return (
    eastern.hour * 60 + eastern.minute >= 9 * 60 &&
    pacific.hour * 60 + pacific.minute < 17 * 60
  )
}

export function isFreebuffModelAvailable(
  id: string,
  now: Date = new Date(),
): boolean {
  const model = SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === id)
  if (!model) return false
  return isAvailableAt(model.availability, now)
}

function isAvailableAt(
  availability: FreebuffModelOption['availability'],
  now: Date,
): boolean {
  if (availability === 'always') return true
  if (availability === 'off_peak_only') return !isDeepSeekExpensiveWindow(now)
  return isFreebuffDeploymentHours(now)
}

export function freebuffModelUnavailableWindow(
  id: string,
  now: Date = new Date(),
  timeZone: string = FALLBACK_WINDOW_TIME_ZONE,
): string {
  const model =
    SUPPORTED_FREEBUFF_MODELS.find((candidate) => candidate.id === id) ??
    getFreebuffWebModel(id)
  return model.availability === 'off_peak_only'
    ? formatDeepSeekExpensiveWindowReturn(now, timeZone)
    : FREEBUFF_DEPLOYMENT_HOURS_LABEL
}

export function freebuffModelUnavailableAt(
  id: string,
  now: Date = new Date(),
): string | undefined {
  const model =
    SUPPORTED_FREEBUFF_MODELS.find((candidate) => candidate.id === id) ??
    getFreebuffWebModel(id)
  if (model.availability !== 'off_peak_only') return undefined
  if (!isDeepSeekExpensiveWindow(now)) return undefined
  return deepSeekExpensiveWindowEndsAt(now).toISOString()
}

export function formatFreebuffModelUnavailableWindow(
  body: { availableHours: string; availableAt?: string },
  options: LocalTimeFormatOptions & { now?: Date } = {},
): string {
  if (!body.availableAt) return body.availableHours
  const ends = new Date(body.availableAt)
  if (Number.isNaN(ends.getTime())) return body.availableHours
  const now = options.now ?? new Date()
  return `again at ${formatLocalTime(ends, now, options)} ${formatWindowTimeZoneLabel(
    ends,
    options.timeZone,
  )}`
}

export function isFreebuffSessionModelAvailable(
  id: string,
  now: Date = new Date(),
): boolean {
  const model =
    SUPPORTED_FREEBUFF_MODELS.find((candidate) => candidate.id === id) ??
    getFreebuffWebModel(id)
  return isAvailableAt(model.availability, now)
}

export function resolveAvailableFreebuffModel(
  id: string | null | undefined,
  now: Date = new Date(),
): FreebuffModelId {
  const resolved = resolveFreebuffModel(id)
  if (isFreebuffModelAvailable(resolved, now)) return resolved
  const declared = (
    SUPPORTED_FREEBUFF_MODELS as readonly FreebuffModelOption[]
  ).find((candidate) => candidate.id === resolved)?.unavailableFallback
  if (
    declared &&
    isFreebuffModelId(declared) &&
    isFreebuffModelAvailable(declared, now)
  ) {
    return declared
  }
  return FALLBACK_FREEBUFF_MODEL_ID
}
