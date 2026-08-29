
import {
  FREE_MODE_AGENT_MODELS,
  FREEBUFF_ROOT_AGENT_IDS,
} from '../constants/free-agents'
import {
  getFreebuffModel,
  getFreebuffWebModel,
  isFreebuffSessionModelAllowedForAccessTier,
  isFreebuffSessionModelId,
  resolveFreebuffSessionModelForAccessTier,
} from '../constants/freebuff-models'

import type { FreebuffAccessTier } from '../constants/freebuff-models'

export type FreebuffCatalogSource = 'supported' | 'web'

export interface FreebuffOfferSurface {
  surface: string
  accessTier: FreebuffAccessTier
  hasPaidSubscription?: boolean
  offered: readonly string[]
  accepts?: (model: string) => boolean
  rootAgentIdFor?: (model: string) => string | readonly string[]
  catalog?: FreebuffCatalogSource
}

function rootAgentIds(
  surface: FreebuffOfferSurface,
  model: string,
): readonly string[] {
  if (!surface.rootAgentIdFor) return []
  const ids = surface.rootAgentIdFor(model)
  return typeof ids === 'string' ? [ids] : ids
}

function violationsForModel(
  surface: FreebuffOfferSurface,
  model: string,
): string[] {
  const where = `${surface.surface}: ${model}`
  const out: string[] = []

  if (!isFreebuffSessionModelId(model)) {
    return [`${where} is offered but is not a freebuff session model id`]
  }

  const hasPaidSubscription = surface.hasPaidSubscription ?? false
  if (
    !isFreebuffSessionModelAllowedForAccessTier(
      model,
      surface.accessTier,
      hasPaidSubscription,
    )
  ) {
    out.push(
      `${where} is offered to the ${surface.accessTier} tier, which session admission does not allow it on`,
    )
  }

  const resolved = resolveFreebuffSessionModelForAccessTier(
    model,
    surface.accessTier,
    { hasPaidSubscription },
  )
  if (resolved !== model) {
    out.push(
      `${where} is offered but resolveFreebuffSessionModelForAccessTier coerces it to ${resolved}`,
    )
  }

  if (surface.accepts && !surface.accepts(model)) {
    out.push(`${where} is offered but the surface's own validator rejects it`)
  }

  const roots = rootAgentIds(surface, model)
  if (surface.rootAgentIdFor && roots.length === 0) {
    out.push(`${where} is offered but resolves to no free-mode root agent`)
  }
  for (const rootId of roots) {
    const allowed = FREE_MODE_AGENT_MODELS[rootId]
    if (!allowed) {
      out.push(
        `${where} runs under free-mode root ${rootId}, which is not in FREE_MODE_AGENT_MODELS`,
      )
      continue
    }
    if (!allowed.has(model)) {
      out.push(
        `${where} runs under free-mode root ${rootId}, whose allowlist does not include it (free_mode_invalid_agent_model)`,
      )
    }
    if (!FREEBUFF_ROOT_AGENT_IDS.some((id) => id === rootId)) {
      out.push(
        `${where} runs under free-mode root ${rootId}, which is missing from FREEBUFF_ROOT_AGENT_IDS (its subagents would 403)`,
      )
    }
  }

  if (surface.catalog) {
    const row =
      surface.catalog === 'web'
        ? getFreebuffWebModel(model)
        : getFreebuffModel(model)
    if (row.id !== model) {
      out.push(
        `${where} is offered but the ${surface.catalog} catalog has no row for it, so it renders as ${row.id}`,
      )
    }
  }

  return out
}

export function freebuffOfferViolations(
  surface: FreebuffOfferSurface,
): string[] {
  if (surface.offered.length === 0) {
    return [`${surface.surface}: offers no models at all — check the test wiring`]
  }
  return surface.offered.flatMap((model) => violationsForModel(surface, model))
}
