export const getNextQuotaReset = (referenceDate: Date | null): Date => {
  const now = new Date()
  let nextMonth = new Date(referenceDate ?? now)
  while (nextMonth <= now) {
    nextMonth.setMonth(nextMonth.getMonth() + 1)
  }
  return nextMonth
}

export interface FormatTimeUntilOptions {
  fallback?: string
  includeSubUnit?: boolean
}

export const formatTimeUntil = (
  date: Date | string | null,
  options: FormatTimeUntilOptions = {},
): string => {
  const { fallback = 'now', includeSubUnit = true } = options

  if (!date) return fallback

  const target = typeof date === 'string' ? new Date(date) : date
  const diffMs = target.getTime() - Date.now()

  if (isNaN(diffMs) || diffMs <= 0) return fallback

  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const remainingHours = diffHours % 24
  const remainingMins = diffMins % 60

  if (diffDays > 0) {
    return includeSubUnit && remainingHours > 0
      ? `${diffDays}d ${remainingHours}h`
      : `${diffDays}d`
  }
  if (diffHours > 0) {
    return includeSubUnit && remainingMins > 0
      ? `${diffHours}h ${remainingMins}m`
      : `${diffHours}h`
  }
  return `${diffMins}m`
}
