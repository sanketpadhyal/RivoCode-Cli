import { AGENT_PERSONAS } from '../constants/agents'

export interface AgentInfo {
  id: string
  displayName: string
  purpose?: string
  isBuiltIn: boolean
}

export function getBuiltInAgents(): AgentInfo[] {
  return Object.entries(AGENT_PERSONAS)
    .filter(([, persona]) => !('hidden' in persona) || !persona.hidden)
    .map(([agentId, persona]) => ({
      id: agentId,
      displayName: persona.displayName,
      purpose: persona.purpose,
      isBuiltIn: true,
    }))
}

export function getLocalAgents(
  localAgents: Record<string, { displayName: string; purpose?: string }>,
): AgentInfo[] {
  return Object.entries(localAgents).map(([agentId, config]) => ({
    id: agentId,
    displayName: config.displayName,
    purpose: config.purpose,
    isBuiltIn: false,
  }))
}

export function getAllAgents(
  localAgents: Record<string, { displayName: string; purpose?: string }> = {},
): AgentInfo[] {
  return [...getBuiltInAgents(), ...getLocalAgents(localAgents)]
}

export function resolveNameToId(
  displayName: string,
  localAgents: Record<string, { displayName: string; purpose?: string }> = {},
): string | null {
  const agents = getAllAgents(localAgents)
  const agent = agents.find(
    (a) => a.displayName.toLowerCase() === displayName.toLowerCase(),
  )
  return agent?.id || null
}

function resolveIdToName(
  agentId: string,
  localAgents: Record<string, { displayName: string; purpose?: string }> = {},
): string | null {
  const agents = getAllAgents(localAgents)
  const agent = agents.find((a) => a.id === agentId)
  return agent?.displayName || null
}

export function getAgentDisplayName(
  agentIdOrName: string,
  localAgents: Record<string, { displayName: string; purpose?: string }> = {},
): string {
  return (
    resolveIdToName(agentIdOrName, localAgents) ||
    (resolveNameToId(agentIdOrName, localAgents)
      ? agentIdOrName
      : agentIdOrName)
  )
}
