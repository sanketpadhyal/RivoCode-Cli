
export function trimNewlines(str: string): string {
  return str.replace(/^\n+|\n+$/g, '')
}

export function sanitizePreview(text: string): string {
  return text.replace(/[#*_`~\[\]()]/g, '').trim()
}

export { isReasoningTextBlock } from '../../utils/block-processor'
