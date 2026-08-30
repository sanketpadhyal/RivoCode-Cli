import { TextAttributes } from '@opentui/core'
import { useMemo } from 'react'

import { useTheme } from '../../hooks/use-theme'

interface DiffViewerProps {
  diffText: string
}

interface ParsedDiffLine {
  type: 'context' | 'added' | 'removed'
  lineNum: number
  content: string
  wordDiff?: {
    prefix: string
    highlighted: string
    suffix: string
  }
}

function computeWordDiff(oldStr: string, newStr: string, mode: 'removed' | 'added') {
  let start = 0
  while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
    start++
  }
  let oldEnd = oldStr.length - 1
  let newEnd = newStr.length - 1
  while (oldEnd >= start && newEnd >= start && oldStr[oldEnd] === newStr[newEnd]) {
    oldEnd--
    newEnd--
  }

  if (mode === 'removed') {
    return {
      prefix: oldStr.slice(0, start),
      highlighted: oldStr.slice(start, oldEnd + 1),
      suffix: oldStr.slice(oldEnd + 1),
    }
  } else {
    return {
      prefix: newStr.slice(0, start),
      highlighted: newStr.slice(start, newEnd + 1),
      suffix: newStr.slice(newEnd + 1),
    }
  }
}

function parseUnifiedDiff(diffText: string): ParsedDiffLine[] {
  const rawLines = diffText.split('\n')
  const result: ParsedDiffLine[] = []

  let oldLine = 1
  let newLine = 1

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (line === undefined || (line === '' && i === rawLines.length - 1)) continue

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match && match[1] && match[2]) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      continue
    }

    if (
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('similarity ') ||
      line.startsWith('rename ')
    ) {
      continue
    }

    if (line.startsWith('-')) {
      const removedText = line.slice(1)
      const nextLine = rawLines[i + 1]
      let wordDiff = undefined

      if (nextLine && nextLine.startsWith('+')) {
        const addedText = nextLine.slice(1)
        wordDiff = computeWordDiff(removedText, addedText, 'removed')
      }

      result.push({
        type: 'removed',
        lineNum: oldLine++,
        content: removedText,
        wordDiff,
      })
    } else if (line.startsWith('+')) {
      const addedText = line.slice(1)
      const prevLine = rawLines[i - 1]
      let wordDiff = undefined

      if (prevLine && prevLine.startsWith('-')) {
        const removedText = prevLine.slice(1)
        wordDiff = computeWordDiff(removedText, addedText, 'added')
      }

      result.push({
        type: 'added',
        lineNum: newLine++,
        content: addedText,
        wordDiff,
      })
    } else {
      const text = line.startsWith(' ') ? line.slice(1) : line
      result.push({
        type: 'context',
        lineNum: oldLine++,
        content: text,
      })
      newLine++
    }
  }

  return result
}

export const DiffViewer = ({ diffText }: DiffViewerProps) => {
  const theme = useTheme()

  const parsedLines = useMemo(() => parseUnifiedDiff(diffText), [diffText])
  const maxLineNum = Math.max(1, ...parsedLines.map((l) => l.lineNum))
  const padWidth = Math.max(2, String(maxLineNum).length)

  const dashedDivider = '┈'.repeat(80)

  return (
    <box
      style={{
        flexDirection: 'column',
        gap: 0,
        width: '100%',
        flexGrow: 1,
        marginTop: 0,
        marginBottom: 0,
      }}
    >
      {/* Top dashed divider */}
      <text style={{ wrapMode: 'none' }}>
        <span fg={theme.border}>{dashedDivider}</span>
      </text>

      {parsedLines.map((item, idx) => {
        const numStr = String(item.lineNum).padStart(padWidth, ' ')

        if (item.type === 'removed') {
          return (
            <box
              key={`diff-line-${idx}`}
              style={{
                flexDirection: 'row',
                width: '100%',
                backgroundColor: '#3b0808',
                paddingLeft: 0,
                paddingRight: 1,
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg="#f87171" attributes={TextAttributes.BOLD}>
                  {`${numStr} - `}
                </span>
                {item.wordDiff && item.wordDiff.highlighted ? (
                  <>
                    <span fg="#fca5a5">{item.wordDiff.prefix}</span>
                    <span
                      fg="#ffffff"
                      bg="#7f1d1d"
                      attributes={TextAttributes.BOLD}
                    >
                      {item.wordDiff.highlighted}
                    </span>
                    <span fg="#fca5a5">{item.wordDiff.suffix}</span>
                  </>
                ) : (
                  <span fg="#fca5a5">{item.content}</span>
                )}
              </text>
            </box>
          )
        }

        if (item.type === 'added') {
          return (
            <box
              key={`diff-line-${idx}`}
              style={{
                flexDirection: 'row',
                width: '100%',
                backgroundColor: '#052e16',
                paddingLeft: 0,
                paddingRight: 1,
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg="#4ade80" attributes={TextAttributes.BOLD}>
                  {`${numStr} + `}
                </span>
                {item.wordDiff && item.wordDiff.highlighted ? (
                  <>
                    <span fg="#86efac">{item.wordDiff.prefix}</span>
                    <span
                      fg="#ffffff"
                      bg="#15803d"
                      attributes={TextAttributes.BOLD}
                    >
                      {item.wordDiff.highlighted}
                    </span>
                    <span fg="#86efac">{item.wordDiff.suffix}</span>
                  </>
                ) : (
                  <span fg="#86efac">{item.content}</span>
                )}
              </text>
            </box>
          )
        }

        // Context line
        return (
          <box
            key={`diff-line-${idx}`}
            style={{
              flexDirection: 'row',
              width: '100%',
              paddingLeft: 0,
              paddingRight: 1,
            }}
          >
            <text style={{ wrapMode: 'none' }}>
              <span fg={theme.muted}>{`${numStr}   `}</span>
              <span fg={theme.foreground}>{item.content}</span>
            </text>
          </box>
        )
      })}

      {/* Bottom dashed divider */}
      <text style={{ wrapMode: 'none' }}>
        <span fg={theme.border}>{dashedDivider}</span>
      </text>
    </box>
  )
}

