import React from 'react'

import { useTheme } from '../hooks/use-theme'

interface SeparatorProps {
  width: number
  widthOffset?: number
  char?: string
  color?: string
}

export const Separator: React.FC<SeparatorProps> = ({
  width,
  widthOffset = 0,
  char = '─',
  color,
}) => {
  const theme = useTheme()
  const separatorWidth = Math.max(1, width - widthOffset)
  const fgColor = color || theme.border

  return (
    <box style={{ height: 1, flexShrink: 0 }}>
      <text style={{ wrapMode: 'none' }}>
        <span fg={fgColor}>{char.repeat(separatorWidth)}</span>
      </text>
    </box>
  )
}
