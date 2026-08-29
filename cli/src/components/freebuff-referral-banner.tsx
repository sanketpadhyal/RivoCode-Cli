import {
  FREEBUFF_EARN_PATH,
  FREEBUFF_EARN_PROMPT_SHORT,
} from '@codebuff/common/constants/freebuff-levels'
import { TextAttributes } from '@opentui/core'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from './button'
import { useCopyToClipboard } from './copy-button'
import { FREEBUFF_GLM_V52_MODEL_ID } from '@codebuff/common/constants/freebuff-models'
import { FREEBUFF_GLM_V52_MAX_DAILY_SESSIONS } from '@codebuff/common/constants/freebuff-models'
import { REFERRAL_CLI_DAILY_SESSION_BONUS_CAP } from '@codebuff/common/constants/freebuff-referral-tiers'
import { pluralize } from '@codebuff/common/util/string'

import { startFreebuffSession } from '../hooks/use-freebuff-session'
import { useNow } from '../hooks/use-now'
import { useTheme } from '../hooks/use-theme'
import { LOGIN_WEBSITE_URL } from '../login/constants'
import { formatFreebuffPremiumResetCountdown } from '../utils/freebuff-premium-reset'
import { safeOpen } from '../utils/open-url'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { FreebuffAccessTier } from '@codebuff/common/constants/freebuff-models'
import type {
  FreebuffGlmPromo,
  FreebuffReferralInfo,
} from '@codebuff/common/types/freebuff-session'

function referralLink(code: string, referrerName: string | null): string {
  const params = new URLSearchParams({ ref: code })
  if (referrerName) params.set('referrer', referrerName)
  return `${LOGIN_WEBSITE_URL}/get-started?${params.toString()}`
}

const EARN_URL = `${LOGIN_WEBSITE_URL}${FREEBUFF_EARN_PATH}`
const DASHBOARD_LABEL = `${FREEBUFF_EARN_PROMPT_SHORT} ↵`
const DASHBOARD_GUTTER = '  '
const DASHBOARD_BUTTON_WIDTH = DASHBOARD_LABEL.length + DASHBOARD_GUTTER.length

function BountyPromoLine({
  theme,
  promo,
}: {
  theme: ReturnType<typeof useTheme>
  promo?: FreebuffGlmPromo
}) {
  if (!promo) return null
  return (
    <text style={{ wrapMode: 'word' }}>
      <span fg={theme.success ?? theme.foreground}>
        ✦ Promo: earn a bounty, spend up to {promo.dailySessions} a day
      </span>
      <span fg={theme.muted}> (ends {formatPromoEnd(promo.endsAt)})</span>
    </text>
  )
}

function DashboardButton({
  theme,
  focused,
  onOpen,
}: {
  theme: ReturnType<typeof useTheme>
  focused: boolean
  onOpen: () => void
}) {
  return (
    <Button onClick={onOpen}>
      <text style={{ wrapMode: 'word' }}>
        <span
          fg={focused ? theme.primary : theme.secondary}
          attributes={focused ? TextAttributes.BOLD : TextAttributes.NONE}
        >
          {DASHBOARD_GUTTER}
          {DASHBOARD_LABEL}
        </span>
      </text>
    </Button>
  )
}

function formatPromoEnd(endsAt: string): string {
  const at = new Date(endsAt)
  return Number.isNaN(at.getTime())
    ? 'soon'
    : at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const COPY_FOCUS_ID = '__freebuff_referral_copy__'
const GLM_FOCUS_ID = '__freebuff_referral_glm__'
const DASHBOARD_FOCUS_ID = '__freebuff_referral_dashboard__'
const BUTTON_HORIZONTAL_CHROME = 6

export interface FreebuffReferralFocusTarget {
  id: string
  activate: () => void
}

const shouldStackFreebuffReferralActions = (width: number): boolean =>
  width < 70

const firstLabelThatFits = (
  availableWidth: number,
  labels: readonly string[],
  chrome: number = BUTTON_HORIZONTAL_CHROME,
): string =>
  labels.find((label) => label.length + chrome <= availableWidth) ??
  labels.at(-1)!

const CopyInviteLinkButton: React.FC<{
  isCopied: boolean
  focused: boolean
  onCopy: () => void
  availableWidth: number
  labels?: readonly string[]
  variant?: 'bordered' | 'inline'
}> = ({
  isCopied,
  focused,
  onCopy,
  availableWidth,
  labels = ['⎘ Copy invite link', '⎘ Copy link', '⎘ Copy'],
  variant = 'bordered',
}) => {
  const theme = useTheme()
  const [isHovered, setIsHovered] = useState(false)
  const inline = variant === 'inline'
  const chrome = inline ? 0 : BUTTON_HORIZONTAL_CHROME
  const label = firstLabelThatFits(availableWidth, labels, chrome)
  const copiedLabel = firstLabelThatFits(
    availableWidth,
    ['✔ Copied!', '✔'],
    chrome,
  )
  const highlighted = isCopied || focused || isHovered

  if (inline) {
    return (
      <Button
        id={COPY_FOCUS_ID}
        onClick={onCopy}
        onMouseOver={() => setIsHovered(true)}
        onMouseOut={() => setIsHovered(false)}
        style={{ flexShrink: 0 }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span
            fg={highlighted ? theme.primary : theme.foreground}
            attributes={
              isCopied || focused ? TextAttributes.BOLD : TextAttributes.NONE
            }
          >
            {isCopied ? copiedLabel : label}
          </span>
        </text>
      </Button>
    )
  }

  const borderColor = isCopied
    ? theme.primary
    : focused
      ? theme.primary
      : isHovered
        ? theme.foreground
        : theme.border
  const fg = isCopied
    ? theme.primary
    : focused || isHovered
      ? theme.foreground
      : theme.muted

  return (
    <Button
      id={COPY_FOCUS_ID}
      onClick={onCopy}
      onMouseOver={() => setIsHovered(true)}
      onMouseOut={() => setIsHovered(false)}
      border
      borderStyle="rounded"
      borderColor={borderColor}
      customBorderChars={BORDER_CHARS}
      style={{
        paddingLeft: 2,
        paddingRight: 2,
        backgroundColor: 'transparent',
        flexShrink: 0,
      }}
    >
      <text style={{ wrapMode: 'none' }}>
        <span fg={fg}>{isCopied ? copiedLabel : label}</span>
      </text>
    </Button>
  )
}

interface FreebuffReferralBannerProps {
  width: number
  referral: FreebuffReferralInfo
  glmPromo?: FreebuffGlmPromo
  accessTier: FreebuffAccessTier
  focusedId: string
  onFocusTargetsChange: (targets: FreebuffReferralFocusTarget[]) => void
}

export const FreebuffReferralBanner: React.FC<FreebuffReferralBannerProps> = ({
  width,
  referral,
  glmPromo,
  accessTier,
  focusedId,
  onFocusTargetsChange,
}) => {
  const theme = useTheme()
  const now = useNow(60_000)
  const [joining, setJoining] = useState(false)
  const joiningRef = useRef(false)
  const [glmHovered, setGlmHovered] = useState(false)
  const copyFocused = focusedId === COPY_FOCUS_ID
  const glmFocused = focusedId === GLM_FOCUS_ID
  const dashboardFocused = focusedId === DASHBOARD_FOCUS_ID

  const useGlm = useCallback(() => {
    if (joiningRef.current) return
    joiningRef.current = true
    setJoining(true)
    startFreebuffSession(FREEBUFF_GLM_V52_MODEL_ID).finally(() => {
      joiningRef.current = false
      setJoining(false)
    })
  }, [])

  const link = referralLink(referral.code, referral.referrerName)
  const { isCopied, copy } = useCopyToClipboard(link)

  const isLocked = (referral.weeklySessionsRemaining ?? 0) <= 0
  const openDashboard = useCallback(() => {
    void safeOpen(EARN_URL)
  }, [])
  const lockedReferralActions = (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        marginTop: 1,
        flexShrink: 0,
      }}
    >
      <CopyInviteLinkButton
        isCopied={isCopied}
        focused={copyFocused}
        onCopy={copy}
        availableWidth={Math.max(0, width - DASHBOARD_BUTTON_WIDTH)}
        variant="inline"
      />
      <DashboardButton
        theme={theme}
        focused={dashboardFocused}
        onOpen={openDashboard}
      />
    </box>
  )

  useEffect(() => {
    onFocusTargetsChange(
      isLocked
        ? [
            { id: COPY_FOCUS_ID, activate: copy },
            { id: DASHBOARD_FOCUS_ID, activate: openDashboard },
          ]
        : [
            { id: GLM_FOCUS_ID, activate: useGlm },
            { id: COPY_FOCUS_ID, activate: copy },
            { id: DASHBOARD_FOCUS_ID, activate: openDashboard },
          ],
    )
    return () => onFocusTargetsChange([])
  }, [isLocked, copy, useGlm, openDashboard, onFocusTargetsChange])

  const { qualifiedCount, githubLinked } = referral

  if (accessTier === 'limited' && isLocked) {
    const atCap = qualifiedCount >= REFERRAL_CLI_DAILY_SESSION_BONUS_CAP
    return (
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0,
          marginTop: 1,
          flexShrink: 0,
        }}
      >
        <text style={{ wrapMode: 'word' }}>
          <span fg={theme.muted}>✦ </span>
          {qualifiedCount > 0 ? (
            <>
              <span fg={theme.foreground}>
                +{pluralize(qualifiedCount, 'session')}/day
              </span>
              <span fg={theme.muted}>
                {' '}
                from referrals
                {atCap
                  ? ''
                  : ` · refer more (${qualifiedCount}/${REFERRAL_CLI_DAILY_SESSION_BONUS_CAP}):`}
              </span>
            </>
          ) : (
            <span fg={theme.muted}>
              Refer friends to unlock more free sessions per day:
            </span>
          )}
        </text>
        {lockedReferralActions}
        <BountyPromoLine theme={theme} promo={glmPromo} />
      </box>
    )
  }

  const weeklySessionsRemaining = referral.weeklySessionsRemaining ?? 0
  const resetsIn = formatFreebuffPremiumResetCountdown(
    referral.resetAt ? new Date(referral.resetAt) : new Date(now),
    now,
    {
      withDays: true,
    },
  )

  if (weeklySessionsRemaining <= 0) {
    return (
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0,
          marginTop: 1,
          flexShrink: 0,
        }}
      >
        <text style={{ wrapMode: 'word' }}>
          <span fg={theme.muted}>✦ </span>
          {qualifiedCount > 0 ? (
            <>
              <span fg={theme.foreground}>GLM 5.2</span>
              <span fg={theme.muted}>
                {' '}
                refills in {resetsIn}
                {qualifiedCount >= FREEBUFF_GLM_V52_MAX_DAILY_SESSIONS
                  ? ''
                  : ` · refer more (${qualifiedCount}/${FREEBUFF_GLM_V52_MAX_DAILY_SESSIONS}):`}
              </span>
            </>
          ) : (
            <>
              <span fg={theme.muted}>Refer friends → </span>
              <span fg={theme.foreground}>GLM 5.2</span>
              <span fg={theme.muted}>, top open-source model:</span>
            </>
          )}
        </text>
        {lockedReferralActions}
        <BountyPromoLine theme={theme} promo={glmPromo} />
      </box>
    )
  }

  const sessionsLeft = Math.max(1, Math.ceil(weeklySessionsRemaining))
  const stackActions = shouldStackFreebuffReferralActions(width)
  const actionRowWidth = width - 4
  const glmLabel = firstLabelThatFits(actionRowWidth, [
    '▶ Use GLM 5.2 ↵',
    '▶ GLM 5.2',
    '▶ GLM',
  ])
  const inviteAvailableWidth = stackActions
    ? actionRowWidth - DASHBOARD_BUTTON_WIDTH
    : actionRowWidth -
      (glmLabel.length + BUTTON_HORIZONTAL_CHROME) -
      2 -
      DASHBOARD_BUTTON_WIDTH
  const glmAtCap = qualifiedCount >= FREEBUFF_GLM_V52_MAX_DAILY_SESSIONS
  const inviteLabels = glmAtCap
    ? ['⎘ Invite a friend', '⎘ Invite']
    : [
        `⎘ Invite for +1/day (${qualifiedCount} earned)`,
        '⎘ Invite +1/day',
        '⎘ Invite',
      ]
  const githubLabel =
    actionRowWidth >=
    'Signed up with Google? Connect GitHub to qualify ↗'.length
      ? 'Signed up with Google? Connect GitHub to qualify ↗'
      : 'Connect GitHub to qualify ↗'

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        paddingLeft: 1,
        paddingRight: 1,
        borderStyle: 'rounded',
        borderColor: theme.muted,
        marginTop: 1,
        width,
        flexShrink: 0,
      }}
      border={['top', 'bottom', 'left', 'right']}
      title=" ✦ GLM 5.2 unlocked "
      titleAlignment="left"
    >
      <text style={{ wrapMode: 'word' }}>
        <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
          {pluralize(sessionsLeft, 'session')}
        </span>
        <span fg={theme.foreground}> available today</span>
        <span fg={theme.muted}> · resets in {resetsIn}</span>
      </text>

      <box
        style={{
          flexDirection: stackActions ? 'column' : 'row',
          alignItems: stackActions ? 'flex-start' : 'center',
          gap: stackActions ? 0 : 2,
        }}
      >
        <Button
          id={GLM_FOCUS_ID}
          onClick={useGlm}
          onMouseOver={() => setGlmHovered(true)}
          onMouseOut={() => setGlmHovered(false)}
          border
          borderStyle="rounded"
          borderColor={
            glmFocused
              ? theme.primary
              : glmHovered
                ? theme.foreground
                : theme.border
          }
          customBorderChars={BORDER_CHARS}
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            backgroundColor: 'transparent',
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span
              fg={
                joining
                  ? theme.muted
                  : glmFocused || glmHovered
                    ? theme.foreground
                    : theme.muted
              }
              attributes={TextAttributes.BOLD}
            >
              {joining ? 'Starting…' : glmLabel}
            </span>
          </text>
        </Button>
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
            flexShrink: 0,
          }}
        >
          <CopyInviteLinkButton
            isCopied={isCopied}
            focused={copyFocused}
            onCopy={copy}
            availableWidth={inviteAvailableWidth}
            labels={inviteLabels}
          />
          <DashboardButton
            theme={theme}
            focused={dashboardFocused}
            onOpen={openDashboard}
          />
        </box>
      </box>

      <BountyPromoLine theme={theme} promo={glmPromo} />

      {!githubLinked && (
        <Button
          onClick={() => void safeOpen(`${LOGIN_WEBSITE_URL}/web/settings`)}
        >
          <text style={{ wrapMode: 'word' }}>
            <span fg={theme.secondary}>{githubLabel}</span>
          </text>
        </Button>
      )}
    </box>
  )
}
