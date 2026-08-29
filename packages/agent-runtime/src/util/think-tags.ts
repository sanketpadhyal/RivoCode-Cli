export function stripThinkTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .replace(/<\/think>/g, '')
    .trim()
}

export function isThinkOnlyResponse(fullResponse: string): boolean {
  const trimmed = fullResponse.trim()
  if (trimmed.length === 0) {
    return false
  }
  return stripThinkTags(fullResponse).length === 0
}
