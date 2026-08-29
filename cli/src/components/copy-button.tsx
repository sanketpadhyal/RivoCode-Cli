import { TextAttributes } from '@opentui/core'
import React, { useCallback, useState } from 'react'

import { Clickable } from './clickable'
import { useTheme } from '../hooks/use-theme'
import { useTimeout } from '../hooks/use-timeout'
import { copyTextToClipboard } from '../utils/clipboard'

import type { ReactNode } from 'react'

export const COPIED_RESET_DELAY_MS = 2000

export function useCopyToClipboard(text: string): {
  isCopied: boolean
  copy: () => void
} {
  const { setTimeout } = useTimeout()
  const [isCopied, setIsCopied] = useState(false)

  const copy = useCallback(() => {
    void (async () => {
      try {
        await copyTextToClipboard(text, { suppressGlobalMessage: true })
        setIsCopied(true)
        setTimeout(
          'reset-copied',
          () => setIsCopied(false),
          COPIED_RESET_DELAY_MS,
        )
      } catch (_error) {
      }
    })()
  }, [text, setTimeout])

  return { isCopied, copy }
}

export const COPY_ICON_COLLAPSED = '⎘'
export const COPY_ICON_EXPANDED = '[⎘ copy]'
export const COPY_ICON_COPIED = '[✔ copied]'

export const getCopyIconText = (
  isCopied: boolean,
  isHovered: boolean,
  leadingSpace: boolean,
): string => {
  const space = leadingSpace ? ' ' : ''
  if (isCopied) return `${space}${COPY_ICON_COPIED}`
  if (isHovered) return `${space}${COPY_ICON_EXPANDED}`
  return `${space}${COPY_ICON_COLLAPSED}`
}

export const copyButtonHandlers = {
  handleMouseOver: (isCopied: boolean): boolean => {
    return !isCopied
  },

  handleMouseOut: (): boolean => {
    return false
  },

  handleCopy: (): { isCopied: boolean; isHovered: boolean } => {
    return { isCopied: true, isHovered: false }
  },
}

interface CopyIconProps {
  isCopied: boolean
  isHovered: boolean
  leadingSpace: boolean
}

const CopyIcon: React.FC<CopyIconProps> = ({
  isCopied,
  isHovered,
  leadingSpace,
}) => {
  const theme = useTheme()
  const text = getCopyIconText(isCopied, isHovered, leadingSpace)

  if (isCopied) {
    return <span fg="green">{text}</span>
  }

  if (isHovered) {
    return <span fg={theme.foreground}>{text}</span>
  }

  return (
    <span fg={theme.muted} attributes={TextAttributes.DIM}>
      {text}
    </span>
  )
}

interface CopyButtonProps {
  textToCopy: string
  children?: ReactNode
  leadingSpace?: boolean
  style?: Record<string, unknown>
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  children,
  leadingSpace = true,
  style,
}) => {
  const { isCopied, copy } = useCopyToClipboard(textToCopy)
  const [isHovered, setIsHovered] = useState(false)

  const handleCopy = () => {
    setIsHovered(copyButtonHandlers.handleCopy().isHovered)
    copy()
  }

  const handleMouseOver = () => {
    const shouldHover = copyButtonHandlers.handleMouseOver(isCopied)
    if (shouldHover) {
      setIsHovered(true)
    }
  }

  const handleMouseOut = () => {
    setIsHovered(copyButtonHandlers.handleMouseOut())
  }

  return (
    <Clickable
      as="text"
      style={style}
      onMouseDown={handleCopy}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      {children}
      <CopyIcon
        isCopied={isCopied}
        isHovered={isHovered}
        leadingSpace={leadingSpace}
      />
    </Clickable>
  )
}
