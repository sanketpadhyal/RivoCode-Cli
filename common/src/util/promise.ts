export const INITIAL_RETRY_DELAY = 1000

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    retryIf?: (error: any) => boolean
    onRetry?: (error: any, attempt: number) => void
    retryDelayMs?: number
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    retryIf = (error) => error?.type === 'APIConnectionError',
    onRetry = () => {},
    retryDelayMs = INITIAL_RETRY_DELAY,
  } = options

  let lastError: any = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!retryIf(error) || attempt === maxRetries - 1) {
        throw error
      }

      onRetry(error, attempt + 1)

      const baseDelayMs = retryDelayMs * Math.pow(2, attempt)
      const jitter = 0.8 + Math.random() * 0.4
      const delayMs = Math.round(baseDelayMs * jitter)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = `Operation timed out after ${timeoutMs}ms`,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
