import { TextAttributes } from '@opentui/core'
import React, { useEffect, useRef, useState } from 'react'

interface InputCursorProps {
  visible: boolean
  focused: boolean
  shouldBlink?: boolean
  char?: string
  color?: string
  blinkDelay?: number
  blinkInterval?: number
  bold?: boolean
}

export const InputCursor: React.FC<InputCursorProps> = ({
  visible,
  focused,
  shouldBlink = true,
  char = '▍',
  color,
  blinkDelay = 500,
  blinkInterval = 500,
  bold = true,
}) => {
  const [isInvisible, setIsInvisible] = useState(false)
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current)
      blinkIntervalRef.current = null
    }

    setIsInvisible(false)

    if (!shouldBlink || !focused || !visible) return

    const idleTimer = setTimeout(() => {
      blinkIntervalRef.current = setInterval(() => {
        setIsInvisible((prev) => !prev)
      }, blinkInterval)
    }, blinkDelay)

    return () => {
      clearTimeout(idleTimer)
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current)
        blinkIntervalRef.current = null
      }
    }
  }, [visible, focused, shouldBlink, blinkDelay, blinkInterval])

  if (!visible || !focused) {
    return null
  }

  if (isInvisible) {
    return <span> </span>
  }

  return (
    <span
      {...(color ? { fg: color } : undefined)}
      {...(bold ? { attributes: TextAttributes.BOLD } : undefined)}
    >
      {char}
    </span>
  )
}