import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { FeedbackCategory } from '@rivocode/common/constants/feedback'

import type { AdResponse } from '../hooks/use-gravity-ad'
import type { ChatMessage } from '../types/chat'
import type { ChatTheme } from '../types/theme-system'
import type { MarkdownPalette } from '../utils/markdown-renderer'

enableMapSet()

export interface MessageBlockContext {
  theme: ChatTheme | null
  markdownPalette: MarkdownPalette | null
  messageTree: Map<string, ChatMessage[]> | null
  isWaitingForResponse: boolean
  timerStartTime: number | null
  availableWidth: number
  responseAds: Record<string, AdResponse[]>
}

export interface MessageBlockCallbacks {
  onToggleCollapsed: (id: string) => void
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
  onFeedback: (
    messageId: string,
    options?: {
      category?: FeedbackCategory
      footerMessage?: string
      errors?: Array<{ id: string; message: string }>
    },
  ) => void
  onCloseFeedback: () => void
  onAdClick: (ad: AdResponse) => void
  onAdImpression: (ad: AdResponse) => void
  onResponseAdsNeeded: (messageId: string, count: number) => void
}

interface MessageBlockStoreState {
  context: MessageBlockContext
  callbacks: MessageBlockCallbacks
}

interface MessageBlockStoreActions {
  setContext: (context: Partial<MessageBlockContext>) => void
  setCallbacks: (callbacks: MessageBlockCallbacks) => void
  reset: () => void
}

type MessageBlockStore = MessageBlockStoreState & MessageBlockStoreActions

const noop = () => {}
const noopFeedback: MessageBlockCallbacks['onFeedback'] = () => {}

const initialContext: MessageBlockContext = {
  theme: null,
  markdownPalette: null,
  messageTree: null,
  isWaitingForResponse: false,
  timerStartTime: null,
  availableWidth: 80,
  responseAds: {},
}

const initialCallbacks: MessageBlockCallbacks = {
  onToggleCollapsed: noop,
  onBuildFast: noop,
  onBuildMax: noop,
  onBuildLite: noop,
  onFeedback: noopFeedback,
  onCloseFeedback: noop,
  onAdClick: noop,
  onAdImpression: noop,
  onResponseAdsNeeded: noop,
}

const initialState: MessageBlockStoreState = {
  context: initialContext,
  callbacks: initialCallbacks,
}

export const useMessageBlockStore = create<MessageBlockStore>()(
  immer((set) => ({
    ...initialState,

    setContext: (updates) =>
      set((state) => {
        state.context = { ...state.context, ...updates }
      }),

    setCallbacks: (callbacks) =>
      set((state) => {
        state.callbacks = callbacks
      }),

    reset: () =>
      set((state) => {
        state.context = { ...initialContext }
        state.callbacks = { ...initialCallbacks }
      }),
  })),
)
