import { TextAttributes } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from './button'
import { ChoiceAdBanner, AD_CARD_HEIGHT } from './ad-banner'
import { visibleWaitingRoomPlacementIds } from '@rivocode/common/ads/waiting-room-placements'
import { FreebuffModelSelector } from './freebuff-model-selector'
import { ShimmerText } from './shimmer-text'
import {
  refreshFreebuffLandingMetadata,
  takeOverFreebuffSession,
} from '../hooks/use-freebuff-session'
import { useFreebuffCtrlCExit } from '../hooks/use-freebuff-ctrl-c-exit'
import { useFreebuffStreakQuery } from '../hooks/use-freebuff-streak-query'
import { useGravityAd } from '../hooks/use-gravity-ad'
import { useLogo } from '../hooks/use-logo'
import { useNow } from '../hooks/use-now'
import { useSheenAnimation } from '../hooks/use-sheen-animation'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { exitCliCleanly } from '../utils/exit-cleanly'
import {
  formatFreebuffPremiumResetCountdown,
  getFreebuffPremiumResetAt,
} from '../utils/freebuff-premium-reset'
import {
  FREEBUFF_STREAK_INLINE_GAP,
  FREEBUFF_STREAK_LABEL_GAP,
  fitsFreebuffStreakOnHeadingRow,
  getFreebuffStreakBonusNoteForLayout,
  getFreebuffStreakLine,
} from '../utils/freebuff-streak-line'
import { formatSessionUnits } from '../utils/format-session-units'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'
import { getLogoAccentColor, getLogoBlockColor } from '../utils/theme-system'
import { INVERTED_CTA_FG } from '../utils/ui-constants'
import {
  FREEBUFF_ENABLE_STREAK_IN_UI,
  FREEBUFF_LIMITED_SESSION_LIMIT,
  FREEBUFF_PREMIUM_SESSION_LIMIT,
} from '@rivocode/common/constants/freebuff-models'
import {
  getRateLimitsByModel,
  getReferralInfo,
} from '@rivocode/common/types/freebuff-session'
import {
  FREEBUFF_PAUSED_MODEL_NOTICE,
  FREEBUFF_TIER_CHANGE_NOTICE,
  getFreebuffModelAvailabilityNotice,
} from '@rivocode/common/util/freebuff-model-availability'
import { formatFreebuffHardBlockedPrivacySignals } from '@rivocode/common/util/freebuff-privacy'

import type { FreebuffStreakLine } from '../utils/freebuff-streak-line'
import type { FreebuffSessionFailure } from '../state/freebuff-session-store'
import type { FreebuffSessionResponse } from '../types/freebuff-session'
import type { KeyEvent } from '@opentui/core'

interface FreebuffLandingScreenProps {
  session: FreebuffSessionResponse | null
  failure: FreebuffSessionFailure | null
}

const LANDING_HEADING = 'Start coding for free'
const COLLAPSED_LOGO_MIN_HEIGHT = 26

const formatRetryAfter = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return 'any moment now'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`
}

const getLimitedModeNotice = (
  session: FreebuffSessionResponse | null,
): string =>
  getFreebuffModelAvailabilityNotice(
    session && 'countryBlockReason' in session ? session : null,
  )

function getTakeoverErrorMessage(failure: FreebuffSessionFailure): string {
  if (failure.type === 'http' && failure.statusCode === 503) {
    return "Freebuff is busy and couldn't complete the takeover yet."
  }
  if (failure.type === 'timeout') {
    return failure.outcomeUnknown
      ? 'The takeover request timed out and may have succeeded. Check the warning, then retry if you still want to take over.'
      : failure.retry
        ? 'The takeover request timed out while Freebuff was busy.'
        : 'The takeover request timed out.'
  }
  if (failure.outcomeUnknown) {
    return "Freebuff couldn't confirm whether the takeover succeeded. Check the warning, then retry if you still want to take over."
  }
  return failure.message.trim()
    ? `Takeover failed: ${failure.message}`
    : 'The takeover failed unexpectedly.'
}

export const TakeoverPrompt: React.FC<{
  failure: FreebuffSessionFailure | null
  onTakeOver?: () => Promise<void>
}> = ({ failure, onTakeOver = takeOverFreebuffSession }) => {
  const theme = useTheme()
  const [pending, setPending] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const takeoverInFlightRef = useRef(false)
  const retry = failure?.retry ?? null
  const retryTick = useNow(1_000, retry !== null)
  const retryNow = retry ? Math.max(retryTick, Date.now()) : retryTick
  const retrySeconds = retry
    ? Math.max(0, Math.ceil((retry.retryAtMs - retryNow) / 1_000))
    : 0
  const outcomeUnknown = failure?.outcomeUnknown ?? false
  const blocked = pending
  const displayError = failure ? getTakeoverErrorMessage(failure) : null

  const handleTakeover = useCallback(async () => {
    if (takeoverInFlightRef.current) return
    takeoverInFlightRef.current = true
    setPending(true)
    try {
      await onTakeOver()
    } finally {
      takeoverInFlightRef.current = false
      setPending(false)
    }
  }, [onTakeOver])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const name = key.name ?? ''
        const isConfirm = isPlainEnterKey(key)
        const isExit = name === 'escape' || name === 'esc'
        const isTab = name === 'tab'
        const isShiftTab = key.shift === true && isTab
        const isRight = name === 'right'
        const isLeft = name === 'left'

        if (isExit) {
          key.preventDefault?.()
          void exitCliCleanly()
          return
        }

        if (isConfirm) {
          key.preventDefault?.()
          if (focusedIndex === 0) {
            void handleTakeover()
          } else {
            void exitCliCleanly()
          }
          return
        }

        if (isRight || isTab) {
          key.preventDefault?.()
          setFocusedIndex((prev) => (prev + 1) % 2)
          return
        }

        if (isLeft || isShiftTab) {
          key.preventDefault?.()
          setFocusedIndex((prev) => (prev - 1 + 2) % 2)
          return
        }
      },
      [focusedIndex, handleTakeover],
    ),
  )

  const isTakeoverFocused = focusedIndex === 0
  const isExitFocused = focusedIndex === 1
  const takeoverLabel = pending
    ? 'Taking over...'
    : outcomeUnknown
      ? 'Try takeover again'
      : retry
        ? 'Retry now'
        : 'Take over'
  const takeoverForeground = blocked
    ? theme.muted
    : isTakeoverFocused
      ? INVERTED_CTA_FG
      : theme.foreground

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        width: '100%',
      }}
    >
      <text style={{ fg: theme.foreground }} attributes={TextAttributes.BOLD}>
        Freebuff is already running
      </text>

      <text style={{ fg: theme.muted }}>
        Only one freebuff instance is allowed at a time.
      </text>

      {displayError && (
        <text style={{ fg: theme.secondary, wrapMode: 'word' }}>
          ⚠ {displayError}
        </text>
      )}

      {retry && (
        <text style={{ fg: theme.muted }}>
          {retrySeconds > 0
            ? `Retrying automatically in ${retrySeconds}s (attempt ${retry.attempt}).`
            : `Retrying automatically now (attempt ${retry.attempt}).`}
        </text>
      )}

      <box style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
        <Button
          onClick={blocked ? undefined : handleTakeover}
          onMouseOver={() => setFocusedIndex(0)}
          style={{ paddingLeft: 1, paddingRight: 1 }}
          border={['top', 'bottom', 'left', 'right']}
          borderStyle="single"
          borderColor={blocked ? theme.muted : theme.primary}
        >
          <text
            style={{
              fg: takeoverForeground,
              bg: isTakeoverFocused && !blocked ? theme.primary : undefined,
            }}
            attributes={TextAttributes.BOLD}
          >
            {takeoverLabel}
          </text>
        </Button>
        <Button
          onClick={() => exitCliCleanly()}
          onMouseOver={() => setFocusedIndex(1)}
          style={{ paddingLeft: 1, paddingRight: 1 }}
          border={['top', 'bottom', 'left', 'right']}
          borderStyle="single"
          borderColor={isExitFocused ? theme.foreground : theme.muted}
        >
          <text
            style={{ fg: isExitFocused ? theme.foreground : theme.muted }}
            attributes={
              isExitFocused ? TextAttributes.BOLD : TextAttributes.NONE
            }
          >
            Exit
          </text>
        </Button>
      </box>
    </box>
  )
}

const streakSpans = (
  line: FreebuffStreakLine,
  theme: ReturnType<typeof useTheme>,
) => [
  <span key="label" fg={theme.foreground}>
    {line.label}
  </span>,
  <span key="dots" fg={theme.primary}>
    {`${' '.repeat(FREEBUFF_STREAK_LABEL_GAP)}${line.dots}`}
  </span>,
]

const StreakInlineLine: React.FC<{
  line: FreebuffStreakLine | null
}> = ({ line }) => {
  const theme = useTheme()

  if (!line) {
    return <text style={{ flexShrink: 0 }}> </text>
  }

  return (
    <text style={{ flexShrink: 0, wrapMode: 'none' }}>
      {streakSpans(line, theme)}
    </text>
  )
}

export const LandingHeadingRow: React.FC<{
  streakLine: FreebuffStreakLine | null
  marginBottom: number
}> = ({ streakLine, marginBottom }) => {
  const theme = useTheme()

  return (
    <text style={{ marginBottom, wrapMode: 'word' }}>
      <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
        {LANDING_HEADING}
      </span>
      {streakLine && [
        <span key="gap">{' '.repeat(FREEBUFF_STREAK_INLINE_GAP)}</span>,
        ...streakSpans(streakLine, theme),
      ]}
    </text>
  )
}

export const FreebuffLandingScreen: React.FC<FreebuffLandingScreenProps> = ({
  session,
  failure,
}) => {
  const theme = useTheme()
  const renderer = useRenderer()
  const { terminalWidth, terminalHeight, contentMaxWidth } =
    useTerminalDimensions()

  const [selectorExpanded, setSelectorExpanded] = useState(false)
  const hasReferralMenu =
    session?.status === 'none' && Boolean(getReferralInfo(session))
  const logoHeightFits =
    terminalHeight >= 40 ||
    (!selectorExpanded &&
      !hasReferralMenu &&
      terminalHeight >= COLLAPSED_LOGO_MIN_HEIGHT)
  const compact = terminalHeight < 22
  const showAds = terminalHeight >= 18
  const textMarginBottom = 1

  const [sheenPosition, setSheenPosition] = useState(0)
  const blockColor = getLogoBlockColor(theme.name)
  const accentColor = getLogoAccentColor(theme.name)
  const { applySheenToChar } = useSheenAnimation({
    logoColor: theme.foreground,
    accentColor,
    blockColor,
    terminalWidth: renderer?.width ?? terminalWidth,
    sheenPosition,
    setSheenPosition,
  })
  const { component: logoComponent, textBlock: logoTextBlock } = useLogo({
    availableWidth: contentMaxWidth,
    accentColor,
    blockColor,
    applySheenToChar,
  })
  const showFullLogo = logoHeightFits && logoTextBlock.length > 0

  const waitingRoomPlacementIds = visibleWaitingRoomPlacementIds(terminalWidth)
  const { ads, recordClick, recordImpression } = useGravityAd({
    enabled: true,
    forceStart: true,
    provider: 'gravity',
    surface: 'waiting_room',
    placementIds: waitingRoomPlacementIds,
  })

  useFreebuffCtrlCExit()

  const [exitHover, setExitHover] = useState(false)

  const accessTier =
    session && 'accessTier' in session ? session.accessTier : 'full'
  const belowPickerNotices = compact
    ? []
    : accessTier === 'limited'
      ? [getLimitedModeNotice(session), FREEBUFF_PAUSED_MODEL_NOTICE]
      : [FREEBUFF_TIER_CHANGE_NOTICE]
  const isLanding = session?.status === 'none'
  const streakQuery = useFreebuffStreakQuery({
    enabled: FREEBUFF_ENABLE_STREAK_IN_UI && isLanding,
  })
  const streak = streakQuery.data?.streak ?? 0
  const showStreakIndicator = FREEBUFF_ENABLE_STREAK_IN_UI && isLanding
  const streakBonusNote = showStreakIndicator
    ? getFreebuffStreakBonusNoteForLayout({
        streak,
        accessTier: accessTier === 'limited' ? 'limited' : 'full',
        terminalHeight,
        availableWidth: contentMaxWidth,
      })
    : null
  const streakLine = showStreakIndicator ? getFreebuffStreakLine(streak) : null
  const streakOnHeadingRow =
    showStreakIndicator &&
    fitsFreebuffStreakOnHeadingRow({
      line: streakLine,
      headingWidth: LANDING_HEADING.length,
      availableWidth: contentMaxWidth,
    })
  const now = useNow(60_000, isLanding)

  const rateLimitsByModel = getRateLimitsByModel(session)
  const sessionRateLimit = rateLimitsByModel
    ? Object.values(rateLimitsByModel)[0]
    : undefined
  const sharedSessionUsed = sessionRateLimit?.recentCount ?? 0
  const showSessionCounter = sharedSessionUsed > 0
  const showBelowPickerCounter =
    showSessionCounter && (accessTier === 'limited' || !selectorExpanded)
  const sessionLimit =
    sessionRateLimit?.limit ??
    (accessTier === 'limited'
      ? FREEBUFF_LIMITED_SESSION_LIMIT
      : FREEBUFF_PREMIUM_SESSION_LIMIT)
  const isSessionExhausted = sharedSessionUsed >= sessionLimit
  const sessionUsedColor = isSessionExhausted ? theme.secondary : theme.muted
  const sessionLabel =
    accessTier === 'limited' ? 'sessions' : 'premium sessions'
  const formattedSharedSessionUsed = formatSessionUnits(sharedSessionUsed)
  const sessionResetAt = getFreebuffPremiumResetAt({
    rateLimitsByModel,
    nowMs: now,
  })
  const sessionResetAtMs = sessionResetAt.getTime()
  const sessionResetCountdown = formatFreebuffPremiumResetCountdown(
    sessionResetAt,
    now,
  )

  const wrappedRows = (text: string) =>
    Math.max(1, Math.ceil(text.length / contentMaxWidth))
  const logoBlockRows = showFullLogo
    ? 8
    : 0
  const adRows = showAds ? AD_CARD_HEIGHT : 0
  const streakRows = !showStreakIndicator ? 0 : streakOnHeadingRow ? 0 : 1
  const noticeRows = belowPickerNotices.reduce(
    (rows, notice) => rows + 1  + wrappedRows(notice),
    0,
  )
  const streakBonusRows = streakBonusNote
    ? 1  + wrappedRows(streakBonusNote)
    : 0
  const belowPickerRows = streakRows + noticeRows + streakBonusRows
  const reservedChrome = 2 + adRows + 1  + logoBlockRows
  const landingTextRows =
    wrappedRows(LANDING_HEADING) + textMarginBottom + belowPickerRows
  const MIN_SELECTOR_ROWS = 4
  const selectorMaxHeight = Math.max(
    MIN_SELECTOR_ROWS,
    terminalHeight - reservedChrome - landingTextRows,
  )

  useEffect(() => {
    if (!isLanding || !sessionRateLimit) return

    const delayMs = Math.max(0, sessionResetAtMs - Date.now() + 1_000)
    const timer = setTimeout(() => {
      refreshFreebuffLandingMetadata().catch(() => {})
    }, delayMs)

    return () => clearTimeout(timer)
  }, [isLanding, sessionRateLimit, sessionResetAtMs])

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        backgroundColor: theme.background,
      }}
    >
      <box
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 1,
          paddingLeft: 2,
          paddingRight: 2,
          flexShrink: 0,
        }}
      >
        <box />
        <Button
          onClick={() => exitCliCleanly()}
          onMouseOver={() => setExitHover(true)}
          onMouseOut={() => setExitHover(false)}
          style={{ paddingLeft: 1, paddingRight: 1 }}
        >
          <text
            style={{ fg: exitHover ? theme.foreground : theme.muted }}
            attributes={TextAttributes.BOLD}
          >
            ✕
          </text>
        </Button>
      </box>

      <box
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: showFullLogo ? 'flex-end' : 'flex-start',
          paddingLeft: 2,
          paddingRight: 2,
          paddingBottom: 1,
          gap: showFullLogo ? 1 : 0,
        }}
      >
        {showFullLogo && (
          <box style={{ marginBottom: 1, flexShrink: 0 }}>{logoComponent}</box>
        )}

        <box
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            maxWidth: contentMaxWidth,
          }}
        >
          {failure && (!session || session.status === 'none') && (
            <text style={{ fg: theme.secondary, wrapMode: 'word' }}>
              ⚠ {failure.message}
            </text>
          )}

          {!session && !failure && (
            <text style={{ fg: theme.muted }}>
              <ShimmerText text="Connecting…" />
            </text>
          )}

          {isLanding && (
            <box
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0,
              }}
            >
              <LandingHeadingRow
                streakLine={streakOnHeadingRow ? streakLine : null}
                marginBottom={textMarginBottom}
              />
              {showStreakIndicator && !streakOnHeadingRow && (
                <StreakInlineLine line={streakLine} />
              )}
              <FreebuffModelSelector
                maxHeight={selectorMaxHeight}
                onExpandedChange={setSelectorExpanded}
                belowToggle={
                  showBelowPickerCounter ? (
                    <text
                      style={{
                        fg: theme.muted,
                        marginTop: 1,
                        wrapMode: 'word',
                      }}
                    >
                      <span fg={sessionUsedColor}>
                        {formattedSharedSessionUsed} of {sessionLimit}{' '}
                        {sessionLabel} used
                      </span>
                      <span fg={theme.muted}>
                        {', '}
                        resets in {sessionResetCountdown}
                      </span>
                    </text>
                  ) : null
                }
              />
              {belowPickerNotices.map((notice) => (
                <text
                  key={notice}
                  style={{ fg: theme.muted, wrapMode: 'word', marginTop: 1 }}
                >
                  {notice}
                </text>
              ))}
              {streakBonusNote && (
                <text
                  style={{ fg: theme.primary, wrapMode: 'word', marginTop: 1 }}
                >
                  {streakBonusNote}
                </text>
              )}
            </box>
          )}

          {session?.status === 'takeover_prompt' && (
            <TakeoverPrompt failure={failure} />
          )}

          {session?.status === 'country_blocked' && (
            <>
              <text style={{ fg: theme.secondary, marginBottom: 1 }}>
                ⚠ Free mode isn't available in your region
              </text>
              <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                {session.countryBlockReason === 'anonymous_network' ? (
                  <>
                    We detected{' '}
                    {formatFreebuffHardBlockedPrivacySignals(
                      session.ipPrivacySignals,
                    )}{' '}
                    traffic
                    {session.countryCode === 'UNKNOWN' ? (
                      ''
                    ) : (
                      <>
                        {' '}
                        from{' '}
                        <span fg={theme.foreground}>{session.countryCode}</span>
                      </>
                    )}
                    . Freebuff can't be used from VPN, proxy, or Tor traffic.
                    Disable it and restart Freebuff to try again.
                  </>
                ) : session.countryCode === 'UNKNOWN' ? (
                  <>
                    We couldn't verify an eligible location for this request.
                    VPN, Tor, proxy, or unknown-location traffic can't use
                    freebuff. Press Ctrl+C to exit.
                  </>
                ) : (
                  <>
                    We detected your location as{' '}
                    <span fg={theme.foreground}>{session.countryCode}</span>,
                    which is outside the countries where freebuff is currently
                    offered. Press Ctrl+C to exit.
                  </>
                )}
              </text>
            </>
          )}

          {session?.status === 'banned' && (
            <>
              <text style={{ fg: theme.secondary, marginBottom: 1 }}>
                ⚠ Account unavailable
              </text>
              <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                This account has been suspended and can't use freebuff. If you
                think this is a mistake, contact support@codebuff.com. Press
                Ctrl+C to exit.
              </text>
            </>
          )}

          {session?.status === 'rate_limited' && (
            <>
              <text style={{ fg: theme.secondary, marginBottom: 1 }}>
                ⚠ Session limit reached
              </text>
              <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                You've used{' '}
                <span fg={theme.foreground}>
                  {formatSessionUnits(session.recentCount)} of {session.limit}
                </span>{' '}
                sessions{' '}
                {session.period === 'pacific_week' ? 'this week' : 'today'}. Try
                again in{' '}
                <span fg={theme.foreground}>
                  {formatRetryAfter(session.retryAfterMs)}
                </span>
                . Press Ctrl+C to exit.
              </text>
            </>
          )}

          {session?.status === 'spend_limited' && (
            <>
              <text style={{ fg: theme.secondary, marginBottom: 1 }}>
                ☕ Daily Freebuff limit reached
              </text>
              <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                {session.message} Come back in{' '}
                <span fg={theme.foreground}>
                  {formatRetryAfter(session.retryAfterMs)}
                </span>
                {' — '}your free usage resets automatically at midnight Pacific.
                Press Ctrl+C to exit.
              </text>
            </>
          )}

          {session?.status === 'ip_capped' && (
            <>
              <text style={{ fg: theme.secondary, marginBottom: 1 }}>
                🚦 Too many Freebuff sessions on this network
              </text>
              <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                {session.activeUsersForIp} other people are already using
                Freebuff from your network, which is the most we allow at once.
                Try again in{' '}
                <span fg={theme.foreground}>
                  {formatRetryAfter(session.retryAfterMs)}
                </span>
                {' — '}a slot opens as soon as one of them finishes. Press
                Ctrl+C to exit.
              </text>
            </>
          )}
        </box>
      </box>

      {showAds && (
        <box
          style={{
            width: '100%',
            flexShrink: 0,
            height: AD_CARD_HEIGHT,
          }}
        >
          {ads ? (
            <ChoiceAdBanner
              ads={ads}
              placementIds={waitingRoomPlacementIds}
              onClick={recordClick}
              onImpression={recordImpression}
            />
          ) : (
            <text style={{ fg: theme.muted }}>{'─'.repeat(terminalWidth)}</text>
          )}
        </box>
      )}
    </box>
  )
}
