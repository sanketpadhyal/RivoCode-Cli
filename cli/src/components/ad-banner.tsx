import { TextAttributes } from '@opentui/core'
import {
  INLINE_AD_DISCLOSURE,
  INLINE_AD_GAP,
  INLINE_AD_LINK_SUFFIX,
  MAX_DESC_LINES,
  getAdDisplayLabel,
  getInlineAdLayout,
  truncateToLines,
  truncateToWidth,
} from '@codebuff/common/ads/inline-ad-layout'
import { visibleWaitingRoomPlacementIds } from '@codebuff/common/ads/waiting-room-placements'
import { safeOpen } from '../utils/open-url'
import React, { useState, useMemo, useEffect } from 'react'

import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { BORDER_CHARS, INVERTED_CTA_FG } from '../utils/ui-constants'

import type { AdResponse } from '../hooks/use-gravity-ad'

interface ChoiceAdBannerProps {
  ads: AdResponse[]
  placementIds?: readonly string[]
  onClick?: (ad: AdResponse) => void
  onImpression?: (ad: AdResponse) => void
}

export const AD_CARD_HEIGHT = 5
export const INLINE_AD_CARD_HEIGHT = 4

export {
  extractDomain,
  getAdDisplayLabel,
  getInlineAdLayout,
} from '@codebuff/common/ads/inline-ad-layout'

export function getCardAdLayout(
  ad: Pick<AdResponse, 'adText' | 'title' | 'cta' | 'url'>,
  width: number,
): {
  headline: string
  description: string
  descriptionLines: number
  ctaText: string
  labelText: string
  labelVariant: 'domain' | 'title'
} {
  const title = (ad.title ?? '').trim()
  const cta = (ad.cta ?? '').trim()
  const adText = ad.adText ?? ''
  const url = ad.url ?? ''

  const copyWidth = Math.max(0, width - 8)
  const headline = truncateToWidth(title, copyWidth)
  const descriptionLines = headline ? 1 : MAX_DESC_LINES
  const ctaText = cta || 'Learn more'
  const label = getAdDisplayLabel({ title, url })
  const showLabel = label.variant === 'domain' || !headline

  return {
    headline,
    description: truncateToLines(adText, copyWidth, descriptionLines),
    descriptionLines,
    ctaText,
    labelText: showLabel
      ? truncateToWidth(label.text, Math.max(0, width - ctaText.length - 5))
      : '',
    labelVariant: label.variant,
  }
}

function columnWidths(count: number, availableWidth: number): number[] {
  const base = Math.floor(availableWidth / count)
  const remainder = availableWidth - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

export const AdCard: React.FC<{
  ad: AdResponse
  width: number
  variant?: 'card' | 'inline'
  onClick?: (ad: AdResponse) => void
  onImpression?: (ad: AdResponse) => void
}> = ({ ad, width, variant = 'card', onClick, onImpression }) => {
  const theme = useTheme()
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    onImpression?.(ad)
  }, [ad, onImpression])

  const buttonProps = {
    onClick: () => {
      if (!ad.clickUrl) return
      onClick?.(ad)
      safeOpen(ad.clickUrl)
    },
    onMouseOver: () => setIsHovered(true),
    onMouseOut: () => setIsHovered(false),
  }

  if (variant === 'inline') {
    const inlineLayout = getInlineAdLayout(ad, width)
    const accentColor = isHovered ? theme.primary : theme.muted
    return (
      <Button
        {...buttonProps}
        style={{
          width,
          height: INLINE_AD_CARD_HEIGHT,
          borderStyle: 'single',
          borderColor: accentColor,
          customBorderChars: BORDER_CHARS,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <box
          style={{
            width: '100%',
            height: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <text
            style={{
              fg: isHovered ? theme.primary : theme.foreground,
              flexShrink: 1,
              wrapMode: 'none',
            }}
            attributes={TextAttributes.BOLD}
          >
            {inlineLayout.title}
          </text>
          <text style={{ fg: theme.muted, flexShrink: 0, wrapMode: 'none' }}>
            {INLINE_AD_DISCLOSURE}
          </text>
        </box>
        <box
          style={{
            width: '100%',
            height: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            columnGap: INLINE_AD_GAP,
            overflow: 'hidden',
          }}
        >
          <text style={{ fg: theme.muted, flexShrink: 1, wrapMode: 'none' }}>
            {inlineLayout.description}
          </text>
          {inlineLayout.label && (
            <text
              style={{
                fg: accentColor,
                flexShrink: 0,
                wrapMode: 'none',
              }}
              attributes={TextAttributes.UNDERLINE}
            >
              {inlineLayout.label + INLINE_AD_LINK_SUFFIX}
            </text>
          )}
        </box>
      </Button>
    )
  }

  const card = getCardAdLayout(ad, width)

  return (
    <Button
      {...buttonProps}
      style={{
        width,
        height: AD_CARD_HEIGHT,
        borderStyle: 'single',
        borderColor: isHovered ? theme.primary : theme.muted,
        customBorderChars: BORDER_CHARS,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'column',
      }}
    >
      {card.headline ? (
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            height: 1,
            overflow: 'hidden',
          }}
        >
          <text
            style={{
              fg: isHovered ? theme.primary : theme.foreground,
              flexShrink: 1,
              wrapMode: 'none',
            }}
            attributes={TextAttributes.BOLD}
          >
            {card.headline}
          </text>
          <text style={{ fg: theme.muted, flexShrink: 0 }}>{'  Ad'}</text>
        </box>
      ) : null}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          height: card.descriptionLines,
          overflow: 'hidden',
        }}
      >
        <text style={{ fg: theme.muted, flexShrink: 1 }}>
          {card.description}
        </text>
        {card.headline ? null : (
          <text style={{ fg: theme.muted, flexShrink: 0 }}>{'  Ad'}</text>
        )}
      </box>
      <box style={{ flexGrow: 1 }} />
      <box
        style={{
          flexDirection: 'row',
          columnGap: 1,
          alignItems: 'center',
          height: 1,
          overflow: 'hidden',
        }}
      >
        <text
          style={{
            fg: INVERTED_CTA_FG,
            bg: isHovered ? theme.primary : theme.muted,
            attributes: TextAttributes.BOLD,
          }}
        >
          {` ${card.ctaText} `}
        </text>
        {card.labelText ? (
          <text
            style={{
              fg: theme.muted,
              wrapMode: 'none',
              attributes:
                card.labelVariant === 'domain'
                  ? TextAttributes.UNDERLINE
                  : TextAttributes.BOLD,
            }}
          >
            {card.labelText}
          </text>
        ) : null}
      </box>
    </Button>
  )
}

export const SingleAdBanner: React.FC<{
  ad: AdResponse
  onClick?: (ad: AdResponse) => void
  onImpression?: (ad: AdResponse) => void
}> = ({ ad, onClick, onImpression }) => {
  const { terminalWidth } = useTerminalDimensions()

  return (
    <box style={{ marginLeft: 1, marginRight: 1 }}>
      <AdCard
        ad={ad}
        width={terminalWidth - 2}
        onClick={onClick}
        onImpression={onImpression}
      />
    </box>
  )
}

export const ChoiceAdBanner: React.FC<ChoiceAdBannerProps> = ({
  ads,
  placementIds,
  onClick,
  onImpression,
}) => {
  const { terminalWidth } = useTerminalDimensions()

  const colAvail = terminalWidth - 2

  const maxVisible =
    placementIds?.length ?? visibleWaitingRoomPlacementIds(terminalWidth).length
  const visibleAds = useMemo(() => {
    const requested = placementIds?.length
      ? orderedRequestedAds(ads, placementIds)
      : ads
    return requested.slice(0, maxVisible)
  }, [ads, maxVisible, placementIds])

  const widths = useMemo(
    () => columnWidths(visibleAds.length, colAvail),
    [visibleAds.length, colAvail],
  )

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
      }}
    >
      <box
        style={{
          marginLeft: 1,
          marginRight: 1,
          flexDirection: 'row',
        }}
      >
        {visibleAds.map((ad, i) => (
          <AdCard
            key={ad.impUrl}
            ad={ad}
            width={widths[i]}
            onClick={onClick}
            onImpression={onImpression}
          />
        ))}
      </box>
    </box>
  )
}

export function orderedRequestedAds(
  ads: AdResponse[],
  placementIds: readonly string[],
): AdResponse[] {
  return placementIds.flatMap((placementId) => {
    const ad = ads.find((candidate) => candidate.placementId === placementId)
    return ad ? [ad] : []
  })
}
