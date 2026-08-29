import type { FreebuffSubscriptionInfo } from '../types/freebuff-session'

export interface FreebuffPlanWindow {
  label: string
  used: number
  limit: number
}

export interface FreebuffPlanSummary {
  tierName: string
  windows: FreebuffPlanWindow[]
  blocked?: { label: string; resetsAt?: string }
  dayResetAt: string
  periodEndsAt: string
  spend: { usedUsd: number; limitUsd: number }
}

export function formatPlanUnits(units: number): string {
  const rounded = Math.round(units * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatPlanWindows(summary: FreebuffPlanSummary): string {
  return summary.windows
    .map((w) => `${w.label} ${formatPlanUnits(w.used)} of ${w.limit}`)
    .join(' · ')
}

const BLOCKED_LABELS: Record<
  NonNullable<FreebuffSubscriptionInfo['blockedBy']>,
  string
> = {
  daily: "today's plan sessions are used",
  five_day: '5-day limit reached',
  monthly: "this period's sessions are used",
  premium_daily: "today's premium sessions are used",
  monthly_spend: "this period's compute cap is reached",
}

export function freebuffPlanSummary(
  info: FreebuffSubscriptionInfo | null | undefined,
): FreebuffPlanSummary | undefined {
  if (!info?.tierId) return undefined
  const usage = info.usage
  if (!usage) return undefined
  const tierName =
    info.tiers.find((tier) => tier.current)?.displayName ?? info.tierId

  const blocked = info.blockedBy
    ? {
        label: BLOCKED_LABELS[info.blockedBy],
        ...(info.blockedBy === 'daily' || info.blockedBy === 'premium_daily'
          ? { resetsAt: usage.dayResetAt }
          : info.blockedBy === 'monthly' || info.blockedBy === 'monthly_spend'
            ? { resetsAt: usage.periodEndsAt }
            : {}),
      }
    : undefined

  return {
    tierName,
    windows: [
      { label: 'today', used: usage.dayUsed, limit: usage.dayLimit },
      { label: '5-day', used: usage.fiveDayUsed, limit: usage.fiveDayLimit },
      { label: 'month', used: usage.monthUsed, limit: usage.monthLimit },
    ],
    ...(blocked ? { blocked } : {}),
    dayResetAt: usage.dayResetAt,
    periodEndsAt: usage.periodEndsAt,
    spend: {
      usedUsd: usage.monthSpendUsd,
      limitUsd: usage.monthSpendLimitUsd,
    },
  }
}
