
export const AD_RESET_TIMEZONE = 'America/Los_Angeles'

export const AD_ENGAGEMENT_PRICE_CENTS = 50

export const AD_MIN_DAILY_BUDGET_CENTS = 1_000

export const AD_DAILY_BUDGET_STEP_CENTS = 500

export const AD_MAX_DAILY_BUDGET_CENTS = 100_000

export function engagementsForDailyBudget(cents: number): number {
  return Math.floor(cents / AD_ENGAGEMENT_PRICE_CENTS)
}

export interface BudgetGlide {
  startCents: number
  targetCents: number
  days: number
  jitterBps: number
  curve: 'linear' | 'exponential'
  startedOn: string
}

function glideHash(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d) >>> 0
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b) >>> 0
  hash ^= hash >>> 16
  return hash >>> 0
}

function daysBetweenPacificDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

export function glidedDailyBudgetCents(params: {
  glide: BudgetGlide
  seed: string
  today: string
}): number {
  const { glide, seed, today } = params
  const low = Math.min(glide.startCents, glide.targetCents)
  const high = Math.max(glide.startCents, glide.targetCents)

  const elapsed = daysBetweenPacificDays(glide.startedOn, today)
  if (elapsed <= 0) return normalizeDailyBudgetCents(glide.startCents)
  if (glide.days <= 0 || elapsed >= glide.days) {
    return normalizeDailyBudgetCents(glide.targetCents)
  }

  const progress = elapsed / glide.days
  const straight =
    glide.curve === 'exponential' && glide.startCents > 0 && glide.targetCents > 0
      ? glide.startCents *
        Math.pow(glide.targetCents / glide.startCents, progress)
      : glide.startCents + (glide.targetCents - glide.startCents) * progress

  const unit = (glideHash(`${seed}:${today}`) / 0xffffffff) * 2 - 1
  const jittered = straight * (1 + (unit * glide.jitterBps) / 10_000)

  return normalizeDailyBudgetCents(Math.min(high, Math.max(low, jittered)))
}

export function effectiveDailyBudgetCents(params: {
  dailyBudgetCents: number
  glide: BudgetGlide | null
  billedBySubscription: boolean
  seed: string
  today: string
}): number {
  if (!params.glide || params.billedBySubscription) {
    return params.dailyBudgetCents
  }
  return glidedDailyBudgetCents({
    glide: params.glide,
    seed: params.seed,
    today: params.today,
  })
}

export const DELIVERY_PACE_WINDOW_MINUTES = 60

export function deliveryWindowLimit(params: {
  capEngagements: number
  seed: string
  windowKey: string
  jitterBps: number
}): number {
  const cap = Math.max(0, Math.floor(params.capEngagements))
  if (cap === 0) return 0
  const windows = 1_440 / DELIVERY_PACE_WINDOW_MINUTES
  const base = cap / windows
  const unit = (glideHash(`${params.seed}:${params.windowKey}`) / 0xffffffff) * 2 - 1
  const jittered = base * (1 + (unit * params.jitterBps) / 10_000)
  return Math.max(1, Math.min(cap, Math.round(jittered)))
}

export function deliverySpacingSeconds(params: {
  capEngagements: number
  seed: string
  windowKey: string
  jitterBps: number
}): number {
  const cap = Math.max(0, Math.floor(params.capEngagements))
  if (cap <= 0) return 0
  const even = 86_400 / cap
  const unit =
    (glideHash(`gap:${params.seed}:${params.windowKey}`) / 0xffffffff) * 2 - 1
  const jittered = even * (1 + (unit * params.jitterBps) / 10_000)
  return Math.min(3_600, Math.max(15, Math.round(jittered)))
}

export function normalizeDailyBudgetCents(cents: number): number {
  const stepped =
    Math.round(cents / AD_DAILY_BUDGET_STEP_CENTS) * AD_DAILY_BUDGET_STEP_CENTS
  return Math.min(
    AD_MAX_DAILY_BUDGET_CENTS,
    Math.max(AD_MIN_DAILY_BUDGET_CENTS, stepped),
  )
}

export function isValidDailyBudgetCents(cents: number): boolean {
  return (
    Number.isInteger(cents) &&
    cents >= AD_MIN_DAILY_BUDGET_CENTS &&
    cents <= AD_MAX_DAILY_BUDGET_CENTS &&
    cents % AD_DAILY_BUDGET_STEP_CENTS === 0
  )
}

export const AD_PLATFORMS = ['twitter', 'linkedin', 'reddit', 'github'] as const
export type AdPlatform = (typeof AD_PLATFORMS)[number]

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  github: 'GitHub',
}

export const AD_PLATFORM_ACTIONS: Record<AdPlatform, readonly string[]> = {
  twitter: ['Like the post', 'Reply with a real comment', 'Repost it'],
  linkedin: ['React to the post', 'Comment something real', 'Repost it'],
  reddit: ['Upvote the post', 'Leave a genuine comment'],
  github: ['Star the repository'],
}

export function platformRequiresComment(platform: AdPlatform): boolean {
  return platform !== 'github'
}

export const AD_PLATFORM_HOSTS: Record<AdPlatform, readonly string[]> = {
  twitter: ['twitter.com', 'x.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
  reddit: ['reddit.com', 'redd.it'],
  github: ['github.com'],
}

export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export const isServableLandingUrl = (raw: string): boolean => {
  const normalized = normalizeUrlInput(raw)
  if (!normalized) return false
  try {
    const u = new URL(normalized)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function platformForUrl(rawUrl: string): AdPlatform | null {
  let host: string
  try {
    const url = new URL(normalizeUrlInput(rawUrl))
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    host = url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  for (const platform of AD_PLATFORMS) {
    for (const allowed of AD_PLATFORM_HOSTS[platform]) {
      if (host === allowed || host.endsWith(`.${allowed}`)) return platform
    }
  }
  return null
}

export const AD_PRICING_ENABLED = true

export const AD_CAMPAIGN_REVIEW_ENABLED = false

export function resolveCampaignEndDate(
  requested: Date | null | undefined,
): Date | null {
  return requested ?? null
}

export const AD_MAX_POSTS_PER_CAMPAIGN = 1
export const AD_MAX_CAMPAIGNS_PER_ADVERTISER = 25
export const AD_MAX_COMMENT_EXAMPLES = 12
export const AD_MAX_COMMENT_URL_CHARS = 2_000

export const AD_EVIDENCE_ATTESTATION =
  'I confirm I liked, reposted and commented on this post myself, and that this is genuine proof of it. I understand it will be verified, and that falsified evidence will result in my account being banned.'

export const AD_EVIDENCE_ATTESTATION_GITHUB =
  'I confirm I starred this repository myself, and that this is genuine proof of it. I understand it will be verified, and that falsified evidence will result in my account being banned.'

export function adEvidenceAttestation(platform: AdPlatform): string {
  return platform === 'github'
    ? AD_EVIDENCE_ATTESTATION_GITHUB
    : AD_EVIDENCE_ATTESTATION
}
export const AD_MAX_DESCRIPTION_CHARS = 2_000
export const AD_MAX_COMMENT_GUIDANCE_CHARS = 2_000

export const AD_GENERATED_COMMENT_COUNT = 4

export const AD_COMMENT_WRITING_RULES = [
  'Write it yourself — do not use AI to generate it.',
  'Make it original: something nobody else would have written.',
  'Say something specific about this post, not a generic compliment.',
  'Clear, correct English. One or two sentences is plenty.',
] as const

export const AD_DEFAULT_COMMENT_GUIDANCE =
  'Something genuine and specific about the post, in your own words. Original and non-repetitive, in clear English — please do not use AI to write it.'

export const AD_MAX_ENGAGEMENTS_PER_USER_PER_DAY = 12

export const AD_ONE_ENGAGEMENT_PER_POST_PER_USER = true

export const AD_MIN_ENGAGEMENT_DWELL_SECONDS = 20

export const AD_FLAG_BLOCK_HOURS = 24

export const AD_MAX_EVIDENCE_IMAGES = 4
export const AD_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const AD_ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

export const AD_CAMPAIGN_STATUSES = [
  'draft',
  'pending_review',
  'rejected',
  'active',
  'paused',
  'ended',
] as const
export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUSES)[number]

export const AD_EDITABLE_CAMPAIGN_STATUSES = [
  'draft',
  'rejected',
  'paused',
  'active',
] as const

export const AD_CAMPAIGN_STATUS_LABELS: Record<AdCampaignStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  rejected: 'Changes needed',
  active: 'Live',
  paused: 'Paused',
  ended: 'Ended',
}

export const AD_ENGAGEMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'skipped',
  'flagged',
] as const
export type AdEngagementStatus = (typeof AD_ENGAGEMENT_STATUSES)[number]

export const AD_ENGAGEMENT_STATUS_LABELS: Record<AdEngagementStatus, string> = {
  pending: 'Verifying',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
  flagged: 'Flagged',
}

export const AD_SHOWCASE_POST_URLS: readonly string[] = [
  'https://x.com/victorxheng/status/2086989599646314583',
  'https://x.com/victorxheng/status/2085813482558259233',
  'https://x.com/victorxheng/status/2085502613949473014',
]

export const AD_SHOWCASE_REACH = {
  handle: '@victorxheng',
  beforeUrls: [
    'https://x.com/victorxheng/status/2056853673100345558',
    'https://x.com/victorxheng/status/2053972044292014482',
    'https://x.com/victorxheng/status/2052603545313333395',
  ],
  beforeViews: 300,
  afterViewsMin: 10_000,
  afterViewsMax: 50_000,
} as const

export const AD_SHOWCASE_TWEET_STATS_AS_OF = 'August 21, 2026'

export interface AdShowcaseTweet {
  text: string
  postedAt: string
  likes: number
  replies: number
  reposts: number | null
  views: number | null
  image?: { src: string; alt: string }
}

export const AD_SHOWCASE_TWEETS: Record<string, AdShowcaseTweet> = {
  'https://x.com/victorxheng/status/2053972044292014482': {
    text: 'forgot my laptop at home today, ended up laying on the office couch the entire time working from my phone\n\nsomehow was able to ship more.\n\nthe future of ai is laziness',
    postedAt: '3:54 PM · May 11, 2026',
    likes: 16,
    replies: 3,
    reposts: null,
    views: null,
  },
  'https://x.com/victorxheng/status/2052603545313333395': {
    text: 'coding has devolved to the point where you can now do everything from imessage itself.\n\ntoday i spent my workday vibecoding from the couch.\n\nshoutout @triggerdotdev i love you',
    postedAt: '9:16 PM · May 7, 2026',
    likes: 8,
    replies: 2,
    reposts: null,
    views: null,
  },
  'https://x.com/victorxheng/status/2086989599646314583': {
    text: "you can now get unlimited free GLM 5.2 for the first time in history 😳\n\nthis is bigger than ever. here's how to do it:\n\n1 / cancel your existing subscriptions:\n\ncancel your Lovable, Cursor, and Claude Code subscriptions. you don't need them anymore",
    postedAt: '6:34 PM · Aug 10, 2026',
    likes: 871,
    replies: 829,
    reposts: 498,
    views: 48_300,
  },
  'https://x.com/victorxheng/status/2085813482558259233': {
    text: 'bolt lost almost all their customers due to this free alternative 😳\n\ntheir $700M valuation just got wiped out overnight.\n\nwidely regarded as one of the worst AI products in history, bolt is beign replaced by this small open-source repo.',
    postedAt: '12:41 PM · Aug 7, 2026',
    likes: 746,
    replies: 823,
    reposts: 436,
    views: 16_800,
  },
}

export const AD_COMPARISON = {
  linkedinCpcUsd: [8, 14] as const,
  twitterCpcUsd: [1.5, 4] as const,
  engagementsPerTenDollars: engagementsForDailyBudget(1_000),
  industryAverageEngagementUsd: 5,
} as const
