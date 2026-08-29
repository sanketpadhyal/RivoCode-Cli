import { memo, useRef } from 'react'

import { makeTextUnselectable } from './clickable'

import type { ReactNode } from 'react'

interface ButtonProps {
  onClick?: (e?: unknown) => void | Promise<unknown>
  onMouseOver?: () => void
  onMouseOut?: () => void
  style?: Record<string, unknown>
  children?: ReactNode
  [key: string]: unknown
}

export const Button = memo(function Button({ onClick, onMouseOver, onMouseOut, style, children, ...rest }: ButtonProps) {
  const processedChildren = makeTextUnselectable(children)

  const mouseDownRef = useRef(false)

  const handleMouseDown = () => {
    mouseDownRef.current = true
  }

  const handleMouseUp = (e?: unknown) => {
    if (mouseDownRef.current && onClick) {
      onClick(e)
    }
    mouseDownRef.current = false
  }

  const handleMouseOut = () => {
    mouseDownRef.current = false
    onMouseOut?.()
  }

  return (
    <box
      {...rest}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseOver={onMouseOver}
      onMouseOut={handleMouseOut}
    >
      {processedChildren}
    </box>
  )
})
