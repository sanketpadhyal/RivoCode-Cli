import {
  IMPREZIA_LIMITS,
  impreziaBaseUrlForKey,
  impreziaChatAdResponseSchema,
  isImpreziaSandboxKey,
} from './imprezia-ad'

import {
  IMPREZIA_DISPLAY_ORIGIN,
  toImpreziaDisplayAd,
} from './imprezia-display'

import type { ImpreziaAd, ImpreziaDeviceContext } from './imprezia-ad'
import type {
  ImpreziaDisplayAd,
  ImpreziaDisplayRequest,
} from './imprezia-display'
import type { Logger } from '../types/contracts/logger'

const CHAT_ADS_PATH = '/v1/ads/chat'
const DISPLAY_ADS_PATH = '/v1/display'

const REQUEST_TIMEOUT_MS = 5_000

let sandboxRefusalLogged = false

export type ImpreziaChatAdRequest = {
  request: string
  response: string
  sessionId: string
  timestamp: string
  sourceUrl: string
  surface: 'desktop' | 'cli' | 'cloud' | 'web' | 'chat' | 'mobile'
  platformString: string
  deviceContext: ImpreziaDeviceContext
}

export type ImpreziaChatAdResult = {
  requestId: string
  ad: ImpreziaAd | null
}

export type ImpreziaChatAdOutcome =
  | 'fill'
  | 'no_fill'
  | 'timeout'
  | 'provider_error'

export type ImpreziaChatAdOutcomeObserver = (
  outcome: ImpreziaChatAdOutcome,
) => void

function observeOutcome(
  observer: ImpreziaChatAdOutcomeObserver | undefined,
  outcome: ImpreziaChatAdOutcome,
): void {
  try {
    observer?.(outcome)
  } catch {
  }
}

function refusesSandboxKey(params: {
  apiKey: string
  testMode: boolean
  allowSandbox: boolean | undefined
  logger: Logger
}): boolean {
  const { apiKey, testMode, allowSandbox, logger } = params
  if (!isImpreziaSandboxKey(apiKey) || testMode || allowSandbox) return false

  const refusal =
    '[ads:imprezia] Refusing to serve: sandbox key in production. Swap in ' +
    'an api_pub_prod_ key before this can fill.'
  if (sandboxRefusalLogged) {
    logger.debug(refusal)
  } else {
    sandboxRefusalLogged = true
    logger.error(refusal)
  }
  return true
}

async function postToImprezia(params: {
  url: string
  apiKey: string
  userAgent: string
  origin?: string
  body: unknown
  productLabel: string
  signal?: AbortSignal
  onFailure?: (outcome: 'timeout' | 'provider_error') => void
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<{ status: number; body: unknown } | null> {
  const {
    url,
    apiKey,
    userAgent,
    origin,
    body,
    productLabel,
    signal,
    onFailure,
    logger,
    fetch,
  } = params

  const baseUrl = new URL(url).origin

  const controller = new AbortController()
  let abortedByCaller = false
  const abortFromCaller = () => {
    abortedByCaller = true
    controller.abort()
  }
  if (signal?.aborted) abortFromCaller()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Forwarded-User-Agent': userAgent,
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 403) {
        logger.warn(
          { baseUrl, url },
          `[ads:imprezia] Publisher is not enabled for ${productLabel}; no ad ` +
            'will fill until Imprezia enables the account for this key',
        )
        onFailure?.('provider_error')
        return null
      }
      logger.error(
        { baseUrl, url, status: response.status },
        '[ads:imprezia] API returned error',
      )
      onFailure?.('provider_error')
      return null
    }

    return {
      status: response.status,
      body:
        response.status === 204
          ? null
          : await response.json().catch((error) => {
              if (
                controller.signal.aborted ||
                (error instanceof Error && error.name === 'AbortError')
              ) {
                throw error
              }
              return null
            }),
    }
  } catch (error) {
    const aborted =
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    logger.warn(
      abortedByCaller
        ? { baseUrl, url, timedOut: true, abortSource: 'caller' }
        : { baseUrl, url, timedOut: aborted, error },
      aborted
        ? '[ads:imprezia] Ad request timed out'
        : '[ads:imprezia] Ad request failed',
    )
    onFailure?.(aborted ? 'timeout' : 'provider_error')
    return null
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function fetchImpreziaChatAd(params: {
  apiKey: string
  request: ImpreziaChatAdRequest
  userAgent: string
  testMode: boolean
  allowSandbox?: boolean
  signal?: AbortSignal
  onOutcome?: ImpreziaChatAdOutcomeObserver
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<ImpreziaChatAdResult | null> {
  const {
    apiKey,
    request,
    userAgent,
    testMode,
    allowSandbox,
    signal,
    onOutcome,
    logger,
    fetch,
  } = params
  const baseUrl = impreziaBaseUrlForKey(apiKey)

  if (!request.request.trim() || !request.response.trim()) {
    logger.debug('[ads:imprezia] Skipping turn with an empty message')
    observeOutcome(onOutcome, 'provider_error')
    return null
  }

  if (refusesSandboxKey({ apiKey, testMode, allowSandbox, logger })) {
    observeOutcome(onOutcome, 'provider_error')
    return null
  }

  const response = await postToImprezia({
    url: `${baseUrl}${CHAT_ADS_PATH}`,
    apiKey,
    userAgent,
    productLabel: 'chat ads',
    signal,
    onFailure: (outcome) => observeOutcome(onOutcome, outcome),
    logger,
    fetch,
    body: {
      ...request,
      request: request.request.slice(0, IMPREZIA_LIMITS.request),
      response: request.response.slice(0, IMPREZIA_LIMITS.response),
      sessionId: request.sessionId.slice(0, IMPREZIA_LIMITS.sessionId),
    },
  })
  if (!response) return null
  if (response.status === 204) {
    observeOutcome(onOutcome, 'no_fill')
    return null
  }

  const parsed = impreziaChatAdResponseSchema.safeParse(response.body)
  if (!parsed.success) {
    logger.error(
      { baseUrl, issues: parsed.error.issues },
      '[ads:imprezia] API response did not match the expected shape',
    )
    observeOutcome(onOutcome, 'provider_error')
    return null
  }

  const { requestId, ad } = parsed.data
  if (!ad) {
    logger.debug({ requestId }, '[ads:imprezia] No ad fill')
    observeOutcome(onOutcome, 'no_fill')
    return { requestId, ad: null }
  }

  logger.info(
    {
      requestId,
      impressionUuid: ad.impression.impressionUuid,
      brandName: ad.creative.brandName,
    },
    '[ads:imprezia] Ad filled',
  )
  observeOutcome(onOutcome, 'fill')
  return { requestId, ad }
}

export async function fetchImpreziaDisplayAd(params: {
  apiKey: string
  request: ImpreziaDisplayRequest
  userAgent: string
  testMode: boolean
  allowSandbox?: boolean
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<{ requestId: string; ad: ImpreziaDisplayAd | null } | null> {
  const { apiKey, request, userAgent, testMode, allowSandbox, logger, fetch } =
    params

  if (refusesSandboxKey({ apiKey, testMode, allowSandbox, logger })) return null

  const response = await postToImprezia({
    url: `${impreziaBaseUrlForKey(apiKey)}${DISPLAY_ADS_PATH}`,
    apiKey,
    userAgent,
    origin: IMPREZIA_DISPLAY_ORIGIN,
    productLabel: 'display ads',
    logger,
    fetch,
    body: {
      ...request,
      sessionId: request.sessionId?.slice(0, IMPREZIA_LIMITS.sessionId),
    },
  })
  if (!response) return null

  const result = toImpreziaDisplayAd(response.body)
  if (!result) {
    logger.error(
      '[ads:imprezia] Display response did not match the expected shape',
    )
    return null
  }

  if (!result.ad) {
    logger.debug(
      { requestId: result.requestId },
      '[ads:imprezia] No display fill',
    )
    return result
  }

  logger.info(
    {
      requestId: result.requestId,
      impressionUuid: result.ad.impressionUuid,
      slotId: request.slotId,
      brandName: result.ad.brandName,
    },
    '[ads:imprezia] Display ad filled',
  )
  return result
}
