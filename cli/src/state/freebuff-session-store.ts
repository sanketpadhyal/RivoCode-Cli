import { create } from 'zustand'

import type { FreebuffSessionResponse } from '../types/freebuff-session'

export interface FreebuffSessionRetry {
  attempt: number
  retryAtMs: number
}

interface FreebuffSessionFailureBase {
  message: string
  retry: FreebuffSessionRetry | null
  outcomeUnknown: boolean
}

export type FreebuffSessionFailure =
  | (FreebuffSessionFailureBase & {
      type: 'http'
      statusCode: number
    })
  | (FreebuffSessionFailureBase & {
      type: 'timeout' | 'other'
    })

interface FreebuffSessionStore {
  session: FreebuffSessionResponse | null
  failure: FreebuffSessionFailure | null

  setSession: (session: FreebuffSessionResponse | null) => void
  setFailure: (failure: FreebuffSessionFailure | null) => void
}

export const useFreebuffSessionStore = create<FreebuffSessionStore>((set) => ({
  session: null,
  failure: null,
  setSession: (session) => set({ session }),
  setFailure: (failure) => set({ failure }),
}))
