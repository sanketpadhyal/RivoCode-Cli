
export const TTFT_HISTOGRAM_BASE = 1.03

export const TTFT_HISTOGRAM_BUCKET_COUNT = 512

const LN_BASE = Math.log(TTFT_HISTOGRAM_BASE)

export function ttftBucketIndex(ttftMs: number): number {
  const index = Math.floor(Math.log(Math.max(ttftMs, 1)) / LN_BASE)
  return Math.min(TTFT_HISTOGRAM_BUCKET_COUNT - 1, Math.max(0, index))
}

export function ttftBucketMs(bucket: number): number {
  return Math.round(Math.exp((bucket + 0.5) * LN_BASE))
}

export function ttftPercentileFromHistogram(
  buckets: Iterable<readonly [number, number]>,
  quantile: number,
): number | null {
  const sorted = [...buckets].sort((a, b) => a[0] - b[0])
  const total = sorted.reduce((sum, [, count]) => sum + count, 0)
  if (total === 0) return null

  const target = total * quantile
  let cumulative = 0
  for (const [bucket, count] of sorted) {
    cumulative += count
    if (cumulative >= target) return ttftBucketMs(bucket)
  }
  return ttftBucketMs(sorted[sorted.length - 1][0])
}
