import { describe, expect, test } from 'bun:test'

import { getInlineAdLayout } from '../../ads/inline-ad-layout'
import {
  PLACEMENT_PREVIEW_WIDTHS,
  PLACEMENT_SLOTS,
} from '../freebuff-placements'
import {
  HOUSE_AD_CREATIVES,
  HOUSE_AD_DESTINATION_URL,
  HOUSE_AD_DISPLAY_CREATIVE,
  HOUSE_AD_DISPLAY_VARIATIONS,
  HOUSE_AD_TEXT_BUDGET,
  HOUSE_AD_TITLE_BUDGET,
  HOUSE_AD_VARIATIONS,
} from '../freebuff-house-ad'

import type { HouseAdCreative, HouseAdSurface } from '../freebuff-house-ad'

const DESCRIPTION_ENFORCED_FROM = 48

const SURFACES: HouseAdSurface[] = [
  'cli_chat',
  'waiting_room',
  'freebuff_web_chat',
  'chat_assistant',
]

const everyInlineCreative = (): Array<{
  surface: HouseAdSurface
  index: number
  creative: HouseAdCreative
}> =>
  SURFACES.flatMap((surface) =>
    HOUSE_AD_VARIATIONS[surface].map((creative, index) => ({
      surface,
      index,
      creative,
    })),
  )

describe('house ad width budget', () => {
  test('the declared budgets match what the renderer actually gives', () => {
    const probe = {
      title: 'T'.repeat(200),
      adText: 'D'.repeat(200),
      url: HOUSE_AD_DESTINATION_URL,
    }

    const narrowest = Math.min(...PLACEMENT_PREVIEW_WIDTHS)
    expect(getInlineAdLayout(probe, narrowest).title).toHaveLength(
      HOUSE_AD_TITLE_BUDGET,
    )

    const enforcedWidths = PLACEMENT_PREVIEW_WIDTHS.filter(
      (width) => width >= DESCRIPTION_ENFORCED_FROM,
    )
    expect(enforcedWidths.length).toBeGreaterThan(0)
    const worstDescription = Math.min(
      ...enforcedWidths.map(
        (width) => getInlineAdLayout(probe, width).description.length,
      ),
    )
    expect(worstDescription).toBe(HOUSE_AD_TEXT_BUDGET)
  })

  test.each(everyInlineCreative())(
    '$surface variation $index survives every preview width uncut',
    ({ creative }) => {
      expect(creative.title.length).toBeLessThanOrEqual(HOUSE_AD_TITLE_BUDGET)
      expect(creative.adText.length).toBeLessThanOrEqual(HOUSE_AD_TEXT_BUDGET)

      for (const width of PLACEMENT_PREVIEW_WIDTHS) {
        const layout = getInlineAdLayout(creative, width)
        expect(layout.title).toBe(creative.title)
        if (width >= DESCRIPTION_ENFORCED_FROM) {
          expect(layout.description).toBe(creative.adText)
        }
      }
    },
  )
})

describe('house ad catalog', () => {
  test('every surface has variations for the CTR bias to choose between', () => {
    for (const surface of SURFACES) {
      expect(HOUSE_AD_VARIATIONS[surface].length).toBeGreaterThan(1)
    }
  })

  test('variations within a surface are distinct', () => {
    for (const surface of SURFACES) {
      const rendered = HOUSE_AD_VARIATIONS[surface].map(
        (creative) => `${creative.title}|${creative.adText}`,
      )
      expect(new Set(rendered).size).toBe(rendered.length)
    }
  })

  test('the floor serves variation 0 of its surface', () => {
    for (const surface of SURFACES) {
      expect(HOUSE_AD_CREATIVES[surface]).toBe(HOUSE_AD_VARIATIONS[surface][0]!)
    }
    expect(HOUSE_AD_DISPLAY_CREATIVE).toBe(HOUSE_AD_DISPLAY_VARIATIONS[0]!)
  })

  test('every sellable slot belongs to a surface that has copy', () => {
    const surfacesWithSlots = new Set(
      PLACEMENT_SLOTS.filter((slot) => slot.available).map(
        (slot) => slot.surface,
      ),
    )
    for (const surface of surfacesWithSlots) {
      expect(HOUSE_AD_VARIATIONS[surface as HouseAdSurface]).toBeDefined()
    }
  })

  test('every surface with copy has a slot to serve it into', () => {
    for (const surface of SURFACES) {
      const slots = PLACEMENT_SLOTS.filter(
        (slot) => slot.surface === surface && slot.available,
      )
      expect(slots.length).toBeGreaterThan(0)
    }
  })

  test('no creative claims a benefit the subscription does not deliver', () => {
    const FALSE_CLAIMS = [
      /no ads/i,
      /ad-free/i,
      /adfree/i,
      /without ads/i,
      /skip the queue/i,
      /no queue/i,
      /no wait/i,
      /no waiting/i,
      /jump the/i,
      /starts? (right )?now/i,
      /instant/i,
    ]
    const everyCreative = [
      ...everyInlineCreative().map(({ creative }) => creative),
      ...HOUSE_AD_DISPLAY_VARIATIONS,
    ]
    for (const creative of everyCreative) {
      const copy = `${creative.title} ${creative.adText}`
      for (const claim of FALSE_CLAIMS) {
        expect(copy).not.toMatch(claim)
      }
    }
  })

  test('every creative sends the reader to the plans page', () => {
    for (const { creative } of everyInlineCreative()) {
      expect(creative.url).toBe(HOUSE_AD_DESTINATION_URL)
      expect(creative.cta.length).toBeGreaterThan(0)
      expect(creative.favicon).toStartWith('https://')
    }
    for (const creative of HOUSE_AD_DISPLAY_VARIATIONS) {
      expect(creative.url).toBe(HOUSE_AD_DESTINATION_URL)
      expect(creative.imageUrl).toStartWith('https://')
    }
  })
})
