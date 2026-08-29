
export const AD_TOP_UP_MIN_CENTS = 5_000

export const AD_TOP_UP_MAX_CENTS = 2_000_000

export const AD_TOP_UP_STEP_CENTS = 100

export const AD_TOP_UP_PRESET_CENTS = [
  25_000, 50_000, 100_000, 250_000,
] as const

export const AD_TOP_UP_PRODUCT_NAME = 'Freebuff placements balance'

export const AD_TOP_UP_CURRENCY = 'usd'

export const AD_POSTPAID_DEFAULT_CREDIT_LINE_CENTS = 10_000

export const AD_PROMO_QUALIFY_CENTS = 10_000
export const AD_PROMO_MATCH_MILESTONES_CENTS = [AD_PROMO_QUALIFY_CENTS] as const
export const AD_PROMO_MATCH_GRANT_CENTS = 50_000

export const AD_PROMO_REFERRER_REWARD_CENTS = 50_000
export const AD_PROMO_REFERRER_REWARD_CAP = 10
export const AD_PROMO_CREDIT_EXPIRY_DAYS = 60
export const AD_PROMO_REFERRAL_PROGRAM = 'placements_launch_2026'

export const AD_PLACEMENT_COLLECTION_RETENTION_DAYS = 180

export const AD_PLACEMENT_CPC_FLOOR_CENTS = 100

export const AD_PLACEMENT_CPC_REPRICE_MAX_MOVE_BPS = 2_500

export const AD_PLACEMENT_CPC_REPRICE_MIN_CLICKS = 50

export const AD_PLACEMENT_CPC_GEO_FLOOR_CENTS = 50

export function isValidTopUpCents(cents: number): boolean {
  return topUpAmountError(cents) === null
}

export function topUpAmountError(cents: number): string | null {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    return 'Enter a whole dollar amount.'
  }
  if (cents < AD_TOP_UP_MIN_CENTS) {
    return `The minimum top-up is ${formatWholeDollars(AD_TOP_UP_MIN_CENTS)}.`
  }
  if (cents > AD_TOP_UP_MAX_CENTS) {
    return `For more than ${formatWholeDollars(AD_TOP_UP_MAX_CENTS)}, contact us and we'll invoice you.`
  }
  if (cents % AD_TOP_UP_STEP_CENTS !== 0) {
    return 'Top up in whole dollars.'
  }
  return null
}

export function isPlausibleCollectedCents(cents: number): boolean {
  return (
    Number.isInteger(cents) && cents > 0 && cents <= AD_TOP_UP_MAX_CENTS * 2
  )
}

export function describeTopUp(cents: number): string {
  return `${formatWholeDollars(cents)} added to your balance`
}

function formatWholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

export const AD_SPEND_LEDGER_REASONS = [
  'topup',
  'spend',
  'refund',
  'adjustment',
  'chargeback',
  'collection',
  'collection_refund',
  'collection_chargeback',
  'promo_credit',
  'promo_reversal',
] as const
export type AdSpendLedgerReason = (typeof AD_SPEND_LEDGER_REASONS)[number]

export const AD_STATEMENT_KINDS = [
  'topup',
  'payment',
  'spend',
  'refund',
  'adjustment',
] as const
export type AdStatementKind = (typeof AD_STATEMENT_KINDS)[number]

export function statementKindForReason(
  reason: AdSpendLedgerReason,
): AdStatementKind {
  if (reason === 'collection') return 'payment'
  if (
    reason === 'chargeback' ||
    reason === 'collection_refund' ||
    reason === 'collection_chargeback' ||
    reason === 'promo_reversal'
  ) {
    return 'adjustment'
  }
  if (reason === 'promo_credit') return 'adjustment'
  return reason
}

export function isCreditReason(reason: AdSpendLedgerReason): boolean {
  return (
    reason === 'topup' ||
    reason === 'refund' ||
    reason === 'collection' ||
    reason === 'promo_credit'
  )
}
