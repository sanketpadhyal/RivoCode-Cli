
import type { PrintModeEvent } from '@rivocode/common/types/print-mode'

export type StreamChunk =
  | string
  | {
      type: 'subagent_chunk'
      agentId: string
      agentType: string
      chunk: string
    }
  | {
      type: 'reasoning_chunk'
      agentId: string
      ancestorRunIds: string[]
      chunk: string
    }

export class EventCollector {
  public events: PrintModeEvent[] = []
  public streamChunks: StreamChunk[] = []
  public errors: PrintModeEvent[] = []

  handleEvent = (event: PrintModeEvent): void => {
    this.events.push(event)
    if (event.type === 'error') {
      this.errors.push(event)
    }
  }

  handleStreamChunk = (chunk: StreamChunk): void => {
    this.streamChunks.push(chunk)
  }

  getEventsByType<T extends PrintModeEvent['type']>(
    type: T,
  ): Extract<PrintModeEvent, { type: T }>[] {
    return this.events.filter(
      (e): e is Extract<PrintModeEvent, { type: T }> => e.type === type,
    )
  }

  hasEventType(type: PrintModeEvent['type']): boolean {
    return this.events.some((e) => e.type === type)
  }

  getFirstEvent<T extends PrintModeEvent['type']>(
    type: T,
  ): Extract<PrintModeEvent, { type: T }> | undefined {
    return this.events.find(
      (e): e is Extract<PrintModeEvent, { type: T }> => e.type === type,
    )
  }

  getLastEvent<T extends PrintModeEvent['type']>(
    type: T,
  ): Extract<PrintModeEvent, { type: T }> | undefined {
    const filtered = this.getEventsByType(type)
    return filtered[filtered.length - 1]
  }

  getFullText(): string {
    return this.getEventsByType('text')
      .map((e) => e.text)
      .join('')
  }

  getFullStreamText(): string {
    return this.streamChunks
      .filter((c): c is string => typeof c === 'string')
      .join('')
  }

  getSubagentChunks(agentId: string): string[] {
    return this.streamChunks
      .filter(
        (c): c is Extract<StreamChunk, { type: 'subagent_chunk' }> =>
          typeof c !== 'string' && c.type === 'subagent_chunk' && c.agentId === agentId,
      )
      .map((c) => c.chunk)
  }

  verifyEventOrder(expectedOrder: PrintModeEvent['type'][]): boolean {
    let lastIndex = -1
    for (const type of expectedOrder) {
      const index = this.events.findIndex((e, i) => i > lastIndex && e.type === type)
      if (index === -1) return false
      lastIndex = index
    }
    return true
  }

  getUniqueEventTypes(): Set<PrintModeEvent['type']> {
    return new Set(this.events.map((e) => e.type))
  }

  countEvents(type: PrintModeEvent['type']): number {
    return this.events.filter((e) => e.type === type).length
  }

  clear(): void {
    this.events = []
    this.streamChunks = []
    this.errors = []
  }

  getSummary(): {
    totalEvents: number
    totalChunks: number
    eventTypes: Record<string, number>
    hasErrors: boolean
  } {
    const eventTypes: Record<string, number> = {}
    for (const event of this.events) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1
    }
    return {
      totalEvents: this.events.length,
      totalChunks: this.streamChunks.length,
      eventTypes,
      hasErrors: this.errors.length > 0,
    }
  }
}
