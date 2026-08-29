import { useCallback, useEffect, useRef } from 'react'

export function useTimeout() {
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const setTimeout = useCallback((key: string, callback: () => void, delay: number) => {
    const timeouts = timeoutsRef.current

    const existingTimeout = timeouts.get(key)
    if (existingTimeout) {
      globalThis.clearTimeout(existingTimeout)
    }

    const timeoutId = globalThis.setTimeout(() => {
      callback()
      timeouts.delete(key)
    }, delay)
    timeouts.set(key, timeoutId)
  }, [])

  const clearTimeout = useCallback((key?: string) => {
    const timeouts = timeoutsRef.current

    if (key) {
      const timeoutId = timeouts.get(key)
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId)
        timeouts.delete(key)
      }
    } else {
      timeouts.forEach((timeoutId) => {
        globalThis.clearTimeout(timeoutId)
      })
      timeouts.clear()
    }
  }, [])

  useEffect(() => {
    return () => {
      const timeouts = timeoutsRef.current
      timeouts.forEach((timeoutId) => {
        globalThis.clearTimeout(timeoutId)
      })
      timeouts.clear()
    }
  }, [])

  return { setTimeout, clearTimeout }
}
