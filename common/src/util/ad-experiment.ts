
export const IMPREZIA_EXPERIMENT = 'ads_imprezia_primary_2026_08'

export const IMPREZIA_EXPERIMENT_PERCENT = 10

export const FIRST_PARTY_ROUTING_EXPERIMENT =
  'ads_first_party_before_paid_networks_2026_08'

export const DEFAULT_FIRST_PARTY_PRIMARY_PERCENT = 0
export const DEFAULT_FIRST_PARTY_BACKFILL = false

export type FirstPartyAdRoute =
  | 'paid_network_only'
  | 'first_party_primary'
  | 'gravity_then_first_party'

export interface FirstPartyRoutingConfig {
  primaryPercent: number
  backfill: boolean
}

export function firstPartyPrimaryBasisPoints(primaryPercent: number): number {
  const configuredPercent = Number.isFinite(primaryPercent)
    ? primaryPercent
    : DEFAULT_FIRST_PARTY_PRIMARY_PERCENT
  return Math.round(Math.min(100, Math.max(0, configuredPercent)) * 100)
}

export function firstPartyPrimaryBucket(sampleId: string): number {
  return fnv1a(`${FIRST_PARTY_ROUTING_EXPERIMENT}:${sampleId}`) % 10_000
}

export type AdExperimentArm = 'imprezia_forced' | 'imprezia_first' | 'control'

export function isImpreziaAudienceEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return (
    normalized === 'jahooma@gmail.com' || normalized.endsWith('@imprezia.ai')
  )
}

export function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function adExperimentArmForUser(
  userId: string | null | undefined,
  userEmail?: string | null,
): AdExperimentArm {
  if (!userId) return 'control'

  if (isImpreziaAudienceEmail(userEmail)) return 'imprezia_forced'

  const bucket = fnv1a(`${IMPREZIA_EXPERIMENT}:${userId}`) % 100
  return bucket < IMPREZIA_EXPERIMENT_PERCENT ? 'imprezia_first' : 'control'
}

export function firstPartyAdRouteForUser(
  userId: string | null | undefined,
  config: FirstPartyRoutingConfig,
  sampleId?: string,
): FirstPartyAdRoute {
  if (!userId) return 'paid_network_only'
  const bucket = firstPartyPrimaryBucket(sampleId || userId)
  if (bucket < firstPartyPrimaryBasisPoints(config.primaryPercent)) {
    return 'first_party_primary'
  }
  return config.backfill ? 'gravity_then_first_party' : 'paid_network_only'
}
