import React from 'react'

import { useTheme } from '../hooks/use-theme'

interface ProgressBarProps {
  value: number
  width?: number
  label?: string
  showPercentage?: boolean
}

const getProgressColor = (
  value: number,
  theme: {
    primary: string
    foreground: string
    warning: string
    error: string
  },
): string => {
  if (value <= 10) return theme.error
  if (value <= 25) return theme.warning
  return theme.foreground
}

const getBarColor = (
  value: number,
  theme: { muted: string; warning: string; error: string },
): string => {
  if (value <= 10) return theme.error
  if (value <= 25) return theme.warning
  return theme.muted
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  width = 20,
  label,
  showPercentage = true,
}) => {
  const theme = useTheme()
  const clampedValue = Math.max(0, Math.min(100, value))
  const filledWidth = Math.round((clampedValue / 100) * width)
  const emptyWidth = width - filledWidth

  const filledChar = '█'
  const emptyChar = '░'

  const filled = filledChar.repeat(filledWidth)
  const empty = emptyChar.repeat(emptyWidth)

  const barColor = getBarColor(clampedValue, theme)
  const textColor = getProgressColor(clampedValue, theme)

  return (
    <box style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
      {label && <text style={{ fg: theme.muted }}>{label} </text>}
      <text style={{ fg: barColor }}>{filled}</text>
      {emptyWidth > 0 && <text style={{ fg: theme.muted }}>{empty}</text>}
      {showPercentage && (
        <text style={{ fg: textColor }}> {Math.round(clampedValue)}%</text>
      )}
    </box>
  )
}
