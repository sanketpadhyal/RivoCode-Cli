
import type { DynamicAgentTemplate } from '../types/dynamic-agent-template'

export function isCustomAgentFile(fileName: string): boolean {
  return fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')
}

export function filterCustomAgentFiles(fileNames: string[]): string[] {
  return fileNames.filter(isCustomAgentFile)
}

export function filterCustomAgentTemplates<T>(
  agentTemplates: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(agentTemplates).filter(([filePath]) =>
      isCustomAgentFile(filePath),
    ),
  )
}

export function extractAgentIdFromFileName(fileName: string): string {
  return fileName.replace('.ts', '')
}

export function filterValidAgentTemplates(
  agentTemplates: Record<string, DynamicAgentTemplate>,
): Record<string, DynamicAgentTemplate> {
  return Object.fromEntries(
    Object.entries(agentTemplates).filter(([key, template]) => {
      if (!template) {
        return false
      }

      if (key.endsWith('.d.ts')) {
        return false
      }

      if (key.includes('.') && !key.endsWith('.ts')) {
        const validExtensions = ['.ts', '.js', '.mjs']
        const hasValidExtension = validExtensions.some((ext) =>
          key.endsWith(ext),
        )
        if (!hasValidExtension) {
          return false
        }
      }

      if (!template.id || typeof template.id !== 'string') {
        return false
      }

      if (typeof template !== 'object') {
        return false
      }

      return true
    }),
  )
}
