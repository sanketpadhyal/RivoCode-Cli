export interface SubscriptionInfo {
  id: string
  status: string
  billingPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  tier: number
  scheduledTier?: number | null
}

export interface SubscriptionRateLimit {
  limited: boolean
  reason?: 'block_exhausted' | 'weekly_limit'
  canStartNewBlock: boolean
  blockUsed?: number
  blockLimit?: number
  blockResetsAt?: string
  weeklyUsed: number
  weeklyLimit: number
  weeklyResetsAt: string
  weeklyPercentUsed: number
}

export interface SubscriptionLimits {
  creditsPerBlock: number
  blockDurationHours: number
  weeklyCreditsLimit: number
}

export interface NoSubscriptionResponse {
  hasSubscription: false
  fallbackToALaCarte: boolean
}

export interface ActiveSubscriptionResponse {
  hasSubscription: true
  displayName: string
  subscription: SubscriptionInfo
  rateLimit: SubscriptionRateLimit
  limits: SubscriptionLimits

  fallbackToALaCarte: boolean
}

export type SubscriptionResponse = NoSubscriptionResponse | ActiveSubscriptionResponse
