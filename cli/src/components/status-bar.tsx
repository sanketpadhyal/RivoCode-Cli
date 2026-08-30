import { TextAttributes } from '@opentui/core'
import React, { useEffect, useState } from 'react'

import { Button } from './button'
import { ScrollToBottomButton } from './scroll-to-bottom-button'
import { ShimmerText } from './shimmer-text'

import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { formatElapsedTime } from '../utils/format-elapsed-time'
import { getContextualThinkingState } from '../utils/thinking-verbs'

import type { StatusIndicatorState } from '../utils/status-indicator-state'

const StatusActionButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) => {
  const theme = useTheme()
  const [hovered, setHovered] = useState(false)

  return (
    <Button
      style={{ paddingLeft: 1, paddingRight: 1 }}
      onClick={onClick}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <text>
        <span
          fg={theme.secondary}
          attributes={hovered ? TextAttributes.BOLD : TextAttributes.NONE}
        >
          {children}
        </span>
      </text>
    </Button>
  )
}

const SHIMMER_INTERVAL_MS = 160

interface StatusBarProps {
  timerStartTime: number | null
  isAtBottom: boolean
  scrollToLatest: () => void
  statusIndicatorState: StatusIndicatorState
  onStop?: () => void
  freebuffSession?: unknown
}

export const StatusBar = ({
  timerStartTime,
  isAtBottom,
  scrollToLatest,
  statusIndicatorState,
  onStop,
}: StatusBarProps) => {
  const theme = useTheme()
  const liveTokens = useChatStore((state) => state.liveTokenCount)
  const messages = useChatStore((state) => state.messages)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const lastUserPrompt = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.sender === 'user' && msg.text) {
        return msg.text
      }
    }
    return ''
  }, [messages])

  const [thinkingState, setThinkingState] = useState(() => getContextualThinkingState(lastUserPrompt))

  useEffect(() => {
    if (statusIndicatorState?.kind === 'waiting' || statusIndicatorState?.kind === 'streaming') {
      setThinkingState(getContextualThinkingState(lastUserPrompt))
      prevTokensRef.current = 0
    }
  }, [timerStartTime, lastUserPrompt])

  const prevTokensRef = React.useRef(0)
  const [tokenTrend, setTokenTrend] = React.useState<'up' | 'down'>('up')

  React.useEffect(() => {
    if (liveTokens > prevTokensRef.current) {
      setTokenTrend('up')
    } else if (liveTokens < prevTokensRef.current && liveTokens > 0) {
      setTokenTrend('down')
    }
    prevTokensRef.current = liveTokens
  }, [liveTokens])

  const trendArrow = tokenTrend === 'up' ? '↑' : '↓'

  const shouldShowTimer =
    statusIndicatorState?.kind === 'waiting' ||
    statusIndicatorState?.kind === 'streaming' ||
    statusIndicatorState?.kind === 'paused'

  useEffect(() => {
    if (!timerStartTime || !shouldShowTimer) {
      setElapsedSeconds(0)
      return
    }

    if (statusIndicatorState?.kind === 'paused') {
      const now = Date.now()
      const elapsed = Math.floor((now - timerStartTime) / 1000)
      setElapsedSeconds(elapsed)
      return
    }

    const updateElapsed = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - timerStartTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [timerStartTime, shouldShowTimer, statusIndicatorState?.kind])

  const renderStatusIndicator = () => {
    switch (statusIndicatorState.kind) {
      case 'ctrlC':
        return <span fg={theme.secondary}>Press Ctrl-C again to exit</span>

      case 'clipboard':
        const isFeedbackSuccess =
          statusIndicatorState.message.includes('Feedback sent')
        return (
          <span fg={isFeedbackSuccess ? theme.success : theme.primary}>
            {statusIndicatorState.message}
          </span>
        )

      case 'reconnected':
        return <span fg={theme.success}>✓ Reconnected & Ready</span>

      case 'retrying':
        return (
          <ShimmerText
            text="reconnecting — attempting server handshake..."
            primaryColor={theme.warning}
          />
        )

      case 'capacityWait':
        return (
          <ShimmerText
            text="high demand — in line, starting soon..."
            primaryColor={theme.warning}
          />
        )

      case 'connecting':
        return (
          <ShimmerText
            text="connecting — setting up workspace & tools..."
            primaryColor={theme.primary}
          />
        )

      case 'idle':
      case 'paused':
        return null

      case 'waiting':
        return (
          <>
            <span fg="#f97316">{`${thinkingState.icon} `}</span>
            <ShimmerText
              text={`${thinkingState.verb}...`}
              interval={SHIMMER_INTERVAL_MS}
              primaryColor="#f97316"
            />
            <span fg="#f97316">
              {liveTokens > 0
                ? ` [${elapsedSeconds}s · ${trendArrow} ${liveTokens.toLocaleString()} tokens]`
                : ` [${elapsedSeconds}s]`}
            </span>
          </>
        )

      case 'streaming':
        return (
          <>
            <span fg="#f97316">{`${thinkingState.icon} `}</span>
            <ShimmerText
              text="Generating..."
              interval={SHIMMER_INTERVAL_MS}
              primaryColor="#f97316"
            />
            <span fg="#f97316">
              {` [${elapsedSeconds}s · ${trendArrow} ${liveTokens.toLocaleString()} tokens]`}
            </span>
          </>
        )
    }
  }

  const renderElapsedTime = () => {
    // Timer is already rendered inline inside waiting / streaming indicators
    if (statusIndicatorState.kind === 'waiting' || statusIndicatorState.kind === 'streaming') {
      return null
    }

    if (!shouldShowTimer || elapsedSeconds === 0) {
      return null
    }

    return <span fg={theme.secondary}>{formatElapsedTime(elapsedSeconds)}</span>
  }

  const statusIndicatorContent = renderStatusIndicator()
  const elapsedTimeContent = renderElapsedTime()

  const hasContent = Boolean(statusIndicatorContent || elapsedTimeContent)

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 1,
        paddingRight: 1,
        gap: 1,
        backgroundColor: hasContent ? theme.surface : 'transparent',
      }}
    >
      <box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
        }}
      >
        <text style={{ wrapMode: 'none' }}>{statusIndicatorContent}</text>
      </box>

      <box style={{ flexShrink: 0 }}>
        {!isAtBottom && <ScrollToBottomButton onClick={scrollToLatest} />}
      </box>

      <box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <text style={{ wrapMode: 'none' }}>{elapsedTimeContent}</text>
        {onStop &&
          (statusIndicatorState.kind === 'waiting' ||
            statusIndicatorState.kind === 'streaming') && (
            <StatusActionButton onClick={onStop}>■ Esc</StatusActionButton>
          )}
      </box>
    </box>
  )
}
