import type { FreebuffRedditRetentionMilestoneDays } from '@rivocode/common/util/reddit-freebuff-retention'

export type RedditConversionSurface = 'cli' | 'web' | 'cloud' | 'chat'

export type RedditCapiEventName =
  | 'FirstPrompt'
  | 'Retention1d'
  | 'Retention7d'
  | 'Retention24d'

export const REDDIT_FIRST_PROMPT_EVENT = 'FirstPrompt' as const

export function redditRetentionCapiEventName(
  milestone: FreebuffRedditRetentionMilestoneDays,
): RedditCapiEventName {
  return `Retention${milestone}d`
}

export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}
