import type { ReactNode } from 'react'

interface HighlightOptions {
  fg?: string
  monochrome?: boolean
}

export function highlightCode(
  code: string,
  lang: string,
  options: HighlightOptions = {},
): ReactNode {
  const { fg = '#d1d5db' } = options

  return <span fg={fg}>{code}</span>
}
