export type GrantType =
  | 'free'
  | 'referral'
  | 'referral_legacy'
  | 'subscription'
  | 'purchase'
  | 'admin'
  | 'organization'
  | 'ad'

export const GrantTypeValues = [
  'free',
  'referral',
  'referral_legacy',
  'subscription',
  'purchase',
  'admin',
  'organization',
  'ad',
] as const
