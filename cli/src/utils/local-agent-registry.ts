import fs from 'fs'
import os from 'os'
import path from 'path'

import { pluralize } from '@rivocode/common/util/string'
import {
  loadLocalAgents as sdkLoadLocalAgents,
  loadMCPConfigSync,
} from '@rivocode/sdk'

import type { MCPConfig } from '@rivocode/common/types/mcp'

import { getProjectRoot } from '../project-files'
import { AGENT_MODE_TO_ID, type AgentMode } from './constants'
import { logger } from './logger'
import * as bundledAgentsModule from '../agents/bundled-agents.generated'

import type { AgentDefinition } from '@rivocode/common/templates/initial-agents-dir/types/agent-definition'

const AGENTS_DIR_NAME = '.agents'

export interface LocalAgentInfo {
  id: string
  displayName: string
  filePath: string
  isBundled?: boolean
}

let userAgentsCache: Record<string, AgentDefinition> = {}
let userAgentFilePaths: Map<string, string> = new Map()
let mcpServersCache: Record<string, MCPConfig> = {}

export async function initializeAgentRegistry(): Promise<void> {
  try {
    userAgentsCache = await sdkLoadLocalAgents({ verbose: false })
    userAgentFilePaths = buildAgentFilePathMap(getDefaultAgentDirs())
  } catch (error) {
    logger.warn(
      { error },
      'Failed to load user agents from .agents directories',
    )
    userAgentsCache = {}
    userAgentFilePaths = new Map()
  }

  try {
    const mcpConfig = loadMCPConfigSync({ verbose: false })
    mcpServersCache = mcpConfig.mcpServers
    if (Object.keys(mcpServersCache).length > 0) {
      logger.debug(
        {
          mcpServers: Object.keys(mcpServersCache),
          source: mcpConfig._sourceFilePath,
        },
        '[agents] Loaded MCP servers from mcp.json',
      )
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to load MCP config from .agents directories')
    mcpServersCache = {}
  }
}

const getDefaultAgentDirs = (): string[] => {
  const cwdAgents = path.join(process.cwd(), AGENTS_DIR_NAME)
  const parentAgents = path.join(process.cwd(), '..', AGENTS_DIR_NAME)
  const homeAgents = path.join(os.homedir(), AGENTS_DIR_NAME)
  return [cwdAgents, parentAgents, homeAgents]
}

const buildAgentFilePathMap = (agentsDirs: string[]): Map<string, string> => {
  const idToPath = new Map<string, string>()
  const idRegex = /id\s*:\s*['"`]([^'"`]+)['"`]/i

  const scanDirectory = (dir: string): void => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scanDirectory(fullPath)
          continue
        }
        if (
          !entry.isFile() ||
          !entry.name.endsWith('.ts') ||
          entry.name.endsWith('.d.ts') ||
          entry.name.endsWith('.test.ts')
        ) {
          continue
        }
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          const match = content.match(idRegex)
          if (match?.[1]) {
            idToPath.set(match[1], fullPath)
          }
        } catch {
        }
      }
    } catch {
    }
  }

  for (const agentsDir of agentsDirs) {
    scanDirectory(agentsDir)
  }
  return idToPath
}

const getUserAgentsAsLocalInfo = (): LocalAgentInfo[] => {
  return Object.values(userAgentsCache).map((def) => ({
    id: def.id,
    displayName: def.displayName || def.id,
    filePath: userAgentFilePaths.get(def.id) || '',
  }))
}

const getUserAgentDefinitions = (): AgentDefinition[] => {
  return Object.values(userAgentsCache) as AgentDefinition[]
}

const getBundledAgents = (): Record<string, AgentDefinition> => {
  return bundledAgentsModule.bundledAgents ?? {}
}

const getBundledAgentsAsLocalInfo = (): LocalAgentInfo[] => {
  return bundledAgentsModule.getBundledAgentsAsLocalInfo?.() ?? []
}

let cachedAgentsDir: string | null = null

export const findAgentsDirectory = (): string | null => {
  if (cachedAgentsDir && fs.existsSync(cachedAgentsDir)) {
    return cachedAgentsDir
  }

  const projectRoot = getProjectRoot() || process.cwd()
  if (projectRoot) {
    const rootCandidate = path.join(projectRoot, AGENTS_DIR_NAME)
    if (
      fs.existsSync(rootCandidate) &&
      fs.statSync(rootCandidate).isDirectory()
    ) {
      cachedAgentsDir = rootCandidate
      return cachedAgentsDir
    }
  }

  let currentDir = process.cwd()
  const filesystemRoot = path.parse(currentDir).root

  while (true) {
    const candidate = path.join(currentDir, AGENTS_DIR_NAME)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      cachedAgentsDir = candidate
      return cachedAgentsDir
    }

    if (currentDir === filesystemRoot) {
      break
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  cachedAgentsDir = null
  return null
}

const cachedAgentsByMode: Map<string, LocalAgentInfo[]> = new Map()

export const loadLocalAgents = (
  currentAgentMode?: AgentMode,
): LocalAgentInfo[] => {
  const cacheKey = currentAgentMode ?? 'all'
  const cached = cachedAgentsByMode.get(cacheKey)
  if (cached) {
    return cached
  }

  const bundledAgentsInfo = getBundledAgentsAsLocalInfo()
  const bundledAgents = getBundledAgents()

  let filteredBundledAgents: LocalAgentInfo[]
  if (currentAgentMode) {
    const currentAgentId = AGENT_MODE_TO_ID[currentAgentMode]
    const currentAgentDef = bundledAgents[currentAgentId]
      ? bundledAgents[currentAgentId]
      : undefined
    const spawnableAgentIds = new Set(currentAgentDef?.spawnableAgents ?? [])

    filteredBundledAgents = bundledAgentsInfo.filter((agent) =>
      spawnableAgentIds.has(agent.id),
    )
  } else {
    filteredBundledAgents = bundledAgentsInfo
  }

  const results: LocalAgentInfo[] = [...filteredBundledAgents]
  const includedIds = new Set(filteredBundledAgents.map((a) => a.id))

  const userAgents = getUserAgentsAsLocalInfo()

  for (const userAgent of userAgents) {
    if (includedIds.has(userAgent.id)) {
      const idx = results.findIndex((a) => a.id === userAgent.id)
      if (idx !== -1) {
        results[idx] = userAgent
      }
    } else {
      results.push(userAgent)
      includedIds.add(userAgent.id)
    }
  }

  const sorted = results.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'en'),
  )

  cachedAgentsByMode.set(cacheKey, sorted)
  return sorted
}

export const loadAgentDefinitions = (): AgentDefinition[] => {
  const bundledAgents = getBundledAgents()
  const definitions: AgentDefinition[] = Object.values(bundledAgents).map(
    (def) => ({ ...def }),
  )
  const bundledIds = new Set(Object.keys(bundledAgents))

  const userAgentDefs = getUserAgentDefinitions()
  const userAgentIds = userAgentDefs.map((def) => def.id)

  for (const agentDef of userAgentDefs) {
    if (bundledIds.has(agentDef.id)) {
      const idx = definitions.findIndex((d) => d.id === agentDef.id)
      if (idx !== -1) {
        definitions[idx] = { ...agentDef }
      }
    } else {
      definitions.push({ ...agentDef })
    }
  }

  if (userAgentIds.length > 0) {
    for (const def of definitions) {
      if (def.id.startsWith('base') && def.spawnableAgents) {
        const existingSpawnable = new Set(def.spawnableAgents)
        for (const userAgentId of userAgentIds) {
          if (!existingSpawnable.has(userAgentId)) {
            def.spawnableAgents = [...def.spawnableAgents, userAgentId]
          }
        }
      }
    }
  }

  if (Object.keys(mcpServersCache).length > 0) {
    for (const def of definitions) {
      if (def.id.startsWith('base')) {
        if (!def.mcpServers) {
          def.mcpServers = {}
        }
        def.mcpServers = {
          ...def.mcpServers,
          ...mcpServersCache,
        }
      }
    }
  }

  return definitions
}

export const announceLoadedAgents = (): void => {
  const agents = loadLocalAgents()
  const agentsDir = findAgentsDirectory()

  if (!agentsDir) {
    logger.debug('[agents] No .agents directory found in this project.')
    return
  }

  if (!agents.length) {
    logger.debug({ agentsDir }, '[agents] No agent files found')
    return
  }

  const agentIdentifiers = agents.map((agent) =>
    agent.displayName && agent.displayName !== agent.id
      ? `${agent.displayName} (${agent.id})`
      : agent.displayName || agent.id,
  )

  logger.debug(
    { agentsDir, agents: agentIdentifiers },
    `[agents] Loaded ${pluralize(agents.length, 'local agent')}`,
  )
}

export const getLoadedAgentsMessage = (): string | null => {
  const agents = loadLocalAgents()
  const agentsDir = findAgentsDirectory()

  if (!agentsDir || !agents.length) {
    return null
  }

  const agentCount = agents.length
  const header = `Loaded ${pluralize(agentCount, 'local agent')} from ${agentsDir}`
  const agentList = agents
    .map((agent) => {
      const identifier =
        agent.displayName && agent.displayName !== agent.id
          ? `${agent.displayName} (${agent.id})`
          : agent.displayName || agent.id
      return `  - ${identifier}`
    })
    .join('\n')

  return `${header}\n${agentList}`
}

export const getLoadedAgentsData = (): {
  agents: LocalAgentInfo[]
  agentsDir: string
} | null => {
  const agents = loadLocalAgents()
  const agentsDir = findAgentsDirectory()

  if (!agentsDir || !agents.length) {
    return null
  }

  return { agents, agentsDir }
}

export const __resetLocalAgentRegistryForTests = (): void => {
  cachedAgentsByMode.clear()
  cachedAgentsDir = null
  userAgentsCache = {}
  userAgentFilePaths = new Map()
  mcpServersCache = {}
}

export const getLoadedMCPServers = (): Record<string, MCPConfig> => {
  return { ...mcpServersCache }
}
