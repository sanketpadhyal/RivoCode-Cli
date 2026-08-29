export const DEFAULT_ORG_PREFIX = 'codebuff/'

export function resolveAgentId(
  agentId: string,
  agentRegistry: Record<string, any>,
): string | null {
  if (!agentId || typeof agentId !== 'string') {
    return null
  }

  if (agentId in agentRegistry) {
    return agentId
  }

  if (!agentId.includes('/')) {
    const prefixedAgentId = `${DEFAULT_ORG_PREFIX}${agentId}`
    if (prefixedAgentId in agentRegistry) {
      return prefixedAgentId
    }
  }

  return null
}
