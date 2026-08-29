import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Button } from './button'
import { FreebuffReferralBanner } from './freebuff-referral-banner'
import {
  FREEBUFF_GLM_V52_MODEL_ID,
  getFreebuffDeploymentAvailabilityLabel,
  getFreebuffModelUnavailableLabel,
  getFreebuffModel,
  getFreebuffModelSupersededBy,
  getFreebuffModelsForAccessTier,
  getRecommendedFreebuffModelId,
  isFreebuffGlmV52ModelId,
  isFreebuffModelAvailable,
  isFreebuffPremiumModelId,
  isSupportedFreebuffModelId,
} from '@codebuff/common/constants/freebuff-models'
import {
  formatFreebuffRowQuota,
  getFreebuffSectionQuotas,
} from '@codebuff/common/util/freebuff-session-pools'
import {
  getLimitedModelOffers,
  getRateLimitsByModel,
  getGlmPromo,
  getReferralInfo,
  getSubscriptionInfo,
} from '@codebuff/common/types/freebuff-session'

import {
  formatPlanWindows,
  freebuffPlanSummary,
} from '@codebuff/common/util/freebuff-plan-summary'

import { startFreebuffSession } from '../hooks/use-freebuff-session'
import { useNow } from '../hooks/use-now'
import { useFreebuffModelStore } from '../state/freebuff-model-store'
import { useFreebuffSessionStore } from '../state/freebuff-session-store'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import {
  freebuffModelNavigationDirectionForKey,
  nextFreebuffModelId,
} from '../utils/freebuff-model-navigation'
import { formatSessionUnits } from '../utils/format-session-units'
import {
  formatFreebuffPremiumResetCountdown,
  getFreebuffPremiumResetAt,
} from '../utils/freebuff-premium-reset'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type {
  FreebuffAccessTier,
  FreebuffModelOption,
} from '@codebuff/common/constants/freebuff-models'
import type { FreebuffReferralFocusTarget } from './freebuff-referral-banner'
import type {
  BoxRenderable,
  KeyEvent,
  ScrollBoxRenderable,
} from '@opentui/core'

type Section = {
  key: 'premium' | 'unlimited' | 'limited' | 'offer'
  label: string
  models: readonly FreebuffModelOption[]
}

const TOGGLE_ID = '__freebuff_toggle__'

const DETAIL_SEPARATOR = ' · '

interface FreebuffModelSelectorProps {
  maxHeight: number
  onExpandedChange?: (expanded: boolean) => void
  belowToggle?: React.ReactNode
  nowMs?: number
}

function gridModels(
  accessTier: FreebuffAccessTier,
  hasPaidSubscription = false,
): readonly FreebuffModelOption[] {
  return getFreebuffModelsForAccessTier(accessTier, hasPaidSubscription).filter(
    (m) => !isFreebuffGlmV52ModelId(m.id),
  )
}

export function freebuffCliOfferedModelIds(
  accessTier: FreebuffAccessTier,
  hasPaidSubscription = false,
): readonly string[] {
  return [
    ...gridModels(accessTier, hasPaidSubscription).map((m) => m.id),
    FREEBUFF_GLM_V52_MODEL_ID,
  ]
}

export const FreebuffModelSelector: React.FC<FreebuffModelSelectorProps> = ({
  maxHeight,
  onExpandedChange,
  belowToggle,
  nowMs,
}) => {
  const theme = useTheme()
  const { contentMaxWidth } = useTerminalDimensions()
  const selectedModel = useFreebuffModelStore((s) => s.selectedModel)
  const setSelectedModel = useFreebuffModelStore((s) => s.setSelectedModel)
  const reasoningEffortByModel = useFreebuffModelStore(
    (s) => s.reasoningEffortByModel,
  )
  const session = useFreebuffSessionStore((s) => s.session)
  const accessTier =
    (session && 'accessTier' in session ? session.accessTier : undefined) ??
    'full'
  const liveNow = useNow(60_000, nowMs === undefined)
  const now = nowMs ?? liveNow
  const deploymentAvailabilityLabel = useMemo(
    () => getFreebuffDeploymentAvailabilityLabel(new Date(now)),
    [now],
  )
  const [pending, setPending] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const subscriptionInfo = getSubscriptionInfo(session)
  const hasPaidSubscription = Boolean(subscriptionInfo?.tierId)
  const planSummary = freebuffPlanSummary(subscriptionInfo)
  const availableModels = useMemo(
    () => gridModels(accessTier, hasPaidSubscription),
    [accessTier, hasPaidSubscription],
  )
  const offers = useMemo(
    () =>
      getLimitedModelOffers(session).filter((offer) =>
        isSupportedFreebuffModelId(offer.model),
      ),
    [session],
  )
  const offerModels = useMemo(
    () => offers.map((offer) => getFreebuffModel(offer.model)),
    [offers],
  )
  const offerByModelId = useMemo(
    () => new Map(offers.map((offer) => [offer.model, offer])),
    [offers],
  )
  const committedModelId: string | null = null
  const rateLimitsByModel = getRateLimitsByModel(session)
  const referral = getReferralInfo(session)
  const glmPromo = getGlmPromo(session)

  const premiumSectionQuotas = getFreebuffSectionQuotas(
    availableModels
      .filter((m) => isFreebuffPremiumModelId(m.id))
      .map((m) => m.id),
    rateLimitsByModel,
  )
  const sharedRateLimit = premiumSectionQuotas.header
  const premiumUsed = sharedRateLimit?.recentCount ?? 0
  const premiumLimit = sharedRateLimit?.limit ?? null
  const premiumExhausted = premiumLimit !== null && premiumUsed >= premiumLimit
  const premiumResetCountdown = sharedRateLimit
    ? formatFreebuffPremiumResetCountdown(
        getFreebuffPremiumResetAt({ rateLimitsByModel, nowMs: now }),
        now,
      )
    : null

  const rowDetails = useCallback(
    (model: FreebuffModelOption): { text: string; warn: boolean }[] => {
      const details: { text: string; warn: boolean }[] = []
      if (model.warning) details.push({ text: model.warning, warn: true })
      if (model.availability === 'deployment_hours') {
        details.push({ text: deploymentAvailabilityLabel, warn: false })
      } else {
        const closed = getFreebuffModelUnavailableLabel(model.id, new Date(now))
        if (closed) details.push({ text: closed, warn: true })
      }
      const ownQuota = premiumSectionQuotas.perModel[model.id]
      if (ownQuota) {
        details.push({
          text: formatFreebuffRowQuota(ownQuota),
          warn: ownQuota.recentCount >= ownQuota.limit,
        })
      }
      return details
    },
    [deploymentAvailabilityLabel, now, premiumSectionQuotas],
  )
  const rowDetailsText = useCallback(
    (model: FreebuffModelOption): string =>
      rowDetails(model)
        .map((detail) => detail.text)
        .join(DETAIL_SEPARATOR),
    [rowDetails],
  )

  const recommendedModel = useMemo(() => {
    const id = getRecommendedFreebuffModelId(accessTier, { premiumExhausted })
    return availableModels.find((m) => m.id === id) ?? availableModels[0]!
  }, [accessTier, availableModels, premiumExhausted])

  const supersededNoticeFor = useCallback(
    (model: FreebuffModelOption): string | undefined =>
      model.id === selectedModel
        ? getFreebuffModelSupersededBy(
            model.id,
            availableModels.map((m) => m.id),
          )?.notice
        : undefined,
    [availableModels, selectedModel],
  )
  const otherModels = useMemo(
    () => availableModels.filter((m) => m.id !== recommendedModel.id),
    [availableModels, recommendedModel],
  )
  const canCollapse = otherModels.length >= 2

  const isJoinable = useCallback(
    (modelId: string) => {
      if (!isFreebuffModelAvailable(modelId, new Date(now))) return false
      const offer = offerByModelId.get(modelId)
      if (offer) return offer.userRemaining > 0
      const rateLimit = rateLimitsByModel?.[modelId]
      return !rateLimit || rateLimit.recentCount < rateLimit.limit
    },
    [now, offerByModelId, rateLimitsByModel],
  )

  const isLanding = session?.status === 'none' || !session
  const [expanded, setExpanded] = useState(
    () =>
      !canCollapse ||
      !isLanding ||
      (selectedModel !== recommendedModel.id && isJoinable(selectedModel)),
  )
  const showStandaloneRecommended = !expanded || accessTier === 'limited'
  useLayoutEffect(() => {
    if (!canCollapse && !expanded) {
      setExpanded(true)
      return
    }
    onExpandedChange?.(expanded)
  }, [canCollapse, expanded, onExpandedChange])

  const [focusedId, setFocusedId] = useState<string>(() => selectedModel)

  const [extraTargets, setExtraTargets] = useState<
    FreebuffReferralFocusTarget[]
  >([])
  const extraTargetIds = useMemo(
    () => extraTargets.map((t) => t.id),
    [extraTargets],
  )
  const contentRef = useRef<BoxRenderable | null>(null)
  const [measuredContentHeight, setMeasuredContentHeight] = useState<
    number | null
  >(null)
  const syncContentHeight = useCallback(() => {
    const nextHeight = contentRef.current?.height
    if (!nextHeight) return
    setMeasuredContentHeight((current) =>
      current === nextHeight ? current : nextHeight,
    )
  }, [])
  const catalogSections = useMemo(() => {
    if (!expanded) return [] as readonly Section[]
    if (accessTier === 'limited') {
      return [
        { key: 'limited', label: '', models: otherModels },
      ] satisfies readonly Section[]
    }
    return (
      [
        {
          key: 'premium',
          label: 'PREMIUM',
          models: availableModels.filter((m) => isFreebuffPremiumModelId(m.id)),
        },
        {
          key: 'unlimited',
          label: 'UNLIMITED',
          models: availableModels.filter(
            (m) => !isFreebuffPremiumModelId(m.id),
          ),
        },
      ] satisfies readonly Section[]
    ).filter((section) => section.models.length > 0)
  }, [expanded, accessTier, availableModels, otherModels])

  const renderedSections = useMemo(
    () =>
      offerModels.length > 0
        ? [
            {
              key: 'offer' as const,
              label: 'LIMITED TRIAL',
              models: offerModels,
            },
            ...catalogSections,
          ]
        : catalogSections,
    [offerModels, catalogSections],
  )

  const renderedModelIds = useMemo(
    () => [
      ...(showStandaloneRecommended ? [recommendedModel.id] : []),
      ...renderedSections.flatMap((section) => section.models.map((m) => m.id)),
    ],
    [recommendedModel, renderedSections, showStandaloneRecommended],
  )
  const navIds = useMemo(
    () => [
      ...renderedModelIds,
      ...(canCollapse ? [TOGGLE_ID] : []),
      ...extraTargetIds,
    ],
    [canCollapse, renderedModelIds, extraTargetIds],
  )

  useEffect(() => {
    setFocusedId((curr) =>
      navIds.includes(curr)
        ? curr
        : navIds.includes(selectedModel)
          ? selectedModel
          : recommendedModel.id,
    )
  }, [navIds, recommendedModel.id, selectedModel])

  useEffect(() => {
    const selectionIsStartable = isFreebuffGlmV52ModelId(selectedModel)
      ? (referral?.weeklySessionsRemaining ?? 0) > 0
      : renderedModelIds.includes(selectedModel) && isJoinable(selectedModel)
    if (isLanding && !selectionIsStartable) {
      setSelectedModel(recommendedModel.id)
      setFocusedId(recommendedModel.id)
    }
  }, [
    referral?.weeklySessionsRemaining,
    renderedModelIds,
    isLanding,
    isJoinable,
    recommendedModel.id,
    selectedModel,
    setSelectedModel,
  ])

  const reasoningSuffixFor = useCallback(
    (model: FreebuffModelOption): string => {
      const chosen = reasoningEffortByModel[model.id]
      if (chosen && model.efforts?.includes(chosen)) {
        return ` · Reasoning: ${chosen}*`
      }
      return model.reasoningEffort
        ? ` · Reasoning: ${model.reasoningEffort}`
        : ''
    },
    [reasoningEffortByModel],
  )

  const BUTTON_CHROME = 4
  const NAME_GAP = 2

  const { compactNames, buttonOuterWidth, buttonInnerWidth, nameColumnWidth } =
    useMemo(() => {
      const widthModels = [...availableModels, ...offerModels]
      const maxNameLen = Math.max(
        ...widthModels.map((m) => m.displayName.length),
      )

      const noticeLineLen = (m: FreebuffModelOption) =>
        supersededNoticeFor(m)?.length ?? 0

      const multimodalSuffixLen = (m: FreebuffModelOption) =>
        m.multimodal ? 9 : 0
      const reasoningSuffixLen = (m: FreebuffModelOption) =>
        reasoningSuffixFor(m).length
      const newSuffixLen = 6
const testSuffixLen = ' · TEST'.length

      const columnLabelLen = (m: FreebuffModelOption) =>
        2  +
        maxNameLen +
        NAME_GAP +
        m.tagline.length +
        reasoningSuffixLen(m) +
        multimodalSuffixLen(m) +
        (m.isNew ? newSuffixLen : 0) +
        (m.experimental ? testSuffixLen : 0)
      const compactLabelLen = (m: FreebuffModelOption) =>
        2 +
        m.displayName.length +
        3  +
        m.tagline.length +
        reasoningSuffixLen(m) +
        multimodalSuffixLen(m) +
        (m.isNew ? newSuffixLen : 0) +
        (m.experimental ? testSuffixLen : 0)

      const detailsLineLen = (m: FreebuffModelOption) =>
        rowDetailsText(m).length

      const innerWidth = (labelLen: (m: FreebuffModelOption) => number) =>
        Math.max(
          ...widthModels.map((m) =>
            Math.max(labelLen(m), detailsLineLen(m), noticeLineLen(m)),
          ),
        )

      const columnInner = innerWidth(columnLabelLen)
      const columnOuter = columnInner + BUTTON_CHROME
      if (columnOuter <= contentMaxWidth) {
        return {
          compactNames: false,
          buttonOuterWidth: columnOuter,
          buttonInnerWidth: columnInner,
          nameColumnWidth: maxNameLen,
        }
      }

      const compactOuter = Math.min(
        innerWidth(compactLabelLen) + BUTTON_CHROME,
        contentMaxWidth,
      )
      return {
        compactNames: true,
        buttonOuterWidth: compactOuter,
        buttonInnerWidth: compactOuter - BUTTON_CHROME,
        nameColumnWidth: maxNameLen,
      }
    }, [
      availableModels,
      offerModels,
      contentMaxWidth,
      reasoningSuffixFor,
      rowDetailsText,
      supersededNoticeFor,
    ])

  const rowHasDetailsLine = useCallback(
    (m: FreebuffModelOption) => rowDetails(m).length > 0,
    [rowDetails],
  )

  const SECTION_GAP = 1
  const TOGGLE_MARGIN = 1
  const estimatedModelHeight = useMemo(() => {
    let y = 0
    const rowHeight = (m: FreebuffModelOption) =>
      2 + (rowHasDetailsLine(m) ? 2 : 1) + (supersededNoticeFor(m) ? 1 : 0)
    if (showStandaloneRecommended) {
      y += rowHeight(recommendedModel)
    }
    renderedSections.forEach((section) => {
      y += SECTION_GAP
      if (section.label) y += 1
      section.models.forEach((m) => {
        y += rowHeight(m)
      })
    })
    if (planSummary) {
      y += SECTION_GAP + 1
      if (planSummary.blocked) y += 1
    }
    if (canCollapse) {
      y += TOGGLE_MARGIN
      y += 1
    }
    return y
  }, [
    renderedSections,
    rowHasDetailsLine,
    recommendedModel,
    canCollapse,
    showStandaloneRecommended,
    supersededNoticeFor,
    planSummary,
  ])

  const contentHeight = Math.max(
    estimatedModelHeight,
    measuredContentHeight ?? (referral ? maxHeight : 0),
  )

  const needsScroll = contentHeight > maxHeight
  const scrollViewportHeight = Math.max(1, Math.min(contentHeight, maxHeight))
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  useLayoutEffect(() => {
    const sb = scrollRef.current
    if (!sb) return
    if (!needsScroll) {
      sb.scrollTop = 0
      return
    }
    sb.scrollChildIntoView(focusedId)
    if (focusedId === extraTargetIds.at(-1)) {
      sb.scrollTop = Math.max(0, sb.scrollHeight - sb.viewport.height)
    }
  }, [focusedId, contentHeight, needsScroll, extraTargetIds])

  const pick = useCallback(
    (modelId: string) => {
      if (pending) return
      if (modelId === committedModelId) return
      if (!isJoinable(modelId)) return
      setPending(modelId)
      startFreebuffSession(modelId).finally(() => setPending(null))
    },
    [pending, committedModelId, isJoinable],
  )

  const toggleExpanded = useCallback(() => {
    setFocusedId(recommendedModel.id)
    setExpanded((prev) => !prev)
  }, [recommendedModel.id])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (pending) return
        const name = key.name ?? ''
        const direction = freebuffModelNavigationDirectionForKey(key)
        const isCommit = isPlainEnterKey(key) || name === 'space'
        if (isCommit) {
          if (focusedId === TOGGLE_ID) {
            key.preventDefault?.()
            key.stopPropagation?.()
            toggleExpanded()
            return
          }
          const extraTarget = extraTargets.find((t) => t.id === focusedId)
          if (extraTarget) {
            key.preventDefault?.()
            key.stopPropagation?.()
            extraTarget.activate()
            return
          }
          if (isJoinable(focusedId) && focusedId !== committedModelId) {
            key.preventDefault?.()
            key.stopPropagation?.()
            pick(focusedId)
          }
          return
        }
        if (!direction) return
        const targetId = nextFreebuffModelId({
          modelIds: navIds,
          focusedId,
          direction,
        })
        if (targetId) {
          key.preventDefault?.()
          key.stopPropagation?.()
          setFocusedId(targetId)
        }
      },
      [
        pending,
        pick,
        toggleExpanded,
        focusedId,
        committedModelId,
        isJoinable,
        navIds,
        extraTargets,
      ],
    ),
  )

  const renderModelButton = (
    model: FreebuffModelOption,
    options: { recommended?: boolean } = {},
  ) => {
    const { recommended = false } = options
    const isHovered = hoveredId === model.id
    const isFocused = focusedId === model.id
    const canJoin = isJoinable(model.id)
    const interactable = !pending && canJoin && model.id !== committedModelId

    const indicator = isFocused ? '›' : ' '
    const fgColor = canJoin ? theme.foreground : theme.muted
    const mutedColor = theme.muted
    const warningColor = theme.secondary

    const borderColor = isFocused
      ? theme.primary
      : isHovered
        ? theme.foreground
        : theme.border

    const details = rowDetails(model)
    const detailsPad = Math.max(
      0,
      Math.floor((buttonInnerWidth - rowDetailsText(model).length) / 2),
    )

    const supersededNotice = supersededNoticeFor(model)
    const supersededPad = Math.max(
      0,
      Math.floor((buttonInnerWidth - (supersededNotice?.length ?? 0)) / 2),
    )

    const namePadding = ' '.repeat(
      nameColumnWidth - model.displayName.length + NAME_GAP,
    )

    const imagesSuffix = model.multimodal ? ' · Images' : ''

    const reasoningSuffix = reasoningSuffixFor(model)

    return (
      <Button
        key={model.id}
        id={model.id}
        titleAlignment={undefined}
        onClick={() => {
          setFocusedId(model.id)
          if (canJoin) pick(model.id)
        }}
        onMouseOver={() => interactable && setHoveredId(model.id)}
        onMouseOut={() =>
          setHoveredId((curr) => (curr === model.id ? null : curr))
        }
        style={{
          borderStyle: 'single',
          borderColor,
          paddingLeft: 1,
          paddingRight: 1,
          width: buttonOuterWidth,
        }}
        border={['top', 'bottom', 'left', 'right']}
      >
        <text>
          <span fg={fgColor}>{indicator} </span>
          <span
            fg={fgColor}
            attributes={isFocused ? TextAttributes.BOLD : TextAttributes.NONE}
          >
            {model.displayName}
          </span>
          {compactNames ? (
            <span fg={mutedColor}>
              {' · ' + model.tagline + reasoningSuffix + imagesSuffix}
            </span>
          ) : (
            <span fg={mutedColor}>
              {namePadding + model.tagline + reasoningSuffix + imagesSuffix}
            </span>
          )}
          {model.isNew && (
            <span fg={theme.primary} attributes={TextAttributes.BOLD}>
              {' · NEW'}
            </span>
          )}
          {model.experimental && (
            <span fg={warningColor} attributes={TextAttributes.BOLD}>
              {' · TEST'}
            </span>
          )}
        </text>
        {details.length > 0 && (
          <text>
            <span>{' '.repeat(detailsPad)}</span>
            {details.map((detail, index) => (
              <React.Fragment key={`${index}-${detail.text}`}>
                {index > 0 && <span fg={mutedColor}>{DETAIL_SEPARATOR}</span>}
                <span fg={detail.warn ? warningColor : mutedColor}>
                  {detail.text}
                </span>
              </React.Fragment>
            ))}
          </text>
        )}
        {supersededNotice && (
          <text>
            <span>{' '.repeat(supersededPad)}</span>
            <span fg={mutedColor}>{supersededNotice}</span>
          </text>
        )}
      </Button>
    )
  }

  const offerSummary = offers[0]
  const offerUserExhausted = !!offerSummary && offerSummary.userRemaining <= 0
  const offerUserResetAt = offerSummary
    ? new Date(offerSummary.userResetAt)
    : null
  const offerUserResetCountdown =
    offerUserResetAt && Number.isFinite(offerUserResetAt.getTime())
      ? formatFreebuffPremiumResetCountdown(offerUserResetAt, now)
      : null

  const sectionsContent = renderedSections.map((section) => (
    <box
      key={section.key}
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        marginTop: SECTION_GAP,
      }}
    >
      {section.label && (
        <text style={{ fg: theme.muted, wrapMode: 'none' }}>
          {section.label}
          {section.key === 'premium' && premiumLimit !== null && (
            <span fg={premiumExhausted ? theme.secondary : theme.muted}>
              {' '}
              · {formatSessionUnits(premiumUsed)} of {premiumLimit} used
            </span>
          )}
          {section.key === 'premium' && premiumResetCountdown && (
            <span fg={theme.muted}> · resets in {premiumResetCountdown}</span>
          )}
          {section.key === 'offer' && offerSummary && (
            <span fg={theme.primary}>
              {' '}
              · {offerSummary.remaining} of {offerSummary.total} sessions left
            </span>
          )}
          {section.key === 'offer' && offerUserExhausted && (
            <span fg={theme.secondary}>
              {' '}
              · you've used yours
              {offerUserResetCountdown
                ? `, resets in ${offerUserResetCountdown}`
                : ''}
            </span>
          )}
        </text>
      )}
      {section.models.map((m) =>
        renderModelButton(m, { recommended: m.id === recommendedModel.id }),
      )}
    </box>
  ))

  const toggleFocused = focusedId === TOGGLE_ID
  const toggleHovered = hoveredId === TOGGLE_ID
  const toggleColor =
    toggleFocused || toggleHovered ? theme.primary : theme.foreground
  const toggleLabel = expanded
    ? '↑  Show fewer'
    : `↓  See all ${availableModels.length} models`
  const toggleContent = canCollapse ? (
    <Button
      id={TOGGLE_ID}
      onClick={toggleExpanded}
      onMouseOver={() => setHoveredId(TOGGLE_ID)}
      onMouseOut={() =>
        setHoveredId((curr) => (curr === TOGGLE_ID ? null : curr))
      }
      style={{ marginTop: TOGGLE_MARGIN }}
    >
      <text style={{ wrapMode: 'none' }}>
        <span
          fg={toggleColor}
          attributes={toggleFocused ? TextAttributes.BOLD : TextAttributes.NONE}
        >
          {toggleLabel}
        </span>
      </text>
    </Button>
  ) : null

  return (
    <scrollbox
      ref={scrollRef}
      scrollX={false}
      scrollbarOptions={{ visible: false }}
      verticalScrollbarOptions={{
        visible: needsScroll,
        trackOptions: { width: 1 },
      }}
      style={{
        height: scrollViewportHeight,
        width: buttonOuterWidth + (needsScroll ? 1 : 0),
        flexShrink: 0,
        rootOptions: {
          flexDirection: 'row',
          backgroundColor: 'transparent',
        },
        wrapperOptions: {
          border: false,
          backgroundColor: 'transparent',
          flexDirection: 'column',
        },
        contentOptions: {
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0,
          backgroundColor: 'transparent',
        },
      }}
    >
      <box
        ref={contentRef}
        onSizeChange={syncContentHeight}
        style={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0,
          width: buttonOuterWidth,
          flexShrink: 0,
        }}
      >
        {showStandaloneRecommended &&
          renderModelButton(recommendedModel, { recommended: true })}
        {sectionsContent}
        {planSummary && (
          <text
            style={{ fg: theme.muted, wrapMode: 'none', marginTop: SECTION_GAP }}
          >
            {planSummary.tierName.toUpperCase()} PLAN ·{' '}
            {formatPlanWindows(planSummary)}
          </text>
        )}
        {planSummary?.blocked && (
          <text style={{ fg: theme.secondary, wrapMode: 'none' }}>
            {planSummary.blocked.label}
            {planSummary.blocked.resetsAt
              ? ` · resets in ${formatFreebuffPremiumResetCountdown(
                  new Date(planSummary.blocked.resetsAt),
                  now,
                  { withDays: true },
                )}`
              : ''}
          </text>
        )}
        {toggleContent}
        {belowToggle}
        {referral && (
          <FreebuffReferralBanner
            width={buttonOuterWidth}
            referral={referral}
            glmPromo={glmPromo}
            accessTier={accessTier}
            focusedId={focusedId}
            onFocusTargetsChange={setExtraTargets}
          />
        )}
      </box>
    </scrollbox>
  )
}
