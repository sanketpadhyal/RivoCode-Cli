import { MAX_LOG_DATA_BYTES } from '../schemas/logs'

import type { LogLevel } from '../types/contracts/logs'

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
}

export function serializeLogData(data: unknown): string | null {
  if (data == null) return null
  let serialized: string
  if (typeof data === 'string') {
    serialized = data
  } else {
    try {
      const seen = new WeakSet()
      serialized = JSON.stringify(data, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]'
          seen.add(v)
        }
        return v
      })
    } catch {
      return null
    }
  }
  if (serialized.length > MAX_LOG_DATA_BYTES) {
    return JSON.stringify({
      _truncated: true,
      original_bytes: serialized.length,
      preview: serialized.slice(0, MAX_LOG_DATA_BYTES),
    })
  }
  return serialized
}
