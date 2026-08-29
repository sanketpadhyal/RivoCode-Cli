import { WEBSITE_URL } from '@rivocode/sdk'
import type {
  PublishAgentsResponse,
} from '@rivocode/common/types/api/agents/publish'
import type { FeedbackRequest } from '@rivocode/common/schemas/feedback'

export type ApiResponse<T> =
  | { ok: true; status: number; data?: T }
  | { ok: false; status: number; error?: string; errorData?: Record<string, unknown> }

export type UserField = 'id' | 'email' | 'discord_id'

export type UserDetails<T extends UserField = UserField> = {
  [K in T]: K extends 'discord_id' ? string | null : string
}

export interface UsageRequest {
  fingerprintId?: string
}

export interface UsageResponse {
  type: 'usage-response'
  usage: number
  remainingBalance: number | null
  balanceBreakdown?: Record<string, number>
  next_quota_reset: string | null
}

export interface LoginCodeRequest {
  fingerprintId: string
}

export interface LoginCodeResponse {
  loginUrl: string
  fingerprintHash: string
  expiresAt: string
}

export interface LoginStatusRequest {
  fingerprintId: string
  fingerprintHash: string
  expiresAt: string
}

export interface LoginStatusResponse {
  user?: Record<string, unknown>
}

export interface LogoutRequest {
  userId?: string
  fingerprintId?: string
  fingerprintHash?: string
}

export interface FeedbackResponse {
  success: boolean
}

export interface RetryConfig {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  retryableStatusCodes?: number[]
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

export interface CodebuffApiClientConfig {
  baseUrl?: string
  authToken?: string
  fetch?: typeof fetch
  defaultTimeoutMs?: number
  retry?: RetryConfig
}

export interface RequestOptions {
  query?: Record<string, string>
  includeAuth?: boolean
  includeCookie?: boolean
  timeoutMs?: number
  retry?: RetryConfig | false
  headers?: Record<string, string>
}

export interface CodebuffApiClient {
  readonly baseUrl: string
  readonly authToken?: string

  request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>

  post<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  put<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  patch<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>

  me<T extends UserField>(
    fields: readonly T[],
  ): Promise<ApiResponse<UserDetails<T>>>

  usage(req?: UsageRequest): Promise<ApiResponse<UsageResponse>>

  loginCode(req: LoginCodeRequest): Promise<ApiResponse<LoginCodeResponse>>

  loginStatus(
    req: LoginStatusRequest,
  ): Promise<ApiResponse<LoginStatusResponse>>

  publish(
    data: Record<string, unknown>[],
    allLocalAgentIds?: string[],
  ): Promise<ApiResponse<PublishAgentsResponse>>

  logout(req?: LogoutRequest): Promise<ApiResponse<void>>

  feedback(req: FeedbackRequest): Promise<ApiResponse<FeedbackResponse>>
}

const TLS_CERTIFICATE_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
])

function getTlsCertificateError(error: Error, depth = 0): Error | null {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined
  const message = error.message.toLowerCase()
  if (
    (code && TLS_CERTIFICATE_ERROR_CODES.has(code)) ||
    message.includes('self signed certificate') ||
    message.includes('unable to verify the first certificate') ||
    message.includes('certificate has expired') ||
    message.includes('certificate verify failed')
  ) {
    return error
  }

  if (depth >= 2 || !(error.cause instanceof Error)) {
    return null
  }

  return getTlsCertificateError(error.cause, depth + 1)
}

function formatNetworkErrorMessage(error: Error, method: string, url: string) {
  const requestUrl = new URL(url)
  const tlsCertificateError = getTlsCertificateError(error)

  if (tlsCertificateError) {
    return [
      `TLS certificate verification failed for ${requestUrl.origin}.`,
      'If your network intercepts HTTPS traffic, install its root certificate into your system trust store or use a network path that does not intercept TLS.',
      `Original error: ${tlsCertificateError.message} (${method} ${url})`,
    ].join(' ')
  }

  return `${error.message} (${method} ${url})`
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const calculateBackoffDelay = (
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
): number => {
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay
  return Math.min(exponentialDelay + jitter, maxDelayMs)
}

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const name = error.name.toLowerCase()
    const message = error.message.toLowerCase()

    if (name === 'aborterror') {
      return false
    }
    if (getTlsCertificateError(error)) {
      return false
    }

    return (
      name === 'timeouterror' ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    )
  }
  return false
}

export function createCodebuffApiClient(
  config: CodebuffApiClientConfig = {},
): CodebuffApiClient {
  const {
    baseUrl = WEBSITE_URL,
    authToken,
    fetch: fetchFn = fetch,
    defaultTimeoutMs = 30000,
    retry: defaultRetryConfig = {},
  } = config

  const mergedDefaultRetry: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...defaultRetryConfig,
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const {
      query,
      includeAuth = true,
      includeCookie = false,
      timeoutMs = defaultTimeoutMs,
      retry: retryConfig = mergedDefaultRetry,
      headers: customHeaders = {},
    } = options

    let url = `${baseUrl}${path}`
    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams(query)
      url += `?${params.toString()}`
    }

    const headers: Record<string, string> = { ...customHeaders }
    if (authToken && includeAuth) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    if (authToken && includeCookie) {
      headers['Cookie'] = `next-auth.session-token=${authToken};`
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    }
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body)
    }

    const shouldRetry = retryConfig !== false
    const retryOpts = shouldRetry
      ? { ...mergedDefaultRetry, ...retryConfig }
      : null

    let lastError: unknown
    const maxAttempts = shouldRetry ? (retryOpts?.maxRetries ?? 0) + 1 : 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetchFn(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          try {
            const responseBody = await response.json()
            const data = responseBody as T
            return { ok: true, status: response.status, data }
          } catch {
            return { ok: true, status: response.status }
          }
        }

        if (
          shouldRetry &&
          retryOpts &&
          retryOpts.retryableStatusCodes.includes(response.status) &&
          attempt < maxAttempts - 1
        ) {
          const delay = calculateBackoffDelay(
            attempt,
            retryOpts.initialDelayMs,
            retryOpts.maxDelayMs,
          )
          await sleep(delay)
          continue
        }

        let errorMessage: string | undefined
        let errorData: unknown
        try {
          const errorBody = await response.json()
          errorData = errorBody
          errorMessage =
            errorBody?.error || errorBody?.message || response.statusText
        } catch {
          try {
            errorMessage = await response.text()
          } catch {
            errorMessage = response.statusText
          }
        }

        return { ok: false, status: response.status, error: errorMessage, errorData: errorData as Record<string, unknown> | undefined }
      } catch (error) {
        clearTimeout(timeoutId)
        lastError = error

        if (
          shouldRetry &&
          retryOpts &&
          isRetryableError(error) &&
          attempt < maxAttempts - 1
        ) {
          const delay = calculateBackoffDelay(
            attempt,
            retryOpts.initialDelayMs,
            retryOpts.maxDelayMs,
          )
          await sleep(delay)
          continue
        }

        if (error instanceof Error) {
          const enhancedError = new Error(
            formatNetworkErrorMessage(error, method, url),
          )
          enhancedError.name = error.name
          enhancedError.cause = error
          throw enhancedError
        }
        throw error
      }
    }

    throw lastError ?? new Error('Request failed after all retries')
  }

  return {
    baseUrl,
    authToken,
    request,

    get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
      return request<T>('GET', path, undefined, options)
    },

    post<T>(
      path: string,
      body?: Record<string, unknown>,
      options?: RequestOptions,
    ): Promise<ApiResponse<T>> {
      return request<T>('POST', path, body, options)
    },

    put<T>(
      path: string,
      body?: Record<string, unknown>,
      options?: RequestOptions,
    ): Promise<ApiResponse<T>> {
      return request<T>('PUT', path, body, options)
    },

    patch<T>(
      path: string,
      body?: Record<string, unknown>,
      options?: RequestOptions,
    ): Promise<ApiResponse<T>> {
      return request<T>('PATCH', path, body, options)
    },

    delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
      return request<T>('DELETE', path, undefined, options)
    },

    me<T extends UserField>(
      fields: readonly T[],
    ): Promise<ApiResponse<UserDetails<T>>> {
      return request<UserDetails<T>>('GET', '/api/v1/me', undefined, {
        query: { fields: fields.join(',') },
      })
    },

    usage(req: UsageRequest = {}): Promise<ApiResponse<UsageResponse>> {
      return request<UsageResponse>('POST', '/api/v1/usage', {
        fingerprintId: req.fingerprintId ?? 'cli-usage',
      })
    },

    loginCode(req: LoginCodeRequest): Promise<ApiResponse<LoginCodeResponse>> {
      return request<LoginCodeResponse>(
        'POST',
        '/api/auth/cli/code',
        { fingerprintId: req.fingerprintId },
        { includeAuth: false },
      )
    },

    loginStatus(
      req: LoginStatusRequest,
    ): Promise<ApiResponse<LoginStatusResponse>> {
      return request<LoginStatusResponse>('GET', '/api/auth/cli/status', undefined, {
        query: {
          fingerprintId: req.fingerprintId,
          fingerprintHash: req.fingerprintHash,
          expiresAt: req.expiresAt,
        },
        includeAuth: false,
      })
    },

    publish(
      data: Record<string, unknown>[],
      allLocalAgentIds?: string[],
    ): Promise<ApiResponse<PublishAgentsResponse>> {
      return request<PublishAgentsResponse>('POST', '/api/agents/publish', {
        data,
        allLocalAgentIds,
      })
    },

    logout(req: LogoutRequest = {}): Promise<ApiResponse<void>> {
      return request<void>('POST', '/api/auth/cli/logout', {
        userId: req.userId,
        fingerprintId: req.fingerprintId,
        fingerprintHash: req.fingerprintHash,
      })
    },

    feedback(req: FeedbackRequest): Promise<ApiResponse<FeedbackResponse>> {
      return request<FeedbackResponse>('POST', '/api/v1/feedback', req, {
        retry: false,
      })
    },
  }
}

let sharedClient: CodebuffApiClient | null = null
let sharedAuthToken: string | undefined
let clientCreatedWithToken: string | undefined

export function getApiClient(): CodebuffApiClient {
  if (!sharedClient || clientCreatedWithToken !== sharedAuthToken) {
    sharedClient = createCodebuffApiClient({ authToken: sharedAuthToken })
    clientCreatedWithToken = sharedAuthToken
  }
  return sharedClient
}

export function setApiClientAuthToken(authToken: string | undefined): void {
  sharedAuthToken = authToken
}

export function resetApiClient(): void {
  sharedClient = null
  sharedAuthToken = undefined
  clientCreatedWithToken = undefined
}
