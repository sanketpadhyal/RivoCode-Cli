import { MAX_LOG_DATA_BYTES } from '../schemas/logs'
import {
  ADS_FIRST_PARTY_VIEW_ACK_EVENT,
  createFirstPartyViewAckTelemetry,
} from './axiom-only-log'

import type { LogRecordInput } from '../schemas/logs'
import type { LogRow, LogSource } from '../types/contracts/logs'

function truncateData(data: unknown): unknown {
  if (data === undefined) return null
  let serialized: string
  try {
    serialized = JSON.stringify(data)
  } catch {
    return { _unserializable: true }
  }
  if (serialized.length <= MAX_LOG_DATA_BYTES) return data
  return {
    _truncated: true,
    original_bytes: serialized.length,
    preview: serialized.slice(0, MAX_LOG_DATA_BYTES),
  }
}

export function buildLogRows(params: {
  records: LogRecordInput[]
  source: LogSource
  service: string
  env: string
  userId?: string | null
  now: Date
}): LogRow[] {
  const { records, source, service, env, userId = null, now } = params
  return records.flatMap((record) => {
    const ts = record.timestamp ? new Date(record.timestamp) : now
    if (record.event === ADS_FIRST_PARTY_VIEW_ACK_EVENT) {
      const telemetry = createFirstPartyViewAckTelemetry(record.data)
      if (!telemetry) return []
      return [
        {
          id: crypto.randomUUID(),
          timestamp: now,
          level: record.level,
          source,
          service,
          env,
          event: ADS_FIRST_PARTY_VIEW_ACK_EVENT,
          message: null,
          user_id: null,
          client_session_id: null,
          client_request_id: null,
          fingerprint_id: null,
          data: { ...telemetry },
        },
      ]
    }
    return {
      id: crypto.randomUUID(),
      timestamp: isNaN(ts.getTime()) ? now : ts,
      level: record.level,
      source,
      service,
      env,
      event: record.event ?? null,
      message: record.message ?? null,
      user_id: userId,
      client_session_id: record.client_session_id ?? null,
      client_request_id: record.client_request_id ?? null,
      fingerprint_id: record.fingerprint_id ?? null,
      data: truncateData(record.data),
    }
  })
}
