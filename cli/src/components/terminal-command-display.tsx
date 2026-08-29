import { TextAttributes } from '@opentui/core'
import { useState } from 'react'

import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { formatTimeout } from '../utils/format-timeout'
import { getLastNVisualLines } from '../utils/text-layout'

interface TerminalCommandDisplayProps {
  command: string
  output: string | null
  expandable?: boolean
  maxVisibleLines?: number
  isRunning?: boolean
  cwd?: string
  timeoutSeconds?: number
  availableWidth?: number
}

export const TerminalCommandDisplay = ({
  command,
  output,
  expandable = true,
  maxVisibleLines,
  isRunning = false,
  timeoutSeconds,
  availableWidth,
}: TerminalCommandDisplayProps) => {
  const theme = useTheme()
  const { separatorWidth } = useTerminalDimensions()
  const [isExpanded, setIsExpanded] = useState(false)

  const defaultMaxLines = expandable ? 5 : 10
  const maxLines = maxVisibleLines ?? defaultMaxLines

  const DEFAULT_TIMEOUT_SECONDS = 30
  const timeoutLabel =
    timeoutSeconds !== undefined && timeoutSeconds !== DEFAULT_TIMEOUT_SECONDS
      ? formatTimeout(timeoutSeconds)
      : null

  const commandHeader = (
    <text style={{ wrapMode: 'word' }}>
      <span fg={theme.success}>$ </span>
      <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
        {command}
      </span>
      {timeoutLabel && (
        <span fg={theme.muted} attributes={TextAttributes.DIM}>
          {' '}({timeoutLabel})
        </span>
      )}
    </text>
  )

  if (!output) {
    return (
      <box style={{ flexDirection: 'column', gap: 0, width: '100%' }}>
        {commandHeader}
        {isRunning && <text fg={theme.muted}>...</text>}
      </box>
    )
  }

  const width = Math.max(10, availableWidth ?? separatorWidth)
  const allLines = output.split('\n')

  let totalVisualLines = 0
  const visualLinesByOriginalLine: string[][] = []

  for (const line of allLines) {
    const { lines: wrappedLines } = getLastNVisualLines(line, width, Infinity)
    visualLinesByOriginalLine.push(wrappedLines)
    totalVisualLines += wrappedLines.length
  }

  const hasMoreLines = totalVisualLines > maxLines
  const hiddenLinesCount = totalVisualLines - maxLines

  let displayOutput: string
  if (isExpanded || !hasMoreLines) {
    displayOutput = output
  } else {
    const displayLines: string[] = []
    let count = 0

    for (const wrappedLines of visualLinesByOriginalLine) {
      for (const line of wrappedLines) {
        if (count >= maxLines) break
        displayLines.push(line)
        count++
      }
      if (count >= maxLines) break
    }

    displayOutput = displayLines.join('\n')
  }

  return (
    <box style={{ flexDirection: 'column', gap: 0, width: '100%' }}>
      {commandHeader}
      <box style={{ flexDirection: 'column', gap: 0, width: '100%' }}>
        {hasMoreLines && !expandable && (
          <text fg={theme.muted} attributes={TextAttributes.DIM}>
            ... ({hiddenLinesCount} more lines above)
          </text>
        )}
        <text fg={theme.muted} style={{ wrapMode: 'word' }}>
          {displayOutput}
        </text>
        {hasMoreLines && expandable && (
          <Button
            style={{ marginTop: 0 }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <text
              fg={theme.secondary}
              style={{ wrapMode: 'word' }}
              attributes={TextAttributes.UNDERLINE}
            >
              {isExpanded
                ? 'Show less'
                : `Show ${hiddenLinesCount} more ${hiddenLinesCount === 1 ? 'line' : 'lines'}`}
            </text>
          </Button>
        )}
      </box>
    </box>
  )
}
