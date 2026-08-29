export const REASONING_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
] as const

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'high'

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
}

export function reasoningEffortRank(value: unknown): number {
  return REASONING_EFFORTS.indexOf(value as ReasoningEffort)
}

export function clampReasoningEffort(
  requested: unknown,
  allowed: readonly ReasoningEffort[],
  fallback: ReasoningEffort,
): ReasoningEffort {
  if (allowed.length === 0) return fallback
  if (!isReasoningEffort(requested)) return fallback

  const wanted = reasoningEffortRank(requested)
  let best: ReasoningEffort | undefined
  for (const candidate of allowed) {
    const rank = reasoningEffortRank(candidate)
    if (rank > wanted) continue
    if (best === undefined || rank > reasoningEffortRank(best)) best = candidate
  }
  if (best !== undefined) return best

  return allowed.reduce((lowest, candidate) =>
    reasoningEffortRank(candidate) < reasoningEffortRank(lowest)
      ? candidate
      : lowest,
  )
}
