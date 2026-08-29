import { useNow } from './use-now'
import { IS_FREEBUFF } from '../utils/constants'

import type { FreebuffSessionResponse } from '../types/freebuff-session'

export interface FreebuffSessionProgress {
  fraction: number
  remainingMs: number
}

export function useFreebuffSessionProgress(
  session: FreebuffSessionResponse | null,
): FreebuffSessionProgress | null {
  const expiresAtMs =
    session?.status === 'active' ? Date.parse(session.expiresAt) : null
  const admittedAtMs =
    session?.status === 'active' ? Date.parse(session.admittedAt) : null

  const nowMs = useNow(1000, expiresAtMs !== null)

  if (!IS_FREEBUFF || !expiresAtMs || !admittedAtMs) return null

  const totalMs = expiresAtMs - admittedAtMs
  if (totalMs <= 0) return null
  const remainingMs = Math.max(0, expiresAtMs - nowMs)
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs))
  return { fraction, remainingMs }
}
