import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { INITIAL_RETRY_DELAY, withRetry } from '../promise'

describe('withRetry', () => {
  describe('basic functionality', () => {
    it('should return result on successful first attempt', async () => {
      const operation = mock(() => Promise.resolve('success'))

      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable error and succeed', async () => {
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts === 1) {
          const error = { type: 'APIConnectionError' }
          return Promise.reject(error)
        }
        return Promise.resolve('success after retry')
      })

      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      const result = await withRetry(operation)

      expect(result).toBe('success after retry')
      expect(attempts).toBe(2)

      setTimeoutSpy.mockRestore()
    })

    it('should throw immediately on non-retryable error', async () => {
      const error = new Error('non-retryable')
      const operation = mock(() => Promise.reject(error))

      await expect(withRetry(operation)).rejects.toThrow('non-retryable')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries exceeded', async () => {
      const error = { type: 'APIConnectionError' }
      const operation = mock(() => Promise.reject(error))

      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      await expect(
        withRetry(operation, { maxRetries: 3 }),
      ).rejects.toMatchObject({ type: 'APIConnectionError' })

      expect(operation).toHaveBeenCalledTimes(3)

      setTimeoutSpy.mockRestore()
    })
  })

  describe('jitter behavior', () => {
    let setTimeoutSpy: ReturnType<typeof spyOn>
    let mathRandomSpy: ReturnType<typeof spyOn>
    let capturedDelays: number[]

    beforeEach(() => {
      capturedDelays = []

      setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void, delay: number) => {
          capturedDelays.push(delay)
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )
    })

    afterEach(() => {
      setTimeoutSpy.mockRestore()
      if (mathRandomSpy) {
        mathRandomSpy.mockRestore()
      }
    })

    it('should apply minimum jitter (0.8x) when Math.random returns 0', async () => {
      mathRandomSpy = spyOn(Math, 'random').mockReturnValue(0)

      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 3,
        retryDelayMs: INITIAL_RETRY_DELAY,
      })

      expect(capturedDelays).toEqual([800, 1600])
    })

    it('should apply maximum jitter (1.2x) when Math.random returns 1', async () => {
      mathRandomSpy = spyOn(Math, 'random').mockReturnValue(1)

      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 3,
        retryDelayMs: INITIAL_RETRY_DELAY,
      })

      expect(capturedDelays).toEqual([1200, 2400])
    })

    it('should apply no jitter (1.0x) when Math.random returns 0.5', async () => {
      mathRandomSpy = spyOn(Math, 'random').mockReturnValue(0.5)

      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 3,
        retryDelayMs: INITIAL_RETRY_DELAY,
      })

      expect(capturedDelays).toEqual([1000, 2000])
    })

    it('should apply exponential backoff with jitter correctly', async () => {
      mathRandomSpy = spyOn(Math, 'random').mockReturnValue(0.25)

      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 4) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 4,
        retryDelayMs: 1000,
      })

      expect(capturedDelays).toEqual([900, 1800, 3600])
    })

    it('should produce delays within ±20% of base delay', async () => {
      mathRandomSpy?.mockRestore()

      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 3,
        retryDelayMs: 1000,
      })

      expect(capturedDelays[0]).toBeGreaterThanOrEqual(800)
      expect(capturedDelays[0]).toBeLessThanOrEqual(1200)

      expect(capturedDelays[1]).toBeGreaterThanOrEqual(1600)
      expect(capturedDelays[1]).toBeLessThanOrEqual(2400)
    })

    it('should use custom retryDelayMs for base delay calculation', async () => {
      mathRandomSpy = spyOn(Math, 'random').mockReturnValue(0.5)

      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 2) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 2,
        retryDelayMs: 500,
      })

      expect(capturedDelays).toEqual([500])
    })
  })

  describe('onRetry callback', () => {
    it('should call onRetry with error and attempt number', async () => {
      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      const onRetry = mock(() => {})
      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 3,
        onRetry,
      })

      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry).toHaveBeenNthCalledWith(1, error, 1)
      expect(onRetry).toHaveBeenNthCalledWith(2, error, 2)

      setTimeoutSpy.mockRestore()
    })
  })

  describe('retryIf callback', () => {
    it('should use custom retryIf to determine retryability', async () => {
      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts === 1) {
          return Promise.reject({ code: 'RETRY_ME' })
        }
        return Promise.resolve('success')
      })

      const result = await withRetry(operation, {
        maxRetries: 3,
        retryIf: (error) => error?.code === 'RETRY_ME',
      })

      expect(result).toBe('success')
      expect(attempts).toBe(2)

      setTimeoutSpy.mockRestore()
    })

    it('should not retry when retryIf returns false', async () => {
      const error = { code: 'DO_NOT_RETRY' }
      const operation = mock(() => Promise.reject(error))

      await expect(
        withRetry(operation, {
          maxRetries: 3,
          retryIf: (err) => err?.code === 'RETRY_ME',
        }),
      ).rejects.toMatchObject({ code: 'DO_NOT_RETRY' })

      expect(operation).toHaveBeenCalledTimes(1)
    })
  })
})
