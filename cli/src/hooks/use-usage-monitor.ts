import { useEffect, useRef } from 'react'

import { useUsageQuery } from './use-usage-query'
import { IS_FREEBUFF } from '../utils/constants'
import { useChatStore } from '../state/chat-store'
import { getAuthToken } from '../utils/auth'
import { shouldAutoShowBanner } from '../utils/usage-banner-state'

export function useUsageMonitor() {
  const isChainInProgress = useChatStore((state) => state.isChainInProgress)
  const sessionCreditsUsed = useChatStore((state) => state.sessionCreditsUsed)
  const setInputMode = useChatStore((state) => state.setInputMode)
  const lastWarnedThresholdRef = useRef<number | null>(null)

  const { data: usageData } = useUsageQuery({ enabled: !IS_FREEBUFF })

  useEffect(() => {
    if (IS_FREEBUFF) return

    if (sessionCreditsUsed === 0) {
      return
    }

    const authToken = getAuthToken()
    const remainingBalance = usageData?.remainingBalance ?? null
    const autoTopupEnabled = usageData?.autoTopupEnabled ?? false

    const decision = shouldAutoShowBanner(
      isChainInProgress,
      !!authToken,
      remainingBalance,
      lastWarnedThresholdRef.current,
      autoTopupEnabled,
    )

    if (decision.newWarningThreshold !== lastWarnedThresholdRef.current) {
      lastWarnedThresholdRef.current = decision.newWarningThreshold
    }

    if (decision.shouldShow) {
      setInputMode('usage')
    }
  }, [isChainInProgress, usageData, sessionCreditsUsed, setInputMode])
}
