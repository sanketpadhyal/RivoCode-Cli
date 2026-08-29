import { FREEBUFF_EARN_PROMPT_SHORT } from '@rivocode/common/constants/freebuff-levels'
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot, flushSync } from '@opentui/react'
import React from 'react'

import { FreebuffModelSelector } from '../freebuff-model-selector'
import {
  DEFAULT_FREEBUFF_MODEL_ID,
  FALLBACK_FREEBUFF_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
  FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  FREEBUFF_SOLAR_PRO_4_MODEL_ID,
  FREEBUFF_FABLE_5_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_MINIMAX_M3_MODEL_ID,
  FREEBUFF_MODELS,
  getFreebuffModelSupersededBy,
  isFreebuffModelId,
  LIMITED_FREEBUFF_MODELS,
} from '@rivocode/common/constants/freebuff-models'

import { initializeThemeStore } from '../../hooks/use-theme'
import {
  getSelectedFreebuffModel,
  useFreebuffModelStore,
} from '../../state/freebuff-model-store'
import { useFreebuffSessionStore } from '../../state/freebuff-session-store'

let cleanupRenderer: (() => void) | undefined

const FIXED_NOW_MS = Date.UTC(2026, 7, 20, 19, 0, 0)

beforeAll(() => {
  initializeThemeStore()
})

afterEach(() => {
  cleanupRenderer?.()
  cleanupRenderer = undefined
  useFreebuffSessionStore.getState().setSession(null)
  useFreebuffSessionStore.getState().setFailure(null)
  useFreebuffModelStore.getState().setSelectedModel(FALLBACK_FREEBUFF_MODEL_ID)
})

const renderSelector = async (maxHeight = 40) => {
  cleanupRenderer?.()
  cleanupRenderer = undefined
  const setup = await createTestRenderer({ width: 100, height: 40 })
  const root = createRoot(setup.renderer)
  cleanupRenderer = () => {
    flushSync(() => root.unmount())
    setup.renderer.destroy()
  }
  flushSync(() =>
    root.render(
      <FreebuffModelSelector maxHeight={maxHeight} nowMs={FIXED_NOW_MS} />,
    ),
  )
  await setup.renderOnce()
  return setup
}

const renderSelectorWithGlmRemaining = async (remaining?: number) => {
  useFreebuffSessionStore.getState().setSession({
    status: 'none',
    accessTier: 'full',
    referral: {
      code: 'test-referral',
      referrerName: null,
      qualifiedCount: 1,
      ...(remaining === undefined
        ? {}
        : { weeklySessionsRemaining: remaining }),
      resetAt: new Date(FIXED_NOW_MS + 60_000).toISOString(),
      githubLinked: true,
    },
  })
  useFreebuffModelStore.getState().setSelectedModel(FREEBUFF_GLM_V52_MODEL_ID)

  const nextSetup = await renderSelector(30)
  await nextSetup.renderOnce()
  await Promise.resolve()
  await nextSetup.renderOnce()
}

describe('FreebuffModelSelector referral selection', () => {
  test('keeps a fractional unlocked GLM session selected while its request is pending', async () => {
    await renderSelectorWithGlmRemaining(0.25)
    expect(getSelectedFreebuffModel()).toBe(FREEBUFF_GLM_V52_MODEL_ID)
  })

  test('still repairs a locked GLM selection to a visible grid model', async () => {
    await renderSelectorWithGlmRemaining(0)
    expect(isFreebuffModelId(getSelectedFreebuffModel())).toBe(true)
  })

  test('treats an omitted GLM balance as locked', async () => {
    await renderSelectorWithGlmRemaining()
    expect(isFreebuffModelId(getSelectedFreebuffModel())).toBe(true)
  })
})

describe('FreebuffModelSelector tier layout', () => {
  test('keeps the referral actions on one condensed row', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
      referral: {
        code: 'test-referral',
        referrerName: null,
        qualifiedCount: 0,
        weeklySessionsRemaining: 0,
        resetAt: new Date(FIXED_NOW_MS + 60_000).toISOString(),
        githubLinked: true,
      },
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_MINIMAX_M3_MODEL_ID)

    const frame = (await renderSelector()).captureCharFrame()
    const actionRow =
      frame.split('\n').find((line) => line.includes('Copy invite link')) ?? ''

    expect(actionRow).toContain(FREEBUFF_EARN_PROMPT_SHORT)
    expect(frame).not.toContain('Or earn')
    expect(frame).not.toContain('for small tasks')
  })

  test('orders the premium rows above UNLIMITED, saved model focused', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_SOLAR_PRO_4_MODEL_ID)

    const setup = await renderSelector()
    const frame = setup.captureCharFrame()
    const premiumHeaderIndex = frame.indexOf('PREMIUM')
    const recommendedModelIndex = frame.indexOf('GPT-5.6 Luna')
    const selectedModelIndex = frame.indexOf('Solar Pro 4')
    const unlimitedHeaderIndex = frame.indexOf('UNLIMITED')

    expect(premiumHeaderIndex).toBeGreaterThanOrEqual(0)
    expect(recommendedModelIndex).toBeGreaterThan(premiumHeaderIndex)
    expect(selectedModelIndex).toBeGreaterThan(recommendedModelIndex)
    expect(unlimitedHeaderIndex).toBeGreaterThan(selectedModelIndex)
    expect(frame).toContain('› Solar Pro 4')
    expect(frame).not.toContain('› GPT-5.6 Luna')
  })

  const allModelIds = FREEBUFF_MODELS.map((m) => m.id)
  const supersededModelId = allModelIds.find((id) =>
    getFreebuffModelSupersededBy(id, allModelIds),
  )
  test.if(Boolean(supersededModelId))(
    'shows the supersedes nudge only on the row the user is on',
    async () => {
      useFreebuffSessionStore.getState().setSession({
        status: 'none',
        accessTier: 'full',
      })
      const superseded = getFreebuffModelSupersededBy(
        supersededModelId!,
        allModelIds,
      )!
      const notice = superseded.notice
      const occurrences = (frame: string) => frame.split(notice).length - 1

      useFreebuffModelStore.getState().setSelectedModel(supersededModelId!)
      const onSuperseded = (await renderSelector()).captureCharFrame()
      expect(occurrences(onSuperseded)).toBe(1)

      const otherId = allModelIds.find((id) => id !== supersededModelId)!
      useFreebuffModelStore.getState().setSelectedModel(otherId)
      const onOther = (await renderSelector()).captureCharFrame()
      expect(occurrences(onOther)).toBe(0)

      useFreebuffModelStore.getState().setSelectedModel(superseded.modelId)
      const onCurrent = (await renderSelector()).captureCharFrame()
      expect(occurrences(onCurrent)).toBe(0)
    },
  )

  test('badges the new builds so a returning user notices they changed', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain('DeepSeek V4 Flash 07/31')
    expect(frame).toContain('NEW')
  })

  test('places the exhausted-quota recommendation beneath UNLIMITED', async () => {
    const resetAt = new Date(FIXED_NOW_MS + 60_000).toISOString()
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
      rateLimitsByModel: {
        [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: {
          model: FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
          limit: 6,
          period: 'pacific_day',
          resetTimeZone: 'America/Los_Angeles',
          resetAt,
          windowHours: 24,
          recentCount: 6,
        },
      },
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_MINIMAX_M3_MODEL_ID)

    const setup = await renderSelector()
    const frame = setup.captureCharFrame()
    const premiumHeaderIndex = frame.indexOf('PREMIUM')
    const unlimitedHeaderIndex = frame.indexOf('UNLIMITED')
    const heroModelIndex = frame.indexOf('MiMo 2.5', unlimitedHeaderIndex)

    expect(unlimitedHeaderIndex).toBeGreaterThan(premiumHeaderIndex)
    expect(heroModelIndex).toBeGreaterThan(unlimitedHeaderIndex)
  })

  test('collapses to the unlimited hero when the premium default is spent', async () => {
    const resetAt = new Date(FIXED_NOW_MS + 60_000).toISOString()
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
      rateLimitsByModel: {
        [DEFAULT_FREEBUFF_MODEL_ID]: {
          model: DEFAULT_FREEBUFF_MODEL_ID,
          limit: 6,
          period: 'pacific_day',
          resetTimeZone: 'America/Los_Angeles',
          resetAt,
          windowHours: 24,
          recentCount: 6,
        },
      },
    })
    useFreebuffModelStore.getState().setSelectedModel(DEFAULT_FREEBUFF_MODEL_ID)

    const setup = await renderSelector()
    await Promise.resolve()
    await setup.renderOnce()
    await setup.renderOnce()

    expect(getSelectedFreebuffModel()).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    const frame = setup.captureCharFrame()
    expect(frame).toContain('› MiMo 2.5')
    expect(frame).toContain('See all')
    expect(frame).not.toContain('PREMIUM')
  })

  test('repairs an invalid selection to the unlimited recommendation when premium is exhausted', async () => {
    const resetAt = new Date(FIXED_NOW_MS + 60_000).toISOString()
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
      rateLimitsByModel: {
        [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: {
          model: FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
          limit: 6,
          period: 'pacific_day',
          resetTimeZone: 'America/Los_Angeles',
          resetAt,
          windowHours: 24,
          recentCount: 6,
        },
      },
    })
    useFreebuffModelStore.getState().setSelectedModel(FREEBUFF_GLM_V52_MODEL_ID)

    const setup = await renderSelector()
    await Promise.resolve()
    await setup.renderOnce()
    await setup.renderOnce()

    expect(getSelectedFreebuffModel()).toBe(FALLBACK_FREEBUFF_MODEL_ID)
    expect(setup.captureCharFrame()).toContain('› MiMo 2.5')
  })

  test('shows every limited-tier model when the access tier arrives after mount', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_GLM_V53_FLASH_MODEL_ID)
    const setup = await renderSelector()

    flushSync(() => {
      useFreebuffSessionStore.getState().setSession({
        status: 'none',
        accessTier: 'limited',
      })
    })
    await Promise.resolve()
    await setup.renderOnce()
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    for (const model of LIMITED_FREEBUFF_MODELS) {
      expect(frame).toContain(model.displayName)
    }
    expect(frame).not.toContain('DeepSeek V4 Flash')
    expect(frame).not.toContain('PREMIUM')
    expect(frame).not.toContain('UNLIMITED')
  })

  test('badges only natively multimodal rows with Images', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_MINIMAX_M3_MODEL_ID)

    const rowOf = (frame: string, name: string) =>
      frame.split('\n').find((line) => line.includes(name)) ?? ''
    const frame = (await renderSelector()).captureCharFrame()

    expect(rowOf(frame, 'MiMo 2.5')).toContain('Images')
    expect(rowOf(frame, 'GPT-5.6 Luna')).toContain('Images')
    expect(rowOf(frame, 'MiMo 2.5')).toContain('Images')
    expect(rowOf(frame, 'DeepSeek V4 Flash')).not.toContain('Images')
    expect(rowOf(frame, 'DeepSeek V4 Pro')).not.toContain('Images')
  })

  test('says the reasoning effort on rows whose catalog entry carries one', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_MINIMAX_M3_MODEL_ID)

    const rowOf = (frame: string, tagline: string) =>
      frame.split('\n').find((line) => line.includes(tagline)) ?? ''
    const frame = (await renderSelector()).captureCharFrame()

    expect(rowOf(frame, 'Smart & Fast')).toContain('Reasoning: high')
    const lunaRow = rowOf(frame, 'GPT-5.6 Luna')
    expect(lunaRow).toContain('Strong all-around')
    expect(lunaRow).toContain('Reasoning: high')
    expect(rowOf(frame, 'MiniMax M3')).not.toContain('Reasoning')
  })

  test('sizes and centres a row around its per-row quota chip', async () => {
    const resetAt = new Date(FIXED_NOW_MS + 60_000).toISOString()
    const pool = (
      model: string,
      poolId: string,
      poolLabel: string,
      limit: number,
    ) => ({
      model,
      pool: poolId,
      poolLabel,
      limit,
      period: 'pacific_day' as const,
      resetTimeZone: 'America/Los_Angeles',
      resetAt,
      windowHours: 24,
      recentCount: 0,
    })
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
      rateLimitsByModel: {
        [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: pool(
          FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
          'premium',
          'Premium',
          4,
        ),
        [FREEBUFF_SOLAR_PRO_4_MODEL_ID]: pool(
          FREEBUFF_SOLAR_PRO_4_MODEL_ID,
          'solar_trial',
          'Solar Pro 4',
          2,
        ),
      },
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)

    const frame = (await renderSelector()).captureCharFrame()
    const gutters = (line: string) => {
      const inner = line.slice(line.indexOf('│') + 1, line.lastIndexOf('│'))
      return [
        inner.length - inner.trimStart().length,
        inner.length - inner.trimEnd().length,
      ]
    }
    const lines = frame.split('\n')
    const chipLine = lines.find((l) => l.includes('Solar Pro 4: 0 of 2 used'))
    const warningOnlyLine = lines.find(
      (l) => l.includes('May use data for AI training') && !l.includes('used'),
    )
    expect(chipLine).toBeDefined()
    expect(warningOnlyLine).toBeDefined()
    for (const line of [chipLine!, warningOnlyLine!]) {
      const [left, right] = gutters(line)
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
    }
    expect(frame).toContain('Show fewer')
  })

  test('says nothing about a premium quota the account does not have', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)

    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain('PREMIUM')
    expect(frame).not.toContain('used')
    expect(frame).not.toContain('resets in')
  })

  test('sizes the hero card to its content, with no Press-Enter gutter', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore
      .getState()
      .setSelectedModel(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)

    const frame = (await renderSelector()).captureCharFrame()
    const heroRow = (
      frame.split('\n').find((line) => line.includes('› DeepSeek V4 Flash')) ??
      ''
    ).trimEnd()

    expect(frame).not.toContain('Press Enter')
    const gapToBorder =
      heroRow.length - 1 - (heroRow.indexOf('NEW') + 'NEW'.length)
    expect(heroRow.endsWith('│')).toBe(true)
    expect(gapToBorder).toBeLessThan(10)
  })
})

describe('FreebuffModelSelector limited-model offer', () => {
  const offerSession = (
    offer: Partial<{
      remaining: number
      total: number
      userRemaining: number
      userResetAt: string
    }> = {},
  ) => ({
    status: 'none' as const,
    accessTier: 'full' as const,
    limitedModelOffers: [
      {
        model: FREEBUFF_FABLE_5_MODEL_ID,
        remaining: 38,
        total: 50,
        userRemaining: 1,
        userResetAt: new Date(FIXED_NOW_MS + 5 * 60 * 60_000).toISOString(),
        ...offer,
      },
    ],
  })

  test('renders nothing when the server sends no offer', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).not.toContain('LIMITED TRIAL')
    expect(frame).not.toContain('Fable')
  })

  test('renders the offered model with its scarcity and data-use label', async () => {
    useFreebuffSessionStore.getState().setSession(offerSession())
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain('LIMITED TRIAL')
    expect(frame).toContain('38 of 50 sessions left')
    expect(frame).toContain('Claude Fable 5')
    expect(frame).toContain('May use data for AI training')
  })

  test('stays visible while collapsed, unlike the ordinary tiers', async () => {
    useFreebuffModelStore.getState().setSelectedModel(DEFAULT_FREEBUFF_MODEL_ID)
    useFreebuffSessionStore.getState().setSession(offerSession())
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain('See all')
    expect(frame).toContain('Claude Fable 5')
    expect(frame).not.toContain('PREMIUM')
  })

  test('explains a spent personal allowance instead of hiding the row', async () => {
    useFreebuffSessionStore
      .getState()
      .setSession(offerSession({ userRemaining: 0 }))
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain('Claude Fable 5')
    expect(frame).toContain("you've used yours")
    expect(frame).toContain('resets in')
  })

  test('drops an offer this build has no catalog entry for', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
      limitedModelOffers: [
        {
          model: 'someone/unreleased-model-9',
          remaining: 5,
          total: 50,
          userRemaining: 1,
          userResetAt: new Date(FIXED_NOW_MS + 60_000).toISOString(),
        },
      ],
    })
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).not.toContain('LIMITED TRIAL')
    expect(frame).not.toContain('unreleased-model-9')
  })

  test('keeps an offered selection instead of repairing it away', async () => {
    useFreebuffSessionStore.getState().setSession(offerSession())
    useFreebuffModelStore.getState().setSelectedModel(FREEBUFF_FABLE_5_MODEL_ID)
    await renderSelector()
    expect(getSelectedFreebuffModel()).toBe(FREEBUFF_FABLE_5_MODEL_ID)
  })

  test('repairs the selection once the wave ends', async () => {
    useFreebuffSessionStore.getState().setSession({
      status: 'none',
      accessTier: 'full',
    })
    useFreebuffModelStore.getState().setSelectedModel(FREEBUFF_FABLE_5_MODEL_ID)
    await renderSelector()
    expect(isFreebuffModelId(getSelectedFreebuffModel())).toBe(true)
  })
})

describe('FreebuffModelSelector plan line', () => {
  const PLAN_SESSION = {
    status: 'none',
    accessTier: 'full',
    subscription: {
      tierId: 'starter',
      tiers: [
        {
          id: 'starter',
          displayName: 'Starter',
          priceUsd: 8,
          firstPeriodPriceUsd: 2.5,
          dailySessions: 2,
          fiveDaySessions: 6,
          monthlySessions: 50,
          monthlySpendLimitUsd: 40,
          dailyPremiumSessions: 2,
          disclaimers: [],
          current: true,
          upgrade: false,
          downgrade: false,
        },
      ],
      usage: {
        dayUsed: 1.3,
        dayLimit: 2,
        fiveDayUsed: 3,
        fiveDayLimit: 6,
        monthUsed: 11,
        monthLimit: 50,
        dayPremiumUsed: 1,
        dayPremiumLimit: 2,
        dayResetAt: new Date(FIXED_NOW_MS + 3 * 3600_000).toISOString(),
        periodEndsAt: new Date(
          FIXED_NOW_MS + 20 * 24 * 3600_000,
        ).toISOString(),
        monthSpendUsd: 3.21,
        monthSpendLimitUsd: 40,
      },
    },
  } as never

  test('a subscriber sees their plan windows under the catalog', async () => {
    useFreebuffSessionStore.getState().setSession(PLAN_SESSION)
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain('STARTER PLAN')
    expect(frame).toContain('today 1.3 of 2')
    expect(frame).toContain('5-day 3 of 6')
    expect(frame).toContain('month 11 of 50')
  })

  test('a blocking limit names itself and its reset', async () => {
    useFreebuffSessionStore.getState().setSession({
      ...(PLAN_SESSION as Record<string, unknown>),
      subscription: {
        ...(PLAN_SESSION as { subscription: Record<string, unknown> })
          .subscription,
        blockedBy: 'daily',
      },
    } as never)
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).toContain("today's plan sessions are used")
    expect(frame).toContain('resets in 3h')
  })

  test('no plan means no plan line', async () => {
    useFreebuffSessionStore
      .getState()
      .setSession({ status: 'none', accessTier: 'full' } as never)
    const frame = (await renderSelector()).captureCharFrame()
    expect(frame).not.toContain('PLAN ·')
  })
})
