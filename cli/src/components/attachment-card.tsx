import { useState } from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'

import type { ReactNode } from 'react'

export interface AttachmentCardProps {
  width?: number
  children: ReactNode
  onRemove?: () => void
  showRemoveButton?: boolean
  label?: string
}

export const AttachmentCard = ({
  width = 28,
  children,
  onRemove,
  showRemoveButton = true,
  label,
}: AttachmentCardProps) => {
  const theme = useTheme()
  const [isCloseHovered, setIsCloseHovered] = useState(false)

  const shouldShowClose = showRemoveButton && !!onRemove

  return (
    <box
      style={{
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: '#475569',
        width,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {(label || shouldShowClose) && (
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 1,
          }}
        >
          <text style={{ fg: theme.info || '#38bdf8' }}>{label || ''}</text>
          {shouldShowClose ? (
            <Button
              onClick={onRemove}
              onMouseOver={() => setIsCloseHovered(true)}
              onMouseOut={() => setIsCloseHovered(false)}
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              <text style={{ fg: isCloseHovered ? theme.error : theme.muted }}>✕</text>
            </Button>
          ) : (
            <box style={{ width: 1 }} />
          )}
        </box>
      )}
      {children}
    </box>
  )
}
