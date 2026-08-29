import { getErrorObject } from '@rivocode/common/util/error'
import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import { MCP_TOOL_SEPARATOR } from './mcp-constants'

import type { AgentTemplate } from './templates/types'
import type { RequestMcpToolDataFn } from '@rivocode/common/types/contracts/client'
import type { Logger } from '@rivocode/common/types/contracts/logger'
import type { OptionalFields } from '@rivocode/common/types/function-params'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@rivocode/common/util/file'

export async function getMCPToolData(
  params: OptionalFields<
    {
      toolNames: AgentTemplate['toolNames']
      mcpServers: AgentTemplate['mcpServers']
      writeTo: ProjectFileContext['customToolDefinitions']
      requestMcpToolData: RequestMcpToolDataFn
      logger?: Logger
    },
    'writeTo'
  >,
): Promise<CustomToolDefinitions> {
  const withDefaults = { writeTo: {}, ...params }
  const { toolNames, mcpServers, writeTo, requestMcpToolData, logger } =
    withDefaults

  const USER_INPUT_SEPARATOR = '/'
  const requestedToolsByMcp: Record<string, string[] | undefined> = {}
  for (const t of toolNames) {
    if (!t.includes(USER_INPUT_SEPARATOR)) {
      continue
    }
    const [mcpName, ...remaining] = t.split(USER_INPUT_SEPARATOR)
    const toolName = remaining.join(USER_INPUT_SEPARATOR)
    if (!requestedToolsByMcp[mcpName]) {
      requestedToolsByMcp[mcpName] = []
    }
    requestedToolsByMcp[mcpName].push(toolName)
  }

  const promises: Promise<any>[] = []
  for (const [mcpName, mcpConfig] of Object.entries(mcpServers)) {
    promises.push(
      (async () => {
        try {
          const mcpData = await requestMcpToolData({
            mcpConfig,
            toolNames: requestedToolsByMcp[mcpName] ?? null,
          })

          for (const { name, description, inputSchema } of mcpData) {
            writeTo[mcpName + MCP_TOOL_SEPARATOR + name] = {
              inputSchema: convertJsonSchemaToZod(inputSchema as any) as any,
              endsAgentStep: true,
              description,
            }
          }
        } catch (error) {
          logger?.warn(
            { error: getErrorObject(error), mcpServer: mcpName },
            `Failed to load tools from MCP server "${mcpName}"; its tools will be unavailable for this step.`,
          )
        }
      })(),
    )
  }
  await Promise.all(promises)

  return writeTo
}
