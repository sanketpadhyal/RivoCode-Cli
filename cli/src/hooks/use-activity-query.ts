import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import { isUserActive, subscribeToActivity } from '../utils/activity-tracker'

type CacheEntry<T> = {
  data?: T
  dataUpdatedAt: number
  error: Error | null
  errorUpdatedAt: number | null
}

type KeySnapshot<T> = {
  entry: CacheEntry<T> | undefined
  isFetching: boolean
}

type CacheState = {
  entries: Map<string, CacheEntry<unknown>>
  keyListeners: Map<string, Set<() => void>>
  refCounts: Map<string, number>
  fetchingKeys: Set<string>
}

const cache: CacheState = {
  entries: new Map(),
  keyListeners: new Map(),
  refCounts: new Map(),
  fetchingKeys: new Set(),
}

const inFlight = new Map<string, Promise<unknown>>()

const snapshotMemo = new Map<
  string,
  {
    entryRef: CacheEntry<unknown> | undefined
    fetching: boolean
    snap: KeySnapshot<unknown>
  }
>()

function notifyKeyListeners(key: string) {
  const listeners = cache.keyListeners.get(key)
  if (!listeners) return
  for (const listener of listeners) listener()
}

function subscribeToKey(key: string, callback: () => void): () => void {
  let listeners = cache.keyListeners.get(key)
  if (!listeners) {
    listeners = new Set()
    cache.keyListeners.set(key, listeners)
  }
  listeners.add(callback)
  return () => {
    listeners!.delete(callback)
    if (listeners!.size === 0) {
      cache.keyListeners.delete(key)
    }
  }
}

function getKeySnapshot<T>(key: string): KeySnapshot<T> {
  const entry = cache.entries.get(key) as CacheEntry<T> | undefined
  const fetching = cache.fetchingKeys.has(key)

  const memo = snapshotMemo.get(key)
  if (memo && memo.entryRef === (entry as any) && memo.fetching === fetching) {
    return memo.snap as KeySnapshot<T>
  }

  const snap: KeySnapshot<T> = { entry, isFetching: fetching }
  snapshotMemo.set(key, {
    entryRef: entry as any,
    fetching,
    snap: snap as any,
  })
  return snap
}

function setCacheEntry<T>(key: string, entry: CacheEntry<T>): void {
  cache.entries.set(key, entry as CacheEntry<unknown>)
  snapshotMemo.delete(key)
  notifyKeyListeners(key)
}

function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.entries.get(key) as CacheEntry<T> | undefined
}

export function isEntryStale(key: string, staleTime: number): boolean {
  const entry = getCacheEntry(key)
  if (!entry) return true

  if (entry.dataUpdatedAt !== 0) {
    return staleTime === 0 || Date.now() - entry.dataUpdatedAt > staleTime
  }

  if (entry.errorUpdatedAt !== null) {
    return staleTime === 0 || Date.now() - entry.errorUpdatedAt > staleTime
  }

  return true
}

function setQueryFetching(key: string, fetching: boolean): void {
  const wasFetching = cache.fetchingKeys.has(key)
  if (fetching) cache.fetchingKeys.add(key)
  else cache.fetchingKeys.delete(key)

  if (wasFetching !== fetching) {
    snapshotMemo.delete(key)
    notifyKeyListeners(key)
  }
}

function incrementRefCount(key: string): void {
  const current = cache.refCounts.get(key) ?? 0
  cache.refCounts.set(key, current + 1)
}

function decrementRefCount(key: string): number {
  const current = cache.refCounts.get(key) ?? 0
  const next = Math.max(0, current - 1)
  if (next === 0) cache.refCounts.delete(key)
  else cache.refCounts.set(key, next)
  return next
}

function getRefCount(key: string): number {
  return cache.refCounts.get(key) ?? 0
}

function serializeQueryKey(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey)
}

const gcTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const retryCounts = new Map<string, number>()
const retryTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const generations = new Map<string, number>()
function bumpGeneration(key: string) {
  generations.set(key, (generations.get(key) ?? 0) + 1)
}
function getGeneration(key: string) {
  return generations.get(key) ?? 0
}

function clearRetryTimeout(key: string) {
  const t = retryTimeouts.get(key)
  if (t) clearTimeout(t)
  retryTimeouts.delete(key)
}

function clearRetryState(key: string) {
  clearRetryTimeout(key)
  retryCounts.delete(key)
}

function deleteCacheEntry(key: string): void {
  bumpGeneration(key)
  clearRetryState(key)
  inFlight.delete(key)
  cache.fetchingKeys.delete(key)
  cache.entries.delete(key)
  cache.refCounts.delete(key)
  snapshotMemo.delete(key)
  notifyKeyListeners(key)
}
export type UseActivityQueryOptions<T> = {
  queryKey: readonly unknown[]
  queryFn: () => Promise<T>
  enabled?: boolean
  staleTime?: number
  gcTime?: number
  retry?: number | false
  refetchInterval?: number | false

  refetchOnMount?: boolean | 'always'
  refetchOnActivity?: boolean
  pauseWhenIdle?: boolean
  idleThreshold?: number
}

export type UseActivityQueryResult<T> = {
  data: T | undefined
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useActivityQuery<T>(
  options: UseActivityQueryOptions<T>,
): UseActivityQueryResult<T> {
  const {
    queryKey,
    queryFn,
    enabled = true,
    staleTime = 0,
    gcTime = 5 * 60 * 1000,
    retry = 0,
    refetchInterval = false,
    refetchOnMount = false,
    refetchOnActivity = false,
    pauseWhenIdle = false,
    idleThreshold = 30_000,
  } = options

  const serializedKey = serializeQueryKey(queryKey)
  const mountedRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasIdleRef = useRef(false)

  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const snap = useSyncExternalStore(
    (cb) => subscribeToKey(serializedKey, cb),
    () => getKeySnapshot<T>(serializedKey),
    () => getKeySnapshot<T>(serializedKey),
  )

  const cachedEntry = snap.entry
  const isFetching = snap.isFetching

  const data = cachedEntry?.data
  const error = cachedEntry?.error ?? null
  const dataUpdatedAt = cachedEntry?.dataUpdatedAt ?? 0

  const isLoading = isFetching && (cachedEntry == null || dataUpdatedAt === 0)

  const doFetch = useCallback(async (): Promise<void> => {
    if (!enabled) return

    const existing = inFlight.get(serializedKey)
    if (existing) {
      await existing
      return
    }

    const myGen = getGeneration(serializedKey)
    setQueryFetching(serializedKey, true)

    const fetchPromise = (async () => {
      try {
        const result = await queryFnRef.current()

        if (getGeneration(serializedKey) !== myGen) return

        setCacheEntry(serializedKey, {
          data: result,
          dataUpdatedAt: Date.now(),
          error: null,
          errorUpdatedAt: null,
        })
        retryCounts.set(serializedKey, 0)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        const maxRetries = retry === false ? 0 : retry
        const currentRetries = retryCounts.get(serializedKey) ?? 0

        if (currentRetries < maxRetries && getRefCount(serializedKey) > 0) {
          const next = currentRetries + 1
          retryCounts.set(serializedKey, next)

          inFlight.delete(serializedKey)
          setQueryFetching(serializedKey, false)

          clearRetryTimeout(serializedKey)
          const t = setTimeout(() => {
            retryTimeouts.delete(serializedKey)
            if (getRefCount(serializedKey) > 0 && getGeneration(serializedKey) === myGen) {
              void doFetch()
            }
          }, 1000 * next)
          retryTimeouts.set(serializedKey, t)
          return
        }

        retryCounts.set(serializedKey, 0)

        if (getGeneration(serializedKey) !== myGen) return

        const existingEntry = getCacheEntry<T>(serializedKey)
        setCacheEntry(serializedKey, {
          data: existingEntry?.data,
          dataUpdatedAt: existingEntry?.dataUpdatedAt ?? 0,
          error: e,
          errorUpdatedAt: Date.now(),
        })
      } finally {
        inFlight.delete(serializedKey)
        setQueryFetching(serializedKey, false)

        if (getRefCount(serializedKey) === 0) {
          clearRetryState(serializedKey)
        }
      }
    })()

    inFlight.set(serializedKey, fetchPromise)
    await fetchPromise
  }, [enabled, serializedKey, retry])

  const refetch = useCallback(async (): Promise<void> => {
    clearRetryState(serializedKey)
    await doFetch()
  }, [doFetch, serializedKey])

  useEffect(() => {
    const existingTimeout = gcTimeouts.get(serializedKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      gcTimeouts.delete(serializedKey)
    }

    wasIdleRef.current = false
    incrementRefCount(serializedKey)

    return () => {
      const next = decrementRefCount(serializedKey)

      if (next === 0) {
        clearRetryState(serializedKey)
      }
    }
  }, [serializedKey])

  useEffect(() => {
    mountedRef.current = true
    if (!enabled) return

    const currentEntry = getCacheEntry<T>(serializedKey)
    const currentlyStale = isEntryStale(serializedKey, staleTime)

    const shouldFetchOnMount =
      refetchOnMount === 'always' ||
      (refetchOnMount && currentlyStale) ||
      (!currentEntry)

    if (shouldFetchOnMount) void doFetch()

    return () => {
      mountedRef.current = false
    }
  }, [enabled, serializedKey])

  useEffect(() => {
    if (!enabled || !refetchInterval) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const tick = () => {
      if (pauseWhenIdle && !isUserActive(idleThreshold)) {
        wasIdleRef.current = true
        return
      }
      if (isEntryStale(serializedKey, staleTime)) {
        void doFetch()
      }
    }

    intervalRef.current = setInterval(tick, refetchInterval)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, refetchInterval, pauseWhenIdle, idleThreshold, staleTime, serializedKey, doFetch])

  useEffect(() => {
    if (!enabled || !refetchOnActivity) return

    const unsubscribe = subscribeToActivity(() => {
      if (wasIdleRef.current) {
        wasIdleRef.current = false
        if (isEntryStale(serializedKey, staleTime)) {
          void doFetch()
        }
      }
    })

    const checkIdle = setInterval(() => {
      if (!isUserActive(idleThreshold)) {
        wasIdleRef.current = true
      }
    }, 5000)

    return () => {
      unsubscribe()
      clearInterval(checkIdle)
    }
  }, [enabled, refetchOnActivity, idleThreshold, staleTime, serializedKey, doFetch])

  useEffect(() => {
    return () => {
      const timeoutId = setTimeout(() => {
        if (getRefCount(serializedKey) === 0) {
          deleteCacheEntry(serializedKey)
          gcTimeouts.delete(serializedKey)
        }
      }, gcTime)

      gcTimeouts.set(serializedKey, timeoutId)
    }
  }, [serializedKey, gcTime])

  return {
    data,
    isLoading,
    isFetching,
    isSuccess: cachedEntry != null && cachedEntry.error == null && cachedEntry.dataUpdatedAt !== 0,
    error,
    refetch,
  }
}

export function invalidateActivityQuery(queryKey: readonly unknown[]): void {
  const key = serializeQueryKey(queryKey)
  const entry = getCacheEntry(key)
  if (!entry) return
  setCacheEntry(key, { ...entry, dataUpdatedAt: 0 })
}

export function removeActivityQuery(queryKey: readonly unknown[]): void {
  const key = serializeQueryKey(queryKey)

  const existingTimeout = gcTimeouts.get(key)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
    gcTimeouts.delete(key)
  }

  deleteCacheEntry(key)
}

export function getActivityQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  const key = serializeQueryKey(queryKey)
  return getCacheEntry<T>(key)?.data
}

export function setActivityQueryData<T>(queryKey: readonly unknown[], data: T): void {
  const key = serializeQueryKey(queryKey)
  setCacheEntry(key, {
    data,
    dataUpdatedAt: Date.now(),
    error: null,
    errorUpdatedAt: null,
  })
}

export function useInvalidateActivityQuery() {
  return useCallback((queryKey: readonly unknown[]) => {
    invalidateActivityQuery(queryKey)
  }, [])
}

export function resetActivityQueryCache(): void {
  for (const timeoutId of gcTimeouts.values()) clearTimeout(timeoutId)
  gcTimeouts.clear()

  for (const t of retryTimeouts.values()) clearTimeout(t)
  retryTimeouts.clear()
  retryCounts.clear()

  cache.entries.clear()
  cache.keyListeners.clear()
  cache.refCounts.clear()
  cache.fetchingKeys.clear()

  inFlight.clear()
  snapshotMemo.clear()
  generations.clear()
}

export function setErrorOnlyCacheEntry(
  queryKey: readonly unknown[],
  error: Error,
  errorUpdatedAt?: number,
): void {
  const key = serializeQueryKey(queryKey)
  setCacheEntry(key, {
    data: undefined,
    dataUpdatedAt: 0,
    error,
    errorUpdatedAt: errorUpdatedAt ?? Date.now(),
  })
}

export const _retryTestHelpers = {
  getRetryCount(queryKey: readonly unknown[]): number {
    return retryCounts.get(serializeQueryKey(queryKey)) ?? 0
  },
  setRetryCount(queryKey: readonly unknown[], count: number): void {
    retryCounts.set(serializeQueryKey(queryKey), count)
  },
  getRetryTimeout(queryKey: readonly unknown[]): ReturnType<typeof setTimeout> | undefined {
    return retryTimeouts.get(serializeQueryKey(queryKey))
  },
  setRefCount(queryKey: readonly unknown[], count: number): void {
    const key = serializeQueryKey(queryKey)
    if (count === 0) cache.refCounts.delete(key)
    else cache.refCounts.set(key, count)
  },
  setFetching(queryKey: readonly unknown[], fetching: boolean): void {
    setQueryFetching(serializeQueryKey(queryKey), fetching)
  },
  getInFlight(queryKey: readonly unknown[]): boolean {
    return inFlight.has(serializeQueryKey(queryKey))
  },
  simulateFailedFetch(
    queryKey: readonly unknown[],
    maxRetries: number,
  ): { retryScheduled: boolean; retryCount: number } {
    const key = serializeQueryKey(queryKey)
    const currentRetries = retryCounts.get(key) ?? 0

    if (currentRetries < maxRetries && (cache.refCounts.get(key) ?? 0) > 0) {
      const next = currentRetries + 1
      retryCounts.set(key, next)

      inFlight.delete(key)
      setQueryFetching(key, false)

      clearRetryTimeout(key)

      return { retryScheduled: true, retryCount: next }
    }

    retryCounts.set(key, 0)

    const existingEntry = getCacheEntry(key)
    setCacheEntry(key, {
      data: existingEntry?.data,
      dataUpdatedAt: existingEntry?.dataUpdatedAt ?? 0,
      error: new Error('Simulated fetch error'),
      errorUpdatedAt: Date.now(),
    })

    inFlight.delete(key)
    setQueryFetching(key, false)

    return { retryScheduled: false, retryCount: 0 }
  },
}
