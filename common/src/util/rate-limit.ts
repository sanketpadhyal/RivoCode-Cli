export interface FixedWindowRateLimiter {
  limited(key: string, now: number): boolean
}

export function createFixedWindowRateLimiter(opts: {
  windowMs: number
  max: number
  maxKeys?: number
}): FixedWindowRateLimiter {
  const { windowMs, max, maxKeys = 10_000 } = opts
  const hits = new Map<string, { count: number; resetAt: number }>()
  let lastPruneAt = 0

  return {
    limited(key: string, now: number): boolean {
      const entry = hits.get(key)
      if (!entry || now >= entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        if (hits.size > maxKeys && now - lastPruneAt >= windowMs) {
          lastPruneAt = now
          for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k)
        }
        return false
      }
      entry.count++
      return entry.count > max
    },
  }
}

export function extractClientIp(headers: {
  get(name: string): string | null
}): string {
  return (
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
