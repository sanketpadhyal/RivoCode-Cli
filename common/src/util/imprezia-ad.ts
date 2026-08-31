import { z } from 'zod'

const IMPREZIA_INTEGRATION_VERSION = 'rivocode/1.0.0'

export const IMPREZIA_SANDBOX_BASE_URL = 'https://api-sandbox.imprezia.ai'
export const IMPREZIA_PROD_BASE_URL = 'https://api.imprezia.ai'

const SANDBOX_KEY_PREFIX = 'api_pub_sandbox_'

export const IMPREZIA_LIMITS = {
  request: 10_000,
  response: 50_000,
  sessionId: 100,
} as const

export function impreziaBaseUrlForKey(apiKey: string): string {
  return apiKey.startsWith(SANDBOX_KEY_PREFIX)
    ? IMPREZIA_SANDBOX_BASE_URL
    : IMPREZIA_PROD_BASE_URL
}

export function isImpreziaSandboxKey(apiKey: string): boolean {
  return apiKey.startsWith(SANDBOX_KEY_PREFIX)
}

const impreziaDeviceTypeSchema = z.enum(['desktop', 'mobile', 'tablet'])

export type ImpreziaDeviceType = z.infer<typeof impreziaDeviceTypeSchema>

export const impreziaDeviceContextSchema = z.object({
  deviceType: impreziaDeviceTypeSchema,
  viewportWidth: z.number().int().positive(),
  viewportHeight: z.number().int().positive(),
})

export type ImpreziaDeviceContext = z.infer<typeof impreziaDeviceContextSchema>

const impreziaTrackersSchema = z.object({
  impression: z.array(z.string()).optional(),
  mrc50: z.array(z.string()).optional(),
  impressionFrameUrl: z.string().optional(),
  viewabilityFrameUrl: z.string().optional(),
})

export type ImpreziaTrackers = z.infer<typeof impreziaTrackersSchema>

export const impreziaBeaconTokenSchema = z.object({
  token: z.string(),
  issuedAt: z.number(),
  kid: z.string(),
})

const impreziaImpressionSchema = z.object({
  impressionUuid: z.string(),
  beaconToken: impreziaBeaconTokenSchema.optional(),
  servedAt: z.string(),
  publisherId: z.string(),
})

const impreziaCreativeSchema = z.object({
  brandName: z.string(),
  title: z.string(),
  description: z.string(),
  cta: z.string(),
  logoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
})

export const impreziaAdSchema = z.object({
  creative: impreziaCreativeSchema,
  clickUrl: z.string(),
  trackers: impreziaTrackersSchema.optional(),
  impression: impreziaImpressionSchema,
})

export type ImpreziaAd = z.infer<typeof impreziaAdSchema>

export const impreziaChatAdResponseSchema = z.object({
  requestId: z.string(),
  ad: impreziaAdSchema.nullable().optional(),
})

export type ImpreziaDecision = {
  requestId: string
  ad: ImpreziaAd
  baseUrl: string
}

export const IMPREZIA_EVENT_INSERTED = 'sdk_impression_inserted' as const
export const IMPREZIA_EVENT_VIEWABLE = 'sdk_impression' as const

export type ImpreziaEventType =
  | typeof IMPREZIA_EVENT_INSERTED
  | typeof IMPREZIA_EVENT_VIEWABLE

export const IMPREZIA_BEACON_PATH = '/v1/events/sdk-impression'

export function buildBeaconPayload(params: {
  decision: {
    requestId: string
    ad: Pick<ImpreziaAd, 'clickUrl' | 'impression'>
  }
  eventType: ImpreziaEventType
  sessionId: string
  eventId: string
  clientTimestamp: string
}): Record<string, unknown> {
  const { decision, eventType, sessionId, eventId, clientTimestamp } = params
  const { requestId, ad } = decision
  const token = ad.impression.beaconToken

  return {
    eventId,
    eventType,
    requestId,
    sdkVersion: IMPREZIA_INTEGRATION_VERSION,
    clientTimestamp,
    serverTimestamp: ad.impression.servedAt,
    generatedUrl: ad.clickUrl,
    impressionUuid: ad.impression.impressionUuid,
    ...(token
      ? {
          impressionToken: token.token,
          tokenIssuedAt: token.issuedAt,
          tokenKid: token.kid,
        }
      : {}),
    placementType: 'uicard',
    publisherId: ad.impression.publisherId,
    sessionId,
  }
}

export function normalizeSourceUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}

export function detectDeviceType(params: {
  userAgent: string
  width: number
  maxTouchPoints: number
}): ImpreziaDeviceType {
  const { userAgent, width, maxTouchPoints } = params
  const ua = userAgent.toLowerCase()
  const isTouch = maxTouchPoints > 0

  if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet'
  if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('android')) {
    return ua.includes('android') && !ua.includes('mobi') ? 'tablet' : 'mobile'
  }
  if (isTouch && width >= 600 && width < 1024) return 'tablet'
  if (isTouch && width < 600) return 'mobile'
  return 'desktop'
}

export type ImpreziaBeaconRecord = {
  baseUrl: string
  requestId: string
  sessionId: string
  clickUrl: string
  impression: ImpreziaAd['impression']
}

export function parseImpreziaBeaconRecord(
  raw: string | null | undefined,
): ImpreziaBeaconRecord | null {
  if (!raw) return null
  try {
    const parsed = impreziaBeaconRecordSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const impreziaBeaconRecordSchema = z.object({
  baseUrl: z.string(),
  requestId: z.string(),
  sessionId: z.string(),
  clickUrl: z.string(),
  impression: impreziaImpressionSchema,
})

const IMPREZIA_IMP_URL_PREFIX = 'https://impression.imprezia.invalid/'

export function impreziaImpressionUrl(impressionUuid: string): string {
  return `${IMPREZIA_IMP_URL_PREFIX}${impressionUuid}`
}

export function impreziaImpressionFields(params: {
  ad: ImpreziaAd
  requestId: string
  sessionId: string
  baseUrl: string
}) {
  const { ad, requestId, sessionId, baseUrl } = params

  const beacon: ImpreziaBeaconRecord = {
    baseUrl,
    requestId,
    sessionId,
    clickUrl: ad.clickUrl,
    impression: ad.impression,
  }

  return {
    adText: ad.creative.description,
    title: ad.creative.title,
    cta: ad.creative.cta,
    url: '',
    clickUrl: ad.clickUrl,
    favicon: ad.creative.logoUrl ?? '',
    impUrl: impreziaImpressionUrl(ad.impression.impressionUuid),
    providerMeta: JSON.stringify(beacon),
  }
}
