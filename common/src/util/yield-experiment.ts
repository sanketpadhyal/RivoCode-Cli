import { fnv1a } from './ad-experiment'

export const CPC_YIELD_EXPERIMENT_BASIS_POINTS = 10_000

export const CPC_YIELD_EXPERIMENT_SALT = 'ads_cpc_yield_2026_08_27'

export type CpcYieldExperimentArm = 'control' | 'shadow' | 'treatment'

export interface CpcYieldExperimentConfig {
  observedBasisPoints: number
  treatmentBasisPoints: number
  permanentControlBasisPoints: number
  cohortSalt?: string
}

export function isValidCpcYieldExperimentConfig(
  config: CpcYieldExperimentConfig | null | undefined,
): boolean {
  if (!config) return false
  const {
    observedBasisPoints,
    treatmentBasisPoints,
    permanentControlBasisPoints,
  } = config
  const basisPoints = [
    observedBasisPoints,
    treatmentBasisPoints,
    permanentControlBasisPoints,
  ]

  if (
    !basisPoints.every(
      (value) =>
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= CPC_YIELD_EXPERIMENT_BASIS_POINTS,
    )
  ) {
    return false
  }

  if (treatmentBasisPoints > observedBasisPoints) return false
  if (
    permanentControlBasisPoints + observedBasisPoints >
    CPC_YIELD_EXPERIMENT_BASIS_POINTS
  ) {
    return false
  }

  return (
    config.cohortSalt === undefined ||
    (typeof config.cohortSalt === 'string' &&
      config.cohortSalt.trim().length > 0)
  )
}

export function cpcYieldExperimentArmForUser(
  userId: string | null | undefined,
  config: CpcYieldExperimentConfig,
): CpcYieldExperimentArm {
  if (!userId || !isValidCpcYieldExperimentConfig(config)) return 'control'

  const salt = config.cohortSalt ?? CPC_YIELD_EXPERIMENT_SALT
  const bucket = fnv1a(`${salt}:${userId}`) % CPC_YIELD_EXPERIMENT_BASIS_POINTS
  const observedStart = config.permanentControlBasisPoints
  const treatmentEnd = observedStart + config.treatmentBasisPoints
  const observedEnd = observedStart + config.observedBasisPoints

  if (bucket < observedStart || bucket >= observedEnd) return 'control'
  return bucket < treatmentEnd ? 'treatment' : 'shadow'
}
