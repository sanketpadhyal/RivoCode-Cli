import { FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from './freebuff-model-ids'
import {
  FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_KIMI_K3_ECO_MODEL_ID,
  getFreebuffWebModel,
} from './freebuff-models'
import {
  formatDeepSeekExpensiveWindowLocal,
  formatDeepSeekOffPeakWindowLocal,
  isDeepSeekExpensiveWindow,
} from './freebuff-peak-hours'

export const FREEBUFF_SUBSCRIPTION_MODEL_IDS: readonly string[] = Object.freeze(
  [
    FREEBUFF_GLM_V53_FLASH_MODEL_ID,
    FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    FREEBUFF_KIMI_K3_ECO_MODEL_ID,
  ],
)

export const FREEBUFF_SUBSCRIPTION_PREMIUM_MODEL_IDS: readonly string[] =
  Object.freeze([
    FREEBUFF_GLM_V53_FLASH_MODEL_ID,
    FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  ])

export function isFreebuffSubscriptionPremiumModelId(modelId: string): boolean {
  return FREEBUFF_SUBSCRIPTION_PREMIUM_MODEL_IDS.includes(modelId)
}

export const FREEBUFF_SUBSCRIPTION_PEAK_PAUSED_MODEL_IDS: readonly string[] =
  Object.freeze([])

export function isFreebuffSubscriptionPeakPausedModelId(
  modelId: string,
): boolean {
  return FREEBUFF_SUBSCRIPTION_PEAK_PAUSED_MODEL_IDS.includes(modelId)
}

export function isFreebuffSubscriptionModelId(modelId: string): boolean {
  return FREEBUFF_SUBSCRIPTION_MODEL_IDS.includes(modelId)
}

export const FREEBUFF_SUBSCRIPTION_TIER_IDS = [
  'starter',
  'plus',
] as const
export type FreebuffSubscriptionTierId =
  (typeof FREEBUFF_SUBSCRIPTION_TIER_IDS)[number]

export interface FreebuffSubscriptionTier {
  id: FreebuffSubscriptionTierId
  displayName: string
  priceUsd: number
  introPriceUsd: number
  dailySessions: number
  fiveDaySessions: number
  monthlySessions: number
  monthlySpendLimitUsd: number
  dailyPremiumSessions: number
}

export const FREEBUFF_SUBSCRIPTION_TIERS: readonly FreebuffSubscriptionTier[] =
  Object.freeze([
    {
      id: 'starter',
      displayName: 'Starter',
      priceUsd: 8,
      introPriceUsd: 5,
      dailySessions: 3,
      fiveDaySessions: 10,
      monthlySessions: 50,
      monthlySpendLimitUsd: 40,
      dailyPremiumSessions: 3,
    },
    {
      id: 'plus',
      displayName: 'Plus',
      priceUsd: 25,
      introPriceUsd: 22,
      dailySessions: 7,
      fiveDaySessions: 20,
      monthlySessions: 125,
      monthlySpendLimitUsd: 100,
      dailyPremiumSessions: 7,
    },
  ] satisfies FreebuffSubscriptionTier[])

const TIERS_BY_ID = new Map(FREEBUFF_SUBSCRIPTION_TIERS.map((t) => [t.id, t]))

export function freebuffSubscriptionTier(
  id: string | null | undefined,
): FreebuffSubscriptionTier | undefined {
  return id ? TIERS_BY_ID.get(id as FreebuffSubscriptionTierId) : undefined
}

export function nextFreebuffSubscriptionTier(
  id: string | null | undefined,
): FreebuffSubscriptionTier | undefined {
  if (!id) return FREEBUFF_SUBSCRIPTION_TIERS[0]
  const index = FREEBUFF_SUBSCRIPTION_TIERS.findIndex((t) => t.id === id)
  return index === -1 ? undefined : FREEBUFF_SUBSCRIPTION_TIERS[index + 1]
}

export function freebuffSubscriptionTierRank(id: string | null | undefined) {
  return FREEBUFF_SUBSCRIPTION_TIERS.findIndex((t) => t.id === id)
}

export function freebuffSubscriptionTierDisclaimers(
  tier: FreebuffSubscriptionTier,
): string[] {
  const out = [
    ...(tier.dailyPremiumSessions < tier.dailySessions
      ? [
          `${tier.dailyPremiumSessions} of your ${tier.dailySessions} daily sessions can be GPT 5.6 Luna or GLM 5.3 Flash; the rest use DeepSeek V4 Flash or Kimi K3 Eco`,
        ]
      : []),
    'The 5-day limit is a rolling window — it frees up as your oldest sessions age out, rather than resetting on a fixed day',
    'Daily hours reset at midnight Pacific; unused ones do not carry over',
    'Adds to your free sessions rather than replacing them',
  ]
  out.push(
    `Up to $${tier.monthlySpendLimitUsd} of ${FREEBUFF_SPEND_UNIT_LABEL} per month; plan sessions pause if reached, free sessions keep working`,
  )
  out.push('Limits are subject to change')
  return out
}

export const FREEBUFF_SUBSCRIPTION_RESET_TIMEZONE = 'America/Los_Angeles'

export const FREEBUFF_SUBSCRIPTION_FIVE_DAY_WINDOW_DAYS = 5

export const FREEBUFF_SUBSCRIPTION_PRO_MODEL_IDS: readonly string[] =
  Object.freeze([])

export const FREEBUFF_PRO_ENFORCED_SURFACES = ['freebuff-web'] as const

export function isFreebuffWebProClosedNow(
  id: string,
  now: Date = new Date(),
): boolean {
  if (!FREEBUFF_SUBSCRIPTION_PRO_MODEL_IDS.includes(id)) return false
  return isDeepSeekExpensiveWindow(now)
}

export function freebuffWebProOpenWindowLabel(
  now: Date = new Date(),
  timeZone?: string,
): string {
  return formatDeepSeekOffPeakWindowLocal(now, timeZone)
}

export function isFreebuffSubscriptionProModelId(
  model: string | null | undefined,
  extra: readonly string[] = [],
): boolean {
  if (!model) return false
  const ids = [...FREEBUFF_SUBSCRIPTION_PRO_MODEL_IDS, ...extra]
  return ids.some((id) => model === id || model.startsWith(`${id}-`))
}

export function getFreebuffPlanPauseWindowLabel(
  id: string,
  now: Date = new Date(),
  timeZone?: string,
): string | undefined {
  if (!FREEBUFF_SUBSCRIPTION_PEAK_PAUSED_MODEL_IDS.includes(id)) return undefined
  if (getFreebuffWebModel(id)?.availability === 'off_peak_only') return undefined
  return `Plan paused ${formatDeepSeekExpensiveWindowLocal(now, timeZone)}`
}

export const FREEBUFF_CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_enough_usage', label: "I didn't use it enough" },
  { id: 'missing_models', label: 'Missing models or features' },
  { id: 'quality', label: 'Quality or reliability' },
  { id: 'other', label: 'Other' },
] as const

export type FreebuffCancellationReasonId =
  (typeof FREEBUFF_CANCELLATION_REASONS)[number]['id']

export function isFreebuffCancellationReason(
  value: unknown,
): value is FreebuffCancellationReasonId {
  return (
    typeof value === 'string' &&
    FREEBUFF_CANCELLATION_REASONS.some((reason) => reason.id === value)
  )
}

export const FREEBUFF_BETA_RATE_LOCK_MULTIPLIER = 3

export function freebuffPlanHours(count: number): string {
  return `${count} ${count === 1 ? 'hour' : 'hours'}`
}

export function freebuffPlanHoursSummary(tier: {
  dailySessions: number
  fiveDaySessions: number
  monthlySessions: number
}): string {
  return [
    `${freebuffPlanHours(tier.dailySessions)}/day`,
    `${freebuffPlanHours(tier.fiveDaySessions)}/5 days`,
    `${freebuffPlanHours(tier.monthlySessions)}/month`,
  ].join(' · ')
}

export const FREEBUFF_SPEND_UNIT_LABEL = 'tokens'
