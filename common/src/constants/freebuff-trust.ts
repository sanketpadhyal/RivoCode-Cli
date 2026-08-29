
import type { FreebuffAccessTier } from './freebuff-models'

export const FREEBUFF_TRUST_LEVELS = [
  'new',
  'verified',
  'established',
  'core',
] as const

export type FreebuffTrustLevel = (typeof FREEBUFF_TRUST_LEVELS)[number]

export const FREEBUFF_TRUST_MIN_LEVEL: FreebuffTrustLevel = 'new'

export const FREEBUFF_TRUST_FALLBACK_LEVEL: FreebuffTrustLevel = 'established'

export function isAtLeastTrustLevel(
  level: FreebuffTrustLevel,
  minimum: FreebuffTrustLevel,
): boolean {
  return (
    FREEBUFF_TRUST_LEVELS.indexOf(level) >=
    FREEBUFF_TRUST_LEVELS.indexOf(minimum)
  )
}

function lowerOf(
  a: FreebuffTrustLevel,
  b: FreebuffTrustLevel,
): FreebuffTrustLevel {
  return isAtLeastTrustLevel(a, b) ? b : a
}

export const FREEBUFF_TRUST_LEVEL_LABELS: Record<FreebuffTrustLevel, string> = {
  new: 'Getting started',
  verified: 'Verified',
  established: 'Established',
  core: 'Core member',
}

export const FREEBUFF_TRUST_LEVEL_BLURBS: Record<FreebuffTrustLevel, string> = {
  new: 'Welcome! Your account is brand new, so limits start small. They open up quickly — the steps below take a few minutes.',
  verified:
    'Your account is verified. You have solid daily limits, and a bit of history unlocks the next level.',
  established:
    'You are an established Freebuff user with generous limits on messages, spend and premium sessions.',
  core: 'You are a core member. You get the highest free limits we offer, in every region.',
}

export interface FreebuffTrustLimits {
  userMessagesPerDay: number
  messagesPer5Hours: number
  messagesPerDay: number
  dailySpendUsd: number
  premiumSessionsPerDay: number
}

export const FREEBUFF_TRUST_LIMITS: Record<
  FreebuffAccessTier,
  Record<FreebuffTrustLevel, FreebuffTrustLimits>
> = {
  full: {
    new: {
      userMessagesPerDay: 120,
      messagesPer5Hours: 800,
      messagesPerDay: 1_200,
      dailySpendUsd: 8,
      premiumSessionsPerDay: 2,
    },
    verified: {
      userMessagesPerDay: 300,
      messagesPer5Hours: 1_800,
      messagesPerDay: 3_000,
      dailySpendUsd: 20,
      premiumSessionsPerDay: 3,
    },
    established: {
      userMessagesPerDay: 600,
      messagesPer5Hours: 3_000,
      messagesPerDay: 5_000,
      dailySpendUsd: 50,
      premiumSessionsPerDay: 4,
    },
    core: {
      userMessagesPerDay: 1_000,
      messagesPer5Hours: 5_000,
      messagesPerDay: 8_000,
      dailySpendUsd: 90,
      premiumSessionsPerDay: 5,
    },
  },
  limited: {
    new: {
      userMessagesPerDay: 40,
      messagesPer5Hours: 400,
      messagesPerDay: 500,
      dailySpendUsd: 3,
      premiumSessionsPerDay: 0,
    },
    verified: {
      userMessagesPerDay: 120,
      messagesPer5Hours: 1_000,
      messagesPerDay: 1_500,
      dailySpendUsd: 10,
      premiumSessionsPerDay: 0,
    },
    established: {
      userMessagesPerDay: 350,
      messagesPer5Hours: 2_000,
      messagesPerDay: 3_000,
      dailySpendUsd: 25,
      premiumSessionsPerDay: 0,
    },
    core: {
      userMessagesPerDay: 700,
      messagesPer5Hours: 3_500,
      messagesPerDay: 5_500,
      dailySpendUsd: 55,
      premiumSessionsPerDay: 0,
    },
  },
}

export function freebuffTrustLimits(
  accessTier: FreebuffAccessTier,
  level: FreebuffTrustLevel,
): FreebuffTrustLimits {
  return FREEBUFF_TRUST_LIMITS[accessTier][level]
}

export interface FreebuffTrustSignals {
  accountCreatedAt: Date | null
  githubAccountCreatedAt: Date | null
  githubOldestRepoCreatedAt: Date | null
  githubPublicRepos: number | null
  githubFollowers: number | null
  githubTwoFactorEnabled: boolean | null
  activeDays: number
  approvedBounties: number
  qualifiedReferrals: number
  hasPaid: boolean
  signupPrivacySignals: readonly string[] | null
  signupIpSource: string | null
  signupPrefixAccountCount: number | null
  mailboxAccountCount: number | null
  hasUnreversedBanEvent: boolean
  privacyFlaggedAt: Date | null
  privacyCorroboratedAt: Date | null
  thirdPartyClientAt: Date | null
  currentRiskScore: number | null
}

export interface FreebuffTrustFactor {
  id: string
  label: string
  points: number
}

export interface FreebuffTrustNextStep {
  id: string
  label: string
  detail: string
  points: number
  href?: string
}

export interface FreebuffTrustAssessment {
  level: FreebuffTrustLevel
  score: number
  uncappedLevel: FreebuffTrustLevel
  cappedBy: string | null
  factors: FreebuffTrustFactor[]
  nextSteps: FreebuffTrustNextStep[]
}

export const FREEBUFF_TRUST_EARNED = {
  BOUNTY_POINTS: 5,
  BOUNTY_CAP: 6,
  REFERRAL_POINTS: 3,
  REFERRAL_CAP: 10,
} as const

const MAX_BOUNTY_POINTS =
  FREEBUFF_TRUST_EARNED.BOUNTY_POINTS * FREEBUFF_TRUST_EARNED.BOUNTY_CAP
const MAX_REFERRAL_POINTS =
  FREEBUFF_TRUST_EARNED.REFERRAL_POINTS * FREEBUFF_TRUST_EARNED.REFERRAL_CAP

export const FREEBUFF_TRUST_THRESHOLDS: Record<
  Exclude<FreebuffTrustLevel, 'new'>,
  number
> = {
  verified: 25,
  established: 50,
  core: 75,
}

const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

function ageMs(date: Date | null, now: Date): number | null {
  if (!date) return null
  const age = now.getTime() - date.getTime()
  return age >= 0 ? age : 0
}

function levelForScore(score: number): FreebuffTrustLevel {
  if (score >= FREEBUFF_TRUST_THRESHOLDS.core) return 'core'
  if (score >= FREEBUFF_TRUST_THRESHOLDS.established) return 'established'
  if (score >= FREEBUFF_TRUST_THRESHOLDS.verified) return 'verified'
  return 'new'
}

const PRIVACY_EGRESS_SIGNALS = new Set(['vpn', 'proxy', 'tor', 'hosting'])

function hasPrivacyEgressAtSignup(
  signals: readonly string[] | null,
): boolean | null {
  if (signals === null) return null
  return signals.some((signal) =>
    PRIVACY_EGRESS_SIGNALS.has(signal.trim().toLowerCase()),
  )
}

export function assessFreebuffTrust(
  signals: FreebuffTrustSignals,
  now: Date = new Date(),
): FreebuffTrustAssessment {
  const factors: FreebuffTrustFactor[] = []
  const nextSteps: FreebuffTrustNextStep[] = []

  const add = (id: string, label: string, points: number) => {
    if (points === 0) return
    factors.push({ id, label, points })
  }
  const step = (s: FreebuffTrustNextStep) => nextSteps.push(s)

  const githubAge = ageMs(signals.githubAccountCreatedAt, now)
  if (githubAge === null) {
    step({
      id: 'connect_github',
      label: 'Connect your GitHub account',
      detail:
        'Linking a GitHub account you have had for a while is the fastest way to raise your limits. We read the account and oldest-repo creation dates, which GitHub sets and nobody can backdate.',
      points: 30,
      href: '/web/settings',
    })
  } else {
    add('github_linked', 'GitHub account connected', 10)
    if (githubAge >= 3 * YEAR_MS) {
      add('github_age', 'GitHub account over 3 years old', 20)
    } else if (githubAge >= YEAR_MS) {
      add('github_age', 'GitHub account over a year old', 15)
    } else if (githubAge >= 6 * MONTH_MS) {
      add('github_age', 'GitHub account over 6 months old', 10)
    } else {
      step({
        id: 'github_age',
        label: 'Your GitHub account is still new',
        detail:
          'Account age is worth up to 20 points and grows on its own — nothing to do here but keep the same account connected.',
        points: 10,
      })
    }

    const repoAge = ageMs(signals.githubOldestRepoCreatedAt, now)
    if (repoAge !== null && repoAge >= 6 * MONTH_MS) {
      add('github_repo', 'Public repo over 6 months old', 10)
    }
    if ((signals.githubPublicRepos ?? 0) >= 3) {
      add('github_repos', '3 or more public repos', 5)
    }
    if ((signals.githubFollowers ?? 0) >= 5) {
      add('github_followers', '5 or more GitHub followers', 5)
    }
    if (signals.githubTwoFactorEnabled) {
      add('github_2fa', 'Two-factor auth enabled on GitHub', 5)
    } else if (signals.githubTwoFactorEnabled === false) {
      step({
        id: 'github_2fa',
        label: 'Turn on two-factor auth for GitHub',
        detail:
          'Worth 5 points, and it protects the account your Freebuff limits now depend on.',
        points: 5,
        href: 'https://github.com/settings/security',
      })
    }
  }

  const accountAge = ageMs(signals.accountCreatedAt, now)
  if (accountAge !== null) {
    if (accountAge >= 90 * DAY_MS) {
      add('account_age', 'Freebuff account over 90 days old', 15)
    } else if (accountAge >= 30 * DAY_MS) {
      add('account_age', 'Freebuff account over 30 days old', 10)
    } else if (accountAge >= 7 * DAY_MS) {
      add('account_age', 'Freebuff account over 7 days old', 5)
    }
  }

  if (signals.activeDays >= 30) {
    add('active_days', 'Used Freebuff on 30+ days', 10)
  } else if (signals.activeDays >= 7) {
    add('active_days', 'Used Freebuff on 7+ days', 5)
  }

  const bountyPoints =
    Math.min(signals.approvedBounties, FREEBUFF_TRUST_EARNED.BOUNTY_CAP) *
    FREEBUFF_TRUST_EARNED.BOUNTY_POINTS
  if (bountyPoints > 0) {
    add(
      'bounties',
      `${signals.approvedBounties} approved ${signals.approvedBounties === 1 ? 'bounty' : 'bounties'}`,
      bountyPoints,
    )
  }
  if (bountyPoints < MAX_BOUNTY_POINTS) {
    step({
      id: 'bounties',
      label: 'Complete a bounty',
      detail: `Approved bounties are worth ${FREEBUFF_TRUST_EARNED.BOUNTY_POINTS} points each, up to ${MAX_BOUNTY_POINTS}. They are reviewed, they work from any country, and they pay session grants on top.`,
      points: MAX_BOUNTY_POINTS - bountyPoints,
      href: '/web/earn',
    })
  }

  const referralPoints =
    Math.min(signals.qualifiedReferrals, FREEBUFF_TRUST_EARNED.REFERRAL_CAP) *
    FREEBUFF_TRUST_EARNED.REFERRAL_POINTS
  if (referralPoints > 0) {
    add(
      'referrals',
      `${signals.qualifiedReferrals} qualified ${signals.qualifiedReferrals === 1 ? 'referral' : 'referrals'}`,
      referralPoints,
    )
  }
  if (referralPoints < MAX_REFERRAL_POINTS) {
    step({
      id: 'referrals',
      label: 'Invite other developers',
      detail: `Each friend who signs up with a real GitHub account and uses Freebuff is worth ${FREEBUFF_TRUST_EARNED.REFERRAL_POINTS} points, up to ${MAX_REFERRAL_POINTS} — plus the referral rewards themselves.`,
      points: MAX_REFERRAL_POINTS - referralPoints,
      href: '/web/earn',
    })
  }

  if (signals.hasPaid) {
    add('paid', 'Supported Freebuff with a purchase', 25)
  }

  const signupPrivacy = hasPrivacyEgressAtSignup(signals.signupPrivacySignals)
  if (signupPrivacy === false) {
    add('clean_signup', 'Signed up from a residential connection', 5)
  }
  if (
    signals.signupIpSource === 'edge_secret' ||
    signals.signupIpSource === 'cloudflare'
  ) {
    add('verified_signup_ip', 'Verified network at signup', 5)
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      factors.reduce((sum, factor) => sum + factor.points, 0),
    ),
  )
  const uncappedLevel = levelForScore(score)

  let level = uncappedLevel
  let cappedBy: string | null = null
  const cap = (limit: FreebuffTrustLevel, reason: string) => {
    const capped = lowerOf(level, limit)
    if (capped !== level) {
      level = capped
      cappedBy = reason
    }
  }

  if (signals.hasUnreversedBanEvent) {
    cap('verified', 'past_enforcement')
  }

  if (signupPrivacy === true) {
    cap('established', 'signup_privacy_egress')
  }

  if (signals.currentRiskScore !== null && signals.currentRiskScore >= 75) {
    cap('verified', 'anonymous_network')
  }

  if (signals.privacyCorroboratedAt !== null) {
    cap('verified', 'past_corroborated_egress')
  }
  if (signals.thirdPartyClientAt !== null) {
    cap('verified', 'third_party_client')
  }
  if (signals.privacyFlaggedAt !== null) {
    cap('established', 'past_privacy_egress')
  }

  if ((signals.signupPrefixAccountCount ?? 1) >= 8) {
    cap('established', 'shared_signup_network')
  }
  if ((signals.mailboxAccountCount ?? 1) >= 3) {
    cap('verified', 'shared_mailbox')
  }

  const earnedSteps = nextSteps.sort((a, b) => b.points - a.points)
  const actionableSteps =
    cappedBy === null
      ? earnedSteps
      : [
          {
            id: `cap_${cappedBy}`,
            label: CAP_REMEDIES[cappedBy]?.label ?? 'Your level is limited',
            detail:
              CAP_REMEDIES[cappedBy]?.detail ??
              'Something about this account limits how high your level can go.',
            points: 0,
          },
          ...earnedSteps,
        ]

  return {
    level,
    score,
    uncappedLevel,
    cappedBy,
    factors: factors.sort((a, b) => b.points - a.points),
    nextSteps: actionableSteps,
  }
}

const CAP_REMEDIES: Record<string, { label: string; detail: string }> = {
  past_corroborated_egress: {
    label: 'This account has used an anonymizing network',
    detail:
      'Requests from this account were confirmed to come through a VPN, proxy or similar exit. That history caps this account at Verified. Everything else still counts toward your level.',
  },
  past_privacy_egress: {
    label: 'This account has connected over a flagged network',
    detail:
      'A connection from this account looked like an anonymizing network. That caps this account at Established. If this seems wrong — some office and university networks are misread — contact support.',
  },
  third_party_client: {
    label: 'A non-Freebuff client has used this account',
    detail:
      'Requests from this account carried a client we do not ship. That caps this account at Verified. Only official Freebuff apps are supported on free mode.',
  },
  anonymous_network: {
    label: 'Turn off your VPN or proxy',
    detail:
      'We cannot tell where requests from a VPN, proxy or Tor exit node come from, so those connections are capped at Verified no matter how much you have earned. Reconnect from your normal network and your level updates within a few minutes.',
  },
  signup_privacy_egress: {
    label: 'You signed up over a VPN or proxy',
    detail:
      'That caps this account at Established. Everything else still counts, and the cap applies to this account only — it is not a strike against you.',
  },
  shared_signup_network: {
    label: 'Many accounts signed up from your network',
    detail:
      'Shared offices, campuses and carrier NATs all look like this, so it caps rather than blocks. Approved bounties and referrals still raise your limits within the cap.',
  },
  shared_mailbox: {
    label: 'Several accounts share your email address',
    detail:
      'Address variations that reach one inbox (dots, or anything after a +) count as one mailbox. Using a single account raises your level.',
  },
  past_enforcement: {
    label: 'This account was actioned in the past',
    detail:
      'Your access is fully restored, but the level is capped at Verified. Contact support if you think that is wrong.',
  },
}

export interface FreebuffStandingHighlight {
  label: string
  value: string
}

const LIMIT_PHRASES: Record<
  FreebuffTrustLevel,
  { prompts: string; depth: string; premium: string }
> = {
  new: {
    prompts: 'Enough to get a project started',
    depth: 'Focused, shorter agent runs',
    premium: 'Occasional access',
  },
  verified: {
    prompts: 'Comfortable for everyday work',
    depth: 'Full agent runs',
    premium: 'Regular access',
  },
  established: {
    prompts: 'Comfortable on heavy days',
    depth: 'Long runs with plenty of subagents',
    premium: 'Generous access',
  },
  core: {
    prompts: 'The most we offer',
    depth: 'The most we offer',
    premium: 'The most we offer',
  },
}

export function freebuffStandingHighlights(
  accessTier: FreebuffAccessTier,
  level: FreebuffTrustLevel,
): FreebuffStandingHighlight[] {
  const phrases = LIMIT_PHRASES[level]
  return [
    { label: 'Prompts a day', value: phrases.prompts },
    { label: 'Work per prompt', value: phrases.depth },
    {
      label: 'Premium models',
      value:
        freebuffTrustLimits(accessTier, level).premiumSessionsPerDay > 0
          ? phrases.premium
          : 'Not available in your region yet',
    },
  ]
}

export interface FreebuffStandingInfo {
  level: FreebuffTrustLevel
  label: string
  blurb: string
  score: number
  nextLevelAt: number | null
  nextLevel: FreebuffTrustLevel | null
  cappedBy: string | null
  cappedReason: string | null
  factors: FreebuffTrustFactor[]
  nextSteps: FreebuffTrustNextStep[]
  accessTier: FreebuffAccessTier
  highlights: FreebuffStandingHighlight[]
}

export function toFreebuffStandingInfo(
  assessment: FreebuffTrustAssessment,
  accessTier: FreebuffAccessTier,
): FreebuffStandingInfo {
  const index = FREEBUFF_TRUST_LEVELS.indexOf(assessment.level)
  const nextLevel = FREEBUFF_TRUST_LEVELS[index + 1] ?? null
  return {
    level: assessment.level,
    label: FREEBUFF_TRUST_LEVEL_LABELS[assessment.level],
    blurb: FREEBUFF_TRUST_LEVEL_BLURBS[assessment.level],
    score: assessment.score,
    nextLevel,
    nextLevelAt:
      nextLevel && nextLevel !== 'new'
        ? FREEBUFF_TRUST_THRESHOLDS[nextLevel]
        : null,
    cappedBy: assessment.cappedBy,
    cappedReason: assessment.cappedBy
      ? (CAP_REMEDIES[assessment.cappedBy]?.detail ?? null)
      : null,
    factors: assessment.factors,
    nextSteps: assessment.nextSteps,
    accessTier,
    highlights: freebuffStandingHighlights(accessTier, assessment.level),
  }
}
