export type ErrorOr<T, E extends ErrorObject = ErrorObject> =
  | Success<T>
  | Failure<E>

export type Success<T> = {
  success: true
  value: T
}

export type Failure<E extends ErrorObject = ErrorObject> = {
  success: false
  error: E
}

export type PromptResult<T> = PromptSuccess<T> | PromptAborted

export type PromptSuccess<T> = {
  aborted: false
  value: T
}

export type PromptAborted = {
  aborted: true
  reason?: string
}

export type ErrorObject = {
  name: string
  message: string
  stack?: string
  status?: number
  statusCode?: number
  code?: string
  rawError?: string
  responseBody?: string
  url?: string
  isRetryable?: boolean
  requestBodyValues?: string
  cause?: ErrorObject
}

export function success<T>(value: T): Success<T> {
  return {
    success: true,
    value,
  }
}

export function failure(error: unknown): Failure<ErrorObject> {
  return {
    success: false,
    error: getErrorObject(error),
  }
}

export function promptSuccess<T>(value: T): PromptSuccess<T> {
  return {
    aborted: false,
    value,
  }
}

export function promptAborted(reason?: string): PromptAborted {
  return {
    aborted: true,
    ...(reason !== undefined && { reason }),
  }
}

export const ABORT_ERROR_MESSAGE = 'Request aborted'

export class AbortError extends Error {
  constructor(reason?: string) {
    super(reason ? `${ABORT_ERROR_MESSAGE}: ${reason}` : ABORT_ERROR_MESSAGE)
    this.name = 'AbortError'
  }
}

export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  if (
    error.message === ABORT_ERROR_MESSAGE ||
    error.message.startsWith(`${ABORT_ERROR_MESSAGE}: `)
  ) {
    return true
  }
  if (error.name === 'AbortError') {
    return true
  }
  return false
}

export function unwrapPromptResult<T>(result: PromptResult<T>): T {
  if (result.aborted) {
    throw new AbortError(result.reason)
  }
  return result.value
}

export function parseApiErrorResponseBody(responseBody: unknown): {
  errorCode?: string
  message?: string
  countryCode?: string
  countryBlockReason?: string
  ipPrivacySignals?: string[]
} {
  if (typeof responseBody !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(responseBody)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: {
      errorCode?: string
      message?: string
      countryCode?: string
      countryBlockReason?: string
      ipPrivacySignals?: string[]
    } = {}
    if (
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
    ) {
      result.errorCode = (parsed as { error: string }).error
    }
    if (
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
    ) {
      result.message = (parsed as { message: string }).message
    }
    if (
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'object' &&
      (parsed as { error: unknown }).error !== null
    ) {
      const nested = (parsed as { error: Record<string, unknown> }).error
      if (result.errorCode === undefined) {
        if (typeof nested.code === 'string') {
          result.errorCode = nested.code
        } else if (typeof nested.type === 'string') {
          result.errorCode = nested.type
        }
      }
      if (result.message === undefined && typeof nested.message === 'string') {
        result.message = nested.message
      }
    }
    if (
      'countryCode' in parsed &&
      typeof (parsed as { countryCode: unknown }).countryCode === 'string'
    ) {
      result.countryCode = (parsed as { countryCode: string }).countryCode
    }
    if (
      'countryBlockReason' in parsed &&
      typeof (parsed as { countryBlockReason: unknown }).countryBlockReason ===
        'string'
    ) {
      result.countryBlockReason = (
        parsed as { countryBlockReason: string }
      ).countryBlockReason
    }
    if ('ipPrivacySignals' in parsed) {
      const signals = (parsed as { ipPrivacySignals: unknown }).ipPrivacySignals
      if (Array.isArray(signals)) {
        result.ipPrivacySignals = signals.filter(
          (signal): signal is string => typeof signal === 'string',
        )
      }
    }
    return result
  } catch {
    return {}
  }
}

export type ApiErrorDetails = ReturnType<typeof parseApiErrorResponseBody> & {
  statusCode?: number
}

function getApiErrorCandidates(
  error: unknown,
  seen = new Set<object>(),
): unknown[] {
  if (!error || typeof error !== 'object') return [error]
  if (seen.has(error)) return []
  seen.add(error)

  const candidates: unknown[] = [error]
  const errorWithNested = error as {
    lastError?: unknown
    errors?: unknown[]
    cause?: unknown
  }

  candidates.push(...getApiErrorCandidates(errorWithNested.lastError, seen))

  if (Array.isArray(errorWithNested.errors)) {
    for (const nestedError of [...errorWithNested.errors].reverse()) {
      candidates.push(...getApiErrorCandidates(nestedError, seen))
    }
  }

  candidates.push(...getApiErrorCandidates(errorWithNested.cause, seen))

  return candidates
}

function getApiErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  if ('statusCode' in error) {
    const statusCode = (error as { statusCode: unknown }).statusCode
    if (typeof statusCode === 'number') return statusCode
  }

  if ('status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') return status
  }

  return undefined
}

function getApiErrorResponseBody(error: unknown): unknown {
  if (!error || typeof error !== 'object') return undefined
  if (!('responseBody' in error)) return undefined
  return (error as { responseBody: unknown }).responseBody
}

function hasParsedApiErrorDetails(
  details: ReturnType<typeof parseApiErrorResponseBody>,
): boolean {
  return (
    details.errorCode !== undefined ||
    details.message !== undefined ||
    details.countryCode !== undefined ||
    details.countryBlockReason !== undefined ||
    details.ipPrivacySignals !== undefined
  )
}

export function extractApiErrorDetails(error: unknown): ApiErrorDetails {
  for (const candidate of getApiErrorCandidates(error)) {
    const statusCode = getApiErrorStatusCode(candidate)
    const parsed = parseApiErrorResponseBody(getApiErrorResponseBody(candidate))

    if (statusCode !== undefined || hasParsedApiErrorDetails(parsed)) {
      return {
        ...parsed,
        ...(statusCode !== undefined && { statusCode }),
      }
    }
  }

  return {}
}

export function isFetchIdleTimeoutError(error: unknown): boolean {
  for (const candidate of getApiErrorCandidates(error)) {
    if (!candidate || typeof candidate !== 'object') continue
    const { name, message } = candidate as { name?: unknown; message?: unknown }
    if (
      name === 'TimeoutError' ||
      (typeof message === 'string' &&
        message.toLowerCase().includes('the operation timed out'))
    ) {
      return true
    }
  }
  return false
}

export const FETCH_IDLE_TIMEOUT_USER_MESSAGE =
  'Connection timed out: no data was received from the server for 5 minutes, so the request was aborted.\n\n' +
  'This can be a slow model start on our side, or a connection dropped in transit (VPN, proxy, firewall, or flaky network).\n\n' +
  'Retrying your message usually works. If it keeps happening, try a different model, or check your network/VPN/proxy.'

const TRANSIENT_NETWORK_ERROR_MESSAGE_PATTERNS = [
  'socket connection was closed unexpectedly',
  'fetch failed',
  'failed to fetch',
  'network connection was lost',
]

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ConnectionClosed',
  'ConnectionRefused',
  'FailedToOpenSocket',
])

export function isTransientNetworkError(error: unknown): boolean {
  for (const candidate of getApiErrorCandidates(error)) {
    if (!candidate || typeof candidate !== 'object') continue
    const { message, code } = candidate as {
      message?: unknown
      code?: unknown
    }
    if (typeof code === 'string' && TRANSIENT_NETWORK_ERROR_CODES.has(code)) {
      return true
    }
    if (typeof message === 'string') {
      const lower = message.toLowerCase()
      if (
        TRANSIENT_NETWORK_ERROR_MESSAGE_PATTERNS.some((pattern) =>
          lower.includes(pattern),
        )
      ) {
        return true
      }
    }
  }
  return false
}

export const TRANSIENT_NETWORK_ERROR_USER_MESSAGE =
  'Connection interrupted: the connection to the server was closed unexpectedly, even after retrying.\n\n' +
  'This is usually a transient issue — a flaky network, VPN/proxy, or the server briefly under heavy load.\n\n' +
  'Your progress is saved. Please try sending your message again.'

interface ExtendedErrorProperties {
  status?: number
  statusCode?: number
  code?: string
  responseBody?: string
  url?: string
  isRetryable?: boolean
  requestBodyValues?: Record<string, unknown>
  cause?: unknown
}

function safeStringify(value: unknown, maxLength = 10000): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value.slice(0, maxLength)
  try {
    const seen = new WeakSet()
    const str = JSON.stringify(
      value,
      (_, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]'
          seen.add(val)
        }
        return val
      },
      2,
    )
    return str?.slice(0, maxLength)
  } catch {
    return '[Unable to stringify]'
  }
}

export function getErrorObject(
  error: unknown,
  options: { includeRawError?: boolean } = {},
): ErrorObject {
  if (error instanceof Error) {
    const extError = error as Error & Partial<ExtendedErrorProperties>

    let responseBody: string | undefined
    if (extError.responseBody !== undefined) {
      responseBody = safeStringify(extError.responseBody)
    }

    let requestBodyValues: string | undefined
    if (
      extError.requestBodyValues !== undefined &&
      typeof extError.requestBodyValues === 'object'
    ) {
      requestBodyValues = safeStringify(extError.requestBodyValues)
    }

    let cause: ErrorObject | undefined
    if (extError.cause !== undefined) {
      cause = getErrorObject(extError.cause, options)
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      status: typeof extError.status === 'number' ? extError.status : undefined,
      statusCode:
        typeof extError.statusCode === 'number'
          ? extError.statusCode
          : undefined,
      code: typeof extError.code === 'string' ? extError.code : undefined,
      rawError: options.includeRawError ? safeStringify(error) : undefined,
      responseBody,
      url: typeof extError.url === 'string' ? extError.url : undefined,
      isRetryable:
        typeof extError.isRetryable === 'boolean'
          ? extError.isRetryable
          : undefined,
      requestBodyValues,
      cause,
    }
  }

  return {
    name: 'Error',
    message: `${error}`,
  }
}
