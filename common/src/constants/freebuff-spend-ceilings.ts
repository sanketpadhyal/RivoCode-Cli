
import { type FreebuffAccessTier } from './freebuff-models'

export const FREEBUFF_REGION_DAILY_SPEND_USD: Record<
  FreebuffAccessTier,
  number
> = {
  full: 15,
  limited: 5,
}

export const FREEBUFF_RESTRICTED_DAILY_SPEND_USD = 0.5

export const FREEBUFF_RESTRICTED_COUNTRIES: readonly string[] = ['CN']

export const FREEBUFF_ELEVATED_DAILY_SPEND_USD = 5

export const FREEBUFF_ELEVATED_COUNTRIES: readonly string[] = ['SG']

export const FREEBUFF_CAPACITY_NOTICE =
  'Capacity is now limited per account — sustained automated abuse forced us to cap how much any one account can use.'

export const FREEBUFF_RESTRICTED_NOTICE =
  'This account has reduced capacity: it was flagged for VPN or proxy usage, a restricted location, or an email domain commonly used by bot farms. If you are on a VPN, connecting directly restores normal limits.'

export const FREEBUFF_RESTRICTED_NOTICE_REASONS: ReadonlySet<string> = new Set([
  'privacy_egress',
  'restricted_country',
  'flagged_email_domain',
  'unverified_egress',
])

export const FREEBUFF_BUDGET_NOTICE_REASONS: ReadonlySet<string> = new Set([
  'region',
  'elevated_country',
  'trust_level',
])

export const FREEBUFF_BUDGET_NOTICE =
  'You have used all of today’s free usage on this account.'

export function freebuffSpendNoticeFor(reason: string): string {
  if (FREEBUFF_RESTRICTED_NOTICE_REASONS.has(reason)) {
    return FREEBUFF_RESTRICTED_NOTICE
  }
  if (FREEBUFF_BUDGET_NOTICE_REASONS.has(reason)) return FREEBUFF_BUDGET_NOTICE
  return FREEBUFF_CAPACITY_NOTICE
}

export const FREEBUFF_SPEND_CEILING_HARD_MULTIPLIER = 2

const HARD_CAPPED_REASONS: ReadonlySet<string> = new Set([
  'restricted_country',
  'privacy_egress',
  'flagged_email_domain',
  'third_party_client',
  'unverified_egress',
])

export type FreebuffSpendCeilingReason =
  | 'region'
  | 'elevated_country'
  | 'restricted_country'
  | 'privacy_egress'
  | 'flagged_email_domain'
  | 'third_party_client'
  | 'unverified_egress'
  | 'trust_level'

export interface FreebuffSpendCeiling {
  usd: number
  reason: FreebuffSpendCeilingReason
  applied: { reason: FreebuffSpendCeilingReason; usd: number }[]
}

export interface FreebuffSpendCeilingInput {
  accessTier: FreebuffAccessTier
  countryCode?: string | null
  privacyEgress?: boolean
  flaggedEmailDomain?: boolean
  thirdPartyClient?: boolean
  unverifiedEgress?: boolean
  trustLevelCeilingUsd?: number | null
  overrides?: {
    regionUsd?: Partial<Record<FreebuffAccessTier, number>>
    restrictedUsd?: number
    restrictedCountries?: readonly string[]
    elevatedUsd?: number
    elevatedCountries?: readonly string[]
  }
}

export function resolveFreebuffSpendCeiling(
  input: FreebuffSpendCeilingInput,
): FreebuffSpendCeiling {
  const restrictedUsd =
    input.overrides?.restrictedUsd ?? FREEBUFF_RESTRICTED_DAILY_SPEND_USD
  const restrictedCountries =
    input.overrides?.restrictedCountries ?? FREEBUFF_RESTRICTED_COUNTRIES
  const elevatedUsd =
    input.overrides?.elevatedUsd ?? FREEBUFF_ELEVATED_DAILY_SPEND_USD
  const elevatedCountries =
    input.overrides?.elevatedCountries ?? FREEBUFF_ELEVATED_COUNTRIES

  const applied: { reason: FreebuffSpendCeilingReason; usd: number }[] = [
    {
      reason: 'region',
      usd:
        input.overrides?.regionUsd?.[input.accessTier] ??
        FREEBUFF_REGION_DAILY_SPEND_USD[input.accessTier],
    },
  ]

  const country = input.countryCode?.toUpperCase() ?? null
  if (country && elevatedCountries.includes(country)) {
    applied.push({ reason: 'elevated_country', usd: elevatedUsd })
  }
  if (country && restrictedCountries.includes(country)) {
    applied.push({ reason: 'restricted_country', usd: restrictedUsd })
  }
  if (input.privacyEgress) {
    applied.push({ reason: 'privacy_egress', usd: restrictedUsd })
  }
  if (input.flaggedEmailDomain) {
    applied.push({ reason: 'flagged_email_domain', usd: restrictedUsd })
  }
  if (input.unverifiedEgress) {
    applied.push({ reason: 'unverified_egress', usd: restrictedUsd })
  }
  if (input.thirdPartyClient) {
    applied.push({ reason: 'third_party_client', usd: restrictedUsd })
  }
  if (
    typeof input.trustLevelCeilingUsd === 'number' &&
    Number.isFinite(input.trustLevelCeilingUsd)
  ) {
    applied.push({ reason: 'trust_level', usd: input.trustLevelCeilingUsd })
  }

  let winner = applied[0]!
  for (const candidate of applied.slice(1)) {
    if (candidate.usd < winner.usd) winner = candidate
  }

  return { usd: winner.usd, reason: winner.reason, applied }
}

export function resolveFreebuffHardSpendCeiling(
  ceiling: Pick<FreebuffSpendCeiling, 'usd' | 'reason'>,
  multiplier: number = FREEBUFF_SPEND_CEILING_HARD_MULTIPLIER,
): number | null {
  if (!HARD_CAPPED_REASONS.has(ceiling.reason)) return null
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null
  return ceiling.usd * multiplier
}
