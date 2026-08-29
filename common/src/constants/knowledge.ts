import path from 'path'

export const KNOWLEDGE_FILE_NAMES = [
  'AGENTS.md',
  'CLAUDE.md',
] as const

export const KNOWLEDGE_FILE_NAMES_LOWERCASE = KNOWLEDGE_FILE_NAMES.map((name) =>
  name.toLowerCase(),
)

export function isKnowledgeFile(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase()

  if (KNOWLEDGE_FILE_NAMES_LOWERCASE.includes(fileName)) {
    return true
  }

  if (fileName.endsWith('.knowledge.md')) {
    return true
  }

  return false
}
