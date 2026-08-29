import { buildArray } from '@rivocode/common/util/array'
import { schemaToJsonStr } from '@rivocode/common/util/zod-schema'
import { z } from 'zod/v4'

import { getAgentTemplate } from './agent-registry'

import type { AgentTemplate } from '@rivocode/common/types/agent-template'
import type { Logger } from '@rivocode/common/types/contracts/logger'
import type { ParamsExcluding } from '@rivocode/common/types/function-params'
import type { AgentTemplateType } from '@rivocode/common/types/session-state'
import type { ToolSet } from 'ai'

function ensureJsonSchemaCompatible(schema: z.ZodType): z.ZodType {
  try {
    z.toJSONSchema(schema, { io: 'input' })
    return schema
  } catch {
    const fallback = z.object({}).passthrough()
    return schema.description ? fallback.describe(schema.description) : fallback
  }
}

export function getAgentShortName(agentType: AgentTemplateType): string {
  const withoutVersion = agentType.split('@')[0]
  const parts = withoutVersion.split('/')
  return parts[parts.length - 1]
}

export function getAgentToolName(agentType: AgentTemplateType): string {
  return getAgentShortName(agentType).replace(/-/g, '_')
}

export function buildAgentToolInputSchema(
  agentTemplate: AgentTemplate,
): z.ZodType {
  const { inputSchema } = agentTemplate

  let schemaFields: Record<string, z.ZodType> = {}

  if (inputSchema?.prompt) {
    schemaFields.prompt = inputSchema.prompt
  }

  if (inputSchema?.params) {
    schemaFields.params = inputSchema.params
  }

  return z
    .object(schemaFields)
    .describe(
      agentTemplate.spawnerPrompt ||
        `Spawn the ${agentTemplate.displayName} agent`,
    )
}

export async function buildAgentToolSet(
  params: {
    spawnableAgents: AgentTemplateType[]
    agentTemplates: Record<string, AgentTemplate>
    logger: Logger
  } & ParamsExcluding<
    typeof getAgentTemplate,
    'agentId' | 'localAgentTemplates'
  >,
): Promise<ToolSet> {
  const { spawnableAgents, agentTemplates } = params

  const toolSet: ToolSet = {}

  for (const agentType of spawnableAgents) {
    const agentTemplate = await getAgentTemplate({
      ...params,
      agentId: agentType,
      localAgentTemplates: agentTemplates,
    })

    if (!agentTemplate) continue

    const toolName = getAgentToolName(agentType)
    const inputSchema = ensureJsonSchemaCompatible(
      buildAgentToolInputSchema(agentTemplate),
    )

    toolSet[toolName] = {
      description:
        agentTemplate.spawnerPrompt ||
        `Spawn the ${agentTemplate.displayName} agent`,
      inputSchema,
    }
  }

  return toolSet
}

function buildSingleAgentDescription(
  agentType: AgentTemplateType,
  agentTemplate: AgentTemplate | null,
): string {
  if (!agentTemplate) {
    return `- ${agentType}: Dynamic agent (description not available)
prompt: {"description": "A coding task to complete", "type": "string"}
params: None`
  }

  const { inputSchema } = agentTemplate
  const inputSchemaStr = inputSchema
    ? [
        `prompt: ${schemaToJsonStr(inputSchema.prompt)}`,
        `params: ${schemaToJsonStr(inputSchema.params)}`,
      ].join('\n')
    : ['prompt: None', 'params: None'].join('\n')

  return buildArray(
    `- ${agentType}: ${agentTemplate.spawnerPrompt}`,
    agentTemplate.includeMessageHistory &&
      'This agent can see the current message history.',
    agentTemplate.inheritParentSystemPrompt &&
      "This agent inherits the parent's system prompt for prompt caching.",
    inputSchemaStr,
  ).join('\n')
}

export async function buildFullSpawnableAgentsSpec(
  params: {
    spawnableAgents: AgentTemplateType[]
    agentTemplates: Record<string, AgentTemplate>
    logger: Logger
  } & ParamsExcluding<
    typeof getAgentTemplate,
    'agentId' | 'localAgentTemplates'
  >,
): Promise<string> {
  const { spawnableAgents, agentTemplates } = params
  if (spawnableAgents.length === 0) {
    return ''
  }

  const subAgentTypesAndTemplates = await Promise.all(
    spawnableAgents.map(async (agentType) => {
      return [
        agentType,
        await getAgentTemplate({
          ...params,
          agentId: agentType,
          localAgentTemplates: agentTemplates,
        }),
      ] as const
    }),
  )

  const agentsDescription = subAgentTypesAndTemplates
    .map(([agentType, agentTemplate]) =>
      buildSingleAgentDescription(agentType, agentTemplate),
    )
    .filter(Boolean)
    .join('\n\n')

  return `You are a subagent that can only spawn the following agents using the spawn_agents tool:

${agentsDescription}`
}
