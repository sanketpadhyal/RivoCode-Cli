import { TextAttributes } from '@opentui/core'
import React, { memo, type ReactNode } from 'react'

import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { getLastNVisualLines } from '../utils/text-layout'

import type { ThinkingCollapseState } from '../types/chat'

const PREVIEW_LINE_COUNT = 5

interface ThinkingProps {
  content: string
  thinkingCollapseState: ThinkingCollapseState
  isThinkingComplete: boolean
  onToggle: () => void
  availableWidth?: number
}

export const Thinking = memo(
  ({
    content,
    thinkingCollapseState,
    isThinkingComplete,
    onToggle,
    availableWidth,
  }: ThinkingProps): ReactNode => {
    const theme = useTheme()
    const { contentMaxWidth } = useTerminalDimensions()

    const singleBoldMatch = content.length < 100 ? content.trim().match(/^\*\*([^*]+)\*\*$/) : null
    if (singleBoldMatch) {
      return (
        null
      )
    }

    const width = Math.max(10, availableWidth ?? contentMaxWidth)
    const normalizedContent = content.replace(/\n+/g, ' ').trim()
    const effectiveWidth = width - 3
    const { lines, hasMore } = getLastNVisualLines(
      normalizedContent,
      effectiveWidth,
      PREVIEW_LINE_COUNT,
    )
    const expandedContent = content.replace(/\n\n+/g, '\n\n').trim()

    const showFull = thinkingCollapseState === 'expanded'
    const showPreview = thinkingCollapseState === 'preview' && lines.length > 0

    const toggleIndicator =
      !isThinkingComplete ? '• '
        : showFull ? '▾ '
          : showPreview ? '• '
            : '▸ '

    return (
      <Button
        style={{
          flexDirection: 'column',
          gap: 0,
        }}
        onClick={onToggle}
      >
        <text style={{ fg: theme.foreground }}>
          <span>{toggleIndicator}</span>
          <span attributes={TextAttributes.BOLD}>Thinking</span>
        </text>
        {showPreview && (
          <box style={{ paddingLeft: 2 }}>
            <text
              style={{
                wrapMode: 'none',
                fg: theme.muted,
              }}
              attributes={TextAttributes.ITALIC}
            >
              {hasMore ? '...' + lines.join('\n') : lines.join('\n')}
            </text>
          </box>
        )}
        {showFull && (
          <box style={{ paddingLeft: 2 }}>
            <text
              style={{
                wrapMode: 'word',
                fg: theme.muted,
              }}
              attributes={TextAttributes.ITALIC}
            >
              {expandedContent}
            </text>
          </box>
        )}
      </Button>
    )
  },
)
