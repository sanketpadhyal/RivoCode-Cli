import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'

import { mcpConfigSchema } from '@rivocode/common/types/mcp'
import { z } from 'zod/v4'

import type { MCPConfig } from '@rivocode/common/types/mcp'

export const mcpFileSchema = z.object({
  mcpServers: z.record(z.string(), mcpConfigSchema).default(() => ({})),
})

export type MCPFileConfig = z.infer<typeof mcpFileSchema>

export type LoadedMCPConfig = {
  mcpServers: Record<string, MCPConfig>
  _sourceFilePath: string
}

const envKey = 'env'
const processEnv = process[envKey] as NodeJS.ProcessEnv

function resolveMcpEnv(
  env: Record<string, string> | undefined,
  mcpServerName: string,
): Record<string, string> {
  if (!env) return {}

  const resolved: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (value.startsWith('$')) {
      const envVarName = value.slice(1)
      const envValue = processEnv[envVarName]

      if (envValue === undefined) {
        throw new Error(
          `Missing environment variable '${envVarName}' required by MCP server '${mcpServerName}' in mcp.json`,
        )
      }

      resolved[key] = envValue
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

function resolveMcpConfigEnv(config: MCPFileConfig): void {
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    if ('command' in serverConfig && serverConfig.env) {
      serverConfig.env = resolveMcpEnv(serverConfig.env, serverName)
    }
  }
}

const MCP_CONFIG_FILE_NAME = 'mcp.json'

const getDefaultMcpConfigDirs = (): string[] => {
  const cwdAgents = path.join(process.cwd(), '.agents')
  const parentAgents = path.join(process.cwd(), '..', '.agents')
  const homeAgents = path.join(os.homedir(), '.agents')
  return [cwdAgents, parentAgents, homeAgents]
}

export async function loadMCPConfig(options: {
  verbose?: boolean
}): Promise<LoadedMCPConfig> {
  const { verbose = false } = options

  const mergedConfig: LoadedMCPConfig = {
    mcpServers: {},
    _sourceFilePath: '',
  }

  const mcpConfigDirs = getDefaultMcpConfigDirs()

  for (const dir of mcpConfigDirs) {
    const configPath = path.join(dir, MCP_CONFIG_FILE_NAME)

    try {
      try {
        await fsPromises.access(configPath)
      } catch {
        continue
      }

      const content = await fsPromises.readFile(configPath, 'utf8')
      const rawConfig = JSON.parse(content)
      const parseResult = mcpFileSchema.safeParse(rawConfig)

      if (!parseResult.success) {
        if (verbose) {
          console.error(
            `Invalid mcp.json at ${configPath}: ${parseResult.error.message}`,
          )
        }
        continue
      }

      const parsedConfig = parseResult.data

      try {
        resolveMcpConfigEnv(parsedConfig)
      } catch (error) {
        if (verbose) {
          console.error(error instanceof Error ? error.message : String(error))
        }
        continue
      }

      for (const [serverName, serverConfig] of Object.entries(
        parsedConfig.mcpServers,
      )) {
        mergedConfig.mcpServers[serverName] = serverConfig
      }

      if (Object.keys(parsedConfig.mcpServers).length > 0) {
        mergedConfig._sourceFilePath = configPath
      }
    } catch (error) {
      if (verbose) {
        console.error(
          `Error loading mcp.json from ${configPath}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  return mergedConfig
}

export function loadMCPConfigSync(options: {
  verbose?: boolean
}): LoadedMCPConfig {
  const { verbose = false } = options

  const mergedConfig: LoadedMCPConfig = {
    mcpServers: {},
    _sourceFilePath: '',
  }

  const mcpConfigDirs = getDefaultMcpConfigDirs()

  for (const dir of mcpConfigDirs) {
    const configPath = path.join(dir, MCP_CONFIG_FILE_NAME)

    try {
      if (!fs.existsSync(configPath)) {
        continue
      }

      const content = fs.readFileSync(configPath, 'utf8')
      const rawConfig = JSON.parse(content)
      const parseResult = mcpFileSchema.safeParse(rawConfig)

      if (!parseResult.success) {
        if (verbose) {
          console.error(
            `Invalid mcp.json at ${configPath}: ${parseResult.error.message}`,
          )
        }
        continue
      }

      const parsedConfig = parseResult.data

      try {
        resolveMcpConfigEnv(parsedConfig)
      } catch (error) {
        if (verbose) {
          console.error(error instanceof Error ? error.message : String(error))
        }
        continue
      }

      for (const [serverName, serverConfig] of Object.entries(
        parsedConfig.mcpServers,
      )) {
        mergedConfig.mcpServers[serverName] = serverConfig
      }

      if (Object.keys(parsedConfig.mcpServers).length > 0) {
        mergedConfig._sourceFilePath = configPath
      }
    } catch (error) {
      if (verbose) {
        console.error(
          `Error loading mcp.json from ${configPath}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  return mergedConfig
}
