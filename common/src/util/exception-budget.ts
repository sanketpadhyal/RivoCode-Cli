
const MAX_DISTINCT_FINGERPRINTS = 200

export type ExceptionBudgetEvent = {
  event?: string | null
  properties?: Record<string, any> | null
}

export type ExceptionBeforeSend = <T extends ExceptionBudgetEvent>(
  event: T | null,
) => T | null

function fingerprint(
  properties: Record<string, any> | null | undefined,
): string {
  const list = properties?.$exception_list
  const first = Array.isArray(list) ? list[0] : undefined
  const type = typeof first?.type === 'string' ? first.type : 'Error'
  return `${type}: ${String(first?.value ?? '')}`.slice(0, 300)
}

function isReportedOccurrence(occurrence: number): boolean {
  let remaining = occurrence
  while (remaining % 10 === 0) remaining /= 10
  return remaining === 1
}

export function createExceptionBeforeSend(): ExceptionBeforeSend {
  const counts = new Map<string, number>()

  return (event) => {
    if (!event || event.event !== '$exception') return event

    const key = fingerprint(event.properties)
    const seen = counts.get(key)
    if (seen === undefined && counts.size >= MAX_DISTINCT_FINGERPRINTS) {
      return null
    }
    const occurrence = (seen ?? 0) + 1
    counts.set(key, occurrence)
    if (!isReportedOccurrence(occurrence)) return null

    if (event.properties) {
      event.properties.$exception_occurrence = occurrence
    }
    return event
  }
}
