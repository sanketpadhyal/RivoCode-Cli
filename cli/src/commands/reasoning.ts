import {
  getFreebuffModel,
  getFreebuffModelDefaultEffort,
  getFreebuffModelEfforts,
} from '@codebuff/common/constants/freebuff-models'
import { isReasoningEffort } from '@codebuff/common/constants/reasoning-effort'

import {
  getFreebuffReasoningEffortForModel,
  getSelectedFreebuffModel,
  useFreebuffModelStore,
} from '../state/freebuff-model-store'

import type { ReasoningEffort } from '@codebuff/common/constants/reasoning-effort'

const CLEAR_WORDS = new Set(['default', 'auto', 'reset', 'clear', 'none'])

function displayName(model: string): string {
  return getFreebuffModel(model)?.displayName ?? model
}

export function handleReasoningCommand(args: string): { message: string } {
  const model = getSelectedFreebuffModel()
  const label = displayName(model)
  const efforts = getFreebuffModelEfforts(model)

  if (!efforts) {
    return {
      message: `${label} has no reasoning levels to adjust — it runs at the provider's own setting. Switch models with /end-session to pick one that does.`,
    }
  }

  const modelDefault = getFreebuffModelDefaultEffort(model)
  const override = getFreebuffReasoningEffortForModel(model)
  const ladder = efforts.join(', ')

  const requested = args.trim().toLowerCase()
  if (!requested) {
    const current = override ?? modelDefault
    const suffix = override ? '' : ' (model default)'
    return {
      message: [
        `Reasoning for ${label}: ${current}${suffix}`,
        `Available: ${ladder}`,
        `Set it with /reasoning <level>, or /reasoning default to go back to ${modelDefault}.`,
      ].join('\n'),
    }
  }

  if (CLEAR_WORDS.has(requested)) {
    useFreebuffModelStore.getState().setReasoningEffort(model, undefined)
    return {
      message: `Reasoning for ${label} back to the model default (${modelDefault}).`,
    }
  }

  if (!isReasoningEffort(requested) || !efforts.includes(requested)) {
    return {
      message: `"${args.trim()}" is not a reasoning level for ${label}. Available: ${ladder}.`,
    }
  }

  const effort: ReasoningEffort = requested
  useFreebuffModelStore.getState().setReasoningEffort(model, effort)
  return {
    message: `Reasoning for ${label} set to ${effort}. Applies from your next message.`,
  }
}
