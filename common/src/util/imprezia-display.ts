import { z } from 'zod'

import { impreziaBeaconTokenSchema } from './imprezia-ad'

export const IMPREZIA_DISPLAY_ORIGIN = 'https://freebuff.com'

export const DESKTOP_NEW_TAB_SLOT_ID = 'freebuff-desktop-new-tab'

export type ImpreziaDisplayRequest = {
  slotId: string
  sessionId?: string
}

const displayCardMetadataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  brandName: z.string().optional(),
  ctaText: z.string().optional(),
  logoUrl: z.string().optional(),
  adAssetUrl: z.string().optional(),
})

const displayCardSchema = z.object({
  hyperlink: z.string().optional(),
  originalUrl: z.string().optional(),
  ctaText: z.string().optional(),
  metadata: z.object({
    beaconToken: impreziaBeaconTokenSchema.optional(),
    cardMetadata: displayCardMetadataSchema,
  }),
})

const impreziaDisplayResponseSchema = z.object({
  no_fill: z.boolean().optional(),
  requestId: z.string(),
  publisherId: z.string(),
  impressionUuid: z.string().optional(),
  clickUrl: z.string().optional(),
  linkData: z.record(z.string(), displayCardSchema).optional(),
})

export type ImpreziaDisplayAd = {
  title: string
  description: string
  cta: string
  brandName: string
  url: string
  clickUrl: string
  imageUrl: string
  logoUrl: string
  impressionUuid: string
  publisherId: string
  beaconToken: { token: string; issuedAt: number; kid: string } | undefined
}

function imageSrcOrNull(value: string | undefined): string {
  if (!value) return ''
  return /^https?:\/\//.test(value) ? value : ''
}

export function toImpreziaDisplayAd(
  raw: unknown,
): { requestId: string; ad: ImpreziaDisplayAd | null } | null {
  const parsed = impreziaDisplayResponseSchema.safeParse(raw)
  if (!parsed.success) return null

  const {
    no_fill,
    requestId,
    publisherId,
    impressionUuid,
    clickUrl,
    linkData,
  } = parsed.data

  const card = linkData ? Object.values(linkData)[0] : undefined
  const click = clickUrl || card?.hyperlink || ''
  if (no_fill || !card || !click || !impressionUuid)
    return { requestId, ad: null }

  const meta = card.metadata.cardMetadata
  return {
    requestId,
    ad: {
      title: meta.title,
      description: meta.description ?? '',
      cta: meta.ctaText || card.ctaText || 'Learn more',
      brandName: meta.brandName ?? '',
      url: card.originalUrl ?? '',
      clickUrl: click,
      imageUrl: imageSrcOrNull(meta.adAssetUrl),
      logoUrl: imageSrcOrNull(meta.logoUrl),
      impressionUuid,
      publisherId,
      beaconToken: card.metadata.beaconToken,
    },
  }
}

export const impreziaDisplayBeaconSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  clickUrl: z.string(),
  impression: z.object({
    impressionUuid: z.string(),
    beaconToken: impreziaBeaconTokenSchema.optional(),
    servedAt: z.string(),
    publisherId: z.string(),
  }),
})
