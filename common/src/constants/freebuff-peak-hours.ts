
export const DEEPSEEK_PEAK_HOUR_RANGES_UTC: ReadonlyArray<
  readonly [number, number]
> = [
  [1, 4],
  [6, 10],
] as const

export type DeepSeekPricingWindow = 'peak' | 'off-peak'

function isBeijingWeekend(at: Date): boolean {
  const beijingDay = new Date(at.getTime() + 8 * 60 * 60 * 1000).getUTCDay()
  return beijingDay === 0 || beijingDay === 6
}

export function deepseekPricingWindow(at: Date): DeepSeekPricingWindow {
  if (isBeijingWeekend(at)) return 'off-peak'
  const hour = at.getUTCHours()
  const peak = DEEPSEEK_PEAK_HOUR_RANGES_UTC.some(
    ([startHour, endHour]) => hour >= startHour && hour < endHour,
  )
  return peak ? 'peak' : 'off-peak'
}

export const DEEPSEEK_EXPENSIVE_WINDOW_LEAD_HOURS = 1

export const DEEPSEEK_EXPENSIVE_WINDOW_UTC: readonly [number, number] = [
  Math.min(...DEEPSEEK_PEAK_HOUR_RANGES_UTC.map(([start]) => start)) -
    DEEPSEEK_EXPENSIVE_WINDOW_LEAD_HOURS,
  Math.max(...DEEPSEEK_PEAK_HOUR_RANGES_UTC.map(([, end]) => end)),
]

export function isDeepSeekExpensiveWindow(at: Date): boolean {
  if (isBeijingWeekend(at)) return false
  const [start, end] = DEEPSEEK_EXPENSIVE_WINDOW_UTC
  const hour = at.getUTCHours()
  return hour >= start && hour < end
}

export function deepSeekExpensiveWindowEndsAt(at: Date): Date {
  if (!isDeepSeekExpensiveWindow(at)) return new Date(at)
  const [, end] = DEEPSEEK_EXPENSIVE_WINDOW_UTC
  const ends = new Date(at)
  ends.setUTCHours(end, 0, 0, 0)
  return ends
}

export const FALLBACK_WINDOW_TIME_ZONE = 'UTC'

function resolveWindowTimeZone(timeZone?: string): string {
  if (timeZone) return timeZone
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      FALLBACK_WINDOW_TIME_ZONE
    )
  } catch {
    return FALLBACK_WINDOW_TIME_ZONE
  }
}

export function formatWindowTimeZoneLabel(on: Date, timeZone?: string): string {
  const zone = resolveWindowTimeZone(timeZone)
  const named = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    hour: 'numeric',
    timeZoneName: 'short',
  })
    .formatToParts(on)
    .find((part) => part.type === 'timeZoneName')?.value
  return named ?? zone
}

function windowTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
}

export function formatDeepSeekExpensiveWindowLocal(
  on: Date = new Date(),
  timeZone?: string,
): string {
  const zone = resolveWindowTimeZone(timeZone)
  const fmt = windowTimeFormatter(zone)
  const atUtcHour = (hour: number): string => {
    const d = new Date(on)
    d.setUTCHours(hour, 0, 0, 0)
    return fmt.format(d)
  }
  const [start, end] = DEEPSEEK_EXPENSIVE_WINDOW_UTC
  return `${atUtcHour(start)} – ${atUtcHour(end)} ${formatWindowTimeZoneLabel(on, zone)}`
}

export function formatDeepSeekExpensiveWindowReturn(
  on: Date = new Date(),
  timeZone?: string,
): string {
  const ends = deepSeekExpensiveWindowEndsAt(on)
  const zone = resolveWindowTimeZone(timeZone)
  return `again at ${windowTimeFormatter(zone).format(ends)} ${formatWindowTimeZoneLabel(ends, zone)}`
}

export function formatDeepSeekOffPeakWindowLocal(
  on: Date = new Date(),
  timeZone?: string,
): string {
  const zone = resolveWindowTimeZone(timeZone)
  const fmt = windowTimeFormatter(zone)
  const atUtcHour = (hour: number): string => {
    const d = new Date(on)
    d.setUTCHours(hour, 0, 0, 0)
    return fmt.format(d)
  }
  const [start, end] = DEEPSEEK_EXPENSIVE_WINDOW_UTC
  return `${atUtcHour(end)} – ${atUtcHour(start)} ${formatWindowTimeZoneLabel(on, zone)}`
}
