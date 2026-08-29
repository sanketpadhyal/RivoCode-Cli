import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import React from 'react'

import { useTimeout } from '../use-timeout'

describe('useTimeout', () => {
  type ReactInternals = {
    H: {
      useRef: <T>(value: T) => { current: T }
      useCallback: <T>(callback: T) => T
      useEffect: (effect: () => void) => void
    }
  }
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout
  let timers: { id: number; ms: number; fn: () => void; cleared: boolean }[]
  let nextId: number
  let originalDispatcher: ReactInternals['H'] | undefined

  beforeEach(() => {
    originalDispatcher = reactInternals.H
    reactInternals.H = {
      useRef: <T>(value: T) => ({ current: value }),
      useCallback: <T>(callback: T) => callback,
      useEffect: (effect: () => void) => {
        effect()
      },
    }

    timers = []
    nextId = 1
    originalSetTimeout = globalThis.setTimeout
    originalClearTimeout = globalThis.clearTimeout

    globalThis.setTimeout = ((fn: () => void, ms?: number) => {
      const id = nextId++
      timers.push({ id, ms: Number(ms ?? 0), fn, cleared: false })
      return id as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout

    globalThis.clearTimeout = ((id?: ReturnType<typeof clearTimeout>) => {
      const timer = timers.find((t) => t.id === (id as unknown as number))
      if (timer) timer.cleared = true
    }) as typeof clearTimeout
  })

  afterEach(() => {
    reactInternals.H = originalDispatcher!
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  })

  test('setTimeout schedules a timeout with correct delay', () => {
    const { setTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('test-key', callback, 1000)

    expect(timers.length).toBe(1)
    expect(timers[0].ms).toBe(1000)
    expect(timers[0].cleared).toBe(false)
  })

  test('timeout callback executes when invoked', () => {
    const { setTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('test-key', callback, 1000)

    expect(callback).not.toHaveBeenCalled()

    timers[0].fn()

    expect(callback).toHaveBeenCalledTimes(1)
  })

  test('clearTimeout marks the timeout as cleared', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('test-key', callback, 1000)
    expect(timers[0].cleared).toBe(false)

    clearTimeout('test-key')
    expect(timers[0].cleared).toBe(true)
  })

  test('clearTimeout prevents callback from being used', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('test-key', callback, 1000)
    clearTimeout('test-key')

    expect(timers[0].cleared).toBe(true)
  })

  test('replacing timeout with same key clears the previous one', () => {
    const { setTimeout } = useTimeout()
    const callback1 = mock(() => {})
    const callback2 = mock(() => {})

    setTimeout('test-key', callback1, 1000)
    expect(timers.length).toBe(1)
    expect(timers[0].cleared).toBe(false)

    setTimeout('test-key', callback2, 2000)
    expect(timers.length).toBe(2)
    expect(timers[0].cleared).toBe(true)
    expect(timers[1].cleared).toBe(false)
    expect(timers[1].ms).toBe(2000)
  })

  test('clearTimeout when no timeout is active does nothing', () => {
    const { clearTimeout } = useTimeout()

    clearTimeout('nonexistent-key')

    expect(timers.length).toBe(0)
  })

  test('multiple setTimeout calls with different keys work independently', () => {
    const { setTimeout } = useTimeout()
    const callbacks = [mock(() => {}), mock(() => {}), mock(() => {})]

    setTimeout('key1', callbacks[0], 1000)
    setTimeout('key2', callbacks[1], 2000)
    setTimeout('key3', callbacks[2], 3000)

    expect(timers.length).toBe(3)
    expect(timers[0].cleared).toBe(false)
    expect(timers[1].cleared).toBe(false)
    expect(timers[2].cleared).toBe(false)
  })

  test('setTimeout after clearTimeout works correctly', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callback1 = mock(() => {})
    const callback2 = mock(() => {})

    setTimeout('test-key', callback1, 1000)
    clearTimeout('test-key')
    setTimeout('test-key', callback2, 2000)

    expect(timers.length).toBe(2)
    expect(timers[0].cleared).toBe(true)
    expect(timers[1].cleared).toBe(false)
  })

  test('hook returns distinct setTimeout and clearTimeout functions', () => {
    const result1 = useTimeout()
    const result2 = useTimeout()

    expect(result1.setTimeout).not.toBe(result2.setTimeout)
    expect(result1.clearTimeout).not.toBe(result2.clearTimeout)
  })

  test('clearTimeout without key clears all timeouts', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callbacks = [mock(() => {}), mock(() => {}), mock(() => {})]

    setTimeout('key1', callbacks[0], 1000)
    setTimeout('key2', callbacks[1], 2000)
    setTimeout('key3', callbacks[2], 3000)

    expect(timers.length).toBe(3)
    expect(timers[0].cleared).toBe(false)
    expect(timers[1].cleared).toBe(false)
    expect(timers[2].cleared).toBe(false)

    clearTimeout()

    expect(timers[0].cleared).toBe(true)
    expect(timers[1].cleared).toBe(true)
    expect(timers[2].cleared).toBe(true)
  })

  test('clearTimeout with specific key only clears that timeout', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callbacks = [mock(() => {}), mock(() => {}), mock(() => {})]

    setTimeout('key1', callbacks[0], 1000)
    setTimeout('key2', callbacks[1], 2000)
    setTimeout('key3', callbacks[2], 3000)

    clearTimeout('key2')

    expect(timers[0].cleared).toBe(false)
    expect(timers[1].cleared).toBe(true)
    expect(timers[2].cleared).toBe(false)
  })

  test('timeout auto-cleans up after execution', () => {
    const { setTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('test-key', callback, 1000)

    timers[0].fn()

    expect(callback).toHaveBeenCalledTimes(1)
  })

  test('can reuse same key after timeout executes', () => {
    const { setTimeout } = useTimeout()
    const callback1 = mock(() => {})
    const callback2 = mock(() => {})

    setTimeout('reuse-key', callback1, 1000)
    expect(timers.length).toBe(1)

    timers[0].fn()
    expect(callback1).toHaveBeenCalledTimes(1)

    setTimeout('reuse-key', callback2, 2000)
    expect(timers.length).toBe(2)
    expect(timers[1].cleared).toBe(false)
  })

  test('multiple timeouts can execute independently', () => {
    const { setTimeout } = useTimeout()
    const callback1 = mock(() => {})
    const callback2 = mock(() => {})
    const callback3 = mock(() => {})

    setTimeout('key1', callback1, 1000)
    setTimeout('key2', callback2, 2000)
    setTimeout('key3', callback3, 3000)

    timers[1].fn()
    timers[0].fn()
    timers[2].fn()

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(1)
  })

  test('replacing timeout before execution prevents old callback', () => {
    const { setTimeout } = useTimeout()
    const oldCallback = mock(() => {})
    const newCallback = mock(() => {})

    setTimeout('replace-key', oldCallback, 1000)
    expect(timers[0].cleared).toBe(false)

    setTimeout('replace-key', newCallback, 2000)
    expect(timers[0].cleared).toBe(true)
    expect(timers[1].cleared).toBe(false)

    timers[1].fn()
    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
  })

  test('clearTimeout on executed timeout does nothing', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('exec-key', callback, 1000)

    timers[0].fn()
    expect(callback).toHaveBeenCalledTimes(1)

    clearTimeout('exec-key')
    expect(timers.length).toBe(1)
  })

  test('mixing set and clear operations maintains correct state', () => {
    const { setTimeout, clearTimeout } = useTimeout()

    setTimeout(
      'a',
      mock(() => {}),
      100,
    )
    setTimeout(
      'b',
      mock(() => {}),
      200,
    )
    clearTimeout('a')
    setTimeout(
      'c',
      mock(() => {}),
      300,
    )
    clearTimeout('b')
    setTimeout(
      'd',
      mock(() => {}),
      400,
    )

    expect(timers[0].cleared).toBe(true)
    expect(timers[1].cleared).toBe(true)
    expect(timers[2].cleared).toBe(false)
    expect(timers[3].cleared).toBe(false)
  })
})
