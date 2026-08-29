import React, { useEffect, useState } from 'react'
import { IS_FREEBUFF } from '../utils/constants'

import { ShimmerText } from './shimmer-text'
import { getActivityQueryData } from '../hooks/use-activity-query'
import { useTheme } from '../hooks/use-theme'
import { usageQueryKeys, useUsageQuery } from '../hooks/use-usage-query'
import { useChatStore } from '../state/chat-store'
import { BORDER_CHARS } from '../utils/ui-constants'

const CREDIT_POLL_INTERVAL = 5 * 1000

let creditsRestoredGlobal = false

export const areCreditsRestored = () => creditsRestoredGlobal

export const OutOfCreditsBanner = () => {
  if (IS_FREEBUFF) return null

  const sessionCreditsUsed = useChatStore((state) => state.sessionCreditsUsed)
  const [creditsRestored, setCreditsRestored] = useState(false)

  const { data: apiData } = useUsageQuery({
    enabled: true,
    refetchInterval: CREDIT_POLL_INTERVAL,
  })

  const cachedUsageData = getActivityQueryData<{
    type: 'usage-response'
    usage: number
    remainingBalance: number | null
    balanceBreakdown?: { free: number; paid: number; ad?: number }
    next_quota_reset: string | null
  }>(usageQueryKeys.current())

  const theme = useTheme()
  const activeData = apiData || cachedUsageData
  const remainingBalance = activeData?.remainingBalance ?? 0

  const [confirmedZeroBalance, setConfirmedZeroBalance] = useState(false)

  useEffect(() => {
    creditsRestoredGlobal = false
  }, [])

  useEffect(() => {
    if (apiData && !confirmedZeroBalance) {
      if ((apiData.remainingBalance ?? 0) <= 0) {
        setConfirmedZeroBalance(true)
      }
    }
  }, [apiData, confirmedZeroBalance])

  useEffect(() => {
    if (!confirmedZeroBalance || remainingBalance <= 0 || creditsRestored) {
      return
    }

    setCreditsRestored(true)
    creditsRestoredGlobal = true
  }, [remainingBalance, creditsRestored, confirmedZeroBalance])

  const statsText = activeData
    ? `Session: ${sessionCreditsUsed.toLocaleString()} credits used · Balance: ${remainingBalance.toLocaleString()} credits`
    : `Session: ${sessionCreditsUsed.toLocaleString()} credits used`

  if (creditsRestored) {
    return (
      <box
        style={{
          width: '100%',
          borderStyle: 'single',
          borderColor: theme.success,
          customBorderChars: BORDER_CHARS,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0,
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <box
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 3,
            gap: 0,
          }}
        >
          <text style={{ fg: theme.success }}>
            <ShimmerText
              text="✨ Credits acquired! ✨"
              primaryColor={theme.success}
              interval={120}
            />
          </text>
          <text style={{ fg: theme.muted }}>
            Balance: {remainingBalance.toLocaleString()} credits
          </text>
          <text style={{ fg: theme.foreground }}>
            Press Enter to continue
          </text>
        </box>
      </box>
    )
  }

  return (
    <box
      style={{
        width: '100%',
        borderStyle: 'single',
        borderColor: theme.warning,
        customBorderChars: BORDER_CHARS,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 3,
          gap: 0,
        }}
      >
        <text style={{ fg: theme.warning }}>
          Out of credits
        </text>
        <text style={{ fg: theme.muted }}>
          {statsText}
        </text>
        <text style={{ fg: theme.muted }}>
          Note: Some credits are needed even with a Claude subscription for other model usage.
        </text>
        <text style={{ fg: theme.foreground }}>
          Press Enter to buy more credits
        </text>
      </box>
    </box>
  )
}
