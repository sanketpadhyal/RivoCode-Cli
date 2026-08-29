import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

import {
  reportActivity,
  getLastActivityTime,
  isUserActive,
  getIdleTime,
  subscribeToActivity,
  resetActivityTracker,
} from '../activity-tracker'

describe('activity-tracker', () => {
  let originalDateNow: typeof Date.now
  let mockNow: number

  beforeEach(() => {
    originalDateNow = Date.now
    mockNow = 1000000
    Date.now = () => mockNow
    resetActivityTracker()
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  describe('reportActivity', () => {
    test('updates lastActivityTime to current time', () => {
      mockNow = 2000000
      reportActivity()
      expect(getLastActivityTime()).toBe(2000000)
    })

    test('notifies all subscribers when activity is reported', () => {
      const listener1 = mock(() => {})
      const listener2 = mock(() => {})

      subscribeToActivity(listener1)
      subscribeToActivity(listener2)

      mockNow = 3000000
      reportActivity()

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener1).toHaveBeenCalledWith(3000000)
      expect(listener2).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledWith(3000000)
    })

    test('multiple calls update the timestamp each time', () => {
      mockNow = 1000
      reportActivity()
      expect(getLastActivityTime()).toBe(1000)

      mockNow = 2000
      reportActivity()
      expect(getLastActivityTime()).toBe(2000)

      mockNow = 3000
      reportActivity()
      expect(getLastActivityTime()).toBe(3000)
    })
  })

  describe('getLastActivityTime', () => {
    test('returns the initial time after reset', () => {
      expect(getLastActivityTime()).toBe(mockNow)
    })

    test('returns the time of the last activity', () => {
      mockNow = 5000000
      reportActivity()
      expect(getLastActivityTime()).toBe(5000000)
    })
  })

  describe('isUserActive', () => {
    test('returns true when user activity is within threshold', () => {
      reportActivity()
      mockNow += 10000
      expect(isUserActive(30000)).toBe(true)
    })

    test('returns false when user has been idle longer than threshold', () => {
      reportActivity()
      mockNow += 35000
      expect(isUserActive(30000)).toBe(false)
    })

    test('uses default threshold of 30 seconds', () => {
      reportActivity()
      mockNow += 29000
      expect(isUserActive()).toBe(true)

      mockNow += 2000
      expect(isUserActive()).toBe(false)
    })

    test('returns true at exactly the threshold boundary', () => {
      reportActivity()
      mockNow += 29999
      expect(isUserActive(30000)).toBe(true)
    })

    test('returns false at exactly the threshold', () => {
      reportActivity()
      mockNow += 30000
      expect(isUserActive(30000)).toBe(false)
    })

    test('works with custom thresholds', () => {
      reportActivity()
      mockNow += 5000
      expect(isUserActive(10000)).toBe(true)
      expect(isUserActive(3000)).toBe(false)
    })
  })

  describe('getIdleTime', () => {
    test('returns 0 immediately after activity', () => {
      reportActivity()
      expect(getIdleTime()).toBe(0)
    })

    test('returns correct idle time', () => {
      reportActivity()
      mockNow += 15000
      expect(getIdleTime()).toBe(15000)
    })

    test('increases as time passes', () => {
      reportActivity()

      mockNow += 1000
      expect(getIdleTime()).toBe(1000)

      mockNow += 4000
      expect(getIdleTime()).toBe(5000)

      mockNow += 10000
      expect(getIdleTime()).toBe(15000)
    })

    test('resets after new activity', () => {
      reportActivity()
      mockNow += 10000
      expect(getIdleTime()).toBe(10000)

      reportActivity()
      expect(getIdleTime()).toBe(0)
    })
  })

  describe('subscribeToActivity', () => {
    test('returns an unsubscribe function', () => {
      const listener = mock(() => {})
      const unsubscribe = subscribeToActivity(listener)

      expect(typeof unsubscribe).toBe('function')
    })

    test('unsubscribe stops notifications', () => {
      const listener = mock(() => {})
      const unsubscribe = subscribeToActivity(listener)

      reportActivity()
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      reportActivity()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    test('multiple subscribers work independently', () => {
      const listener1 = mock(() => {})
      const listener2 = mock(() => {})
      const listener3 = mock(() => {})

      const unsub1 = subscribeToActivity(listener1)
      subscribeToActivity(listener2)
      subscribeToActivity(listener3)

      reportActivity()
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
      expect(listener3).toHaveBeenCalledTimes(1)

      unsub1()

      reportActivity()
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(2)
      expect(listener3).toHaveBeenCalledTimes(2)
    })

    test('same listener can be subscribed multiple times', () => {
      const listener = mock(() => {})

      subscribeToActivity(listener)
      subscribeToActivity(listener)

      reportActivity()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    test('unsubscribing non-existent listener does nothing', () => {
      const listener1 = mock(() => {})
      const listener2 = mock(() => {})

      const unsub1 = subscribeToActivity(listener1)
      unsub1()
      unsub1()

      reportActivity()
      expect(listener1).not.toHaveBeenCalled()
    })
  })

  describe('resetActivityTracker', () => {
    test('resets lastActivityTime to current time', () => {
      reportActivity()
      mockNow = 9999999
      resetActivityTracker()
      expect(getLastActivityTime()).toBe(9999999)
    })

    test('clears all listeners', () => {
      const listener1 = mock(() => {})
      const listener2 = mock(() => {})

      subscribeToActivity(listener1)
      subscribeToActivity(listener2)

      resetActivityTracker()

      reportActivity()
      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })
  })
})

describe('activity-tracker integration scenarios', () => {
  let originalDateNow: typeof Date.now
  let mockNow: number

  beforeEach(() => {
    originalDateNow = Date.now
    mockNow = 1000000
    Date.now = () => mockNow
    resetActivityTracker()
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  describe('pauseWhenIdle behavior', () => {
    test('isUserActive returns true immediately after reportActivity', () => {
      reportActivity()
      expect(isUserActive(30000)).toBe(true)
    })

    test('isUserActive returns false after idle threshold passes', () => {
      reportActivity()
      mockNow += 35000
      expect(isUserActive(30000)).toBe(false)
    })

    test('activity tracking prevents polling pause', () => {
      reportActivity()
      expect(isUserActive(30000)).toBe(true)

      mockNow += 10000
      reportActivity()
      expect(isUserActive(30000)).toBe(true)

      mockNow += 10000
      reportActivity()
      expect(isUserActive(30000)).toBe(true)

    })

    test('prolonged inactivity should trigger idle state', () => {
      reportActivity()

      mockNow += 60000

      expect(isUserActive(30000)).toBe(false)
      expect(getIdleTime()).toBe(60000)
    })
  })

  describe('refetchOnActivity behavior', () => {
    test('activity notification triggers listeners for refetch', () => {
      const refetchCallback = mock(() => {})
      subscribeToActivity(refetchCallback)

      mockNow += 35000
      expect(isUserActive(30000)).toBe(false)

      reportActivity()

      expect(refetchCallback).toHaveBeenCalledTimes(1)
      expect(refetchCallback).toHaveBeenCalledWith(mockNow)
    })

    test('multiple listeners all receive activity notifications', () => {
      const callback1 = mock(() => {})
      const callback2 = mock(() => {})
      const callback3 = mock(() => {})

      subscribeToActivity(callback1)
      subscribeToActivity(callback2)
      subscribeToActivity(callback3)

      reportActivity()

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
    })

    test('unsubscribed listeners do not receive notifications', () => {
      const activeCallback = mock(() => {})
      const unsubscribedCallback = mock(() => {})

      subscribeToActivity(activeCallback)
      const unsub = subscribeToActivity(unsubscribedCallback)

      unsub()

      reportActivity()

      expect(activeCallback).toHaveBeenCalledTimes(1)
      expect(unsubscribedCallback).not.toHaveBeenCalled()
    })
  })

  describe('Claude quota polling scenarios', () => {
    test('idle user should not trigger quota polling', () => {
      const idleThreshold = 30000

      reportActivity()

      mockNow += 60000

      expect(isUserActive(idleThreshold)).toBe(false)

    })

    test('returning user after idle should trigger stale data refetch', () => {
      const idleThreshold = 30000
      const wasIdleCallback = mock(() => {})

      let wasIdle = false

      subscribeToActivity(() => {
        if (wasIdle) {
          wasIdleCallback()
          wasIdle = false
        }
      })

      reportActivity()

      mockNow += 35000
      wasIdle = !isUserActive(idleThreshold)
      expect(wasIdle).toBe(true)

      reportActivity()

      expect(wasIdleCallback).toHaveBeenCalledTimes(1)
    })

    test('continuous activity should not set wasIdle flag', () => {
      const idleThreshold = 30000

      for (let i = 0; i < 10; i++) {
        reportActivity()
        mockNow += 10000

        expect(isUserActive(idleThreshold)).toBe(true)
      }
    })
  })

  describe('edge cases', () => {
    test('very short idle threshold', () => {
      reportActivity()
      mockNow += 100
      expect(isUserActive(100)).toBe(false)
    })

    test('very long idle threshold', () => {
      reportActivity()
      mockNow += 3600000
      expect(isUserActive(7200000)).toBe(true)
    })

    test('activity reported multiple times in quick succession', () => {
      const callback = mock(() => {})
      subscribeToActivity(callback)

      for (let i = 0; i < 100; i++) {
        mockNow += 10
        reportActivity()
      }

      expect(callback).toHaveBeenCalledTimes(100)
      expect(getLastActivityTime()).toBe(mockNow)
    })
  })
})
