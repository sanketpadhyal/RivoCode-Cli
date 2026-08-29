
export type OnboardingRequirementInput = {
  enabled: boolean
  complete: boolean
}

export type OnboardingRequirement =
  | { required: false; reason: 'gate_disabled' | 'already_complete' }
  | { required: true }

export function evaluateOnboardingRequirement(
  input: OnboardingRequirementInput,
): OnboardingRequirement {
  if (!input.enabled) return { required: false, reason: 'gate_disabled' }
  if (input.complete) return { required: false, reason: 'already_complete' }
  return { required: true }
}

export function parseOnboardingEnabled(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim().toLowerCase()
  return trimmed === 'on' || trimmed === 'true' || trimmed === '1'
}
