import {
  DEFAULT_FREEBUFF_MODEL_ID,
  getFreebuffModelDefaultEffort,
  getFreebuffModelEfforts,
  resolveAvailableFreebuffModel,
  resolveSupportedFreebuffModel,
} from '@rivocode/common/constants/freebuff-models'
import { create } from 'zustand'

import {
  loadFreebuffModelPreference,
  loadFreebuffReasoningEfforts,
  saveFreebuffReasoningEffort,
} from '../utils/settings'

import type { ReasoningEffort } from '@rivocode/common/constants/reasoning-effort'

interface FreebuffModelStore {
  selectedModel: string
  setSelectedModel: (model: string) => void
  reasoningEffortByModel: Record<string, ReasoningEffort>
  setReasoningEffort: (
    model: string,
    effort: ReasoningEffort | undefined,
  ) => void
}

export const useFreebuffModelStore = create<FreebuffModelStore>((set) => ({
  selectedModel: resolveAvailableFreebuffModel(
    loadFreebuffModelPreference() ?? DEFAULT_FREEBUFF_MODEL_ID,
  ),
  setSelectedModel: (model) =>
    set({ selectedModel: resolveSupportedFreebuffModel(model) }),
  reasoningEffortByModel: loadFreebuffReasoningEfforts(),
  setReasoningEffort: (model, effort) => {
    saveFreebuffReasoningEffort(model, effort)
    set((state) => {
      const next = { ...state.reasoningEffortByModel }
      if (effort === undefined) {
        delete next[model]
      } else {
        next[model] = effort
      }
      return { reasoningEffortByModel: next }
    })
  },
}))

export function getSelectedFreebuffModel(): string {
  return useFreebuffModelStore.getState().selectedModel
}

export function getFreebuffReasoningEffortForModel(
  model: string,
): ReasoningEffort | null {
  const saved = useFreebuffModelStore.getState().reasoningEffortByModel[model]
  if (!saved) return null
  return getFreebuffModelEfforts(model)?.includes(saved) ? saved : null
}

export function getEffectiveFreebuffReasoningEffort(
  model: string,
): ReasoningEffort | null {
  return (
    getFreebuffReasoningEffortForModel(model) ??
    getFreebuffModelDefaultEffort(model)
  )
}

export function getSelectedFreebuffReasoningEffort(): ReasoningEffort | null {
  return getFreebuffReasoningEffortForModel(getSelectedFreebuffModel())
}
