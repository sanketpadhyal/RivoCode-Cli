import { IS_DEV, IS_TEST, IS_CI } from '@rivocode/common/env'

import { getApiClient } from './codebuff-api'
import { getCliEnv } from './env'

import type { LogRecordInput } from '@rivocode/common/schemas/logs'

const MAX_BATCH = 50
const FLUSH_INTERVAL_MS = 10_000
const MAX_BUFFER = 1_000

let buffer: LogRecordInput[] = []
let timer: ReturnType<typeof setInterval> | null = null
let naturalExitFlushRegistered = false

export function createClientLogFlusher(deps: {
  takeBatch: () => LogRecordInput[]
  hasPending: () => boolean
  sendBatch: (batch: LogRecordInput[]) => Promise<void>
}) {
  let activeFlush: Promise<void> | null = null

  const flush = (): Promise<void> => {
    if (activeFlush) return activeFlush
    const batch = deps.takeBatch()
    if (batch.length === 0) return Promise.resolve()

    activeFlush = deps
      .sendBatch(batch)
      .catch(() => {
      })
      .finally(() => {
        activeFlush = null
      })
    return activeFlush
  }

  const drain = async (): Promise<void> => {
    while (activeFlush || deps.hasPending()) {
      await (activeFlush ?? flush())
    }
  }

  return { flush, drain }
}

const clientLogFlusher = createClientLogFlusher({
  takeBatch: () => buffer.splice(0, MAX_BATCH),
  hasPending: () => buffer.length > 0,
  sendBatch: async (batch) => {
    const client = getApiClient()
    await client.post(
      '/api/logs',
      { records: batch },
      {
        includeAuth: Boolean(client.authToken),
        retry: false,
        timeoutMs: 5_000,
      },
    )
  },
})

function enabled(): boolean {
  const flag = getCliEnv().CODEBUFF_SHIP_LOGS
  if (flag === 'true') return true
  if (flag === 'false') return false
  return !IS_DEV && !IS_TEST && !IS_CI
}

function ensureTimer(): void {
  if (timer) return
  timer = setInterval(() => {
    void flushClientLogs()
  }, FLUSH_INTERVAL_MS)
  ;(timer as { unref?: () => void }).unref?.()
}

function registerNaturalExitFlush(): void {
  if (naturalExitFlushRegistered) return
  naturalExitFlushRegistered = true
  const onExit = () => {
    void drainClientLogs()
  }
  process.once('beforeExit', onExit)
}

export function enqueueClientLog(record: LogRecordInput): void {
  if (!enabled()) return
  if (buffer.length >= MAX_BUFFER) {
    buffer.shift()
  }
  buffer.push(record)
  ensureTimer()
  registerNaturalExitFlush()
  if (buffer.length >= MAX_BATCH) {
    void flushClientLogs()
  }
}

export function flushClientLogs(): Promise<void> {
  return clientLogFlusher.flush()
}

export async function drainClientLogs(): Promise<void> {
  await clientLogFlusher.drain()
}
