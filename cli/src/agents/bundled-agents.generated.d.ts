import type { LocalAgentInfo } from '../utils/local-agent-registry'

export declare const bundledAgents: Record<string, any>
export declare function getBundledAgentsAsLocalInfo(): LocalAgentInfo[]
export declare function getBundledAgentIds(): string[]
export declare function isBundledAgent(agentId: string): boolean
