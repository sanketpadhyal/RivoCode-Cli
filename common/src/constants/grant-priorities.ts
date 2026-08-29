import type { GrantType } from '@rivocode/common/types/grant'

export const GRANT_PRIORITIES: Record<GrantType, number> = {
  subscription: 10,
  free: 20,
  referral_legacy: 30,
  ad: 40,
  referral: 50,
  admin: 60,
  organization: 70,
  purchase: 80,
} as const
