import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface QueuePanelState {
  queuePanelOpen: boolean
  openQueuePanel: () => void
  closeQueuePanel: () => void
}

export const useQueuePanelStore = create<QueuePanelState>()(
  immer((set) => ({
    queuePanelOpen: false,
    openQueuePanel: () => {
      set((state) => {
        state.queuePanelOpen = true
      })
    },
    closeQueuePanel: () => {
      set((state) => {
        state.queuePanelOpen = false
      })
    },
  })),
)
