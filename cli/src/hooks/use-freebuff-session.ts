import {
  FALLBACK_FREEBUFF_MODEL_ID,
  freebuffWithdrawnModelMessage,
  getFreebuffModel,
  isFreebuffLimitedOfferModelId,
  LIMITED_FREEBUFF_MODEL_ID,
  resolveFreebuffModelForAccessTier,
} from '@codebuff/common/constants/freebuff-models'
import {
  getLimitedModelOffers,
  getRateLimitsByModel,
  getReferralInfo,
  getSubscriptionInfo,
} from '@codebuff/common/types/freebuff-session'
import { useEffect } from 'react'

import {
  getSelectedFreebuffModel,
  useFreebuffModelStore,
} from '../state/freebuff-model-store'
import { useChatStore } from '../state/chat-store'
import { useFreebuffSessionStore } from '../state/freebuff-session-store'
import { getAuthTokenDetails } from '../utils/auth'
import { stopActiveRun } from '../utils/active-run'
import { IS_FREEBUFF } from '../utils/constants'
import {
  isFreebuffInstanceOwnedByDeadLocalProcess,
  recordFreebuffInstanceOwner,
} from '../utils/freebuff-instance-owner'
import { logger } from '../utils/logger'
import { getSystemMessage } from '../utils/message-history'
import {
  clearReferralCache,
  getCachedReferral,
  rememberReferral,
} from '../utils/freebuff-referral-cache'
import {
  callFreebuffSession,
  classifyFreebuffSessionRequestFailure,
  FreebuffSessionRequestError,
  holdsLiveFreebuffSlot,
  isFreebuffSessionTimeoutError,
  mergeCompactActiveSession,
  releaseFreebuffSlot,
} from '../utils/freebuff-session-api'
import {
  failedPollDelayMs,
  jitterPollIntervalMs,
} from '../utils/polling-backoff'
import { saveFreebuffModelPreference } from '../utils/settings'

import type { FreebuffSessionResponse } from '../types/freebuff-session'
import type {
  FreebuffCountryBlockReason,
  FreebuffIpPrivacySignal,
} from '@codebuff/common/types/freebuff-session'

const POLL_INTERVAL_ACTIVE_MS = 30_000

const playAdmissionSound = () => {
  try {
    process.stdout.write('\x07')
  } catch {
  }
}

function nextDelayMs(next: FreebuffSessionResponse): number | null {
  const activeCadenceMs = jitterPollIntervalMs({
    intervalMs: POLL_INTERVAL_ACTIVE_MS,
  })
  switch (next.status) {
    case 'active':
      return Math.max(
        1_000,
        Math.min(activeCadenceMs, next.remainingMs + 1_000),
      )
    case 'ended':
      return next.instanceId ? activeCadenceMs : null
    case 'none':
    case 'superseded':
    case 'takeover_prompt':
    case 'country_blocked':
    case 'banned':
    case 'model_locked':
    case 'rate_limited':
    case 'spend_limited':
    case 'ip_capped':
    case 'model_unavailable':
    case 'premium_slot_taken':
      return null
  }
}

type RestartMode = 'rejoin' | 'landing'

interface PollController {
  restart: (mode: RestartMode) => Promise<void>
  apply: (next: FreebuffSessionResponse) => void
  abort: () => void
}

let controller: PollController | null = null

let pendingExplicitPickModel: string | null = null

export function getFreebuffInstanceId(): string | undefined {
  const current = useFreebuffSessionStore.getState().session
  if (!current || !holdsLiveFreebuffSlot(current)) return undefined
  return 'instanceId' in current ? current.instanceId : undefined
}

function toLandingSession(
  current: FreebuffSessionResponse | null,
): Extract<FreebuffSessionResponse, { status: 'none' }> {
  const accessTier =
    current && 'accessTier' in current ? current.accessTier : undefined
  const rateLimitsByModel = getRateLimitsByModel(current)
  const referral = accessTier
    ? (getReferralInfo(current) ?? getCachedReferral(accessTier))
    : undefined
  const countryCode =
    current && 'countryCode' in current ? current.countryCode : undefined
  const countryBlockReason =
    current && 'countryBlockReason' in current
      ? current.countryBlockReason
      : undefined
  const ipPrivacySignals =
    current && 'ipPrivacySignals' in current
      ? current.ipPrivacySignals
      : undefined
  const limitedModelOffers = getLimitedModelOffers(current)
  const subscription = getSubscriptionInfo(current)

  return {
    status: 'none',
    ...(accessTier ? { accessTier } : {}),
    ...(rateLimitsByModel ? { rateLimitsByModel } : {}),
    ...(referral ? { referral } : {}),
    ...(subscription ? { subscription } : {}),
    ...(limitedModelOffers.length > 0 ? { limitedModelOffers } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(countryBlockReason ? { countryBlockReason } : {}),
    ...(ipPrivacySignals ? { ipPrivacySignals } : {}),
  }
}

interface RestartOpts {
  resetChat?: boolean
  releaseSlot?: boolean
}

async function restartFreebuffSession(
  mode: RestartMode,
  opts: RestartOpts = {},
): Promise<void> {
  if (!IS_FREEBUFF) return
  if (opts.resetChat) {
    stopActiveRun('session-transition')
    useChatStore.getState().reset()
  }
  controller?.abort()
  if (opts.releaseSlot) await releaseFreebuffSlot()
  await controller?.restart(mode)
}

export function refreshFreebuffSession(
  opts: { resetChat?: boolean } = {},
): Promise<void> {
  return restartFreebuffSession('rejoin', { resetChat: opts.resetChat })
}

export function returnToFreebuffLanding(
  opts: { resetChat?: boolean } = {},
): Promise<void> {
  return restartFreebuffSession('landing', {
    resetChat: opts.resetChat,
    releaseSlot: true,
  })
}

export function refreshFreebuffLandingMetadata(): Promise<void> {
  return restartFreebuffSession('landing')
}

export function startFreebuffSession(model: string): Promise<void> {
  if (!IS_FREEBUFF) return Promise.resolve()
  const current = useFreebuffSessionStore.getState().session
  const accessTier =
    current && 'accessTier' in current ? current.accessTier : 'full'
  const resolved = resolveFreebuffModelForAccessTier(model, accessTier)
  pendingExplicitPickModel = resolved
  useFreebuffModelStore.getState().setSelectedModel(resolved)
  saveFreebuffModelPreference(resolved)
  return restartFreebuffSession('rejoin')
}

let takeoverInFlight: Promise<void> | null = null

export function takeOverFreebuffSession(): Promise<void> {
  if (!IS_FREEBUFF) return Promise.resolve()
  if (takeoverInFlight) return takeoverInFlight

  const { session } = useFreebuffSessionStore.getState()
  if (session?.status !== 'takeover_prompt') {
    return Promise.resolve()
  }

  useFreebuffModelStore.getState().setSelectedModel(session.model)
  takeoverInFlight = restartFreebuffSession('rejoin').finally(() => {
    takeoverInFlight = null
  })
  return takeoverInFlight
}

export function markFreebuffSessionSuperseded(): void {
  if (!IS_FREEBUFF) return
  controller?.abort()
  controller?.apply({ status: 'superseded' })
}

export function markFreebuffSessionCountryBlocked(params: {
  countryCode: string
  countryBlockReason?: FreebuffCountryBlockReason
  ipPrivacySignals?: FreebuffIpPrivacySignal[]
}): void {
  if (!IS_FREEBUFF) return
  controller?.abort()
  controller?.apply({ status: 'country_blocked', ...params })
  releaseFreebuffSlot().catch(() => {})
}

export function markFreebuffSessionEnded(): void {
  if (!IS_FREEBUFF) return
  controller?.abort()
  const current = useFreebuffSessionStore.getState().session
  const rateLimitsByModel = getRateLimitsByModel(current)
  controller?.apply({
    status: 'ended',
    accessTier:
      current && 'accessTier' in current ? current.accessTier : undefined,
    rateLimitsByModel,
    subscription: getSubscriptionInfo(current),
  })
}

interface UseFreebuffSessionResult {
  session: FreebuffSessionResponse | null
  failure: ReturnType<typeof useFreebuffSessionStore.getState>['failure']
}

export function useFreebuffSession(): UseFreebuffSessionResult {
  const session = useFreebuffSessionStore((s) => s.session)
  const failure = useFreebuffSessionStore((s) => s.failure)

  useEffect(() => {
    const { setSession, setFailure } = useFreebuffSessionStore.getState()

    if (!IS_FREEBUFF) {
      setSession(null)
      return
    }

    const { token } = getAuthTokenDetails()
    if (!token) {
      logger.warn(
        {},
        '[freebuff-session] No auth token; skipping free-session admission',
      )
      setFailure({
        type: 'other',
        message: 'Not authenticated',
        retry: null,
        outcomeUnknown: false,
      })
      return
    }

    let cancelled = false
    let abortController = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    let previousStatus: FreebuffSessionResponse['status'] | null = null
    let needsFullActivePoll = false
    let restartGeneration = 0
    let consecutiveFailures = 0
    let nextMethod: 'GET' | 'POST' = 'GET'

    const apply = (next: FreebuffSessionResponse) => {
      rememberReferral(next)
      if (next.status === 'active') {
        useFreebuffModelStore.getState().setSelectedModel(next.model)
        recordFreebuffInstanceOwner(next.instanceId)
      } else if (next.status === 'none' && next.accessTier === 'limited') {
        useFreebuffModelStore
          .getState()
          .setSelectedModel(LIMITED_FREEBUFF_MODEL_ID)
      }
      setSession(next)
      setFailure(null)
      previousStatus = next.status
    }

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    const schedule = (ms: number) => {
      if (cancelled) return
      clearTimer()
      timer = setTimeout(tick, ms)
    }

    const tick = async () => {
      if (cancelled) return
      const method = nextMethod
      const instanceId = getFreebuffInstanceId()
      const model = getSelectedFreebuffModel()
      const compact =
        method === 'GET' && previousStatus === 'active' && !needsFullActivePoll
      const fetchController = abortController
      const generation = restartGeneration
      try {
        const next = await callFreebuffSession(method, token, {
          signal: fetchController.signal,
          instanceId,
          model,
          compact,
        })
        if (
          cancelled ||
          fetchController.signal.aborted ||
          generation !== restartGeneration
        ) {
          return
        }
        consecutiveFailures = 0
        nextMethod = 'GET'

        const explicitPickModel = pendingExplicitPickModel
        pendingExplicitPickModel = null

        if (next.status === 'model_locked') {
          if (explicitPickModel && explicitPickModel !== next.currentModel) {
            const current = getFreebuffModel(next.currentModel).displayName
            const requested = getFreebuffModel(explicitPickModel).displayName
            let released = false
            try {
              await callFreebuffSession('DELETE', token, {
                signal: fetchController.signal,
              })
              released = true
            } catch {
            }
            if (
              cancelled ||
              fetchController.signal.aborted ||
              generation !== restartGeneration
            ) {
              return
            }
            if (released) {
              useChatStore
                .getState()
                .setMessages((prev) => [
                  ...prev,
                  getSystemMessage(
                    `Ended your previous session on ${current} and switched to ${requested}.`,
                  ),
                ])
              nextMethod = 'POST'
              schedule(0)
              return
            }
            useChatStore
              .getState()
              .setMessages((prev) => [
                ...prev,
                getSystemMessage(
                  `You're already in an active session on ${current}, and ending it failed, so the switch to ${requested} was not applied. Run /end-session, then pick ${requested}. (Sessions end on their own after 1 hour.)`,
                ),
              ])
          }
          useFreebuffModelStore.getState().setSelectedModel(next.currentModel)
          schedule(0)
          return
        }
        if (next.status === 'model_unavailable') {
          if (next.withdrawn) {
            useChatStore
              .getState()
              .setMessages((prev) => [
                ...prev,
                getSystemMessage(
                  freebuffWithdrawnModelMessage(next.requestedModel),
                ),
              ])
          } else if (isFreebuffLimitedOfferModelId(next.requestedModel)) {
            const requested = getFreebuffModel(next.requestedModel).displayName
            const fallback = getFreebuffModel(
              FALLBACK_FREEBUFF_MODEL_ID,
            ).displayName
            useChatStore
              .getState()
              .setMessages((prev) => [
                ...prev,
                getSystemMessage(
                  `${requested}'s trial sessions just ran out, so this session started on ${fallback} instead. Check back later — we release more in batches.`,
                ),
              ])
          }
          useFreebuffModelStore
            .getState()
            .setSelectedModel(FALLBACK_FREEBUFF_MODEL_ID)
          nextMethod = 'POST'
          schedule(0)
          return
        }

        if (
          method === 'GET' &&
          previousStatus === null &&
          next.status === 'active'
        ) {
          useFreebuffModelStore.getState().setSelectedModel(next.model)
          if (isFreebuffInstanceOwnedByDeadLocalProcess(next.instanceId)) {
            nextMethod = 'POST'
            schedule(0)
            return
          }
          apply({ status: 'takeover_prompt', model: next.model })
          return
        }

        if (previousStatus === 'none' && next.status === 'active') {
          playAdmissionSound()
        }

        if (
          (previousStatus === 'active' || previousStatus === 'ended') &&
          next.status === 'none'
        ) {
          const current = useFreebuffSessionStore.getState().session
          const rateLimitsByModel =
            next.rateLimitsByModel ?? getRateLimitsByModel(current)
          apply({
            status: 'ended',
            accessTier:
              next.accessTier ??
              (current && 'accessTier' in current
                ? current.accessTier
                : undefined),
            rateLimitsByModel,
            subscription:
              getSubscriptionInfo(next) ?? getSubscriptionInfo(current),
          })
          return
        }

        if (compact && next.status === 'active') {
          const merged = mergeCompactActiveSession(
            useFreebuffSessionStore.getState().session,
            next,
          )
          needsFullActivePoll = merged === null
          apply(merged ?? next)
        } else {
          needsFullActivePoll = false
          apply(next)
        }
        if (needsFullActivePoll) {
          schedule(0)
          return
        }
        const delay = nextDelayMs(next)
        if (delay !== null) schedule(delay)
      } catch (err) {
        if (
          cancelled ||
          fetchController.signal.aborted ||
          generation !== restartGeneration
        ) {
          return
        }
        const msg = err instanceof Error ? err.message : String(err)
        consecutiveFailures++
        const disposition = classifyFreebuffSessionRequestFailure(method, err)
        const shouldRetry = disposition === 'retry'
        const retryAfterMs =
          err instanceof FreebuffSessionRequestError
            ? err.retryAfterMs
            : undefined
        const delayMs = shouldRetry
          ? failedPollDelayMs({
              consecutiveFailures,
              retryAfterMs,
            })
          : null
        logger.warn(
          { error: msg, method, consecutiveFailures, delayMs, shouldRetry },
          shouldRetry
            ? '[freebuff-session] fetch failed; backing off'
            : '[freebuff-session] fetch failed; automatic retry stopped',
        )
        const retry =
          delayMs === null
            ? null
            : {
                attempt: consecutiveFailures + 1,
                retryAtMs: Date.now() + delayMs,
              }
        const failure = {
          message: msg,
          retry,
          outcomeUnknown: disposition === 'unknown',
        }
        if (err instanceof FreebuffSessionRequestError) {
          setFailure({
            ...failure,
            type: 'http',
            statusCode: err.statusCode,
          })
        } else if (isFreebuffSessionTimeoutError(err)) {
          setFailure({ ...failure, type: 'timeout' })
        } else {
          setFailure({ ...failure, type: 'other' })
        }
        if (delayMs !== null) schedule(delayMs)
      }
    }

    controller = {
      restart: async (mode) => {
        const generation = ++restartGeneration
        clearTimer()
        abortController.abort()
        abortController = new AbortController()
        previousStatus = null
        needsFullActivePoll = false
        consecutiveFailures = 0
        setFailure(null)
        if (mode === 'landing') {
          nextMethod = 'GET'
          const landingSession = toLandingSession(
            useFreebuffSessionStore.getState().session,
          )
          apply(landingSession)
          const fetchController = abortController
          callFreebuffSession('GET', token, {
            signal: fetchController.signal,
          })
            .then((response) => {
              if (
                cancelled ||
                fetchController.signal.aborted ||
                generation !== restartGeneration
              ) {
                return
              }
              if (response.status === 'none') {
                const canReuseLandingMetadata =
                  response.accessTier === undefined ||
                  response.accessTier === landingSession.accessTier
                apply({
                  ...(canReuseLandingMetadata ? landingSession : {}),
                  ...response,
                  status: 'none',
                  accessTier: response.accessTier ?? landingSession.accessTier,
                  referral: response.referral,
                })
              }
            })
            .catch(() => {
            })
          return
        }
        nextMethod = 'POST'
        await tick()
      },
      apply,
      abort: () => {
        clearTimer()
        abortController.abort()
      },
    }

    tick()

    return () => {
      cancelled = true
      abortController.abort()
      clearTimer()
      const current = useFreebuffSessionStore.getState().session
      controller = null
      clearReferralCache()

      if (holdsLiveFreebuffSlot(current)) {
        callFreebuffSession('DELETE', token).catch(() => {})
      }
      setSession(null)
      setFailure(null)
    }
  }, [])

  return { session, failure }
}
