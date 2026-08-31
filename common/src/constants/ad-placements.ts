
import { AD_CAMPAIGN_STATUSES } from './ad-types'

import type { AdCampaignStatus } from './ad-types'

export const PLACEMENTS_CONSOLE_ENABLED = true

export const MAX_PLACEMENT_CREATIVES_PER_CAMPAIGN = 25

export const PLACEMENT_PREVIEW_WIDTHS = [20, 48, 60] as const
export type PlacementPreviewWidth = (typeof PLACEMENT_PREVIEW_WIDTHS)[number]

export const ACTIVATION_ATTRIBUTION_WINDOW_DAYS = 30

export const ATTRIBUTION_WINDOW_COPY = `Activation counts within ${ACTIVATION_ATTRIBUTION_WINDOW_DAYS} days of the click`

export const PLACEMENT_SLOTS = [
  { id: 'waiting-room-1', surface: 'waiting_room', available: true },
  { id: 'waiting-room-2', surface: 'waiting_room', available: true },
  { id: 'waiting-room-3', surface: 'waiting_room', available: true },
  { id: 'waiting-room-4', surface: 'waiting_room', available: true },
  { id: 'CLI-Chat-Inline', surface: 'cli_chat', available: true },
  { id: 'Desktop-Inline-Chat', surface: 'cli_chat', available: true },
  { id: 'Desktop-Below-Chat', surface: 'cli_chat', available: true },
  { id: 'Single-Ad-Unit-1', surface: 'cli_chat', available: true },
  {
    id: 'Web-Chat-After-User-Message',
    surface: 'rivocode_web_chat',
    available: true,
  },
  {
    id: 'Web-Chat-After-Assistant-Message',
    surface: 'rivocode_web_chat',
    available: true,
  },
  {
    id: 'Chat-Assistant-Above-Input',
    surface: 'chat_assistant',
    available: true,
  },
] as const

export const TRACKED_LINK_PLACEMENT_ID = 'tracked-link'
export const TRACKED_LINK_SURFACE = 'tracked_link'

export function placementSlotLabel(placementId: string): string {
  if (placementId === TRACKED_LINK_PLACEMENT_ID) return 'Tracked links'
  const [head, ...rest] = placementId.split('-')
  if (!head) return placementId
  return [head[0]!.toUpperCase() + head.slice(1), ...rest].join(' ')
}

export const PRIMARY_METRICS = [
  'billableClicks',
  'activations',
  'spend',
  'avgCpc',
  'avgCpa',
] as const
export const DIAGNOSTIC_METRICS = [
  'impressions',
  'clicks',
  'ctr',
  'ecpm',
] as const

export type PrimaryMetric = (typeof PRIMARY_METRICS)[number]
export type DiagnosticMetric = (typeof DIAGNOSTIC_METRICS)[number]
export type PlacementMetric =
  | PrimaryMetric
  | DiagnosticMetric
  | 'activations'
  | 'costPerActivation'

export const PLACEMENT_METRIC_LABELS: Record<PlacementMetric, string> = {
  activations: 'Billable activations',
  costPerActivation: 'Avg CPA',
  spend: 'Spend',
  impressions: 'Impressions',
  clicks: 'Clicks',
  billableClicks: 'Billable',
  ctr: 'CTR',
  avgCpc: 'Avg CPC',
  avgCpa: 'Avg CPA',
  ecpm: 'Effective CPM',
}

export interface PlacementTotals {
  activations: number
  impressionsServed: number
  impressionsViewed: number
  clicks: number
  billableClicks: number
  spendCents: number
}

function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  return numerator / denominator
}

export function ctr(totals: PlacementTotals): number | null {
  return ratio(totals.clicks, totals.impressionsViewed)
}

export function costPerActivation(totals: PlacementTotals): number | null {
  const perActivation = ratio(totals.spendCents, totals.activations)
  return perActivation === null ? null : perActivation / 100
}

export function avgCpc(totals: PlacementTotals): number | null {
  const perClick = ratio(totals.spendCents, totals.billableClicks)
  return perClick === null ? null : perClick / 100
}

export function avgCpa(totals: PlacementTotals): number | null {
  return costPerActivation(totals)
}

export function ecpm(totals: PlacementTotals): number | null {
  const perImpression = ratio(totals.spendCents, totals.impressionsViewed)
  return perImpression === null ? null : (perImpression / 100) * 1000
}

export function spendUsd(totals: PlacementTotals): number {
  return totals.spendCents / 100
}

export const PLACEMENT_DISPLAY_STATUSES = [
  ...AD_CAMPAIGN_STATUSES,
  'not_funded',
] as const
export type PlacementDisplayStatus = (typeof PLACEMENT_DISPLAY_STATUSES)[number]

export const PLACEMENT_STATUS_LABELS: Record<PlacementDisplayStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  rejected: 'Changes needed',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
  not_funded: 'Not funded',
}

export function placementDisplayStatus(campaign: {
  status: AdCampaignStatus
  billingActive: boolean
}): PlacementDisplayStatus {
  if (campaign.status === 'active' && !campaign.billingActive) {
    return 'not_funded'
  }
  return campaign.status
}

export function isServing(campaign: {
  status: AdCampaignStatus
  billingActive: boolean
}): boolean {
  return campaign.status === 'active' && campaign.billingActive
}

export const NOT_SERVING_REASONS = [
  'awaiting_review',
  'rejected',
  'balance_empty',
  'not_funded',
  'paused',
  'flight_ended',
  'no_creatives',
  'daily_cap_spent',
  'total_budget_spent',
] as const
export type NotServingReason = (typeof NOT_SERVING_REASONS)[number]

export const NOT_SERVING_COPY: Record<
  NotServingReason,
  { message: string; action: string | null }
> = {
  awaiting_review: {
    message: 'Awaiting review before this campaign can start serving',
    action: null,
  },
  rejected: {
    message: 'Every creative was rejected — edit them to resume',
    action: 'Edit creatives',
  },
  balance_empty: {
    message: 'Not serving — your balance reached zero',
    action: 'Top up',
  },
  not_funded: {
    message: 'Approved, but not funded yet',
    action: 'Add funds',
  },
  paused: {
    message: 'Paused — resume to start serving again',
    action: 'Resume',
  },
  flight_ended: { message: 'This campaign reached its end date', action: null },
  no_creatives: {
    message: 'No approved creatives to serve',
    action: 'Add a creative',
  },
  daily_cap_spent: {
    message: 'Paused for today — daily cap reached, resumes at midnight PT',
    action: 'Raise daily cap',
  },
  total_budget_spent: {
    message: 'This campaign spent its total budget',
    action: 'Raise total budget',
  },
}

export const UNDERSPEND_REASONS = [
  'no_inventory',
  'review_hold',
  'balance_empty',
  'paused',
  'flight_ended',
] as const
export type UnderspendReason = (typeof UNDERSPEND_REASONS)[number]

export const UNDERSPEND_COPY: Record<UnderspendReason, string> = {
  no_inventory: 'no matching inventory',
  review_hold: 'held for review',
  balance_empty: 'balance reached zero',
  paused: 'campaign paused',
  flight_ended: 'flight ended',
}

export const OVERSHOOT_POLICY_COPY =
  'You are never billed above your daily cap or total budget.'
