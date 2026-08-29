import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'
import {
  EngagementTracker,
  createEngagementSessionId,
} from '@rivocode/common/util/engagement-tracker'

import { subscribeToActivity } from './activity-tracker'
import { trackEvent } from './analytics'

let tracker: EngagementTracker | undefined
let unsubscribeActivity: (() => void) | undefined

export function startEngagementTracking(): void {
  if (tracker) {
    return
  }

  const sessionId = createEngagementSessionId()

  tracker = new EngagementTracker({
    emit: () =>
      trackEvent(AnalyticsEvent.PRODUCT_ACTIVE_MINUTE, {
        surface: 'cli',
        engagement_session_id: sessionId,
      }),
    scheduler: {
      setInterval: (fn: () => void, ms: number) => {
        const t = setInterval(fn, ms)
        t.unref?.()
        return t
      },
      clearInterval: (t: unknown) =>
        clearInterval(t as ReturnType<typeof setInterval>),
    },
  })

  unsubscribeActivity = subscribeToActivity(() => tracker?.recordActivity())
  tracker.start()
}

export function stopEngagementTracking(): void {
  unsubscribeActivity?.()
  unsubscribeActivity = undefined
  tracker?.stop()
  tracker = undefined
}
