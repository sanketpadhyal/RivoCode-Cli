import fs from 'fs'
import path from 'path'
import React, { useMemo } from 'react'

import { LOGO, LOGO_SMALL, SHADOW_CHARS } from '../login/constants'
import { parseLogoLines } from '../login/utils'
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
  applySheenToChar,
  textColor,
  accentColor = '#9EFC62',
  blockColor = '#ffffff',
  maxHeight,
}: UseLogoOptions): LogoResult => {
  const ASCII_LOGO_LINES = 6

  const inlineImageSequence = useMemo(() => {
    if (!supportsInlineImages()) return null
    const base64 = getRivoImageBase64()
    if (!base64) return null
    return renderInlineImage(base64, {
      width: Math.min(availableWidth, 64),
      filename: 'rivo.png',
    })
  }, [availableWidth])

  const rawLogoString = useMemo(() => {
    if (maxHeight != null && maxHeight < ASCII_LOGO_LINES) {
      return 'RIVOCODE'
    }
    if (availableWidth >= 70) return LOGO
    if (availableWidth >= 20) return LOGO_SMALL
    return 'RIVOCODE'
  }, [availableWidth, maxHeight])

  const textBlock = useMemo(() => {
    if (rawLogoString === 'RIVOCODE') {
      return ''
    }
    return parseLogoLines(rawLogoString)
      .map((line) => line.slice(0, availableWidth))
      .join('\n')
  }, [rawLogoString, availableWidth])

  const component = useMemo(() => {
    if (inlineImageSequence) {
      return (
        <box style={{ flexDirection: 'column', marginBottom: 1 }}>
          <text style={{ wrapMode: 'none' }}>{inlineImageSequence}</text>
        </box>
      )
    }

    if (rawLogoString === 'RIVOCODE') {
      const brandName = 'RivoCode'
      const forcedByHeight = maxHeight != null && maxHeight < ASCII_LOGO_LINES
      const displayText =
        availableWidth < 30 || forcedByHeight
          ? brandName
          : `${brandName} CLI`

      return (
        <text style={{ wrapMode: 'none' }}>
          <b>
            {textColor ? (
              <span fg={textColor}>{displayText}</span>
            ) : (
              <>{displayText}</>
            )}
          </b>
        </text>
      )
    }

    const logoLines = parseLogoLines(rawLogoString)
    const displayLines = logoLines.map((line) => line.slice(0, availableWidth))

    const defaultColorChar = (char: string, charIndex: number) => {
      if (char === ' ' || char === '\n') {
        return <span key={charIndex}>{char}</span>
      }
      if (char === '█') {
        return <span key={charIndex} fg={blockColor}>{char}</span>
      }
      if (SHADOW_CHARS.has(char)) {
        return <span key={charIndex} fg={accentColor}>{char}</span>
      }
      return <span key={charIndex} fg={accentColor}>{char}</span>
    }

    return (
      <>
        {displayLines.map((line, lineIndex) => (
          <text key={`logo-line-${lineIndex}`} style={{ wrapMode: 'none' }}>
            {line
              .split('')
              .map((char, charIndex) =>
                applySheenToChar
                  ? applySheenToChar(char, charIndex, lineIndex)
                  : defaultColorChar(char, charIndex),
              )}
          </text>
        ))}
      </>
    )
  }, [inlineImageSequence, rawLogoString, availableWidth, applySheenToChar, textColor, accentColor, blockColor, maxHeight])

  return { component, textBlock }
}
