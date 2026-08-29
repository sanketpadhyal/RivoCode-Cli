export const AXIOM_MIRROR_DENYLIST: ReadonlySet<string> = new Set([
  '$snapshot',
  '$autocapture',
  '$heatmap',
  '$$heatmap',
  '$web_vitals',
  '$pageleave',
  'product_active_minute',
])

export function shouldMirrorAnalyticsEvent(
  eventName: string | null | undefined,
): boolean {
  if (!eventName) return true
  return !AXIOM_MIRROR_DENYLIST.has(eventName)
}
