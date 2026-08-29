import { describe, expect, it } from 'bun:test'

import {
  TTFT_HISTOGRAM_BASE,
  TTFT_HISTOGRAM_BUCKET_COUNT,
  ttftBucketIndex,
  ttftBucketMs,
  ttftPercentileFromHistogram,
} from '../ttft-histogram'

function exactPercentile(samples: number[], quantile: number): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const target = sorted.length * quantile
  let cumulative = 0
  for (const value of sorted) {
    cumulative += 1
    if (cumulative >= target) return value
  }
  return sorted[sorted.length - 1]
}

function histogramOf(samples: number[]): Map<number, number> {
  const histogram = new Map<number, number>()
  for (const sample of samples) {
    const bucket = ttftBucketIndex(sample)
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1)
  }
  return histogram
}

function makeRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('ttftBucketIndex', () => {
  it('is monotonic in latency', () => {
    let previous = -1
    for (const ms of [0, 1, 10, 100, 500, 1000, 2000, 5000, 30_000, 120_000]) {
      const bucket = ttftBucketIndex(ms)
      expect(bucket).toBeGreaterThanOrEqual(previous)
      previous = bucket
    }
  })

  it('clamps degenerate samples into the first bucket instead of -Infinity', () => {
    expect(ttftBucketIndex(0)).toBe(0)
    expect(ttftBucketIndex(0.4)).toBe(0)
    expect(ttftBucketIndex(1)).toBe(0)
    expect(Number.isFinite(ttftBucketMs(ttftBucketIndex(0)))).toBe(true)
  })

  it('clamps pathological samples into the last bucket', () => {
    const last = TTFT_HISTOGRAM_BUCKET_COUNT - 1
    expect(ttftBucketIndex(Number.MAX_SAFE_INTEGER)).toBe(last)
    expect(ttftBucketIndex(60 * 60 * 1000)).toBeLessThan(last)
  })

  it('keeps every reported value within half a bucket, plus ms rounding', () => {
    const halfWidth = (TTFT_HISTOGRAM_BASE - 1) / 2
    for (let ms = 1; ms <= 300_000; ms = Math.ceil(ms * 1.017)) {
      const reported = ttftBucketMs(ttftBucketIndex(ms))
      expect(Math.abs(reported - ms)).toBeLessThanOrEqual(
        ms * halfWidth + 0.5 + 1e-9,
      )
    }
  })

  it('keeps the relative error under 1.6% across the range the page renders', () => {
    for (let ms = 200; ms <= 300_000; ms = Math.ceil(ms * 1.017)) {
      const reported = ttftBucketMs(ttftBucketIndex(ms))
      expect(Math.abs(reported - ms) / ms).toBeLessThanOrEqual(0.016)
    }
  })
})

describe('ttftPercentileFromHistogram', () => {
  it('returns null for an empty histogram rather than 0', () => {
    expect(ttftPercentileFromHistogram([], 0.5)).toBeNull()
    expect(ttftPercentileFromHistogram([[10, 0]], 0.5)).toBeNull()
  })

  it('tracks exact percentiles on a realistic long-tailed distribution', () => {
    const random = makeRandom(20260728)
    const samples = Array.from({ length: 50_000 }, () => {
      const u = Math.max(random(), 1e-9)
      const v = Math.max(random(), 1e-9)
      const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      return Math.max(1, Math.round(Math.exp(7.5 + 0.6 * normal)))
    })

    const histogram = histogramOf(samples)
    for (const quantile of [0.5, 0.9, 0.95, 0.99]) {
      const approximate = ttftPercentileFromHistogram(histogram, quantile)!
      const exact = exactPercentile(samples, quantile)
      expect(Math.abs(approximate - exact) / exact).toBeLessThan(0.02)
    }
  })

  it('preserves the ordering between two models a few percent apart', () => {
    const slower = histogramOf(
      Array.from({ length: 10_000 }, (_, i) => 1981 + (i % 200)),
    )
    const faster = histogramOf(
      Array.from({ length: 10_000 }, (_, i) => 1822 + (i % 200)),
    )

    expect(ttftPercentileFromHistogram(faster, 0.5)!).toBeLessThan(
      ttftPercentileFromHistogram(slower, 0.5)!,
    )
  })

  it('merges histograms additively, which is what hourly rollup relies on', () => {
    const hourA = Array.from({ length: 3_000 }, (_, i) => 800 + (i % 400))
    const hourB = Array.from({ length: 1_000 }, (_, i) => 9_000 + (i % 900))

    const merged = histogramOf([...hourA, ...hourB])
    const combined = new Map(histogramOf(hourA))
    for (const [bucket, count] of histogramOf(hourB)) {
      combined.set(bucket, (combined.get(bucket) ?? 0) + count)
    }

    expect(ttftPercentileFromHistogram(combined, 0.5)).toBe(
      ttftPercentileFromHistogram(merged, 0.5),
    )
    expect(ttftPercentileFromHistogram(combined, 0.95)).toBe(
      ttftPercentileFromHistogram(merged, 0.95),
    )
    expect(ttftPercentileFromHistogram(merged, 0.95)!).toBeGreaterThan(8_000)
  })

  it('does not require the caller to pre-sort buckets', () => {
    const pairs: [number, number][] = [
      [300, 10],
      [100, 80],
      [200, 10],
    ]
    expect(ttftPercentileFromHistogram(pairs, 0.5)).toBe(ttftBucketMs(100))
    expect(ttftPercentileFromHistogram([...pairs].reverse(), 0.5)).toBe(
      ttftBucketMs(100),
    )
  })

  it('reports the slowest occupied bucket for a quantile of 1', () => {
    const histogram = histogramOf([100, 200, 30_000])
    expect(ttftPercentileFromHistogram(histogram, 1)).toBe(
      ttftBucketMs(ttftBucketIndex(30_000)),
    )
  })
})
