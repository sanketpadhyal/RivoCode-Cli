export const HIGH_CREDITS_THRESHOLD = 1000
export const MEDIUM_CREDITS_THRESHOLD = 500
export const LOW_CREDITS_THRESHOLD = 100

export type BannerColorLevel = 'success' | 'warning' | 'error'

export type CreditTier = 'high' | 'medium' | 'low' | 'out'

export type ThresholdInfo = {
  tier: CreditTier
  colorLevel: BannerColorLevel
  threshold: number
}

export function getThresholdInfo(balance: number | null): ThresholdInfo {
  if (balance === null) {
    return {
      tier: 'medium',
      colorLevel: 'warning',
      threshold: MEDIUM_CREDITS_THRESHOLD,
    }
  }
  if (balance >= HIGH_CREDITS_THRESHOLD) {
    return {
      tier: 'high',
      colorLevel: 'success',
      threshold: HIGH_CREDITS_THRESHOLD,
    }
  }
  if (balance >= MEDIUM_CREDITS_THRESHOLD) {
    return {
      tier: 'medium',
      colorLevel: 'warning',
      threshold: MEDIUM_CREDITS_THRESHOLD,
    }
  }
  if (balance >= LOW_CREDITS_THRESHOLD) {
    return {
      tier: 'low',
      colorLevel: 'warning',
      threshold: LOW_CREDITS_THRESHOLD,
    }
  }
  return { tier: 'out', colorLevel: 'error', threshold: 0 }
}

export function getBannerColorLevel(balance: number | null): BannerColorLevel {
  return getThresholdInfo(balance).colorLevel
}

export function generateLoadingBannerText(sessionCreditsUsed: number): string {
  return `Session usage: ${sessionCreditsUsed.toLocaleString()}. Loading credit balance...`
}

function getThresholdTier(balance: number): number | null {
  if (balance < LOW_CREDITS_THRESHOLD) return LOW_CREDITS_THRESHOLD
  if (balance < MEDIUM_CREDITS_THRESHOLD) return MEDIUM_CREDITS_THRESHOLD
  if (balance < HIGH_CREDITS_THRESHOLD) return HIGH_CREDITS_THRESHOLD
  return null
}

export interface AutoShowDecision {
  shouldShow: boolean
  newWarningThreshold: number | null
}

export function shouldAutoShowBanner(
  isChainInProgress: boolean,
  hasAuthToken: boolean,
  remainingBalance: number | null,
  lastWarnedThreshold: number | null,
  autoTopupEnabled: boolean = false,
): AutoShowDecision {
  if (isChainInProgress) {
    return { shouldShow: false, newWarningThreshold: lastWarnedThreshold }
  }

  if (!hasAuthToken) {
    return { shouldShow: false, newWarningThreshold: lastWarnedThreshold }
  }

  if (remainingBalance === null) {
    return { shouldShow: false, newWarningThreshold: lastWarnedThreshold }
  }

  if (autoTopupEnabled && remainingBalance > 0) {
    return { shouldShow: false, newWarningThreshold: null }
  }

  const currentThreshold = getThresholdTier(remainingBalance)

  if (currentThreshold === null) {
    return { shouldShow: false, newWarningThreshold: null }
  }

  const isNewThreshold =
    lastWarnedThreshold === null || currentThreshold < lastWarnedThreshold

  if (isNewThreshold) {
    return { shouldShow: true, newWarningThreshold: currentThreshold }
  }

  return { shouldShow: false, newWarningThreshold: lastWarnedThreshold }
}
