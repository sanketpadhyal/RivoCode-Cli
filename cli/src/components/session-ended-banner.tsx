import {
  FALLBACK_FREEBUFF_MODEL_ID,
  isFreebuffPremiumModelId,
  SUPPORTED_FREEBUFF_MODELS,
  type FreebuffModelOption,
} from '@rivocode/common/constants/freebuff-models'
import { getRateLimitsByModel } from '@rivocode/common/types/freebuff-session'
import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useState } from 'react'

import { Button } from './button'
import {
  refreshFreebuffSession,
  returnToFreebuffLanding,
} from '../hooks/use-freebuff-session'
import { useTheme } from '../hooks/use-theme'
import { useFreebuffModelStore } from '../state/freebuff-model-store'
import { useFreebuffSessionStore } from '../state/freebuff-session-store'
import { formatSessionUnits } from '../utils/format-session-units'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { KeyEvent } from '@opentui/core'

interface SessionEndedBannerProps {
  isStreaming: boolean
}

export const SessionEndedBanner: React.FC<SessionEndedBannerProps> = ({
  isStreaming,
}) => {
  const theme = useTheme()
  const [pendingAction, setPendingAction] = useState<
    'landing' | 'same-chat' | null
  >(null)

  const premiumQuota = useFreebuffSessionStore(
    (s) => Object.values(getRateLimitsByModel(s.session) ?? {})[0] ?? null,
  )
  const isQuotaExhausted = premiumQuota
    ? premiumQuota.recentCount >= premiumQuota.limit
    : false
  const accessTier = useFreebuffSessionStore((s) =>
    s.session && 'accessTier' in s.session ? s.session.accessTier : 'full',
  )
  const quotaLabel = accessTier === 'limited' ? 'sessions' : 'premium sessions'
  const bannerTitle = premiumQuota
    ? `Session ended  ·  ${formatSessionUnits(premiumQuota.recentCount)} of ${premiumQuota.limit} ${quotaLabel} used today`
    : 'Session ended'
  const landingButtonLabel = 'Change model'
  const landingPendingLabel = 'Opening model selection…'

  const selectedModel = useFreebuffModelStore((s) => s.selectedModel)
  const continueOnFallback =
    isQuotaExhausted &&
    accessTier !== 'limited' &&
    isFreebuffPremiumModelId(selectedModel)
  const fallbackModel: FreebuffModelOption | undefined =
    SUPPORTED_FREEBUFF_MODELS.find((m) => m.id === FALLBACK_FREEBUFF_MODEL_ID)
  const fallbackModelName = fallbackModel?.displayName ?? 'DeepSeek V4 Flash'
  const fallbackWarning = fallbackModel?.warning

  const canRestart = !isStreaming && pendingAction === null
  const pickNewModel = useCallback(() => {
    if (!canRestart) return
    setPendingAction('landing')
    returnToFreebuffLanding({ resetChat: true }).catch(() =>
      setPendingAction(null),
    )
  }, [canRestart])

  const startSameChatSession = useCallback(() => {
    if (!canRestart) return
    setPendingAction('same-chat')
    if (continueOnFallback) {
      useFreebuffModelStore
        .getState()
        .setSelectedModel(FALLBACK_FREEBUFF_MODEL_ID)
    }
    refreshFreebuffSession().catch(() => setPendingAction(null))
  }, [canRestart, continueOnFallback])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (!canRestart) return
        if (isPlainEnterKey(key)) {
          key.preventDefault?.()
          startSameChatSession()
          return
        }
        if (key.name === 'escape') {
          key.preventDefault?.()
          pickNewModel()
        }
      },
      [startSameChatSession, pickNewModel, canRestart],
    ),
  )

  return (
    <box
      title={bannerTitle}
      titleAlignment="center"
      style={{
        width: '100%',
        borderStyle: 'single',
        borderColor: isQuotaExhausted ? theme.secondary : theme.muted,
        customBorderChars: BORDER_CHARS,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {isStreaming ? (
        <text style={{ fg: theme.muted, wrapMode: 'word' }}>
          Agent is wrapping up. Rejoin the wait room after it's finished.
        </text>
      ) : (
        <box
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Button onClick={startSameChatSession}>
            <text
              style={{
                fg:
                  pendingAction === 'same-chat'
                    ? theme.muted
                    : theme.foreground,
              }}
              attributes={TextAttributes.BOLD}
            >
              {pendingAction === 'same-chat'
                ? 'Starting…'
                : continueOnFallback
                  ? `Press Enter to continue with ${fallbackModelName}`
                  : 'Press Enter to continue in a new session'}
            </text>
          </Button>
          <box style={{ flexGrow: 1 }} />
          <Button
            onClick={pickNewModel}
            style={{
              borderStyle: 'single',
              borderColor:
                pendingAction === 'landing' ? theme.muted : theme.border,
              customBorderChars: BORDER_CHARS,
              paddingLeft: 1,
              paddingRight: 1,
            }}
            border={['top', 'bottom', 'left', 'right']}
          >
            <text
              style={{
                fg:
                  pendingAction === 'landing'
                    ? theme.muted
                    : theme.foreground,
              }}
            >
              {pendingAction === 'landing' ? (
                landingPendingLabel
              ) : (
                <>
                  {landingButtonLabel}
                  <span fg={theme.muted}>{'   Esc'}</span>
                </>
              )}
            </text>
          </Button>
        </box>
      )}
      {!isStreaming && continueOnFallback && fallbackWarning && (
        <text style={{ fg: theme.secondary, wrapMode: 'word' }}>
          {`${fallbackModelName} ${fallbackWarning.toLowerCase()}.`}
        </text>
      )}
    </box>
  )
}
