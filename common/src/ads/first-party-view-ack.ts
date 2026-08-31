export const FIRST_PARTY_VIEW_ACK_OUTCOMES = [
  'accepted',
  'deduped',
  'client_error',
  'server_error',
  'timeout',
  'network_error',
] as const

export const FIRST_PARTY_VIEW_ACK_CLIENT_FAMILIES = [
  'cli',
  'desktop',
  'web',
  'chat',
] as const

export type FirstPartyViewAckOutcome =
  (typeof FIRST_PARTY_VIEW_ACK_OUTCOMES)[number]
export type FirstPartyViewAckClientFamily =
  (typeof FIRST_PARTY_VIEW_ACK_CLIENT_FAMILIES)[number]

export type FirstPartyViewAckObservation = {
  surface: string
  placement_id: string
  outcome: FirstPartyViewAckOutcome
  attempt: 1 | 2 | 3
  duration_ms: number
  client_family: FirstPartyViewAckClientFamily
}

export type FirstPartyViewAckRequest = {
  token: string
  url: string
  surface: string
  placementId: string
  clientFamily: FirstPartyViewAckObservation['client_family']
  init?: RequestInit
  keepalive?: boolean
  fetch?: FirstPartyAckFetch
  onAttempt?: (observation: FirstPartyViewAckObservation) => void
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  attemptTimeoutMs?: number
}

export type FirstPartyAckFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export const FIRST_PARTY_VIEW_ACK_TIMEOUT_MS = 2_000
export const FIRST_PARTY_VIEW_ACK_MAX_DURATION_MS = 10_000
export const MAX_COMPLETED_FIRST_PARTY_VIEW_ACK_TOKENS = 1_024
const RETRY_DELAYS_MS = [250, 1_000] as const
const completedTokens = new Set<string>()
const inFlightTokens = new Map<string, Promise<void>>()

function timeoutSignal(timeoutMs: number): {
  signal: AbortSignal
  cancel: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return { signal: controller.signal, cancel: () => clearTimeout(timer) }
}

function isDedupedResponse(response: Response, body: unknown): boolean {
  return (
    response.status === 208 ||
    response.headers.get('X-Ack-Outcome') === 'deduped' ||
    (typeof body === 'object' &&
      body !== null &&
      ((body as { acknowledgement?: unknown }).acknowledgement === 'deduped' ||
        (body as { alreadyRecorded?: unknown }).alreadyRecorded === true))
  )
}

async function responseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null
  return response.json().catch(() => null)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function markTokenCompleted(token: string): void {
  completedTokens.delete(token)
  while (completedTokens.size >= MAX_COMPLETED_FIRST_PARTY_VIEW_ACK_TOKENS) {
    const oldest = completedTokens.values().next().value
    if (oldest === undefined) break
    completedTokens.delete(oldest)
  }
  completedTokens.add(token)
}

export function acknowledgeFirstPartyView(
  request: FirstPartyViewAckRequest,
): Promise<void> {
  if (!request.token || completedTokens.has(request.token)) {
    return Promise.resolve()
  }
  const existing = inFlightTokens.get(request.token)
  if (existing) return existing

  const fetchImpl = request.fetch ?? globalThis.fetch
  const init = {
    ...request.init,
    ...(request.keepalive ? { keepalive: true } : {}),
  }
  const run = (async () => {
    const now = request.now ?? Date.now
    const firstStartedAt = now()
    for (const index of [0, 1, 2] as const) {
      const attempt = (index + 1) as 1 | 2 | 3
      const timeout = timeoutSignal(
        request.attemptTimeoutMs ?? FIRST_PARTY_VIEW_ACK_TIMEOUT_MS,
      )
      let outcome: FirstPartyViewAckOutcome
      try {
        const response = await fetchImpl(request.url, {
          ...init,
          signal: timeout.signal,
        })
        const body = response.ok ? await responseBody(response) : null
        if (response.ok) {
          outcome = isDedupedResponse(response, body) ? 'deduped' : 'accepted'
        } else {
          outcome = response.status >= 500 ? 'server_error' : 'client_error'
        }
      } catch {
        outcome = timeout.signal.aborted ? 'timeout' : 'network_error'
      } finally {
        timeout.cancel()
      }

      try {
        request.onAttempt?.({
          surface: request.surface,
          placement_id: request.placementId,
          outcome,
          attempt,
          duration_ms: Math.min(
            FIRST_PARTY_VIEW_ACK_MAX_DURATION_MS,
            Math.max(0, now() - firstStartedAt),
          ),
          client_family: request.clientFamily,
        })
      } catch {
      }
      const retryable =
        outcome === 'server_error' ||
        outcome === 'timeout' ||
        outcome === 'network_error'
      if (!retryable || attempt === 3) return
      await (request.sleep ?? delay)(
        attempt === 1 ? RETRY_DELAYS_MS[0] : RETRY_DELAYS_MS[1],
      )
    }
  })().finally(() => {
    markTokenCompleted(request.token)
    inFlightTokens.delete(request.token)
  })
  inFlightTokens.set(request.token, run)
  return run
}

export function resetFirstPartyViewAckRegistryForTests(): void {
  completedTokens.clear()
  inFlightTokens.clear()
}

export function getCompletedFirstPartyViewAckTokenCountForTests(): number {
  return completedTokens.size
}
