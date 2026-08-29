import { z } from 'zod/v4'

export const MAX_LOG_RECORDS_PER_BATCH = 500
export const MAX_LOG_MESSAGE_LENGTH = 4_000
export const MAX_LOG_DATA_BYTES = 64_000
export const MAX_LOG_BODY_BYTES = 1_000_000

export function isLogBodyTooLarge(contentLength: string | null): boolean {
  if (contentLength == null) return false
  const len = Number(contentLength)
  return Number.isFinite(len) && len > MAX_LOG_BODY_BYTES
}

export const logLevelSchema = z.enum([
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
])

export const logRecordSchema = z.object({
  timestamp: z.string().datetime().optional(),
  level: logLevelSchema.default('info'),
  event: z.string().max(200).nullish(),
  message: z.string().max(MAX_LOG_MESSAGE_LENGTH).nullish(),
  client_session_id: z.string().max(200).nullish(),
  client_request_id: z.string().max(200).nullish(),
  fingerprint_id: z.string().max(200).nullish(),
  data: z.unknown().optional(),
})

export type LogRecordInput = z.infer<typeof logRecordSchema>

export const logIngestSchema = z.object({
  records: z.array(logRecordSchema).min(1).max(MAX_LOG_RECORDS_PER_BATCH),
})

export type LogIngestBody = z.infer<typeof logIngestSchema>
