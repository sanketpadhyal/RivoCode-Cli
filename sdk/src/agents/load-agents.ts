import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'

import { validateAgents } from '../validate-agents'

import type { AgentDefinition } from '@codebuff/common/templates/initial-agents-dir/types/agent-definition'

export type LoadedAgentDefinition = AgentDefinition & {
  _sourceFilePath: string
  handleStepsFn?: AgentDefinition['handleSteps']
}

export type LoadedAgents = Record<string, LoadedAgentDefinition>

export function resolveMcpEnv(
  env: Record<string, string> | undefined,
  agentId: string,
  mcpServerName: string,
): Record<string, string> {
  if (!env) return {}

  const resolved: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (value.startsWith('$')) {
      const envVarName = value.slice(1)
      const envName = 'env'
      const envValue = process[envName][envVarName]

      if (envValue === undefined) {
        throw new Error(
          `Missing environment variable '${envVarName}' required by agent '${agentId}' in mcpServers.${mcpServerName}.env.${key}`,
        )
      }

      resolved[key] = envValue
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

export function resolveAgentMcpEnv(agent: AgentDefinition): void {
  if (!agent.mcpServers) return

  for (const [serverName, config] of Object.entries(agent.mcpServers)) {
    if ('command' in config && config.env) {
      config.env = resolveMcpEnv(config.env, agent.id, serverName)
    }
  }
}

export type AgentValidationError = {
  agentId: string
  filePath: string
  message: string
}

export type LoadLocalAgentsResult = {
  agents: LoadedAgents
  validationErrors: AgentValidationError[]
}

const agentFileExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

const shouldSkipAgentDirectory = (name: string): boolean =>
  name.startsWith('.') ||
  name === 'node_modules' ||
  name === 'scripts' ||
  name === 'skills' ||
  name.startsWith('skills-')

const isLoadableAgentFileName = (fileName: string): boolean => {
  const extension = path.extname(fileName).toLowerCase()
  return (
    agentFileExtensions.has(extension) &&
    !fileName.endsWith('.d.ts') &&
    !/[./](test|spec)\.[cm]?[tj]sx?$/.test(fileName)
  )
}

const getAllAgentFiles = (dir: string): string[] => {
  const files: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (shouldSkipAgentDirectory(entry.name)) continue
        files.push(...getAllAgentFiles(fullPath))
        continue
      }
      const isAgentFile = entry.isFile() && isLoadableAgentFileName(entry.name)
      if (isAgentFile) {
        files.push(fullPath)
      }
    }
  } catch {
  }
  return files
}

const getDefaultAgentDirs = () => {
  const cwdAgents = path.join(process.cwd(), '.agents')
  const parentAgents = path.join(process.cwd(), '..', '.agents')
  const homeAgents = path.join(os.homedir(), '.agents')
  return [cwdAgents, parentAgents, homeAgents]
}

export async function loadLocalAgents(options: {
  agentsPath?: string
  verbose?: boolean
  validate: true
}): Promise<LoadLocalAgentsResult>

export async function loadLocalAgents(options: {
  agentsPath?: string
  verbose?: boolean
  validate?: false
}): Promise<LoadedAgents>

export async function loadLocalAgents({
  agentsPath,
  verbose = false,
  validate = false,
}: {
  agentsPath?: string
  verbose?: boolean
  validate?: boolean
}): Promise<LoadedAgents | LoadLocalAgentsResult> {
  const agents: LoadedAgents = {}

  const agentDirs = agentsPath ? [agentsPath] : getDefaultAgentDirs()
  const allAgentFiles = agentDirs.flatMap((dir) => getAllAgentFiles(dir))

  if (allAgentFiles.length === 0) {
    return validate ? { agents, validationErrors: [] } : agents
  }

  for (const fullPath of allAgentFiles) {
    try {
      const agentModule = await importAgentModule(fullPath)
      if (!agentModule) {
        continue
      }
      const agentDefinition = agentModule.default ?? agentModule

      if (!agentDefinition?.id || !agentDefinition?.model) {
        if (verbose) {
          console.error(
            `Agent definition missing required attributes (id, model): ${fullPath}`,
          )
        }
        continue
      }

      const processedAgentDefinition: LoadedAgentDefinition = {
        ...agentDefinition,
        _sourceFilePath: fullPath,
      }
      if (agentDefinition.handleSteps) {
        if (typeof agentDefinition.handleSteps === 'function') {
          processedAgentDefinition.handleStepsFn = agentDefinition.handleSteps
        }
        processedAgentDefinition.handleSteps =
          agentDefinition.handleSteps.toString()
      }

      try {
        resolveAgentMcpEnv(processedAgentDefinition)
      } catch (error) {
        if (verbose) {
          console.error(error instanceof Error ? error.message : String(error))
        }
        continue
      }

      agents[processedAgentDefinition.id] = processedAgentDefinition
    } catch (error) {
      if (verbose) {
        console.error(
          `Error loading agent from file ${fullPath}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  if (validate) {
    const validationErrors: AgentValidationError[] = []

    if (Object.keys(agents).length > 0) {
      const result = await validateAgents(Object.values(agents))

      if (!result.success) {
        const errorsByAgentId = new Map<string, string>()
        for (const err of result.validationErrors) {
          const lastUnderscoreIdx = err.id.lastIndexOf('_')
          const agentId =
            lastUnderscoreIdx > 0 ? err.id.slice(0, lastUnderscoreIdx) : err.id
          if (!errorsByAgentId.has(agentId)) {
            errorsByAgentId.set(agentId, err.message)
          }
        }

        for (const agentId of Object.keys(agents)) {
          const errorMessage = errorsByAgentId.get(agentId)
          if (errorMessage) {
            const agent = agents[agentId]
            validationErrors.push({
              agentId,
              filePath: agent._sourceFilePath,
              message: errorMessage,
            })
            if (verbose) {
              console.error(
                `Validation failed for agent '${agentId}': ${errorMessage}`,
              )
            }
            delete agents[agentId]
          }
        }
      }
    }

    return { agents, validationErrors }
  }

  return agents
}

async function importAgentModule(fullPath: string): Promise<any | null> {
  const urlVersion = `?update=${Date.now()}`
  return import(`${pathToFileURL(fullPath).href}${urlVersion}`)
}
