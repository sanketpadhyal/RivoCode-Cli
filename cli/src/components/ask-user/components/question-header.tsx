
import { TextAttributes } from '@opentui/core'
import React, { memo } from 'react'

import { useTerminalLayout } from '../../../hooks/use-terminal-layout'
import { useTheme } from '../../../hooks/use-theme'
import { Button } from '../../button'

const ANSWER_LINE_OVERHEAD = 20

export interface QuestionHeaderProps {
  questionText: string
  questionPrefix: string
  isExpanded: boolean
  isAnswered: boolean
  answerDisplay: string
  onToggleExpand: () => void
}

export const QuestionHeader: React.FC<QuestionHeaderProps> = memo(
  ({
    questionText,
    questionPrefix,
    isExpanded,
    isAnswered,
    answerDisplay,
    onToggleExpand,
  }) => {
    const theme = useTheme()
    const { terminalWidth } = useTerminalLayout()

    const availableWidth = Math.max(20, terminalWidth - ANSWER_LINE_OVERHEAD)
    const truncatedAnswer =
      answerDisplay.length > availableWidth
        ? answerDisplay.slice(0, availableWidth - 1) + '…'
        : answerDisplay

    return (
      <Button
        onClick={onToggleExpand}
        style={{
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <text>
          <span fg={theme.muted}>{isExpanded ? '▼' : '▶'}</span>
          <span
            fg={theme.foreground}
            attributes={isExpanded ? TextAttributes.BOLD : undefined}
          >
            {' '}
            {questionPrefix}
            {questionText}
          </span>
        </text>
        {!isExpanded && (
          <text wrapMode="none" style={{ marginLeft: 3 }}>
            <span fg={theme.primary}>↳ </span>
            <span
              fg={isAnswered ? theme.primary : theme.muted}
              attributes={TextAttributes.ITALIC}
            >
              {isAnswered ? `"${truncatedAnswer}"` : '(click to answer)'}
            </span>
          </text>
        )}
      </Button>
    )
  },
)

QuestionHeader.displayName = 'QuestionHeader'
