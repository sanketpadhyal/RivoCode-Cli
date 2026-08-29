
export const MIN_INLINE_WIDTH_WITH_DESTINATION = 48
export const MAX_DESC_LINES = 2
export const INLINE_AD_DISCLOSURE = 'Ad'
export const INLINE_AD_GAP = 2
export const INLINE_AD_LINK_SUFFIX = ' ↗'

export interface InlineAdLayoutInput {
  adText: string
  title: string
  url: string
}

export function truncateToLines(
  text: string,
  lineWidth: number,
  maxLines: number,
): string {
  if (lineWidth <= 0) return text
  const maxChars = lineWidth * maxLines
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text
  return text.slice(0, width - 1) + '…'
}

export const extractDomain = (url: string): string => {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getAdDisplayLabel(
  ad: Pick<InlineAdLayoutInput, 'title' | 'url'>,
): {
  text: string
  variant: 'domain' | 'title'
} {
  const url = ad.url.trim()
  if (url) {
    return { text: extractDomain(url), variant: 'domain' }
  }

  return { text: ad.title.trim() || 'Sponsored', variant: 'title' }
}

export function getInlineAdLayout(
  ad: InlineAdLayoutInput,
  width: number,
): { title: string; description: string; label: string } {
  const contentWidth = Math.max(0, width - 4)
  const displayLabel = getAdDisplayLabel(ad)
  const headerTrailingWidth = INLINE_AD_GAP + INLINE_AD_DISCLOSURE.length
  const titleWidth = Math.max(0, contentWidth - headerTrailingWidth)
  const destinationLabel =
    width >= MIN_INLINE_WIDTH_WITH_DESTINATION &&
    displayLabel.variant === 'domain'
      ? displayLabel.text
      : ''
  const maxLabelWidth = Math.max(0, Math.min(24, Math.floor(contentWidth / 3)))
  const label = truncateToWidth(destinationLabel, maxLabelWidth)
  const trailingWidth = label
    ? INLINE_AD_GAP + label.length + INLINE_AD_LINK_SUFFIX.length
    : 0
  const descriptionWidth = Math.max(0, contentWidth - trailingWidth)

  return {
    title: truncateToWidth(ad.title.trim() || displayLabel.text, titleWidth),
    description: truncateToWidth(ad.adText.trim(), descriptionWidth),
    label,
  }
}
