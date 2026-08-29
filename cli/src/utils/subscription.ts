import type { SubscriptionResponse } from '../hooks/use-subscription-query'

export function getBlockPercentRemaining(
  subscriptionData: SubscriptionResponse | null | undefined,
): number | null {
  if (!subscriptionData?.hasSubscription) return null
  const rateLimit = subscriptionData.rateLimit
  if (!rateLimit?.blockLimit || rateLimit.blockUsed == null) return null
  return Math.round(
    ((rateLimit.blockLimit - rateLimit.blockUsed) / rateLimit.blockLimit) * 100,
  )
}

export function isCoveredBySubscription(
  subscriptionData: SubscriptionResponse | null | undefined,
): boolean {
  if (!subscriptionData?.hasSubscription) return false
  const rateLimit = subscriptionData.rateLimit
  if (rateLimit?.limited) return false
  const blockPercentRemaining = getBlockPercentRemaining(subscriptionData)
  return blockPercentRemaining != null && blockPercentRemaining > 0
}
