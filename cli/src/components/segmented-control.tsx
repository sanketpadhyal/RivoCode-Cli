import React, { useState } from 'react'
import stringWidth from 'string-width'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'

import type { ChatTheme } from '../types/theme-system'

export interface Segment {
  id: string
  label: string
  isBold?: boolean
  isSelected?: boolean
  defaultHighlighted?: boolean
  disabled?: boolean
}

interface SegmentedControlProps {
  segments: Segment[]
  onSegmentClick?: (id: string) => void
  onMouseOver?: () => void
  onMouseOut?: () => void
}

export const SegmentedControl = ({
  segments,
  onSegmentClick,
  onMouseOver,
  onMouseOut,
}: SegmentedControlProps) => {
  const theme = useTheme()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hasHoveredSinceOpen, setHasHoveredSinceOpen] = useState(false)

  const processedSegments = processSegments(
    segments,
    hoveredId,
    hasHoveredSinceOpen,
    theme,
  )
  const hoveredIndex = hoveredId
    ? processedSegments.findIndex((s) => s.id === hoveredId)
    : processedSegments.length - 1

  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 0,
        backgroundColor: 'transparent',
      }}
      onMouseOver={onMouseOver}
      onMouseOut={() => {
        setHoveredId(null)
        onMouseOut && onMouseOut()
      }}
    >
      {processedSegments.map((seg, idx) => {
        const leftOfHovered = idx <= hoveredIndex
        const rightOfHovered = idx >= hoveredIndex

        return (
          <React.Fragment key={seg.id}>
            {leftOfHovered ? (
              <box style={{ flexDirection: 'column', gap: 0 }}>
                <text fg={seg.frameColor} selectable={false}>╭</text>
                <text fg={seg.frameColor} selectable={false}>│</text>
                <text fg={seg.frameColor} selectable={false}>╰</text>
              </box>
            ) : null}

            <Button
              onClick={() => onSegmentClick && onSegmentClick(seg.id)}
              onMouseOver={() => {
                setHoveredId(seg.id)
                setHasHoveredSinceOpen(true)
              }}
              style={{
                flexDirection: 'column',
                gap: 0,
                width: seg.width,
                minWidth: seg.width,
              }}
            >
              <text fg={seg.frameColor}>{seg.topBorder}</text>
              <text fg={seg.textColor}>
                {seg.isItalic ? (
                  <i>{seg.content}</i>
                ) : seg.isBold ? (
                  <b>{seg.content}</b>
                ) : (
                  seg.content
                )}
              </text>
              <text fg={seg.frameColor}>{seg.bottomBorder}</text>
            </Button>

            {rightOfHovered ? (
              <box style={{ flexDirection: 'column', gap: 0 }}>
                <text fg={seg.frameColor} selectable={false}>╮</text>
                <text fg={seg.frameColor} selectable={false}>│</text>
                <text fg={seg.frameColor} selectable={false}>╯</text>
              </box>
            ) : null}
          </React.Fragment>
        )
      })}
    </box>
  )
}

export type ProcessedSegment = {
  id: string
  topBorder: string
  content: string
  bottomBorder: string
  frameColor: string
  leftBorderColor: string
  textColor: string
  isHovered: boolean
  isBold: boolean
  isItalic: boolean
  label: string
  width: number
}

export const processSegments = (
  segments: Segment[],
  hoveredId: string | null,
  hasHoveredSinceOpen: boolean,
  theme: ChatTheme,
): ProcessedSegment[] => {
  return segments.map((seg) => {
    const isDisabled = !!seg.disabled
    const isSelected = !!seg.isSelected
    const defaultHL = !!seg.defaultHighlighted

    const canHover = !isSelected || defaultHL
    const isHovered = hoveredId === seg.id && canHover
    const isDefaultHighlighted = defaultHL && !hasHoveredSinceOpen
    const isHighlighted = isHovered || isDefaultHighlighted

    const isBold = !!(seg.isBold || isHovered || (isSelected && isHighlighted))

    const frameColor = isHighlighted ? theme.foreground : theme.border
    const textMuted = isDisabled || (isSelected && !isHighlighted)
    const textColor = textMuted ? theme.muted : theme.foreground

    const content = ` ${seg.label} `
    const width = stringWidth(content)
    const horizontal = '─'.repeat(width)

    return {
      id: seg.id,
      topBorder: horizontal,
      content,
      bottomBorder: horizontal,
      frameColor,
      leftBorderColor: frameColor,
      textColor,
      isHovered,
      isBold,
      isItalic: isDisabled,
      label: seg.label,
      width,
    }
  })
}
