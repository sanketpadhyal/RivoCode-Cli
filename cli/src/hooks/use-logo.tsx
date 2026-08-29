import fs from 'fs'
import path from 'path'
import React, { useMemo } from 'react'

import { renderInlineImage, supportsInlineImages } from '../utils/terminal-images'

interface UseLogoOptions {
  availableWidth: number
  applySheenToChar?: (char: string, charIndex: number, lineIndex: number) => React.ReactNode
  textColor?: string
  accentColor?: string
  blockColor?: string
  maxHeight?: number
}

interface LogoResult {
  component: React.ReactNode
  textBlock: string
}

function getRivoImageBase64(): string | null {
  const possiblePaths = [
    '/Users/sanketpadhyal/Desktop/Cli/freebuff/assets/rivo.png',
    path.join(process.cwd(), 'assets/rivo.png'),
    path.join(process.cwd(), '../assets/rivo.png'),
    path.join(__dirname, '../../assets/rivo.png'),
    path.join(__dirname, '../assets/rivo.png'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p).toString('base64')
      } catch {}
    }
  }
  return null
}

export const useLogo = ({
  availableWidth,
}: UseLogoOptions): LogoResult => {
  const inlineImageSequence = useMemo(() => {
    if (!supportsInlineImages()) return null
    const base64 = getRivoImageBase64()
    if (!base64) return null
    return renderInlineImage(base64, {
      width: Math.min(availableWidth, 32),
      filename: 'rivo.png',
    })
  }, [availableWidth])

  const component = useMemo(() => {
    if (inlineImageSequence) {
      return (
        <box style={{ flexDirection: 'column', marginBottom: 1 }}>
          <text style={{ wrapMode: 'none' }}>{inlineImageSequence}</text>
        </box>
      )
    }

    // High-resolution Rivo Icon character rendering
    return (
      <box style={{ flexDirection: 'column', marginBottom: 1 }}>
        <text style={{ wrapMode: 'none' }}>
          <span>     </span>
          <span fg="#ffffff">▄</span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀</span>
          <span> </span>
          <span fg="#ffffff">▄</span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff">▄</span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span fg="#ffffff">▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#c6ff00">▄▄▄▄▄▄▄▄</span>
          <span>  </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#c6ff00" bg="#c6ff00">▀▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#c6ff00" bg="#c6ff00">▀▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀▀</span>
          <span> </span>
          <span fg="#c6ff00" bg="#c6ff00">▀▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀▀▀</span>
          <span>  </span>
          <span fg="#c6ff00" bg="#c6ff00">▀▀▀▀▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span>   </span>
          <span fg="#ffffff">▀▀▀▀</span>
          <span>       </span>
          <span fg="#c6ff00">▀▀▀▀▀▀▀</span>
          <span>  </span>
        </text>
      </box>
    )
  }, [inlineImageSequence])

  return { component, textBlock: 'RIVOCODE' }
}
