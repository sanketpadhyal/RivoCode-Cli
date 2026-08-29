import React, { useState } from 'react'

import { Button } from './button'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { ChatTheme } from '../types/theme-system'

export type BannerColorKey = keyof ChatTheme

export interface BottomBannerConfig {
  borderColorKey: BannerColorKey
  borderColor?: string
  textColorKey?: BannerColorKey
  textColor?: string
  text?: string
  children?: React.ReactNode
  onClose?: () => void
  border?: ('top' | 'bottom' | 'left' | 'right')[]
}

export type BottomBannerProps = BottomBannerConfig

export const BottomBanner: React.FC<BottomBannerProps> = ({
  borderColorKey,
  borderColor: borderColorOverride,
  textColorKey,
  textColor: textColorOverride,
  text,
  children,
  onClose,
  border,
}) => {
  const { width, terminalWidth } = useTerminalLayout()
  const theme = useTheme()
  const [isCloseHovered, setIsCloseHovered] = useState(false)

  const themeRecord = theme as unknown as Record<string, string>
  const borderColor = borderColorOverride ?? themeRecord[borderColorKey]
  const textColor =
    textColorOverride ??
    (textColorKey ? themeRecord[textColorKey] : borderColor)

  const hasCloseButton = onClose !== undefined
  const hasTextContent = text !== undefined && children === undefined

  return (
    <box
      key={terminalWidth}
      style={{
        marginLeft: width.is('sm') ? 0 : 1,
        marginRight: width.is('sm') ? 0 : 1,
        borderStyle: 'single',
        borderColor: borderColor,
        flexDirection: hasCloseButton ? 'row' : 'column',
        justifyContent: hasCloseButton ? 'space-between' : undefined,
        paddingLeft: 1,
        paddingRight: 1,
        marginTop: 0,
        marginBottom: 0,
      }}
      border={border ?? ['bottom', 'left', 'right']}
      customBorderChars={BORDER_CHARS}
    >
      {hasTextContent ? (
        <>
          <text
            style={{
              fg: textColor,
              wrapMode: 'word',
              flexShrink: 1,
              marginRight: hasCloseButton ? 3 : 0,
            }}
          >
            {text}
          </text>
        </>
      ) : (
        children
      )}
      {hasCloseButton && (
        <Button
          onClick={onClose}
          onMouseOver={() => setIsCloseHovered(true)}
          onMouseOut={() => setIsCloseHovered(false)}
        >
          <text style={{ fg: isCloseHovered ? theme.error : theme.muted }}>
            x
          </text>
        </Button>
      )}
    </box>
  )
}
