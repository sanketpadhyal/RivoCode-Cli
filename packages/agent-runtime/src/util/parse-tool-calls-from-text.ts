import {
  startToolTag,
  endToolTag,
  toolNameParam,
} from '@codebuff/common/tools/constants'

export type ParsedToolCallFromText = {
  type: 'tool_call'
  toolName: string
  input: Record<string, unknown>
}

export type ParsedTextSegment = {
  type: 'text'
  text: string
}

export type ParsedSegment = ParsedToolCallFromText | ParsedTextSegment

export function parseTextWithToolCalls(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []

  const toolExtractionPattern = new RegExp(
    `${escapeRegex(startToolTag)}([\\s\\S]*?)${escapeRegex(endToolTag)}`,
    'gs',
  )

  let lastIndex = 0

  for (const match of text.matchAll(toolExtractionPattern)) {
    if (match.index !== undefined && match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim()
      if (textBefore) {
        segments.push({ type: 'text', text: textBefore })
      }
    }

    const jsonContent = match[1].trim()

    try {
      const parsed = JSON.parse(jsonContent)
      const toolName = parsed[toolNameParam]

      if (typeof toolName === 'string') {
        const input = { ...parsed }
        delete input[toolNameParam]

        delete input['cb_easp']

        segments.push({
          type: 'tool_call',
          toolName,
          input,
        })
      }
    } catch {
    }

    if (match.index !== undefined) {
      lastIndex = match.index + match[0].length
    }
  }

  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex).trim()
    if (textAfter) {
      segments.push({ type: 'text', text: textAfter })
    }
  }

  return segments
}

export function parseToolCallsFromText(
  text: string,
): Omit<ParsedToolCallFromText, 'type'>[] {
  return parseTextWithToolCalls(text)
    .filter((segment): segment is ParsedToolCallFromText => segment.type === 'tool_call')
    .map(({ toolName, input }) => ({ toolName, input }))
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
