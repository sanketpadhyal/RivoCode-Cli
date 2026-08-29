import { getReferralInfo } from '@rivocode/common/types/freebuff-session'

import type { FreebuffAccessTier } from '@rivocode/common/constants/freebuff-models'
import type { FreebuffReferralInfo } from '@rivocode/common/types/freebuff-session'
import type { FreebuffSessionResponse } from '../types/freebuff-session'

let referralByAccessTier: Partial<
  Record<FreebuffAccessTier, FreebuffReferralInfo>
> = {}

export function rememberReferral(session: FreebuffSessionResponse | null): void {
  const referral = getReferralInfo(session)
  const accessTier =
    session && 'accessTier' in session ? session.accessTier : undefined
  if (!accessTier) return
  if (referral) {
    referralByAccessTier[accessTier] = referral
  } else if (session?.status === 'none') {
    delete referralByAccessTier[accessTier]
  }
}

export function getCachedReferral(
  accessTier: FreebuffAccessTier | undefined,
): FreebuffReferralInfo | undefined {
  return accessTier ? referralByAccessTier[accessTier] : undefined
}

export function clearReferralCache(): void {
  referralByAccessTier = {}
}
