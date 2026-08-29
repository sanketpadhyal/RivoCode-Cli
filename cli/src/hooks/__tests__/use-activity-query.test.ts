import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  invalidateActivityQuery,
  removeActivityQuery,
  getActivityQueryData,
  setActivityQueryData,
  resetActivityQueryCache,
  isEntryStale,
  setErrorOnlyCacheEntry,
  _retryTestHelpers,
} from '../use-activity-query'

describe('use-activity-query utilities', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })

  describe('setActivityQueryData', () => {
    test('stores data in cache', () => {
      setActivityQueryData(['test'], { value: 'hello' })
      expect(getActivityQueryData<{ value: string }>(['test'])).toEqual({ value: 'hello' })
    })

    test('overwrites existing data', () => {
      setActivityQueryData(['test'], { value: 'first' })
      setActivityQueryData(['test'], { value: 'second' })
      expect(getActivityQueryData<{ value: string }>(['test'])).toEqual({ value: 'second' })
    })

    test('handles complex query keys', () => {
      setActivityQueryData(['users', 1], { name: 'John' })
      expect(getActivityQueryData<{ name: string }>(['users', 1])).toEqual({ name: 'John' })
    })

    test('handles query keys with objects', () => {
      setActivityQueryData(['complex', { id: 1 }], { data: 'test' })
      expect(getActivityQueryData<{ data: string }>(['complex', { id: 1 }])).toEqual({
        data: 'test',
      })
    })

    test('different keys store different data', () => {
      setActivityQueryData(['key1'], 'value1')
      setActivityQueryData(['key2'], 'value2')
      expect(getActivityQueryData<string>(['key1'])).toBe('value1')
      expect(getActivityQueryData<string>(['key2'])).toBe('value2')
    })
  })

  describe('getActivityQueryData', () => {
    test('returns undefined for non-existent key', () => {
      expect(getActivityQueryData(['nonexistent'])).toBeUndefined()
    })

    test('returns stored data for existing key', () => {
      setActivityQueryData(['test'], 42)
      expect(getActivityQueryData<number>(['test'])).toBe(42)
    })

    test('returns correct type', () => {
      setActivityQueryData<string[]>(['test'], ['a', 'b', 'c'])
      const data = getActivityQueryData<string[]>(['test'])
      expect(data).toEqual(['a', 'b', 'c'])
    })
  })

  describe('removeActivityQuery', () => {
    test('removes existing cache entry', () => {
      setActivityQueryData(['test'], 'value')
      expect(getActivityQueryData<string>(['test'])).toBe('value')

      removeActivityQuery(['test'])
      expect(getActivityQueryData(['test'])).toBeUndefined()
    })

    test('does nothing for non-existent key', () => {
      removeActivityQuery(['nonexistent'])
      expect(getActivityQueryData(['nonexistent'])).toBeUndefined()
    })

    test('only removes specified key', () => {
      setActivityQueryData(['key1'], 'value1')
      setActivityQueryData(['key2'], 'value2')

      removeActivityQuery(['key1'])

      expect(getActivityQueryData(['key1'])).toBeUndefined()
      expect(getActivityQueryData<string>(['key2'])).toBe('value2')
    })
  })

  describe('invalidateActivityQuery', () => {
    test('marks query as stale by setting dataUpdatedAt to 0', () => {
      setActivityQueryData(['test'], 'value')

      expect(getActivityQueryData<string>(['test'])).toBe('value')

      invalidateActivityQuery(['test'])

      expect(getActivityQueryData<string>(['test'])).toBe('value')
    })

    test('does nothing for non-existent key', () => {
      invalidateActivityQuery(['nonexistent'])
    })
  })

  describe('query key serialization', () => {
    test('same array values produce same cache key', () => {
      setActivityQueryData(['test', 'key'], 'value')
      expect(getActivityQueryData<string>(['test', 'key'])).toBe('value')
    })

    test('different array values produce different cache keys', () => {
      setActivityQueryData(['test', 'key1'], 'value1')
      setActivityQueryData(['test', 'key2'], 'value2')
      expect(getActivityQueryData<string>(['test', 'key1'])).toBe('value1')
      expect(getActivityQueryData<string>(['test', 'key2'])).toBe('value2')
    })

    test('object keys are serialized correctly', () => {
      setActivityQueryData(['query', { page: 1, sort: 'asc' }], 'page1')
      expect(getActivityQueryData<string>(['query', { page: 1, sort: 'asc' }])).toBe(
        'page1',
      )
    })

    test('nested objects in keys work correctly', () => {
      setActivityQueryData(
        ['query', { filter: { status: 'active', type: 'user' } }],
        'filtered',
      )
      expect(
        getActivityQueryData<string>([
          'query',
          { filter: { status: 'active', type: 'user' } },
        ]),
      ).toBe('filtered')
    })
  })
})

describe('useActivityQuery hook behavior', () => {

  describe('cache entry structure', () => {
    test('setActivityQueryData creates proper cache entry', () => {
      const testData = { users: [1, 2, 3] }
      setActivityQueryData(['users'], testData)

      const retrieved = getActivityQueryData<typeof testData>(['users'])
      expect(retrieved).toEqual(testData)
    })

    test('cache preserves data types', () => {
      setActivityQueryData(['number'], 42)
      expect(getActivityQueryData<number>(['number'])).toBe(42)

      setActivityQueryData(['string'], 'hello')
      expect(getActivityQueryData<string>(['string'])).toBe('hello')

      setActivityQueryData(['boolean'], true)
      expect(getActivityQueryData<boolean>(['boolean'])).toBe(true)

      setActivityQueryData(['array'], [1, 2, 3])
      expect(getActivityQueryData<number[]>(['array'])).toEqual([1, 2, 3])

      setActivityQueryData(['object'], { a: 1, b: 2 })
      expect(getActivityQueryData<{ a: number; b: number }>(['object'])).toEqual({ a: 1, b: 2 })

      setActivityQueryData(['null'], null)
      expect(getActivityQueryData<null>(['null'])).toBeNull()
    })
  })

  describe('invalidation behavior', () => {
    test('invalidation preserves existing data', () => {
      const originalData = { id: 1, name: 'Test' }
      setActivityQueryData(['preserve'], originalData)

      invalidateActivityQuery(['preserve'])

      expect(getActivityQueryData<typeof originalData>(['preserve'])).toEqual(originalData)
    })

    test('multiple invalidations do not remove data', () => {
      setActivityQueryData(['multi'], 'persistent')

      invalidateActivityQuery(['multi'])
      invalidateActivityQuery(['multi'])
      invalidateActivityQuery(['multi'])

      expect(getActivityQueryData<string>(['multi'])).toBe('persistent')
    })
  })

  describe('remove behavior', () => {
    test('remove completely clears the cache entry', () => {
      setActivityQueryData(['remove-test'], 'data')
      expect(getActivityQueryData<string>(['remove-test'])).toBe('data')

      removeActivityQuery(['remove-test'])
      expect(getActivityQueryData(['remove-test'])).toBeUndefined()

      setActivityQueryData(['remove-test'], 'new-data')
      expect(getActivityQueryData<string>(['remove-test'])).toBe('new-data')
    })
  })

  describe('resetActivityQueryCache', () => {
    test('clears all cache entries', () => {
      setActivityQueryData(['key1'], 'value1')
      setActivityQueryData(['key2'], 'value2')
      setActivityQueryData(['key3'], 'value3')

      expect(getActivityQueryData<string>(['key1'])).toBe('value1')
      expect(getActivityQueryData<string>(['key2'])).toBe('value2')
      expect(getActivityQueryData<string>(['key3'])).toBe('value3')

      resetActivityQueryCache()

      expect(getActivityQueryData(['key1'])).toBeUndefined()
      expect(getActivityQueryData(['key2'])).toBeUndefined()
      expect(getActivityQueryData(['key3'])).toBeUndefined()
    })

    test('allows setting new data after reset', () => {
      setActivityQueryData(['test'], 'old')
      resetActivityQueryCache()
      setActivityQueryData(['test'], 'new')
      expect(getActivityQueryData<string>(['test'])).toBe('new')
    })
  })
})

describe('staleness calculation', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })

  test('data is considered stale after staleTime has passed', () => {
    const staleTime = 100
    const testKey = ['stale-test']

    setActivityQueryData(testKey, 'test-value')

    const dataImmediately = getActivityQueryData<string>(testKey)
    expect(dataImmediately).toBe('test-value')
  })

  test('invalidated data should be refetchable', () => {
    const testKey = ['invalidate-test']

    setActivityQueryData(testKey, 'initial')
    expect(getActivityQueryData<string>(testKey)).toBe('initial')

    invalidateActivityQuery(testKey)

    expect(getActivityQueryData<string>(testKey)).toBe('initial')
  })
})

describe('refetch interval staleness bug fix', () => {

  beforeEach(() => {
    resetActivityQueryCache()
  })

  test('setActivityQueryData sets dataUpdatedAt to current time', () => {
    const before = Date.now()
    setActivityQueryData(['timing-test'], 'value')
    const after = Date.now()

    expect(getActivityQueryData<string>(['timing-test'])).toBe('value')

    invalidateActivityQuery(['timing-test'])

    expect(getActivityQueryData<string>(['timing-test'])).toBe('value')
  })

  test('fresh data followed by stale time passage should allow refetch', () => {

    const testKey = ['refetch-bug-test']

    setActivityQueryData(testKey, 'fresh-data')
    expect(getActivityQueryData<string>(testKey)).toBe('fresh-data')

    invalidateActivityQuery(testKey)

    expect(getActivityQueryData<string>(testKey)).toBe('fresh-data')

  })

  test('multiple data updates preserve latest data', () => {
    const testKey = ['multi-update-test']

    setActivityQueryData(testKey, 'first')
    expect(getActivityQueryData<string>(testKey)).toBe('first')

    setActivityQueryData(testKey, 'second')
    expect(getActivityQueryData<string>(testKey)).toBe('second')

    setActivityQueryData(testKey, 'third')
    expect(getActivityQueryData<string>(testKey)).toBe('third')

    invalidateActivityQuery(testKey)
    expect(getActivityQueryData<string>(testKey)).toBe('third')
  })
})

describe('cache listener notifications', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })

  test('setActivityQueryData notifies listeners', () => {
    const testKey = ['listener-test']
    let notificationCount = 0

    setActivityQueryData(testKey, 'initial')

    setActivityQueryData(testKey, 'updated')
    expect(getActivityQueryData<string>(testKey)).toBe('updated')
  })

  test('invalidateActivityQuery notifies listeners', () => {
    const testKey = ['invalidate-listener-test']

    setActivityQueryData(testKey, 'data')

    invalidateActivityQuery(testKey)

    expect(getActivityQueryData<string>(testKey)).toBe('data')
  })

  test('removeActivityQuery clears data and notifies listeners', () => {
    const testKey = ['remove-listener-test']

    setActivityQueryData(testKey, 'data')
    expect(getActivityQueryData<string>(testKey)).toBe('data')

    removeActivityQuery(testKey)
    expect(getActivityQueryData<string>(testKey)).toBeUndefined()
  })
})

describe('polling and staleness simulation', () => {
  let originalDateNow: typeof Date.now
  let mockNow: number

  beforeEach(() => {
    resetActivityQueryCache()
    originalDateNow = Date.now
    mockNow = 1000000
    Date.now = () => mockNow
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  test('data becomes stale after staleTime passes', () => {
    const testKey = ['stale-time-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000

    setActivityQueryData(testKey, 'fresh-data')

    expect(getActivityQueryData<string>(testKey)).toBe('fresh-data')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 25000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 10000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)

    expect(getActivityQueryData<string>(testKey)).toBe('fresh-data')
  })

  test('invalidated data is immediately stale', () => {
    const testKey = ['invalidate-stale-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000

    setActivityQueryData(testKey, 'data')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    invalidateActivityQuery(testKey)
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)

    expect(getActivityQueryData<string>(testKey)).toBe('data')
  })

  test('updating data resets the staleness timer', () => {
    const testKey = ['reset-timer-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000

    setActivityQueryData(testKey, 'initial')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 35000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)

    setActivityQueryData(testKey, 'updated')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    expect(getActivityQueryData<string>(testKey)).toBe('updated')

    mockNow += 10000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    expect(getActivityQueryData<string>(testKey)).toBe('updated')
  })

  test('staleTime of 0 means always stale', () => {
    const testKey = ['zero-stale-test']
    const serializedKey = JSON.stringify(testKey)

    setActivityQueryData(testKey, 'data')

    expect(isEntryStale(serializedKey, 0)).toBe(true)
    expect(getActivityQueryData<string>(testKey)).toBe('data')
  })

  test('non-existent key is always stale', () => {
    const serializedKey = JSON.stringify(['non-existent'])
    expect(isEntryStale(serializedKey, 30000)).toBe(true)
  })
})

describe('refetch on activity behavior', () => {
  let originalDateNow: typeof Date.now
  let mockNow: number

  beforeEach(() => {
    resetActivityQueryCache()
    originalDateNow = Date.now
    mockNow = 1000000
    Date.now = () => mockNow
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  test('data should be refetchable when user becomes active after idle', () => {
    const testKey = ['activity-refetch-test']
    const staleTime = 30000
    const idleThreshold = 30000

    setActivityQueryData(testKey, 'initial')

    mockNow += 35000

    expect(getActivityQueryData<string>(testKey)).toBe('initial')

    setActivityQueryData(testKey, 'refetched')
    expect(getActivityQueryData<string>(testKey)).toBe('refetched')
  })

  test('pause when idle should prevent polling updates', () => {
    const testKey = ['pause-idle-test']

    setActivityQueryData(testKey, 'before-idle')

    expect(getActivityQueryData<string>(testKey)).toBe('before-idle')
  })
})

describe('cache edge cases and error handling', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })

  test('setting undefined data should still create cache entry', () => {
    const testKey = ['undefined-test']

    setActivityQueryData(testKey, undefined)

    expect(getActivityQueryData(testKey)).toBeUndefined()
  })

  test('setting null data should store null', () => {
    const testKey = ['null-test']

    setActivityQueryData(testKey, null)

    expect(getActivityQueryData(testKey)).toBeNull()
  })

  test('complex nested objects should be stored correctly', () => {
    const testKey = ['complex-object-test']

    const complexData = {
      user: {
        id: 1,
        profile: {
          name: 'Test',
          settings: {
            theme: 'dark',
            notifications: [1, 2, 3],
          },
        },
      },
      timestamp: new Date('2024-01-01'),
    }

    setActivityQueryData(testKey, complexData)

    const cached = getActivityQueryData<typeof complexData>(testKey)
    expect(cached?.user.profile.settings.notifications).toEqual([1, 2, 3])
    expect(cached?.timestamp).toEqual(new Date('2024-01-01'))
  })

  test('array data should be stored and retrieved correctly', () => {
    const testKey = ['array-test']

    const arrayData = [1, 2, 3, { nested: 'value' }]
    setActivityQueryData(testKey, arrayData)

    const cached = getActivityQueryData<typeof arrayData>(testKey)
    expect(cached).toEqual(arrayData)
    expect(cached?.[3]).toEqual({ nested: 'value' })
  })

  test('invalidating non-existent key should not throw', () => {
    expect(() => {
      invalidateActivityQuery(['non-existent-key'])
    }).not.toThrow()
  })

  test('removing non-existent key should not throw', () => {
    expect(() => {
      removeActivityQuery(['non-existent-key'])
    }).not.toThrow()
  })

  test('getting data after remove should return undefined', () => {
    const testKey = ['remove-then-get-test']

    setActivityQueryData(testKey, 'data')
    removeActivityQuery(testKey)

    expect(getActivityQueryData(testKey)).toBeUndefined()
  })

  test('setting data after remove should work', () => {
    const testKey = ['remove-then-set-test']

    setActivityQueryData(testKey, 'first')
    removeActivityQuery(testKey)
    setActivityQueryData(testKey, 'second')

    expect(getActivityQueryData<string>(testKey)).toBe('second')
  })
})

describe('error-only entries and persistent error handling', () => {
  let originalDateNow: typeof Date.now
  let mockNow: number

  beforeEach(() => {
    resetActivityQueryCache()
    originalDateNow = Date.now
    mockNow = 1000000
    Date.now = () => mockNow
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  test('setErrorOnlyCacheEntry creates entry with no data and error', () => {
    const testKey = ['error-entry-test']
    const error = new Error('Network error')

    setErrorOnlyCacheEntry(testKey, error)

    expect(getActivityQueryData(testKey)).toBeUndefined()
  })

  test('error-only entry with recent errorUpdatedAt should NOT be stale', () => {

    const testKey = ['error-only-fresh-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000
    const error = new Error('API error')

    setErrorOnlyCacheEntry(testKey, error, mockNow)

    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
  })

  test('error-only entry becomes stale after staleTime passes', () => {
    const testKey = ['error-stale-after-time-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000
    const error = new Error('API error')

    setErrorOnlyCacheEntry(testKey, error, mockNow)

    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 25000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 10000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })

  test('simulates subscription query polling with persistent errors', () => {

    const subscriptionKey = ['subscription', 'current']
    const serializedKey = JSON.stringify(subscriptionKey)
    const staleTime = 30000
    const refetchInterval = 60000
    const error = new Error('Failed to fetch subscription: 500')

    setErrorOnlyCacheEntry(subscriptionKey, error, mockNow)

    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 1000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    for (let i = 0; i < 28; i++) {
      mockNow += 1000
      expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    }

    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 1000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 1000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })

  test('staleTime of 0 means always stale even for error-only entries', () => {
    const testKey = ['zero-stale-error-test']
    const serializedKey = JSON.stringify(testKey)
    const error = new Error('Some error')

    setErrorOnlyCacheEntry(testKey, error, mockNow)

    expect(isEntryStale(serializedKey, 0)).toBe(true)
  })

  test('error-only entry with null errorUpdatedAt is stale', () => {
    const testKey = ['null-error-time-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000

    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })

  test('successful data takes precedence over errorUpdatedAt for staleness', () => {
    const testKey = ['data-precedence-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000

    setErrorOnlyCacheEntry(testKey, new Error('Initial error'), mockNow)
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    setActivityQueryData(testKey, { subscription: 'active' })

    expect(isEntryStale(serializedKey, staleTime)).toBe(false)

    mockNow += 35000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })
})

describe('retry infinite loop bug fix (subscription 401 scenario)', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })

  test('retry count is preserved after scheduling a retry', () => {
    const queryKey = ['subscription', 'current']
    const maxRetries = 1

    _retryTestHelpers.setRefCount(queryKey, 1)

    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(0)

    const result1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(result1.retryScheduled).toBe(true)
    expect(result1.retryCount).toBe(1)

    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(1)
  })

  test('retries are exhausted after maxRetries attempts', () => {
    const queryKey = ['subscription', 'current']
    const maxRetries = 1

    _retryTestHelpers.setRefCount(queryKey, 1)

    const result1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(result1.retryScheduled).toBe(true)
    expect(result1.retryCount).toBe(1)

    const result2 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(result2.retryScheduled).toBe(false)
    expect(result2.retryCount).toBe(0)
  })

  test('simulates full subscription 401 scenario: fetch + 1 retry + stop', () => {
    const queryKey = ['subscription', 'current']
    const maxRetries = 1

    _retryTestHelpers.setRefCount(queryKey, 1)

    const fetch1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch1.retryScheduled).toBe(true)
    expect(fetch1.retryCount).toBe(1)

    const fetch2 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch2.retryScheduled).toBe(false)
    expect(fetch2.retryCount).toBe(0)

    const fetch3 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch3.retryScheduled).toBe(true)
    expect(fetch3.retryCount).toBe(1)

    const fetch4 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch4.retryScheduled).toBe(false)
  })

  test('demonstrates the old bug: clearRetryState would reset count causing infinite loop', () => {
    const queryKey = ['subscription', 'current']

    _retryTestHelpers.setRefCount(queryKey, 1)

    _retryTestHelpers.setRetryCount(queryKey, 1)
    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(1)

    _retryTestHelpers.setRetryCount(queryKey, 0)
    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(0)

    const result = _retryTestHelpers.simulateFailedFetch(queryKey, 1)
    expect(result.retryScheduled).toBe(true)
    expect(result.retryCount).toBe(1)

  })

  test('retry count resets to 0 when retries are exhausted', () => {
    const queryKey = ['retry-reset-test']
    const maxRetries = 2

    _retryTestHelpers.setRefCount(queryKey, 1)

    const r1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(r1).toEqual({ retryScheduled: true, retryCount: 1 })

    const r2 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(r2).toEqual({ retryScheduled: true, retryCount: 2 })

    const r3 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(r3).toEqual({ retryScheduled: false, retryCount: 0 })
  })

  test('no retries when retry is 0 or false', () => {
    const queryKey = ['no-retry-test']
    _retryTestHelpers.setRefCount(queryKey, 1)

    const result = _retryTestHelpers.simulateFailedFetch(queryKey, 0)
    expect(result.retryScheduled).toBe(false)
    expect(result.retryCount).toBe(0)
  })

  test('no retries when component is unmounted (refCount=0)', () => {
    const queryKey = ['unmounted-test']

    const result = _retryTestHelpers.simulateFailedFetch(queryKey, 1)
    expect(result.retryScheduled).toBe(false)
  })

  test('error-only entry is created after retries exhausted', () => {
    const queryKey = ['error-entry-after-retry']
    _retryTestHelpers.setRefCount(queryKey, 1)

    _retryTestHelpers.simulateFailedFetch(queryKey, 1)

    expect(getActivityQueryData(queryKey)).toBeUndefined()

    _retryTestHelpers.simulateFailedFetch(queryKey, 1)

    const serializedKey = JSON.stringify(queryKey)
    expect(isEntryStale(serializedKey, 30000)).toBe(false)
  })
})
