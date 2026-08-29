
const OPEN_TAG = '<think>'
const CLOSE_TAG = '</think>'

export type ThinkStreamSegment = {
  type: 'text' | 'reasoning'
  text: string
}

export interface ThinkTagStreamOptions {
  implicitOpen?: boolean
}

export const IMPLICIT_OPEN_BUDGET_CHARS = 4000

export function stripThinkScaffolding(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .split(CLOSE_TAG)
    .join('')
}

function partialTagSuffixLength(text: string): number {
  const max = Math.min(text.length, CLOSE_TAG.length - 1)
  for (let len = max; len > 0; len--) {
    const suffix = text.slice(text.length - len)
    if (OPEN_TAG.startsWith(suffix) || CLOSE_TAG.startsWith(suffix)) {
      return len
    }
  }
  return 0
}

export function historyLeaksThinkTags(
  messages: readonly { role: string; content: unknown }[],
): boolean {
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      continue
    }
    for (const part of message.content) {
      if (
        !part ||
        typeof part !== 'object' ||
        (part as { type?: unknown }).type !== 'text'
      ) {
        continue
      }
      const text = (part as { text?: unknown }).text
      if (typeof text !== 'string' || !text.includes(CLOSE_TAG)) continue
      const head = text.slice(0, IMPLICIT_OPEN_BUDGET_CHARS + CLOSE_TAG.length)
      if (!head.includes(CLOSE_TAG)) continue
      if (head.replace(/<think>[\s\S]*?<\/think>/g, '').includes(CLOSE_TAG)) {
        return true
      }
    }
  }
  return false
}

export class ThinkTagStream {
  private partial = ''
  private held = ''
  private implicitOpen: boolean
  private inThinkBlock: boolean

  constructor(options: ThinkTagStreamOptions = {}) {
    this.implicitOpen = options.implicitOpen ?? false
    this.inThinkBlock = this.implicitOpen
  }

  disarmImplicitOpen(): ThinkStreamSegment[] {
    if (!this.implicitOpen) return []
    return this.abandonImplicitOpen()
  }

  push(chunk: string): ThinkStreamSegment[] {
    if (!chunk) return []
    const segments: ThinkStreamSegment[] = []
    let buffer = this.partial + chunk
    this.partial = ''

    while (buffer.length > 0) {
      if (this.inThinkBlock) {
        const closeIdx = buffer.indexOf(CLOSE_TAG)
        if (closeIdx === -1) break
        this.addReasoning(segments, buffer.slice(0, closeIdx))
        buffer = buffer.slice(closeIdx + CLOSE_TAG.length)
        this.inThinkBlock = false
        this.confirmImplicitOpen(segments)
        continue
      }

      const openIdx = buffer.indexOf(OPEN_TAG)
      const closeIdx = buffer.indexOf(CLOSE_TAG)
      if (openIdx === -1 && closeIdx === -1) break
      if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
        this.addText(segments, buffer.slice(0, openIdx))
        buffer = buffer.slice(openIdx + OPEN_TAG.length)
        this.inThinkBlock = true
        continue
      }
      this.addText(segments, buffer.slice(0, closeIdx))
      buffer = buffer.slice(closeIdx + CLOSE_TAG.length)
    }

    const hold = partialTagSuffixLength(buffer)
    this.partial = buffer.slice(buffer.length - hold)
    const rest = buffer.slice(0, buffer.length - hold)
    if (this.inThinkBlock) this.addReasoning(segments, rest)
    else this.addText(segments, rest)
    return segments
  }

  flush(): ThinkStreamSegment[] {
    const segments: ThinkStreamSegment[] = []
    const trailing = this.partial
    this.partial = ''
    if (trailing) {
      if (this.inThinkBlock) this.addReasoning(segments, trailing)
      else this.addText(segments, trailing)
    }
    if (this.implicitOpen) segments.push(...this.abandonImplicitOpen())
    return segments
  }

  private confirmImplicitOpen(segments: ThinkStreamSegment[]): void {
    if (!this.implicitOpen) return
    this.implicitOpen = false
    const held = this.held
    this.held = ''
    if (held) push(segments, 'reasoning', held)
  }

  private abandonImplicitOpen(): ThinkStreamSegment[] {
    this.implicitOpen = false
    this.inThinkBlock = false
    const held = this.held
    this.held = ''
    return held ? [{ type: 'text', text: held }] : []
  }

  private addReasoning(
    segments: ThinkStreamSegment[],
    text: string,
  ): void {
    const cleaned = text.split(OPEN_TAG).join('')
    if (!cleaned) return
    if (!this.implicitOpen) {
      push(segments, 'reasoning', cleaned)
      return
    }
    this.held += cleaned
    if (this.held.length >= IMPLICIT_OPEN_BUDGET_CHARS) {
      segments.push(...this.abandonImplicitOpen())
    }
  }

  private addText(segments: ThinkStreamSegment[], text: string): void {
    if (!text) return
    push(segments, 'text', text)
  }
}

function push(
  segments: ThinkStreamSegment[],
  type: ThinkStreamSegment['type'],
  text: string,
): void {
  const last = segments[segments.length - 1]
  if (last && last.type === type) last.text += text
  else segments.push({ type, text })
}
