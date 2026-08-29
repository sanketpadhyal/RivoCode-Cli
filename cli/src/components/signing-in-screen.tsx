import React, { useEffect, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface SigningInScreenProps {
  onComplete: () => void
}

export const SigningInScreen = ({ onComplete }: SigningInScreenProps) => {
  const theme = useTheme()
  const { contentMaxWidth } = useTerminalDimensions()
  const [frameIndex, setFrameIndex] = useState(0)

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
  })

  // Animate spinner
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  // 6 second timer to bypass login and advance to workspace trust screen
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 6000)
    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <box
      style={{
        flexDirection: 'column',
        paddingLeft: 2,
        paddingTop: 1,
        gap: 1,
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          marginBottom: 1,
        }}
      >
        {logoComponent}
      </box>

      <text style={{ wrapMode: 'none' }}>
        <span fg={theme.foreground}>Welcome to the </span>
        <b>
          <span fg={theme.primary}>RivoCode CLI</span>
        </b>
        <span fg={theme.foreground}>. You are in good hands.</span>
      </text>

      <box style={{ flexDirection: 'row', gap: 1, marginTop: 1 }}>
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.primary}>{SPINNER_FRAMES[frameIndex]}</span>
          <span fg={theme.foreground}>  Signing in...</span>
        </text>
      </box>
    </box>
  )
}
