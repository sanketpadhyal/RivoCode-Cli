import React, { useEffect, useRef, useState } from 'react'

import { Button } from './button'
import { SegmentedControl } from './segmented-control'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { AGENT_MODES, IS_FREEBUFF } from '../utils/constants'

import type { Segment } from './segmented-control'
import type { AgentMode } from '../utils/constants'

export const OPEN_DELAY_MS = 0
export const CLOSE_DELAY_MS = 250
export const REOPEN_SUPPRESS_MS = 250

export const MODE_ICONS: Record<AgentMode, string> = {
  DEFAULT: '✦',
  LITE: '◇',
  MAX: '★',
  PLAN: '≡',
}

export function useHoverToggle() {
  const [isOpen, setIsOpen] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reopenBlockedUntilRef = useRef<number>(0)

  const clearOpenTimer = () => {
    clearTimeout(openTimeoutRef.current!)
    openTimeoutRef.current = null
  }

  const clearCloseTimer = () => {
    clearTimeout(closeTimeoutRef.current!)
    closeTimeoutRef.current = null
  }

  const clearAllTimers = () => {
    clearOpenTimer()
    clearCloseTimer()
  }

  const openNow = () => {
    clearAllTimers()
    setIsOpen(true)
  }

  const closeNow = (suppressReopen = false) => {
    clearAllTimers()
    setIsOpen(false)
    if (suppressReopen) {
      reopenBlockedUntilRef.current = Date.now() + REOPEN_SUPPRESS_MS
    }
  }

  const scheduleOpen = () => {
    if (isOpen) return
    if (Date.now() < reopenBlockedUntilRef.current) return

    clearOpenTimer()
    openTimeoutRef.current = setTimeout(() => {
      openNow()
    }, OPEN_DELAY_MS)
  }

  const scheduleClose = () => {
    if (!isOpen) return

    clearCloseTimer()
    closeTimeoutRef.current = setTimeout(() => {
      closeNow()
    }, CLOSE_DELAY_MS)
  }

  useEffect(() => {
    return () => clearAllTimers()
  }, [])

  return {
    isOpen,
    openNow,
    closeNow,
    scheduleOpen,
    scheduleClose,
    clearOpenTimer,
    clearCloseTimer,
    clearAllTimers,
  }
}

export function buildExpandedSegments(currentMode: AgentMode): Segment[] {
  return AGENT_MODES.map((m) => {
    const icon = MODE_ICONS[m] || '✦'
    return {
      id: m,
      label: `${icon} ${m}`,
      isSelected: m === currentMode,
    }
  })
}

export type AgentModeClickAction =
  | { type: 'closeActive' }
  | { type: 'selectMode'; mode: AgentMode }
  | { type: 'toggleMode'; mode: AgentMode }

export const resolveAgentModeClick = (
  currentMode: AgentMode,
  clickedId: string,
  hasOnSelectMode: boolean,
): AgentModeClickAction => {
  const target = clickedId as AgentMode
  if (target === currentMode) return { type: 'closeActive' }
  if (hasOnSelectMode) {
    return { type: 'selectMode', mode: target }
  }
  return { type: 'toggleMode', mode: target }
}

export const AgentModeToggle = ({
  mode,
  onToggle,
  onSelectMode,
}: {
  mode: AgentMode
  onToggle: () => void
  onSelectMode?: (mode: AgentMode) => void
}) => {
  if (IS_FREEBUFF) return null

  const theme = useTheme()
  const inputFocused = useChatStore((state) => state.inputFocused)
  const [isCollapsedHovered, setIsCollapsedHovered] = useState(false)
  const hoverToggle = useHoverToggle()

  const handleMouseOver = () => {
    if (!inputFocused) return
    hoverToggle.clearCloseTimer()
    hoverToggle.scheduleOpen()
  }

  const handleMouseOut = () => {
    hoverToggle.scheduleClose()
    setIsCollapsedHovered(false)
  }

  const handleSegmentClick = (id: string) => {
    const action = resolveAgentModeClick(mode, id, !!onSelectMode)
    if (action.type === 'closeActive') {
      hoverToggle.closeNow(true)
      return
    }
    if (action.type === 'selectMode') {
      onSelectMode?.(action.mode)
      hoverToggle.closeNow(true)
      return
    }
    hoverToggle.clearAllTimers()
    onToggle()
    hoverToggle.closeNow(true)
  }

  const currentIcon = MODE_ICONS[mode] || '✦'

  if (!hoverToggle.isOpen) {
    return (
      <Button
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 1,
          paddingRight: 1,
          borderStyle: isCollapsedHovered ? 'single' : 'none',
          borderColor: isCollapsedHovered ? theme.primary : undefined,
        }}
        onClick={() => {
          if (!inputFocused) return
          hoverToggle.clearAllTimers()
          hoverToggle.openNow()
        }}
        onMouseOver={() => {
          if (inputFocused) {
            setIsCollapsedHovered(true)
          }
          handleMouseOver()
        }}
        onMouseOut={handleMouseOut}
      >
        <text
          wrapMode="none"
          fg={isCollapsedHovered ? theme.primary : theme.muted}
        >
          {isCollapsedHovered ? (
            <b>{`< ${currentIcon} ${mode}`}</b>
          ) : (
            `< ${currentIcon} ${mode}`
          )}
        </text>
      </Button>
    )
  }

  const segments: Segment[] = buildExpandedSegments(mode)

  return (
    <SegmentedControl
      segments={segments}
      onSegmentClick={handleSegmentClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    />
  )
}
