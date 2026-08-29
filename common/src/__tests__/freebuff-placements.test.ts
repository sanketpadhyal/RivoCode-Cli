import { describe, expect, it } from 'bun:test'

import { AD_CAMPAIGN_STATUSES } from '../constants/freebuff-ads'
import {
  ACTIVATION_ATTRIBUTION_WINDOW_DAYS,
  ATTRIBUTION_WINDOW_COPY,
  DIAGNOSTIC_METRICS,
  NOT_SERVING_COPY,
  NOT_SERVING_REASONS,
  PLACEMENTS_CONSOLE_ENABLED,
  PLACEMENT_METRIC_LABELS,
  PLACEMENT_PREVIEW_WIDTHS,
  PLACEMENT_SLOTS,
  TRACKED_LINK_PLACEMENT_ID,
  placementSlotLabel,
  PLACEMENT_STATUS_LABELS,
  PRIMARY_METRICS,
  UNDERSPEND_COPY,
  UNDERSPEND_REASONS,
  avgCpa,
  avgCpc,
  costPerActivation,
  ctr,
  ecpm,
  isServing,
  placementDisplayStatus,
  spendUsd,
} from '../constants/freebuff-placements'

import type { PlacementTotals } from '../constants/freebuff-placements'

function totals(overrides: Partial<PlacementTotals> = {}): PlacementTotals {
  return {
    activations: 0,
    impressionsServed: 0,
    impressionsViewed: 0,
    clicks: 0,
    billableClicks: 0,
    spendCents: 0,
    ...overrides,
  }
}

describe('derived metrics', () => {
  it('divides CTR by viewed impressions, not served ones', () => {
    const value = ctr(
      totals({
        impressionsServed: 2_000,
        impressionsViewed: 1_000,
        clicks: 10,
      }),
    )

    expect(value).toBe(0.01)
  })

  it('keeps CTR diagnostic and counts raw clicks, not only billed clicks', () => {
    const value = ctr(
      totals({ impressionsViewed: 1_000, clicks: 20, billableClicks: 10 }),
    )

    expect(value).toBe(0.02)
  })

  it('computes CPA, CPC and eCPM in dollars', () => {
    const measured = totals({
      activations: 4,
      impressionsViewed: 10_000,
      clicks: 40,
      billableClicks: 40,
      spendCents: 6_000,
    })

    expect(costPerActivation(measured)).toBe(15)
    expect(avgCpa(measured)).toBe(15)
    expect(avgCpc(measured)).toBe(1.5)
    expect(ecpm(measured)).toBe(6)
    expect(spendUsd(measured)).toBe(60)
  })

  it('returns null rather than NaN or zero on an empty denominator', () => {
    const empty = totals()

    expect(ctr(empty)).toBeNull()
    expect(costPerActivation(empty)).toBeNull()
    expect(avgCpc(empty)).toBeNull()
    expect(ecpm(empty)).toBeNull()
  })

  it('treats a negative or non-finite denominator as no answer', () => {
    expect(ctr(totals({ impressionsViewed: -5, billableClicks: 1 }))).toBeNull()
    expect(
      ctr(totals({ impressionsViewed: Number.NaN, billableClicks: 1 })),
    ).toBeNull()
    expect(
      ecpm(
        totals({
          impressionsViewed: Number.POSITIVE_INFINITY,
          spendCents: 100,
        }),
      ),
    ).toBeNull()
  })

  it('reports zero spend as zero, not as missing', () => {
    expect(spendUsd(totals({ spendCents: 0 }))).toBe(0)
    expect(costPerActivation(totals({ activations: 3, spendCents: 0 }))).toBe(0)
  })
})

describe('display status', () => {
  it('labels an approved but unfunded campaign "Not funded"', () => {
    expect(
      placementDisplayStatus({ status: 'active', billingActive: false }),
    ).toBe('not_funded')
    expect(PLACEMENT_STATUS_LABELS.not_funded).toBe('Not funded')
  })

  it('is exactly active AND not billing_active', () => {
    expect(
      placementDisplayStatus({ status: 'active', billingActive: true }),
    ).toBe('active')
    expect(
      placementDisplayStatus({ status: 'paused', billingActive: false }),
    ).toBe('paused')
    expect(
      placementDisplayStatus({ status: 'draft', billingActive: false }),
    ).toBe('draft')
    expect(
      placementDisplayStatus({ status: 'ended', billingActive: false }),
    ).toBe('ended')
  })

  it('only reports serving for a funded active campaign', () => {
    expect(isServing({ status: 'active', billingActive: true })).toBe(true)
    expect(isServing({ status: 'active', billingActive: false })).toBe(false)
    expect(isServing({ status: 'paused', billingActive: true })).toBe(false)
  })

  it('covers every ad_campaign_status with a label', () => {
    for (const status of AD_CAMPAIGN_STATUSES) {
      expect(PLACEMENT_STATUS_LABELS[status]).toBeTruthy()
      expect(placementDisplayStatus({ status, billingActive: true })).toBe(
        status,
      )
    }
  })
})

describe('copy and configuration', () => {
  it('marks the DB-backed control and delivery planes as wired', () => {
    expect(PLACEMENTS_CONSOLE_ENABLED).toBe(true)
  })

  it('previews the widths where layout actually changes', () => {
    expect(PLACEMENT_PREVIEW_WIDTHS).toEqual([20, 48, 60])
  })

  it('states the attribution window in the copy that goes on screen', () => {
    expect(ATTRIBUTION_WINDOW_COPY).toContain(
      String(ACTIVATION_ATTRIBUTION_WINDOW_DAYS),
    )
  })

  it('sells every real slot, and only real slots', () => {
    const surfaceNames = new Set<string>(
      PLACEMENT_SLOTS.map((slot) => slot.surface),
    )
    for (const slot of PLACEMENT_SLOTS) {
      expect([slot.id, surfaceNames.has(slot.id)]).toEqual([slot.id, false])
    }

    expect(PLACEMENT_SLOTS.every((slot) => slot.available)).toBe(true)
    expect(new Set(PLACEMENT_SLOTS.map((slot) => slot.id)).size).toBe(
      PLACEMENT_SLOTS.length,
    )
  })

  it('covers the chat surfaces, which are the larger pool', () => {
    const bySurface = (surface: string) =>
      PLACEMENT_SLOTS.filter((slot) => slot.surface === surface).length
    expect(bySurface('cli_chat')).toBe(4)
    expect(bySurface('waiting_room')).toBe(4)
    expect(bySurface('freebuff_web_chat')).toBe(2)
    expect(bySurface('chat_assistant')).toBe(1)
  })

  it('gives every not-serving and underspend reason copy', () => {
    for (const reason of NOT_SERVING_REASONS) {
      expect(NOT_SERVING_COPY[reason].message).toBeTruthy()
    }
    for (const reason of UNDERSPEND_REASONS) {
      expect(UNDERSPEND_COPY[reason]).toBeTruthy()
    }
  })

  it('labels every metric it exposes', () => {
    for (const metric of [...PRIMARY_METRICS, ...DIAGNOSTIC_METRICS]) {
      expect(PLACEMENT_METRIC_LABELS[metric]).toBeTruthy()
    }
  })

  it('exposes both CPA and CPC primary facts for model-aware dashboards', () => {
    expect(PRIMARY_METRICS).toEqual([
      'billableClicks',
      'activations',
      'spend',
      'avgCpc',
      'avgCpa',
    ])
  })

  it('never labels impressions as a purchasable unit', () => {
    expect(PLACEMENT_METRIC_LABELS.ecpm).toBe('Effective CPM')
  })
})

describe('placementSlotLabel', () => {
  it('renders every real slot exactly as the breakdown table already did', () => {
    expect(placementSlotLabel('waiting-room-1')).toBe('Waiting room 1')
    expect(placementSlotLabel('CLI-Chat-Inline')).toBe('CLI Chat Inline')
    expect(placementSlotLabel('Web-Chat-After-User-Message')).toBe(
      'Web Chat After User Message',
    )
    for (const slot of PLACEMENT_SLOTS) {
      expect(placementSlotLabel(slot.id).length).toBeGreaterThan(0)
    }
  })

  it('names the tracked-link grain, which no slot describes', () => {
    expect(placementSlotLabel(TRACKED_LINK_PLACEMENT_ID)).toBe('Tracked links')
    expect(
      (PLACEMENT_SLOTS as readonly { id: string }[]).some(
        (slot) => slot.id === TRACKED_LINK_PLACEMENT_ID,
      ),
    ).toBe(false)
  })

  it('degrades an unknown grain to something readable, never undefined', () => {
    expect(placementSlotLabel('some-future-grain')).toBe('Some future grain')
    expect(placementSlotLabel('')).toBe('')
  })
})
