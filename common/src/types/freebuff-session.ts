import type { FreebuffAccessTier } from '../constants/freebuff-models'
import type { FreebuffStandingInfo } from '../constants/freebuff-trust'

export interface FreebuffSessionEntitlementBreakdown {
  base: number
  referral: number
  streak: number
  promo?: number
  level?: number
  subscription?: number
}

export interface FreebuffSubscriptionTierOffer {
  id: string
  displayName: string
  priceUsd: number
  firstPeriodPriceUsd: number
  dailySessions: number
  fiveDaySessions: number
  monthlySessions: number
  monthlySpendLimitUsd: number
  dailyPremiumSessions: number
  disclaimers: string[]
  current: boolean
  upgrade: boolean
  downgrade: boolean
}

export interface FreebuffSubscriptionUsage {
  dayUsed: number
  dayLimit: number
  fiveDayUsed: number
  fiveDayLimit: number
  monthUsed: number
  monthLimit: number
  dayPremiumUsed: number
  dayPremiumLimit: number
  dayResetAt: string
  periodEndsAt: string
  monthSpendUsd: number
  monthSpendLimitUsd: number
  freeDayUsed?: number
  freeDayLimit?: number
}

export interface FreebuffSubscriptionInfo {
  tierId: string | null
  usage?: FreebuffSubscriptionUsage
  status?: string
  cancelAtPeriodEnd?: boolean
  pendingTierId?: string
  tiers: FreebuffSubscriptionTierOffer[]
  blockedBy?:
    | 'daily'
    | 'five_day'
    | 'monthly'
    | 'premium_daily'
    | 'monthly_spend'
}

export interface FreebuffUpgradeHint {
  url: string
  message: string
}

export interface FreebuffSessionRateLimit {
  model: string
  pool?: string
  poolLabel?: string
  countsAdmissions?: true
  entitlementBreakdown?: FreebuffSessionEntitlementBreakdown
  limit: number
  period: 'pacific_day' | 'pacific_week'
  resetTimeZone: string
  resetAt: string
  windowHours: number
  recentCount: number
}

export type FreebuffSessionRateLimitByModel = Record<
  string,
  FreebuffSessionRateLimit
>

export interface FreebuffActiveSessionInfo {
  model: string
  admittedAt: string
  expiresAt: string
}

export interface FreebuffDesktopSessionCounts {
  premium: number
  unlimited: number
  nextExpiryAt?: string
}

export interface FreebuffReferralInfo {
  code: string
  referrerName: string | null
  qualifiedCount: number
  weeklySessionsRemaining?: number
  resetAt?: string
  githubLinked: boolean
}

export interface FreebuffGlmPromo {
  dailySessions: number
  endsAt: string
}

export const getGlmPromo = (
  session: { status: string } | null | undefined,
): FreebuffGlmPromo | undefined =>
  session && 'glmPromo' in session
    ? ((session as { glmPromo?: FreebuffGlmPromo }).glmPromo ?? undefined)
    : undefined

export const getReferralInfo = (
  session: { status: string } | null | undefined,
): FreebuffReferralInfo | undefined =>
  session && 'referral' in session
    ? (session as { referral?: FreebuffReferralInfo }).referral
    : undefined

export const getRateLimitsByModel = (
  session: { status: string } | null | undefined,
): FreebuffSessionRateLimitByModel | undefined =>
  session && 'rateLimitsByModel' in session
    ? (session as { rateLimitsByModel?: FreebuffSessionRateLimitByModel })
        .rateLimitsByModel
    : undefined

export const getSubscriptionInfo = (
  session: { status: string } | null | undefined,
): FreebuffSubscriptionInfo | undefined =>
  session && 'subscription' in session
    ? (session as { subscription?: FreebuffSubscriptionInfo }).subscription
    : undefined

export interface FreebuffLimitedModelOffer {
  model: string
  remaining: number
  total: number
  userRemaining: number
  userResetAt: string
}

export const getLimitedModelOffers = (
  session: { status: string } | null | undefined,
): FreebuffLimitedModelOffer[] =>
  session && 'limitedModelOffers' in session
    ? ((session as { limitedModelOffers?: FreebuffLimitedModelOffer[] })
        .limitedModelOffers ?? [])
    : []

export type FreebuffCountryBlockReason =
  | 'country_not_allowed'
  | 'anonymized_or_unknown_country'
  | 'anonymous_network'
  | 'missing_client_ip'
  | 'unresolved_client_ip'
  | 'ip_privacy_lookup_failed'

export type FreebuffIpPrivacySignal =
  | 'anonymous'
  | 'vpn'
  | 'proxy'
  | 'tor'
  | 'relay'
  | 'res_proxy'
  | 'hosting'
  | 'service'

export type FreebuffSpurStatus =
  | 'not_checked'
  | 'clean'
  | 'suspicious'
  | 'failed'
  | 'skipped'

export type FreebuffScamalyticsStatus =
  | 'not_checked'
  | 'clean'
  | 'suspicious'
  | 'failed'
  | 'skipped'

export type FreebuffPrivacyDecision =
  | 'allowed_clean'
  | 'ipinfo_suspicious_spur_clean'
  | 'corroborated_block'
  | 'cloudflare_tor_block'
  | 'spur_failed_limited'
  | 'unverified_egress_limited'
  | 'scamalytics_failed_limited'
  | 'scamalytics_suspicious_limited'
  | 'ipinfo_failed_limited'
  | 'limited_other'

export type FreebuffPrivacyProviderDecision =
  | 'not_checked'
  | 'cloudflare_tor'
  | 'ipinfo_clean'
  | 'ipinfo_failed'
  | 'ipinfo_only'
  | 'spur_failed'
  | 'scamalytics_failed'
  | 'scamalytics_only'
  | 'corroborated_soft'
  | 'corroborated_hard'

export interface FreebuffLimitedModeReason {
  countryCode?: string | null
  countryBlockReason?: FreebuffCountryBlockReason | null
  ipPrivacySignals?: FreebuffIpPrivacySignal[] | null
}

export type FreebuffSessionServerResponse = (
  | ({
      status: 'none'
      accessTier?: FreebuffAccessTier
      message?: string
      rateLimitsByModel?: FreebuffSessionRateLimitByModel
      referral?: FreebuffReferralInfo
      limitedModelOffers?: FreebuffLimitedModelOffer[]
      standing?: FreebuffStandingInfo
      subscription?: FreebuffSubscriptionInfo
    } & FreebuffLimitedModeReason)
  | ({
      status: 'active'
      accessTier: FreebuffAccessTier
      instanceId: string
      model: string
      admittedAt: string
      expiresAt: string
      remainingMs: number
      rateLimit?: FreebuffSessionRateLimit
      rateLimitsByModel?: FreebuffSessionRateLimitByModel
      referral?: FreebuffReferralInfo
      subscription?: FreebuffSubscriptionInfo
    } & FreebuffLimitedModeReason)
  | ({
      status: 'ended'
      accessTier?: FreebuffAccessTier
      instanceId?: string
      admittedAt?: string
      expiresAt?: string
      gracePeriodEndsAt?: string
      gracePeriodRemainingMs?: number
      rateLimitsByModel?: FreebuffSessionRateLimitByModel
      referral?: FreebuffReferralInfo
      subscription?: FreebuffSubscriptionInfo
    } & FreebuffLimitedModeReason)
  | {
      status: 'superseded'
    }
  | {
      status: 'country_blocked'
      message?: string
      countryCode: string
      countryBlockReason?: FreebuffCountryBlockReason
      ipPrivacySignals?: FreebuffIpPrivacySignal[]
    }
  | {
      status: 'model_locked'
      accessTier?: FreebuffAccessTier
      currentModel: string
      requestedModel: string
    }
  | {
      status: 'model_unavailable'
      accessTier?: FreebuffAccessTier
      requestedModel: string
      availableHours: string
      availableAt?: string
      requiresSubscription?: boolean
      withdrawn?: boolean
    }
  | {
      status: 'banned'
    }
  | {
      status: 'ip_capped'
      accessTier?: FreebuffAccessTier
      model: string
      activeUsersForIp: number
      limit: number
      retryAfterMs: number
    }
  | {
      status: 'rate_limited'
      accessTier?: FreebuffAccessTier
      upgrade?: FreebuffUpgradeHint
      model: string
      limit: number
      entitlementBreakdown?: FreebuffSessionEntitlementBreakdown
      period: 'pacific_day' | 'pacific_week'
      resetTimeZone: string
      resetAt: string
      windowHours: number
      recentCount: number
      retryAfterMs: number
    }
  | {
      status: 'spend_limited'
      accessTier?: FreebuffAccessTier
      message: string
      resetAt: string
      retryAfterMs: number
      upgrade?: FreebuffUpgradeHint
    }
  | {
      status: 'premium_slot_taken'
      accessTier?: FreebuffAccessTier
      requestedModel: string
      currentModel: string
      currentInstanceId: string
    }
) & {
  desktopSessionCounts?: FreebuffDesktopSessionCounts
}

export const FREEBUFF_GATE_CODES = {
  waiting_room_required: { status: 428, endsTheSession: true },
  session_expired: { status: 410, endsTheSession: true },
  session_superseded: { status: 409, endsTheSession: true },
  session_model_mismatch: { status: 409, endsTheSession: true },
  session_limit_reached: { status: 409, endsTheSession: false },
  waiting_room_queued: { status: 429, endsTheSession: false },
  model_unavailable: { status: 410, endsTheSession: false },
} as const satisfies Record<string, { status: number; endsTheSession: boolean }>

export type FreebuffGateCode = keyof typeof FREEBUFF_GATE_CODES

export function getFreebuffGateCode(output: {
  error?: string | undefined
  statusCode?: number | undefined
}): FreebuffGateCode | null {
  const code = output.error
  if (!code || !Object.hasOwn(FREEBUFF_GATE_CODES, code)) return null
  const gate = FREEBUFF_GATE_CODES[code as FreebuffGateCode]
  return gate.status === output.statusCode ? (code as FreebuffGateCode) : null
}
