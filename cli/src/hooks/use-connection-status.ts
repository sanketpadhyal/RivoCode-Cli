import { useEffect, useRef, useState } from 'react'

import { getCodebuffClient } from '../utils/codebuff-client'
import { logger } from '../utils/logger'
import {
  failedPollDelayMs,
  jitterPollIntervalMs,
} from '../utils/polling-backoff'

const HEALTH_CHECK_CONFIG = {
  INITIAL_INTERVAL: 10_000,
  INTERVALS: [
    { successCount: 3, interval: 30_000 },
    { successCount: 6, interval: 60_000 },
    { successCount: 10, interval: 120_000 },
    { successCount: 15, interval: 300_000 },
    { successCount: 20, interval: 600_000 },
  ],
} as const

export function getNextInterval(consecutiveSuccesses: number): number {
  for (let i = HEALTH_CHECK_CONFIG.INTERVALS.length - 1; i >= 0; i--) {
    const { successCount, interval } = HEALTH_CHECK_CONFIG.INTERVALS[i]
    if (consecutiveSuccesses >= successCount) {
      return interval
    }
  }
  return HEALTH_CHECK_CONFIG.INITIAL_INTERVAL
}

export const useConnectionStatus = (
  onReconnect?: (isInitialConnection: boolean) => void,
) => {
  const [isConnected, setIsConnected] = useState(true)
  const previousConnectedRef = useRef<boolean | null>(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    let consecutiveSuccesses = 0
    let consecutiveFailures = 0

    const scheduleNextCheck = (interval: number) => {
      if (!isMounted) return
      timeoutId = setTimeout(() => checkConnection(), interval)
    }

    const scheduleFailedCheck = (message: string, error?: unknown): void => {
      if (!isMounted) return
      setIsConnected(false)
      previousConnectedRef.current = false
      consecutiveSuccesses = 0
      consecutiveFailures++
      const delayMs = failedPollDelayMs({
        consecutiveFailures,
      })
      logger.debug(
        {
          ...(error === undefined ? {} : { error }),
          delayMs,
          consecutiveFailures,
        },
        message,
      )
      scheduleNextCheck(delayMs)
    }

    const checkConnection = async () => {
      try {
        const client = await getCodebuffClient()
        if (!client) {
          scheduleFailedCheck('Health check: No client, backing off')
          return
        }

        const connected = await client.checkConnection()
        if (!isMounted) return

        const prevConnected = previousConnectedRef.current
        setIsConnected(connected)
        previousConnectedRef.current = connected

        if (connected) {
          consecutiveFailures = 0
          const isInitialConnection = prevConnected === null
          const shouldFireReconnectCallback =
            typeof onReconnect === 'function' && prevConnected !== true

          if (shouldFireReconnectCallback) {
            logger.info(
              { isInitialConnection },
              'Reconnection detected, firing onReconnect callback',
            )
            onReconnect(isInitialConnection)
          }
          consecutiveSuccesses++
          scheduleNextCheck(
            jitterPollIntervalMs({
              intervalMs: getNextInterval(consecutiveSuccesses),
            }),
          )
        } else {
          scheduleFailedCheck('Health check failed, backing off')
        }
      } catch (error) {
        scheduleFailedCheck('Connection check failed; backing off', error)
      }
    }

    checkConnection()

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  return isConnected
}
