export function formatCodeSearchOutput(
  stdout: string,
  options: { matchCount?: number } = {},
): string {
  if (!stdout) {
    return 'Found 0 matches'
  }
  const lines = stdout.split('\n')
  const formatted: string[] = [
    `Found ${options.matchCount ?? countFormattedMatches(lines)} matches`,
  ]
  let currentFile: string | null = null

  for (const line of lines) {
    if (!line.trim()) {
      formatted.push(line)
      continue
    }

    if (line === '--') {
      continue
    }

    const parsedLine = parseRipgrepLine(line)

    if (!parsedLine) {
      formatted.push(line)
      continue
    }
    const { filePath, lineNumber, content } = parsedLine

    if (filePath && !filePath.startsWith(' ') && !filePath.startsWith('\t')) {
      if (filePath !== currentFile) {
        if (currentFile !== null) {
          formatted.push('')
        }
        currentFile = filePath
        formatted.push(filePath + ':')
        formatted.push(`  Line ${lineNumber}: ${content}`)
      } else {
        formatted.push(`  Line ${lineNumber}: ${content}`)
      }
    } else {
      formatted.push(line)
    }
  }

  return formatted.join('\n')
}

function parseRipgrepLine(line: string): {
  filePath: string
  lineNumber: string
  content: string
  isContext: boolean
} | null {
  const matchLineMatch = line.match(/(.*?):(\d+):(.*)$/)
  if (matchLineMatch) {
    return {
      filePath: matchLineMatch[1],
      lineNumber: matchLineMatch[2],
      content: matchLineMatch[3],
      isContext: false,
    }
  }

  const contextLineMatch = line.match(/(.*?)-(\d+)-(.*)$/)
  if (contextLineMatch) {
    return {
      filePath: contextLineMatch[1],
      lineNumber: contextLineMatch[2],
      content: contextLineMatch[3],
      isContext: true,
    }
  }

  return null
}

function countFormattedMatches(lines: string[]): number {
  return lines.filter((line) => {
    const parsedLine = parseRipgrepLine(line)
    return parsedLine && !parsedLine.isContext
  }).length
}
