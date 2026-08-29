import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ElapsedTimeTracker {
  start: () => void
  stop: () => void
  pause: () => void
  resume: () => void
  elapsedSeconds: number
  startTime: number | null
  isPaused: boolean
}

export const useElapsedTime = (): ElapsedTimeTracker => {
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [isPaused, setIsPaused] = useState(false)
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0)

  const start = useCallback(() => {
    setStartTime(Date.now())
    setAccumulatedSeconds(0)
    setIsPaused(false)
  }, [])

  const stop = useCallback(() => {
    setStartTime(null)
    setElapsedSeconds(0)
    setAccumulatedSeconds(0)
    setIsPaused(false)
  }, [])

  const pause = useCallback(() => {
    if (startTime && !isPaused) {
      const currentElapsed = Math.floor((Date.now() - startTime) / 1000)
      setAccumulatedSeconds(currentElapsed)
      setElapsedSeconds(currentElapsed)
      setIsPaused(true)
    }
  }, [startTime, isPaused])

  const resume = useCallback(() => {
    if (isPaused) {
      setStartTime(Date.now() - accumulatedSeconds * 1000)
      setIsPaused(false)
    }
  }, [isPaused, accumulatedSeconds])

  useEffect(() => {
    if (!startTime || isPaused) {
      if (!isPaused && !startTime) {
        setElapsedSeconds(0)
      }
      return
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateElapsed()

    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [startTime, isPaused])

  const timer = useMemo(
    () => ({ start, stop, pause, resume, elapsedSeconds, startTime, isPaused }),
    [start, stop, pause, resume, elapsedSeconds, startTime, isPaused],
  )

  return timer
}
