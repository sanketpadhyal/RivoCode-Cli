
export function shiftUtcDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function dayWindowBounds(day: string): { start: string; end: string } {
  return {
    start: `${day}T00:00:00.000Z`,
    end: `${shiftUtcDay(day, 1)}T00:00:00.000Z`,
  }
}

export function trailingUtcDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    shiftUtcDay(today, -(count - i)),
  )
}
