
export interface FreebuffLevelTier {
  level: number
  name: string
  trustRequired: number
  trustPerEngagement: number
  freeSessionsPerDay: number
  premiumSessionsPerDay: number
}

export const FREEBUFF_LEVEL_SESSION_CEILING = 7

export const FREEBUFF_LEVELS: readonly FreebuffLevelTier[] = [
  {
    level: 0,
    name: 'Newcomer',
    trustRequired: 0,
    trustPerEngagement: 50,
    freeSessionsPerDay: 3,
    premiumSessionsPerDay: 4,
  },
  {
    level: 1,
    name: 'Contributor',
    trustRequired: 100,
    trustPerEngagement: 55,
    freeSessionsPerDay: 4,
    premiumSessionsPerDay: 4,
  },
  {
    level: 2,
    name: 'Builder',
    trustRequired: 275,
    trustPerEngagement: 60,
    freeSessionsPerDay: 4,
    premiumSessionsPerDay: 5,
  },
  {
    level: 3,
    name: 'Maker',
    trustRequired: 525,
    trustPerEngagement: 70,
    freeSessionsPerDay: 5,
    premiumSessionsPerDay: 5,
  },
  {
    level: 4,
    name: 'Shipper',
    trustRequired: 875,
    trustPerEngagement: 80,
    freeSessionsPerDay: 5,
    premiumSessionsPerDay: 6,
  },
  {
    level: 5,
    name: 'Operator',
    trustRequired: 1_350,
    trustPerEngagement: 95,
    freeSessionsPerDay: 6,
    premiumSessionsPerDay: 6,
  },
  {
    level: 6,
    name: 'Veteran',
    trustRequired: 2_000,
    trustPerEngagement: 110,
    freeSessionsPerDay: 6,
    premiumSessionsPerDay: 6,
  },
  {
    level: 7,
    name: 'Principal',
    trustRequired: 2_900,
    trustPerEngagement: 130,
    freeSessionsPerDay: 7,
    premiumSessionsPerDay: 7,
  },
  {
    level: 8,
    name: 'Staff',
    trustRequired: 4_100,
    trustPerEngagement: 150,
    freeSessionsPerDay: 7,
    premiumSessionsPerDay: 7,
  },
  {
    level: 9,
    name: 'Distinguished',
    trustRequired: 5_700,
    trustPerEngagement: 175,
    freeSessionsPerDay: 7,
    premiumSessionsPerDay: 7,
  },
  {
    level: 10,
    name: 'Architect',
    trustRequired: 7_800,
    trustPerEngagement: 200,
    freeSessionsPerDay: 7,
    premiumSessionsPerDay: 7,
  },
]

export const FREEBUFF_LEVEL_0 = FREEBUFF_LEVELS[0]!
export const FREEBUFF_MAX_LEVEL = FREEBUFF_LEVELS[FREEBUFF_LEVELS.length - 1]!

export function levelForTrust(trust: number): FreebuffLevelTier {
  let held = FREEBUFF_LEVEL_0
  for (const tier of FREEBUFF_LEVELS) {
    if (trust >= tier.trustRequired) held = tier
    else break
  }
  return held
}

export function nextLevelAfter(level: number): FreebuffLevelTier | null {
  return FREEBUFF_LEVELS.find((tier) => tier.level === level + 1) ?? null
}

export interface FreebuffLevelProgress {
  trust: number
  level: number
  levelName: string
  trustPerEngagement: number
  freeSessionsPerDay: number
  premiumSessionsPerDay: number
  levelFloor: number
  nextLevelAt: number | null
  nextLevelName: string | null
  trustToNextLevel: number | null
  progress: number
  engagementsToNextLevel: number | null
}

export function levelProgress(trust: number): FreebuffLevelProgress {
  const tier = levelForTrust(trust)
  const next = nextLevelAfter(tier.level)
  const clamped = Math.max(0, trust)
  const span = next ? next.trustRequired - tier.trustRequired : 0
  const into = clamped - tier.trustRequired
  const remaining = next ? Math.max(0, next.trustRequired - clamped) : null
  return {
    trust: clamped,
    level: tier.level,
    levelName: tier.name,
    trustPerEngagement: tier.trustPerEngagement,
    freeSessionsPerDay: tier.freeSessionsPerDay,
    premiumSessionsPerDay: tier.premiumSessionsPerDay,
    levelFloor: tier.trustRequired,
    nextLevelAt: next?.trustRequired ?? null,
    nextLevelName: next?.name ?? null,
    trustToNextLevel: remaining,
    progress: next && span > 0 ? Math.min(1, Math.max(0, into / span)) : 1,
    engagementsToNextLevel:
      remaining === null ? null : Math.ceil(remaining / tier.trustPerEngagement),
  }
}

export function levelSessionBonus(level: number): {
  free: number
  premium: number
} {
  const tier =
    FREEBUFF_LEVELS.find((entry) => entry.level === level) ?? FREEBUFF_LEVEL_0
  return {
    free: Math.max(0, tier.freeSessionsPerDay - FREEBUFF_LEVEL_0.freeSessionsPerDay),
    premium: Math.max(
      0,
      tier.premiumSessionsPerDay - FREEBUFF_LEVEL_0.premiumSessionsPerDay,
    ),
  }
}

export const FREEBUFF_TRUST_COST_PER_PROMPT = {
  standard: 1,
  glm: 1,
  premium: 1,
  frontier: 1,
} as const

export type FreebuffTrustCostClass = keyof typeof FREEBUFF_TRUST_COST_PER_PROMPT

export const FREEBUFF_TRUST_ALLOW_NEGATIVE = false

export const FREEBUFF_TRUST_MIN_BALANCE = 0

export const FREEBUFF_TRUST_CURRENCY_NAME = 'Trust'

export const FREEBUFF_EARN_PROMPT = `Earn ${FREEBUFF_TRUST_CURRENCY_NAME} · level up for more daily sessions`

export const FREEBUFF_EARN_PROMPT_SHORT = `Earn ${FREEBUFF_TRUST_CURRENCY_NAME} for more sessions`

export const FREEBUFF_EARN_PATH = '/earn/trust'

export const FREEBUFF_LEVEL_BLURBS: Record<number, string> = {
  0: 'Engage with a promoted post to earn your first Trust. Two engagements gets you to level 1.',
  1: 'You are on the ladder. Each level you hold adds sessions for as long as you hold it.',
  2: 'A fifth premium session a day. Keep engaging to hold your level as you work.',
  3: 'Solid standing. Your Trust now buys noticeably more per engagement.',
  4: 'Six premium sessions a day, and every engagement is worth more than it was.',
  5: 'Operator tier: the free limits here are what other products charge for.',
  6: 'Veteran standing. Every engagement is worth more than double a newcomer’s.',
  7: 'Principal — the session ceiling, seven a day on both pools. From here Trust is about HOLDING it.',
  8: 'Staff. Engagements pay three times what they did at the bottom, so the daily drain barely registers.',
  9: 'Distinguished. Very few accounts hold this level for long.',
  10: 'Architect — the top of the ladder. Nothing above this, and nothing to prove.',
}

export function levelBlurb(level: number): string {
  return FREEBUFF_LEVEL_BLURBS[level] ?? FREEBUFF_LEVEL_BLURBS[10]!
}
