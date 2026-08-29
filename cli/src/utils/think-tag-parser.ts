
export const THINK_OPEN_TAG = '<think>'
export const THINK_CLOSE_TAG = '</think>'

export type ThinkSegment = {
  type: 'text' | 'thinking'
  content: string
}

const PARTIAL_OPEN_PREFIXES = ['<', '<t', '<th', '<thi', '<thin', '<think']
const PARTIAL_CLOSE_PREFIXES = ['</', '</t', '</th', '</thi', '</thin', '</think']

export function getPartialTagLength(text: string): number {
  for (const prefix of PARTIAL_CLOSE_PREFIXES) {
    if (text.endsWith(prefix)) {
      return prefix.length
    }
  }
  for (const prefix of PARTIAL_OPEN_PREFIXES) {
    if (text.endsWith(prefix)) {
      return prefix.length
    }
  }
  return 0
}

export function parseThinkTags(text: string): ThinkSegment[] {
  if (!text) {
    return []
  }

  const segments: ThinkSegment[] = []
  let remaining = text
  let insideThink = false

  while (remaining.length > 0) {
    if (insideThink) {
      const closeIdx = remaining.indexOf(THINK_CLOSE_TAG)
      if (closeIdx === -1) {
        if (remaining.length > 0) {
          segments.push({ type: 'thinking', content: remaining })
        }
        break
      }
      if (closeIdx > 0) {
        segments.push({ type: 'thinking', content: remaining.slice(0, closeIdx) })
      }
      remaining = remaining.slice(closeIdx + THINK_CLOSE_TAG.length)
      insideThink = false
    } else {
      const openIdx = remaining.indexOf(THINK_OPEN_TAG)
      const closeIdx = remaining.indexOf(THINK_CLOSE_TAG)
      if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
        if (closeIdx > 0) {
          segments.push({
            type: 'thinking',
            content: remaining.slice(0, closeIdx),
          })
        }
        remaining = remaining.slice(closeIdx + THINK_CLOSE_TAG.length)
        continue
      }

      if (openIdx === -1) {
        if (remaining.length > 0) {
          segments.push({ type: 'text', content: remaining })
        }
        break
      }
      if (openIdx > 0) {
        segments.push({ type: 'text', content: remaining.slice(0, openIdx) })
      }
      remaining = remaining.slice(openIdx + THINK_OPEN_TAG.length)
      insideThink = true
    }
  }

  return segments
}
