import { TextAttributes } from '@opentui/core'
import { useCallback, useState } from 'react'

import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'

const MIN_WIDTH_FOR_DESCRIPTION = 80
const LABEL_DESCRIPTION_GAP = 2

export interface SuggestedPrompt {
  label: string
  prompt: string
}

export interface SuggestedPromptSelection {
  label: string
  index: number
}

export const DEFAULT_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    label: 'Explain this codebase',
    prompt:
      'Give me a high-level overview of how this codebase is structured and what the main parts do.',
  },
  {
    label: 'Find opportunities to refactor',
    prompt:
      'Look through my codebase for opportunities to refactor and simplify, and suggest the highest-impact ones.',
  },
  {
    label: 'Improve my test coverage',
    prompt:
      'Analyze my test coverage and tell me where adding tests would have the most impact.',
  },
]

interface SuggestedPromptLineProps {
  prompt: SuggestedPrompt
  index: number
  isHovered: boolean
  onSelect: (prompt: string, selection: SuggestedPromptSelection) => void
  onHover: (label: string | null) => void
  labelColumnWidth: number
}

const SuggestedPromptLine = ({
  prompt,
  index,
  isHovered,
  onSelect,
  onHover,
  labelColumnWidth,
}: SuggestedPromptLineProps) => {
  const theme = useTheme()
  const { terminalWidth } = useTerminalDimensions()

  const handleClick = useCallback(
    () => onSelect(prompt.prompt, { label: prompt.label, index }),
    [onSelect, prompt.prompt, prompt.label, index],
  )
  const handleMouseOver = useCallback(
    () => onHover(prompt.label),
    [onHover, prompt.label],
  )
  const handleMouseOut = useCallback(() => onHover(null), [onHover])

  const iconColor = isHovered ? theme.primary : theme.muted
  const labelColor = isHovered ? theme.primary : theme.foreground

  const showDescription =
    isHovered && terminalWidth >= MIN_WIDTH_FOR_DESCRIPTION
  const labelLength = '→ '.length + prompt.label.length
  const paddingSpaces = showDescription
    ? ' '.repeat(Math.max(0, labelColumnWidth - labelLength))
    : ''
  const truncatedPrompt = showDescription
    ? (() => {
        const availableWidth = Math.max(0, terminalWidth - labelColumnWidth - 4)
        return prompt.prompt.length > availableWidth
          ? prompt.prompt.slice(0, availableWidth - 1) + '…'
          : prompt.prompt
      })()
    : ''

  return (
    <box style={{ flexDirection: 'row', width: '100%' }}>
      <Button
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        style={{
          flexShrink: 0,
          flexGrow: 0,
          backgroundColor: isHovered ? theme.surface : undefined,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span fg={iconColor}>→</span>
          <span
            fg={labelColor}
            attributes={isHovered ? TextAttributes.BOLD : undefined}
          >
            {' '}
            {prompt.label}
          </span>
        </text>
      </Button>
      {showDescription && (
        <box style={{ flexGrow: 1 }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.muted} attributes={TextAttributes.ITALIC}>
              {paddingSpaces}
              {truncatedPrompt}
            </span>
          </text>
        </box>
      )}
    </box>
  )
}

interface SuggestedPromptsProps {
  onSelect: (prompt: string, selection: SuggestedPromptSelection) => void
  maxItems?: number
  prompts?: SuggestedPrompt[]
}

export const SuggestedPrompts = ({
  onSelect,
  maxItems,
  prompts = DEFAULT_SUGGESTED_PROMPTS,
}: SuggestedPromptsProps) => {
  const theme = useTheme()
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)

  const items =
    maxItems != null ? prompts.slice(0, Math.max(0, maxItems)) : prompts

  if (items.length === 0) return null

  const labelColumnWidth =
    Math.max(...items.map((p) => '→ '.length + p.label.length)) +
    LABEL_DESCRIPTION_GAP

  return (
    <box style={{ flexDirection: 'column', paddingLeft: 1, paddingBottom: 1 }}>
      <text style={{ fg: theme.muted }}>Try one of these:</text>
      {items.map((prompt, index) => (
        <SuggestedPromptLine
          key={prompt.label}
          prompt={prompt}
          index={index}
          isHovered={hoveredLabel === prompt.label}
          onSelect={onSelect}
          onHover={setHoveredLabel}
          labelColumnWidth={labelColumnWidth}
        />
      ))}
    </box>
  )
}
