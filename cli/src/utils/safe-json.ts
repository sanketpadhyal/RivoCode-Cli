
export type SerializeFallbackReport = {
  reason: 'cyclic' | 'oom'
  cyclePaths: string[]
  truncatedStrings: number
}

export type SerializeResult = {
  json: string
  fallback?: SerializeFallbackReport
}

const TRUNCATE_THRESHOLD_CHARS = 1_000_000
const TRUNCATE_KEEP_CHARS = 50_000
const MAX_REPORTED_CYCLE_PATHS = 5

export function classifyStringifyError(
  error: unknown,
): 'cyclic' | 'oom' | null {
  const msg = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase()
  if (msg.includes('cyclic') || msg.includes('circular')) return 'cyclic'
  if (msg.includes('out of memory') || msg.includes('invalid string length')) {
    return 'oom'
  }
  return null
}

function makeFallbackReplacer(
  truncate: boolean,
  report: SerializeFallbackReport,
): (this: unknown, key: string, value: unknown) => unknown {
  const stack: unknown[] = []
  const keys: string[] = []
  return function (key, value) {
    if (stack.length > 0) {
      const thisPos = stack.indexOf(this)
      if (thisPos !== -1) {
        stack.splice(thisPos + 1)
        keys.splice(thisPos, Infinity, key)
      } else {
        stack.push(this)
        keys.push(key)
      }
      if (
        typeof value === 'object' &&
        value !== null &&
        stack.includes(value)
      ) {
        if (report.cyclePaths.length < MAX_REPORTED_CYCLE_PATHS) {
          report.cyclePaths.push(keys.filter(Boolean).join('.'))
        }
        return '[Circular]'
      }
    } else {
      stack.push(value)
    }
    if (
      truncate &&
      typeof value === 'string' &&
      value.length > TRUNCATE_THRESHOLD_CHARS
    ) {
      report.truncatedStrings++
      return (
        value.slice(0, TRUNCATE_KEEP_CHARS) +
        `…[truncated ${value.length - TRUNCATE_KEEP_CHARS} chars]`
      )
    }
    return value
  }
}

export function serializeForPersistence(value: unknown): SerializeResult {
  try {
    return { json: JSON.stringify(value) }
  } catch (error) {
    const reason = classifyStringifyError(error)
    if (!reason) throw error
    const report: SerializeFallbackReport = {
      reason,
      cyclePaths: [],
      truncatedStrings: 0,
    }
    try {
      const json = JSON.stringify(
        value,
        makeFallbackReplacer(reason === 'oom', report),
      )
      return { json, fallback: report }
    } catch (fallbackError) {
      if (
        reason === 'cyclic' &&
        classifyStringifyError(fallbackError) === 'oom'
      ) {
        const retryReport: SerializeFallbackReport = {
          reason: 'oom',
          cyclePaths: [],
          truncatedStrings: 0,
        }
        try {
          const json = JSON.stringify(
            value,
            makeFallbackReplacer(true, retryReport),
          )
          return { json, fallback: retryReport }
        } catch {
          throw error
        }
      }
      throw error
    }
  }
}
