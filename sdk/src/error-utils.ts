
export type HttpError = Error & { statusCode: number }

export const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

export function createHttpError(message: string, statusCode: number): HttpError {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  return error
}

export function createAuthError(message = 'Authentication failed'): HttpError {
  return createHttpError(message, 401)
}

export function createForbiddenError(message = 'Access forbidden'): HttpError {
  return createHttpError(message, 403)
}

export function createPaymentRequiredError(message = 'Payment required'): HttpError {
  return createHttpError(message, 402)
}

export function createServerError(message = 'Server error', statusCode = 500): HttpError {
  return createHttpError(message, statusCode)
}

export function createNetworkError(message = 'Network error'): HttpError {
  return createHttpError(message, 503)
}

export function isRetryableStatusCode(statusCode: number | undefined): boolean {
  if (statusCode === undefined) return false
  return RETRYABLE_STATUS_CODES.has(statusCode)
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    if ('statusCode' in error) {
      const statusCode = (error as { statusCode: unknown }).statusCode
      if (typeof statusCode === 'number') {
        return statusCode
      }
    }
    if ('status' in error) {
      const status = (error as { status: unknown }).status
      if (typeof status === 'number') {
        return status
      }
    }
  }
  return undefined
}

export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return String(error)
}
