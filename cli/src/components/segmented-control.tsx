import React, { useState } from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'

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

  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 1,
        alignItems: 'center',
      }}
      onMouseOver={onMouseOver}
      onMouseOut={() => {
        setHoveredId(null)
        onMouseOut?.()
      }}
    >
      {segments.map((seg) => {
        const isSelected = !!seg.isSelected
        const isHovered = hoveredId === seg.id

        return (
          <Button
            key={seg.id}
            onClick={() => onSegmentClick?.(seg.id)}
            onMouseOver={() => setHoveredId(seg.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 1,
              paddingRight: 1,
              borderStyle: 'single',
              borderColor: isSelected
                ? theme.primary
                : isHovered
                  ? theme.foreground
                  : theme.border,
            }}
          >
            <text style={{ wrapMode: 'none' }}>
              {isSelected ? (
                <b>
                  <span fg={theme.primary}>{seg.label}</span>
                </b>
              ) : isHovered ? (
                <span fg={theme.foreground}>{seg.label}</span>
              ) : (
                <span fg={theme.muted}>{seg.label}</span>
              )}
            </text>
          </Button>
        )
      })}
    </box>
  )
}
