
type ActivityListener = (timestamp: number) => void

const listeners = new Set<ActivityListener>()
let lastActivityTime = Date.now()

export function reportActivity(): void {
  lastActivityTime = Date.now()
  for (const listener of listeners) {
    listener(lastActivityTime)
  }
}

export function getLastActivityTime(): number {
  return lastActivityTime
}

export function isUserActive(idleThresholdMs: number = 30_000): boolean {
  return Date.now() - lastActivityTime < idleThresholdMs
}

export function getIdleTime(): number {
  return Date.now() - lastActivityTime
}

export function subscribeToActivity(callback: ActivityListener): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function resetActivityTracker(): void {
  lastActivityTime = Date.now()
  listeners.clear()
}
