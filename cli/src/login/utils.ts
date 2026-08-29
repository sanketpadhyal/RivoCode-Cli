
export function isLightModeColor(hexColor: string): boolean {
  if (!hexColor) return false

  const hex = hexColor.replace('#', '')
  if (hex.length < 6) {
    return false
  }

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

export function formatUrl(url: string, maxWidth?: number): string[] {
  if (!maxWidth || maxWidth <= 0 || url.length <= maxWidth) {
    return [url]
  }

  const lines: string[] = []
  let remaining = url

  while (remaining.length > 0) {
    if (remaining.length <= maxWidth) {
      lines.push(remaining)
      break
    }

    let breakPoint = maxWidth
    for (let i = maxWidth - 1; i > maxWidth - 20 && i > 0; i--) {
      if (['/', '?', '&', '='].includes(remaining[i])) {
        breakPoint = i + 1
        break
      }
    }

    lines.push(remaining.substring(0, breakPoint))
    remaining = remaining.substring(breakPoint)
  }

  return lines
}

export function getSheenColor(
  char: string,
  charIndex: number,
  sheenPosition: number,
  logoColor: string,
  shadowChars: Set<string>,
  accentColor: string = '#9EFC62',
  blockColor: string = '#ffffff',
  isReversing: boolean = false,
): string {
  if (char === '█') {
    return blockColor
  }

  if (!shadowChars.has(char)) {
    return logoColor
  }

  if (isReversing) {
    if (charIndex <= sheenPosition) {
      return logoColor
    }
    return accentColor
  } else {
    if (charIndex <= sheenPosition) {
      return accentColor
    }
    return logoColor
  }
}

export function parseLogoLines(logo: string): string[] {
  return logo.split('\n').filter((line) => line.length > 0)
}

export function calculateResponsiveLayout(
  terminalWidth: number,
  terminalHeight: number,
) {
  const isVerySmall = terminalHeight < 15
  const isSmall = terminalHeight >= 15 && terminalHeight < 20
  const isMedium = terminalHeight >= 20 && terminalHeight < 30
  const isLarge = terminalHeight >= 30

  const isNarrow = terminalWidth < 60

  const containerPadding = isVerySmall ? 0 : 1
  const headerMarginTop = 0
  const headerMarginBottom = isVerySmall ? 0 : 1
  const sectionMarginBottom = isVerySmall ? 0 : 1
  const contentMaxWidth = Math.max(
    10,
    Math.min(terminalWidth - (containerPadding * 2 + 4), 80),
  )

  const maxUrlWidth = Math.min(terminalWidth - 10, 100)

  return {
    isVerySmall,
    isSmall,
    isMedium,
    isLarge,
    isNarrow,
    containerPadding,
    headerMarginTop,
    headerMarginBottom,
    sectionMarginBottom,
    contentMaxWidth,
    maxUrlWidth,
  }
}

export function calculateModalDimensions(
  terminalHeight: number,
  hasInvalidCredentials: boolean,
  defaultHeight = 24,
  verticalMargin = 2,
  maxBaseHeight = 22,
  warningBannerHeight = 3,
) {
  const availableHeight = terminalHeight || defaultHeight

  const baseModalHeight = Math.min(
    availableHeight - verticalMargin,
    maxBaseHeight,
  )

  const totalContentHeight =
    baseModalHeight + (hasInvalidCredentials ? warningBannerHeight : 0)

  const modalHeight = Math.min(totalContentHeight, availableHeight)

  return {
    modalHeight,
    baseModalHeight,
    availableHeight,
  }
}
