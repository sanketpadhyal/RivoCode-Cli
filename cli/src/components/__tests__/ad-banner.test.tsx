import { beforeAll, describe, expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot, flushSync } from '@opentui/react'
import React from 'react'

import {
  AD_CARD_HEIGHT,
  AdCard,
  getAdDisplayLabel,
  getCardAdLayout,
  getInlineAdLayout,
  orderedRequestedAds,
} from '../ad-banner'
import { initializeThemeStore } from '../../hooks/use-theme'

beforeAll(() => {
  initializeThemeStore()
})

describe('requested waiting-room ads', () => {
  test('mount order follows the canonical request and excludes duplicates/unrequested ads', () => {
    const ads = [
      {
        placementId: 'waiting-room-2',
        impUrl: 'two',
        adText: '',
        title: '',
        cta: '',
        url: '',
        favicon: '',
        clickUrl: '',
      },
      {
        placementId: 'waiting-room-1',
        impUrl: 'one',
        adText: '',
        title: '',
        cta: '',
        url: '',
        favicon: '',
        clickUrl: '',
      },
      {
        placementId: 'waiting-room-1',
        impUrl: 'duplicate',
        adText: '',
        title: '',
        cta: '',
        url: '',
        favicon: '',
        clickUrl: '',
      },
      {
        placementId: 'waiting-room-4',
        impUrl: 'hidden',
        adText: '',
        title: '',
        cta: '',
        url: '',
        favicon: '',
        clickUrl: '',
      },
    ]
    expect(
      orderedRequestedAds(ads, ['waiting-room-1', 'waiting-room-2']).map(
        (ad) => ad.impUrl,
      ),
    ).toEqual(['one', 'two'])
  })
})

describe('card ad layout', () => {
  const ad = {
    adText:
      'Automate mobile UI testing with plain-English test steps and AI-powered execution.',
    title: 'Test every release before you ship',
    cta: 'Try free',
    url: 'https://www.drizz.dev/ios',
  }

  test('renders the headline for the creative the console asks for', () => {
    const layout = getCardAdLayout(ad, 78)

    expect(layout.headline).toBe('Test every release before you ship')
    expect(layout.ctaText).toBe('Try free')
    expect(layout.labelText).toBe('drizz.dev')
  })

  test('gives up a description line to make room for the headline', () => {
    expect(getCardAdLayout(ad, 78).descriptionLines).toBe(1)
  })

  test('keeps both description lines when the ad has no headline', () => {
    const layout = getCardAdLayout({ ...ad, title: '' }, 78)

    expect(layout.headline).toBe('')
    expect(layout.descriptionLines).toBe(2)
  })

  test('the interior always sums to the reserved card height', () => {
    for (const title of ['A headline', '']) {
      const layout = getCardAdLayout({ ...ad, title }, 78)
      const headlineRows = layout.headline ? 1 : 0
      const borderRows = 2
      const ctaRow = 1

      expect(borderRows + headlineRows + layout.descriptionLines + ctaRow).toBe(
        AD_CARD_HEIGHT,
      )
    }
  })

  test('falls back to Learn more rather than reprinting the headline', () => {
    expect(getCardAdLayout({ ...ad, cta: '' }, 78).ctaText).toBe('Learn more')
  })

  test('drops the destination label when it would repeat the headline', () => {
    const layout = getCardAdLayout({ ...ad, url: '' }, 78)

    expect(layout.headline).toBe('Test every release before you ship')
    expect(layout.labelText).toBe('')
  })

  test('keeps the Sponsored label when there is no headline and no URL', () => {
    const layout = getCardAdLayout({ ...ad, title: '', url: '' }, 78)

    expect(layout.labelText).toBe('Sponsored')
  })

  test('survives a provider that omits fields the type says are required', () => {
    const layout = getCardAdLayout(
      {} as Parameters<typeof getCardAdLayout>[0],
      78,
    )

    expect(layout.headline).toBe('')
    expect(layout.description).toBe('')
    expect(layout.ctaText).toBe('Learn more')
    expect(layout.labelText).toBe('Sponsored')
    expect(layout.descriptionLines).toBe(2)
  })

  test('falls back to Learn more when only the CTA is missing', () => {
    const layout = getCardAdLayout(
      { ...ad, cta: undefined } as unknown as Parameters<
        typeof getCardAdLayout
      >[0],
      78,
    )

    expect(layout.ctaText).toBe('Learn more')
    expect(layout.headline).toBe('Test every release before you ship')
  })

  test('truncates the headline to the interior width', () => {
    const layout = getCardAdLayout(
      {
        ...ad,
        title:
          'A headline considerably longer than this narrow card could ever hold',
      },
      60,
    )

    expect(layout.headline.length).toBeLessThanOrEqual(60 - 8)
    expect(layout.headline.endsWith('…')).toBe(true)
  })
})

describe('card ad render', () => {
  const ad = {
    adText: 'Automate mobile UI testing with plain-English test steps.',
    title: 'Test every release before you ship',
    cta: 'Try free',
    url: 'https://www.drizz.dev/ios',
    favicon: '',
    clickUrl: 'https://www.drizz.dev/ios?click=1',
    impUrl: 'imp-1',
  }

  const renderCard = async (
    overrides: Partial<typeof ad>,
    width = 78,
  ): Promise<string> => {
    const setup = await createTestRenderer({ width, height: AD_CARD_HEIGHT })
    const root = createRoot(setup.renderer)
    flushSync(() => {
      root.render(<AdCard ad={{ ...ad, ...overrides }} width={width} />)
    })
    try {
      await setup.renderOnce()
      return setup.captureCharFrame()
    } finally {
      flushSync(() => root.unmount())
      setup.renderer.destroy()
    }
  }

  test('draws the headline, the body, the CTA and the destination', async () => {
    const frame = await renderCard({})

    expect(frame).toContain('Test every release before you ship')
    expect(frame).toContain('Automate mobile UI testing')
    expect(frame).toContain('Try free')
    expect(frame).toContain('drizz.dev')
  })

  test('still discloses itself as an ad', async () => {
    expect(await renderCard({})).toContain('Ad')
  })

  test('reports presentation only after the card mounts', async () => {
    const presented: string[] = []
    const setup = await createTestRenderer({
      width: 78,
      height: AD_CARD_HEIGHT,
    })
    const root = createRoot(setup.renderer)
    const mountedAd = { ...ad, provider: 'first_party' as const }

    flushSync(() => {
      root.render(
        <AdCard
          ad={mountedAd}
          width={78}
          onImpression={(presentedAd) => presented.push(presentedAd.impUrl)}
        />,
      )
    })
    await setup.renderOnce()
    expect(presented).toEqual(['imp-1'])

    flushSync(() => root.unmount())
    setup.renderer.destroy()
  })

  test('does not print the headline twice when there is no CTA', async () => {
    const frame = await renderCard({ cta: '' })

    expect(frame).toContain('Test every release before you ship')
    expect(frame).toContain('Learn more')
  })

  test('renders rather than throwing when the provider omits a CTA', async () => {
    const frame = await renderCard({
      cta: undefined,
    } as Partial<typeof ad>)

    expect(frame).toContain('Learn more')
    expect(frame).toContain('Test every release before you ship')
  })

  test('renders a title-less ad without a blank first row', async () => {
    const frame = await renderCard({ title: '' })

    expect(frame).toContain('Automate mobile UI testing')
    expect(frame).toContain('Ad')
  })
})

describe('ad banner display label', () => {
  test('uses the display domain when the ad has a URL', () => {
    expect(
      getAdDisplayLabel({
        title: 'Example Sponsor',
        url: 'https://www.example.com/path',
      }),
    ).toEqual({ text: 'example.com', variant: 'domain' })
  })

  test('uses the ad title when the ad has no URL', () => {
    expect(
      getAdDisplayLabel({
        title: 'Example Sponsor',
        url: '',
      }),
    ).toEqual({ text: 'Example Sponsor', variant: 'title' })
  })
})

describe('inline ad layout', () => {
  const ad = {
    adText:
      'Deploy frontends globally with zero config and preview every pull request.',
    title: 'Vercel',
    url: 'https://www.vercel.com/products',
  }

  test('fits the compact copy and sponsor within the card interior', () => {
    const width = 60
    const layout = getInlineAdLayout(ad, width)
    const header = `${layout.title}  Ad`
    const detail = `${layout.description}  ${layout.label} ↗`

    expect(header.length).toBeLessThanOrEqual(width - 4)
    expect(detail.length).toBeLessThanOrEqual(width - 4)
    expect(layout.title).toBe('Vercel')
    expect(layout.label).toBe('vercel.com')
    expect(layout.description.endsWith('…')).toBe(true)
  })

  test('truncates long labels without starving narrow cards', () => {
    const layout = getInlineAdLayout(
      {
        ...ad,
        url: 'https://www.extraordinarily-long-sponsor-domain.example',
      },
      48,
    )

    expect(layout.label).toBe('extraordinari…')
    expect(layout.description.length).toBeGreaterThan(0)
    expect(`${layout.title}  Ad`.length).toBeLessThanOrEqual(44)
  })

  test('prioritizes copy over the destination on very narrow cards', () => {
    const width = 47
    const layout = getInlineAdLayout(ad, width)

    expect(layout.label).toBe('')
    expect(layout.description.length).toBe(width - 4)
    expect(layout.description.endsWith('…')).toBe(true)
  })

  test('uses the full detail row when no destination domain is available', () => {
    const layout = getInlineAdLayout(
      {
        adText:
          'A Carbon ad whose tracked destination is intentionally hidden.',
        title: 'Example Sponsor',
        url: '',
      },
      40,
    )

    expect(layout.title).toBe('Example Sponsor')
    expect(layout.label).toBe('')
    expect(layout.description.length).toBe(36)
  })
})
