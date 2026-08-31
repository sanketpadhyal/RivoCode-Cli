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
  availableWidth: _availableWidth,
}: UseLogoOptions): LogoResult => {
  const component = useMemo(() => {
    // Small, compact Rivo Icon rendering
    return (
      <box style={{ flexDirection: 'column', marginBottom: 1 }}>
        <text key="line-0" style={{ wrapMode: 'none' }}>
          <span>     </span>
          <span fg="#ffffff">▄▄</span>
          <span>  </span>
          <span fg="#ffffff">▄▄▄▄</span>
          <span> </span>
        </text>
        <text key="line-1" style={{ wrapMode: 'none' }}>
          <span>  </span>
          <span fg="#ffffff">▄</span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀</span>
          <span> </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text key="line-2" style={{ wrapMode: 'none' }}>
          <span>  </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀</span>
          <span> </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text key="line-3" style={{ wrapMode: 'none' }}>
          <span>  </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀</span>
          <span> </span>
          <span fg="#c6ff00">▄▄▄▄▄</span>
          <span> </span>
        </text>
        <text key="line-4" style={{ wrapMode: 'none' }}>
          <span>  </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀▀▀</span>
          <span> </span>
          <span fg="#c6ff00" bg="#c6ff00">▀▀▀▀▀</span>
          <span> </span>
        </text>
        <text key="line-5" style={{ wrapMode: 'none' }}>
          <span>  </span>
          <span fg="#ffffff" bg="#ffffff">▀▀▀</span>
          <span fg="#ffffff">▀</span>
          <span>  </span>
          <span fg="#c6ff00">▀</span>
          <span fg="#c6ff00" bg="#c6ff00">▀▀▀▀</span>
          <span> </span>
        </text>
      </box>
    )
  }, [])

  return { component, textBlock: 'RIVOCODE' }
}
