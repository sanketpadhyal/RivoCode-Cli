export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogSource = 'server' | 'cli' | 'browser'

export type LogRow = {
  id: string
  timestamp: Date
  level: LogLevel
  source: LogSource
  service?: string | null
  env: string
  event?: string | null
  message?: string | null
  user_id?: string | null
  client_session_id?: string | null
  client_request_id?: string | null
  fingerprint_id?: string | null
  data?: unknown
}
