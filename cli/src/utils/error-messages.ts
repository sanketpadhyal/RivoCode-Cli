import { sanitizeErrorMessage, getErrorStatusCode } from '@codebuff/sdk'

export function formatErrorForDisplay(error: unknown, fallbackTitle: string): string {
  const statusCode = getErrorStatusCode(error)

  if (statusCode === 401) {
    return `${fallbackTitle}: Authentication failed. Please check your API key.`
  }
  if (statusCode === 403) {
    return `${fallbackTitle}: Access forbidden. You do not have permission to access this resource.`
  }

  if (statusCode !== undefined) {
    if (statusCode === 408) {
      return `${fallbackTitle}: Request timed out. Please check your internet connection.`
    }
    if (statusCode === 503) {
      return `${fallbackTitle}: Service unavailable. The server may be down.`
    }
    if (statusCode >= 500) {
      return `${fallbackTitle}: Server error. Please try again later.`
    }
    if (statusCode === 429) {
      return `${fallbackTitle}: Rate limited. Please try again later.`
    }
  }

  if (error instanceof Error) {
    const message = error.message || 'An unexpected error occurred.'
    return `${fallbackTitle}: ${message}`
  }

  const safeMessage = sanitizeErrorMessage(error)
  return `${fallbackTitle}: ${safeMessage}`
}

export function formatRetryBannerMessage(error: unknown, pendingCount: number): string {
  const baseTitle = 'Network error'
  const formatted = formatErrorForDisplay(error, baseTitle)

  const suffix =
    pendingCount > 0
      ? ` • ${pendingCount} message${pendingCount === 1 ? '' : 's'} will retry when connection is restored`
      : ''

  return `⚠️ ${formatted}${suffix}`
}
