import { TextAttributes } from '@opentui/core'
import fs from 'fs'
import path from 'path'
import React, { useEffect, useMemo, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function hasExistingWorkspace(): boolean {
  try {
    const rivoDir = path.join(process.cwd(), '.rivocode')
    return fs.existsSync(rivoDir) && fs.existsSync(path.join(rivoDir, 'context.json'))
  } catch {
    return false
  }
}

interface SettingUpSessionProps {
  onComplete: () => void
}

export const SettingUpSession = ({ onComplete }: SettingUpSessionProps) => {
  const theme = useTheme()
  const { contentMaxWidth } = useTerminalDimensions()
  const [frameIndex, setFrameIndex] = useState(0)

  const isReturning = useMemo(() => hasExistingWorkspace(), [])
  const statusLabel = isReturning ? 'Reconnecting...' : 'Setting Up...'

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

  // Timer to display animation before advancing
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 4500)
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
        <span fg={theme.foreground}>Welcome to </span>
        <span fg={theme.primary} attributes={TextAttributes.BOLD}>
          RivoCode
        </span>
      </text>

      <box style={{ flexDirection: 'row', gap: 1, marginTop: 1 }}>
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.primary}>{SPINNER_FRAMES[frameIndex]}</span>
          <span fg={theme.foreground}>  {statusLabel}</span>
        </text>
      </box>
    </box>
  )
}
