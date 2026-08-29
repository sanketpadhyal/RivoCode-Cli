export function parseToolCallXml(xmlString: string): Record<string, string> {
  if (!xmlString.trim()) return {}

  const result: Record<string, string> = {}
  const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g
  let match

  while ((match = tagPattern.exec(xmlString)) !== null) {
    const [, key, rawValue] = match

    const value = rawValue.replace(/^\s+|\s+$/g, '')

    result[key] = value
  }

  return result
}
