import { WEBSITE_URL } from '@rivocode/sdk'
import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'
import { getAdUserAgent } from '@rivocode/common/util/ad-user-agent'
import {
  acknowledgeFirstPartyView,
  type FirstPartyViewAckRequest,
} from '@rivocode/common/ads/first-party-view-ack'
import { createFirstPartyViewAckTelemetry } from '@rivocode/common/util/axiom-only-log'
import { useEffect, useRef, useState } from 'react'

import { useTerminalLayout } from './use-terminal-layout'
import { getAdsEnabled } from '../commands/ads'
import { useChatStore } from '../state/chat-store'
import { isUserActive, subscribeToActivity } from '../utils/activity-tracker'
import { getAuthToken } from '../utils/auth'
import { IS_FREEBUFF } from '../utils/constants'
import { getCliEnv } from '../utils/env'
import { logger } from '../utils/logger'
import { enqueueClientLog } from '../utils/log-shipper'
import { AI_MESSAGE_ID_PREFIX } from '../utils/ai-message-id'
import { trackEvent } from '../utils/analytics'
import {
  createLazyResponseAdQueue,
  MAX_RESPONSE_AD_POOL_SIZE,
  requestLazyResponseAds,
} from '../utils/lazy-response-ads'

import type { Message } from '@rivocode/sdk'
import type { ChatMessage } from '../types/chat'

const AD_ROTATION_INTERVAL_MS = 60 * 1000
const MAX_ADS_AFTER_ACTIVITY = 3
const ACTIVITY_THRESHOLD_MS = 30_000
const MAX_AD_CACHE_SIZE = 50
const ZEROCLICK_IMPRESSIONS_URL = 'https://zeroclick.dev/api/v2/impressions'

export type AdResponse = {
  adText: string
  title: string
  cta: string
  url: string
  favicon: string
  clickUrl: string
  impUrl: string
  placementId?: string
  provider?: AdProvider
  impressionIds?: string[]
  credits?: number
}

export type AdProvider = 'gravity' | 'carbon' | 'zeroclick' | 'first_party'
export type AdSurface = 'waiting_room' | 'cli_chat'

export type GravityAdState = {
  ads: AdResponse[] | null
  responseAds: Record<string, AdResponse[]>
  requestResponseAds: (messageId: string, count: number) => void
  isLoading: boolean
  recordClick: (ad: AdResponse) => void
  recordImpression: (ad: AdResponse) => void
}

type GravityController = {
  choiceCache: AdResponse[][]
  choiceCacheIndex: number
  impressionsFired: Set<string>
  adsShownSinceActivity: number
  tickInFlight: boolean
  inlineQueue: ReturnType<typeof createLazyResponseAdQueue<AdResponse>>
  eligibleSlotCounts: Map<string, number>
}

function addToChoiceCache(ctrl: GravityController, ads: AdResponse[]): void {
  if (ads.some((ad) => ad.provider === 'zeroclick')) return

  const key = ads[0]?.impUrl
  if (key && ctrl.choiceCache.some((set) => set[0]?.impUrl === key)) return
  if (ctrl.choiceCache.length >= MAX_AD_CACHE_SIZE) ctrl.choiceCache.shift()
  ctrl.choiceCache.push(ads)
}

function nextFromChoiceCache(ctrl: GravityController): AdResponse[] | null {
  if (ctrl.choiceCache.length === 0) return null
  const set = ctrl.choiceCache[ctrl.choiceCacheIndex % ctrl.choiceCache.length]!
  ctrl.choiceCacheIndex = (ctrl.choiceCacheIndex + 1) % ctrl.choiceCache.length
  return set
}

export function isAnswerMessage(m: ChatMessage): boolean {
  return (
    !m.parentId && m.variant === 'ai' && m.id.startsWith(AI_MESSAGE_ID_PREFIX)
  )
}

export function isInlineAdEligibleAnswer(m: ChatMessage): boolean {
  return isAnswerMessage(m) && m.metadata?.allowInlineAds === true
}

export function claimAdImpression(
  impressionsFired: Set<string>,
  impUrl: string,
): boolean {
  if (impressionsFired.has(impUrl)) return false
  impressionsFired.add(impUrl)
  return true
}

export function dispatchFirstPartyViewAcknowledgement(
  provider: AdProvider | undefined,
  request: Omit<FirstPartyViewAckRequest, 'onAttempt'>,
  onAttempt: NonNullable<FirstPartyViewAckRequest['onAttempt']>,
  acknowledge: typeof acknowledgeFirstPartyView = acknowledgeFirstPartyView,
): boolean {
  if (provider !== 'first_party') return false
  void acknowledge({ ...request, onAttempt })
  return true
}

function trackInlineAdEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown>,
): void {
  try {
    trackEvent(event, properties)
  } catch (error) {
    logger.debug({ error, event }, '[ads] Failed to track inline ad event')
  }
}

type GravityAdOptionsBase = {
  enabled?: boolean
  forceStart?: boolean
  provider?: AdProvider
  surface?: AdSurface
  slotPlacementId?: string
  placementIds?: string[]
}

type GravityAdOptions = GravityAdOptionsBase &
  (
    | {
        inline: true
        inlinePlacementId: string
      }
    | {
        inline?: false
        inlinePlacementId?: never
      }
  )

export const useGravityAd = (options?: GravityAdOptions): GravityAdState => {
  const enabled = options?.enabled ?? true
  const forceStart = options?.forceStart ?? false
  const provider: AdProvider = options?.provider ?? 'gravity'
  const surface = options?.surface
  const inline = options?.inline ?? false
  const inlinePlacementId = options?.inlinePlacementId
  const slotPlacementId = options?.slotPlacementId
  const placementIds = options?.placementIds
  const [ads, setAds] = useState<AdResponse[] | null>(null)
  const [responseAds, setResponseAds] = useState<Record<string, AdResponse[]>>(
    {},
  )
  const [isLoading, setIsLoading] = useState(false)

  const { terminalHeight } = useTerminalLayout()
  const isVeryCompactHeight = terminalHeight <= 17

  const isFreeMode = IS_FREEBUFF

  const shouldHideAds = !enabled || (isVeryCompactHeight && !isFreeMode)

  const hasUserMessagedStore = useChatStore((s) =>
    s.messages.some((m) => m.variant === 'user'),
  )
  const shouldStart = forceStart || hasUserMessagedStore

  const ctrlRef = useRef<GravityController>({
    choiceCache: [],
    choiceCacheIndex: 0,
    impressionsFired: new Set(),
    adsShownSinceActivity: 0,
    tickInFlight: false,
    inlineQueue: createLazyResponseAdQueue<AdResponse>(),
    eligibleSlotCounts: new Map(),
  })

  const tickRef = useRef<() => void>(() => {})

  const shouldHideAdsRef = useRef(shouldHideAds)
  shouldHideAdsRef.current = shouldHideAds

  const recordImpressionOnce = (ad: AdResponse): void => {
    if (shouldHideAdsRef.current) return

    const ctrl = ctrlRef.current
    const { impUrl } = ad
    if (!claimAdImpression(ctrl.impressionsFired, impUrl)) return

    const recordLocalImpression = async (): Promise<void> => {
      const authToken = getAuthToken()
      if (!authToken) {
        logger.warn('[ads] No auth token, skipping local impression recording')
        return
      }

      const agentMode = useChatStore.getState().agentMode

      const dispatchedFirstPartyAck = dispatchFirstPartyViewAcknowledgement(
        ad.provider,
        {
          token: impUrl,
          url: `${WEBSITE_URL}/api/v1/ads/impression`,
          init: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
              'User-Agent': getCliAdRequestUserAgent(),
            },
            body: JSON.stringify({
              impUrl,
              mode: agentMode,
              userAgent: getAdUserAgent(),
              os: getDeviceInfo().os,
            }),
          },
          surface: surface ?? 'cli_chat',
          placementId: ad.placementId ?? slotPlacementId ?? 'unknown',
          clientFamily: 'cli',
        },
        (observation) => {
          const telemetry = createFirstPartyViewAckTelemetry(observation)
          if (telemetry) {
            enqueueClientLog({
              level: 'info',
              event: AnalyticsEvent.ADS_FIRST_PARTY_VIEW_ACK,
              message: 'First-party view acknowledgement',
              data: telemetry,
            })
          }
        },
      )
      if (dispatchedFirstPartyAck) {
        return
      }

      const res = await fetch(`${WEBSITE_URL}/api/v1/ads/impression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'User-Agent': getCliAdRequestUserAgent(),
        },
        body: JSON.stringify({
          impUrl,
          mode: agentMode,
          userAgent: getAdUserAgent(),
          os: getDeviceInfo().os,
        }),
      })

      if (!res.ok) {
        logger.debug(
          { status: res.status },
          '[ads] Failed to record local ad impression',
        )
        return
      }

      const data = await res.json()
      if (data.creditsGranted > 0) {
        logger.info(
          { creditsGranted: data.creditsGranted },
          '[ads] Ad impression credits granted',
        )
        setAds((cur) => {
          if (!cur) return cur
          return cur.map((a) =>
            a.impUrl === impUrl ? { ...a, credits: data.creditsGranted } : a,
          )
        })
      }
    }

    if (ad.provider === 'zeroclick' && ad.impressionIds?.length) {
      void (async () => {
        try {
          const res = await fetch(ZEROCLICK_IMPRESSIONS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ad.impressionIds }),
          })

          if (!res.ok) {
            logger.debug(
              { status: res.status },
              '[ads] Failed to record ZeroClick impression',
            )
            return
          }
        } catch (err) {
          logger.debug({ err }, '[ads] Failed to record ZeroClick impression')
          return
        }

        recordLocalImpression().catch((err) => {
          logger.debug({ err }, '[ads] Failed to record local ad impression')
        })
      })()
      return
    }

    recordLocalImpression().catch((err) => {
      logger.debug({ err }, '[ads] Failed to record ad impression')
    })
  }

  const recordClick = (ad: AdResponse): void => {
    const authToken = getAuthToken()
    if (!authToken) {
      logger.warn('[ads] No auth token, skipping ad click recording')
      return
    }

    void fetch(`${WEBSITE_URL}/api/v1/ads/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'User-Agent': getCliAdRequestUserAgent(),
      },
      body: JSON.stringify({
        impUrl: ad.impUrl,
        ...(surface ? { surface } : {}),
      }),
    })
      .then((res) => {
        if (!res.ok) {
          logger.debug(
            { status: res.status },
            '[ads] Failed to record ad click',
          )
        }
      })
      .catch((err) => {
        logger.debug({ err }, '[ads] Failed to record ad click')
      })
  }

  type FetchAdResult = { ads: AdResponse[] } | null

  const fetchAd = async (params?: {
    placementId?: string
    placementIds?: string[]
  }): Promise<FetchAdResult> => {
    if (shouldHideAdsRef.current) return null
    if (!getAdsEnabled()) return null

    const authToken = getAuthToken()
    if (!authToken) {
      logger.warn('[ads] No auth token available')
      return null
    }

    const currentRunState = useChatStore.getState().runState
    const messageHistory =
      currentRunState?.sessionState?.mainAgentState?.messageHistory ?? []
    const adMessages = convertToAdMessages(messageHistory)

    const uiMessages = useChatStore.getState().messages
    const lastUIMessage = [...uiMessages]
      .reverse()
      .find((msg) => msg.variant === 'user')

    if (lastUIMessage?.content) {
      const lastAdUserMessage = [...adMessages]
        .reverse()
        .find((m) => m.role === 'user')
      if (
        !lastAdUserMessage ||
        !lastAdUserMessage.content.includes(lastUIMessage.content)
      ) {
        adMessages.push({
          role: 'user',
          content: `<user_message>${lastUIMessage.content}</user_message>`,
        })
      }
    }

    try {
      const response = await fetch(`${WEBSITE_URL}/api/v1/ads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'User-Agent': getCliAdRequestUserAgent(),
        },
        body: JSON.stringify({
          provider,
          messages: adMessages,
          sessionId: useChatStore.getState().chatSessionId,
          device: getDeviceInfo(),
          ...(surface ? { surface } : {}),
          ...(params?.placementId ? { placementId: params.placementId } : {}),
          ...(params?.placementIds?.length
            ? { placementIds: params.placementIds }
            : {}),
          userAgent: getAdUserAgent(),
        }),
      })

      if (!response.ok) {
        let responseBody: unknown
        try {
          const contentType = response.headers.get('content-type') ?? ''
          responseBody = contentType.includes('application/json')
            ? await response.json()
            : await response.text()
        } catch {
          responseBody = 'Unable to parse error response'
        }
        logger.warn(
          { provider, status: response.status, response: responseBody },
          '[ads] Web API returned error',
        )
        return null
      }

      const data = await response.json()

      if (Array.isArray(data.ads) && data.ads.length > 0) {
        return {
          ads: (data.ads as AdResponse[]).map((ad) => ({
            ...ad,
            provider: data.provider ?? provider,
          })),
        }
      }
    } catch (err) {
      logger.error({ err, provider }, '[ads] Failed to fetch ad')
    }

    return null
  }

  tickRef.current = () => {
    void (async () => {
      const ctrl = ctrlRef.current
      if (ctrl.tickInFlight) return
      ctrl.tickInFlight = true

      try {
        if (!getAdsEnabled()) return

        const canFetchNew =
          ctrl.adsShownSinceActivity < MAX_ADS_AFTER_ACTIVITY &&
          isUserActive(ACTIVITY_THRESHOLD_MS)

        const result = canFetchNew
          ? await fetchAd({ placementId: slotPlacementId, placementIds })
          : null

        if (result) {
          addToChoiceCache(ctrl, result.ads)
          ctrl.adsShownSinceActivity += 1
          setAds(result.ads)
        } else {
          const cachedSet = nextFromChoiceCache(ctrl)
          if (cachedSet) {
            ctrl.adsShownSinceActivity += 1
            setAds(cachedSet)
          } else {
            setAds((cur) => (cur?.[0]?.provider === 'zeroclick' ? null : cur))
          }
        }
      } finally {
        ctrl.tickInFlight = false
      }
    })()
  }

  useEffect(() => {
    if (!getAdsEnabled()) return
    return subscribeToActivity(() => {
      ctrlRef.current.adsShownSinceActivity = 0
    })
  }, [])

  useEffect(() => {
    if (!shouldStart || !getAdsEnabled() || shouldHideAds) return

    setIsLoading(true)

    void (async () => {
      const result = await fetchAd({
        placementId: slotPlacementId,
        placementIds,
      })
      if (result) {
        const ctrl = ctrlRef.current
        addToChoiceCache(ctrl, result.ads)
        setAds(result.ads)
        ctrl.adsShownSinceActivity = 1
      }
      setIsLoading(false)
    })()

    const id = setInterval(() => tickRef.current(), AD_ROTATION_INTERVAL_MS)

    return () => {
      clearInterval(id)
    }
  }, [shouldStart, shouldHideAds, provider, surface, placementIds?.join(',')])

  const requestResponseAds = (messageId: string, count: number): void => {
    if (
      !inline ||
      !inlinePlacementId ||
      count <= 0 ||
      shouldHideAdsRef.current ||
      !getAdsEnabled()
    ) {
      return
    }

    const messages = useChatStore.getState().messages
    const answer = messages.find((m) => m.id === messageId)
    if (!answer || !isInlineAdEligibleAnswer(answer)) {
      return
    }

    const ctrl = ctrlRef.current
    const previousEligibleCount = ctrl.eligibleSlotCounts.get(messageId) ?? 0
    if (count > previousEligibleCount) {
      ctrl.eligibleSlotCounts.set(messageId, count)
      const telemetryProperties = {
        response_id: messageId,
        chat_session_id: useChatStore.getState().chatSessionId,
        eligible_slot_count: count,
        pool_size: MAX_RESPONSE_AD_POOL_SIZE,
        provider,
        surface,
        placement_id: inlinePlacementId,
        is_freebuff: IS_FREEBUFF,
      }
      trackInlineAdEvent(
        AnalyticsEvent.CLI_INLINE_AD_SLOT_ELIGIBLE,
        telemetryProperties,
      )

      if (
        count > MAX_RESPONSE_AD_POOL_SIZE &&
        previousEligibleCount <= MAX_RESPONSE_AD_POOL_SIZE
      ) {
        enqueueClientLog({
          level: 'info',
          event: 'cli.inline_ad_pool_reused',
          message: 'CLI inline-ad pool reused',
          client_session_id: telemetryProperties.chat_session_id,
          data: telemetryProperties,
        })
      }
    }

    void requestLazyResponseAds({
      queue: ctrl.inlineQueue,
      messageId,
      count,
      fetchOne: async () => {
        const result = await fetchAd({ placementId: inlinePlacementId })
        return result?.ads[0] ?? null
      },
      onAd: (ad) => {
        setResponseAds((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] ?? []), ad],
        }))
      },
    })
  }

  const visible = shouldStart && !shouldHideAds
  return {
    ads: visible ? ads : null,
    responseAds: visible ? responseAds : {},
    requestResponseAds,
    isLoading,
    recordClick,
    recordImpression: recordImpressionOnce,
  }
}

type AdMessage = { role: 'user' | 'assistant'; content: string }

const convertToAdMessages = (messages: Message[]): AdMessage[] => {
  const adMessages: AdMessage[] = messages
    .filter(
      (message) => message.role === 'assistant' || message.role === 'user',
    )
    .filter(
      (message) =>
        !message.tags || !message.tags.includes('INSTRUCTIONS_PROMPT'),
    )
    .map((message) => ({
      role: message.role,
      content: message.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text.trim())
        .filter((c) => c !== '')
        .join('\n\n')
        .trim(),
    }))
    .filter((message) => message.content !== '')

  return adMessages
}

type DeviceInfo = {
  os: 'macos' | 'windows' | 'linux'
  timezone: string
  locale: string
}

function getDeviceInfo(): DeviceInfo {
  const platformToOs: Record<string, 'macos' | 'windows' | 'linux'> = {
    darwin: 'macos',
    win32: 'windows',
    linux: 'linux',
  }
  const os = platformToOs[process.platform] ?? 'linux'

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const locale = Intl.DateTimeFormat().resolvedOptions().locale

  return { os, timezone, locale }
}

function getCliAdRequestUserAgent(): string {
  const product = IS_FREEBUFF ? 'Freebuff-CLI' : 'Codebuff-CLI'
  const version = getCliEnv().CODEBUFF_CLI_VERSION ?? 'dev'
  return `${product}/${version}`
}
