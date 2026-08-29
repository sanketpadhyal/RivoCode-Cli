import { formatTimeUntil } from '@rivocode/common/util/dates'

export const formatResetTimeLong = (resetDate: Date | string | null): string => {
  if (!resetDate) return ''
  return formatTimeUntil(resetDate, { fallback: 'now' })
}
