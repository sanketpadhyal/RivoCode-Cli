
export const MIN_GITHUB_ACCOUNT_AGE_MONTHS = 4

export const MIN_GITHUB_ACCOUNT_AGE_MONTHS_GLM = 12

export const MIN_GITHUB_ACCOUNT_AGE_MONTHS_REFERRAL = 4

export const REFERRAL_CLI_DAILY_SESSION_BONUS_CAP = 3

export const FREEBUFF_WEB_REFERRAL_LIMIT = 20

export const REFERRAL_SIGNUP_WINDOW_DAYS = 30

export const FREEBUFF_REFERRAL_SIGNUP_LIMIT = 100

export function isGithubAccountOldEnoughForReferral(
  githubCreatedAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  minMonths: number = MIN_GITHUB_ACCOUNT_AGE_MONTHS,
): boolean {
  if (githubCreatedAtMs == null || !Number.isFinite(githubCreatedAtMs)) {
    return false
  }
  const threshold = new Date(githubCreatedAtMs)
  threshold.setUTCMonth(threshold.getUTCMonth() + minMonths)
  return nowMs >= threshold.getTime()
}
