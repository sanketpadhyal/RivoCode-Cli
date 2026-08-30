import { TextAttributes } from '@opentui/core'
import fs from 'fs'
import path from 'path'
import React, { useEffect, useMemo, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { initProjectWorkspace } from '../workspace/project-context'
import { ensureOcrBinaryExists } from '../utils/ocr-helper'
import { ensureWebToolExists } from '../utils/web-helper'

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
  isReturning?: boolean
}

export const SettingUpSession = ({ onComplete, isReturning = false }: SettingUpSessionProps) => {
  const theme = useTheme()
  const { contentMaxWidth } = useTerminalDimensions()
  const [frameIndex, setFrameIndex] = useState(0)
  const [setupStep, setSetupStep] = useState(0)

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

  // Execute actual initialization steps live
  useEffect(() => {
    // Step 1: Initialize workspace files (.rivocode, context.json, settings.json, ocr.swift, web.js)
    setSetupStep(1)
    try {
      initProjectWorkspace(process.cwd())
      ensureOcrBinaryExists()
      ensureWebToolExists()
    } catch (_e) {}

    const t1 = setTimeout(() => {
      setSetupStep(2)
    }, 300)

    const t2 = setTimeout(() => {
      setSetupStep(3)
    }, 600)

    const t3 = setTimeout(() => {
      setSetupStep(4)
    }, 900)

    const t4 = setTimeout(() => {
      onComplete()
    }, 1200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [onComplete])

  const stepText = useMemo(() => {
    if (isReturning) {
      if (setupStep === 1) return 'Reconnecting workspace session...'
      if (setupStep === 2) return 'Checking native Vision OCR tools...'
      if (setupStep === 3) return 'Verifying web reader & internet tools...'
      return 'Connected & Ready!'
    } else {
      if (setupStep === 1) return 'Initializing .rivocode workspace configuration...'
      if (setupStep === 2) return 'Installing native Vision OCR in .rivocode/ocr.swift...'
      if (setupStep === 3) return 'Installing web access & markdown reader in .rivocode/web.js...'
      return 'Workspace ready!'
    }
  }, [isReturning, setupStep])

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
          <span fg={theme.foreground}>  [{setupStep}/4] {stepText}</span>
        </text>
      </box>
    </box>
  )
}
