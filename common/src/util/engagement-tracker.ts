
export const ENGAGEMENT_INTERVAL_MS = 60_000

export const ENGAGEMENT_IDLE_THRESHOLD_MS = 5 * 60_000

export interface EngagementScheduler {
  setInterval: (fn: () => void, ms: number) => unknown
  clearInterval: (handle: unknown) => void
}

export interface EngagementTrackerOptions {
  emit: () => void
  intervalMs?: number
  idleThresholdMs?: number
  now?: () => number
  scheduler?: EngagementScheduler
}

const defaultScheduler: EngagementScheduler = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

export class EngagementTracker {
  private readonly emit: () => void
  private readonly intervalMs: number
  private readonly idleThresholdMs: number
  private readonly now: () => number
  private readonly scheduler: EngagementScheduler

  private lastActivity: number
  private visible = true
  private handle: unknown = undefined

  constructor(options: EngagementTrackerOptions) {
    this.emit = options.emit
    this.intervalMs = options.intervalMs ?? ENGAGEMENT_INTERVAL_MS
    this.idleThresholdMs = options.idleThresholdMs ?? ENGAGEMENT_IDLE_THRESHOLD_MS
    this.now = options.now ?? (() => Date.now())
    this.scheduler = options.scheduler ?? defaultScheduler
    this.lastActivity = this.now()
  }

  recordActivity(): void {
    this.lastActivity = this.now()
  }

  setVisible(visible: boolean): void {
    if (visible && !this.visible) {
      this.lastActivity = this.now()
    }
    this.visible = visible
  }

  start(): void {
    if (this.handle !== undefined) {
      return
    }
    this.lastActivity = this.now()
    this.handle = this.scheduler.setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.handle === undefined) {
      return
    }
    this.scheduler.clearInterval(this.handle)
    this.handle = undefined
  }

  tick(): boolean {
    if (!this.visible) {
      return false
    }
    if (this.now() - this.lastActivity >= this.idleThresholdMs) {
      return false
    }
    this.emit()
    return true
  }
}

export function createEngagementSessionId(): string {
  return crypto.randomUUID()
}
