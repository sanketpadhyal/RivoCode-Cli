export type ActiveRunStopReason =
  | 'user-interrupt'
  | 'logout'
  | 'new-chat'
  | 'history-resume'
  | 'session-transition'
  | 'process-exit'

type ActiveRunQueuePolicy =
  | 'pause-if-pending'
  | 'clear-and-block'
  | 'preserve-and-block'

export const ACTIVE_RUN_QUEUE_POLICIES = {
  'user-interrupt': 'pause-if-pending',
  logout: 'clear-and-block',
  'new-chat': 'clear-and-block',
  'history-resume': 'clear-and-block',
  'session-transition': 'clear-and-block',
  'process-exit': 'preserve-and-block',
} satisfies Record<ActiveRunStopReason, ActiveRunQueuePolicy>

export type ActiveRunQueueControls = {
  pauseQueueIfPending: () => void
  discardQueue: () => void
  setCanProcessQueue: (canProcess: boolean) => void
}

export function applyActiveRunQueuePolicy(
  reason: ActiveRunStopReason,
  controls: ActiveRunQueueControls,
): void {
  const policy = ACTIVE_RUN_QUEUE_POLICIES[reason]
  if (policy === 'pause-if-pending') {
    controls.pauseQueueIfPending()
    return
  }
  if (policy === 'clear-and-block') {
    controls.discardQueue()
    return
  }
  if (policy === 'preserve-and-block') {
    controls.setCanProcessQueue(false)
  }
}

type ActiveRun = {
  ownerId: string
  stop: (reason: ActiveRunStopReason) => void
}

let activeRun: ActiveRun | null = null
let runtimeStopHandler: ((reason: ActiveRunStopReason) => void) | null = null

export function registerActiveRunStopHandler(
  handler: (reason: ActiveRunStopReason) => void,
): () => void {
  runtimeStopHandler = handler
  return () => {
    if (runtimeStopHandler === handler) runtimeStopHandler = null
  }
}

export function registerActiveRun(
  ownerId: string,
  stop: (reason: ActiveRunStopReason) => void,
): void {
  const previousRun = activeRun
  activeRun = { ownerId, stop }
  if (previousRun && previousRun.ownerId !== ownerId) {
    try {
      previousRun.stop('user-interrupt')
    } catch {
    }
  }
}

export function clearActiveRun(ownerId: string): void {
  if (activeRun?.ownerId === ownerId) {
    activeRun = null
  }
}

export function stopActiveRun(reason: ActiveRunStopReason): boolean {
  const run = activeRun
  if (run) activeRun = null

  try {
    run?.stop(reason)
  } catch {
  }
  try {
    runtimeStopHandler?.(reason)
  } catch {
  }
  return run !== null
}
