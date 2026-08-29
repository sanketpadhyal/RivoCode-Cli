import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import {
  DynamicAgentDefinitionSchema,
  DynamicAgentTemplateSchema,
} from '../types/dynamic-agent-template'

import type { AgentTemplate } from '../types/agent-template'
import type { DynamicAgentTemplate } from '../types/dynamic-agent-template'
import type { Logger } from '@codebuff/common/types/contracts/logger'

export interface DynamicAgentValidationError {
  filePath: string
  message: string
}

export function collectAgentIds(params: {
  agentTemplates?: Record<string, DynamicAgentTemplate>
  logger: Logger
}): { agentIds: string[]; spawnableAgentIds: string[] } {
  const { agentTemplates = {}, logger } = params

  const agentIds: string[] = []
  const spawnableAgentIds: string[] = []
  const jsonFiles = Object.keys(agentTemplates)

  for (const filePath of jsonFiles) {
    try {
      const content = agentTemplates[filePath]
      if (!content) {
        continue
      }

      if (content.id && typeof content.id === 'string') {
        agentIds.push(content.id)
      }
      if (Array.isArray(content.spawnableAgents)) {
        spawnableAgentIds.push(...content.spawnableAgents)
      }
    } catch (error) {
      logger.debug(
        { filePath, error },
        'Failed to extract agent ID during collection phase',
      )
    }
  }

  return { agentIds, spawnableAgentIds }
}

export function validateAgents(params: {
  agentTemplates?: Record<string, any>
  logger: Logger
}): {
  templates: Record<string, AgentTemplate>
  dynamicTemplates: Record<string, DynamicAgentTemplate>
  validationErrors: DynamicAgentValidationError[]
} {
  const { agentTemplates = {}, logger } = params

  const templates: Record<string, AgentTemplate> = {}
  const dynamicTemplates: Record<string, DynamicAgentTemplate> = {}
  const validationErrors: DynamicAgentValidationError[] = []

  const hasAgentTemplates = Object.keys(agentTemplates).length > 0

  if (!hasAgentTemplates) {
    return {
      templates,
      dynamicTemplates,
      validationErrors,
    }
  }

  const agentKeys = Object.keys(agentTemplates)

  for (const agentKey of agentKeys) {
    const content = agentTemplates[agentKey]
    try {
      if (!content) {
        continue
      }

      const validationResult = validateSingleAgent({
        template: content,
        filePath: agentKey,
      })

      if (!validationResult.success) {
        validationErrors.push({
          filePath: agentKey,
          message: validationResult.error!,
        })
        continue
      }

      if (templates[validationResult.agentTemplate!.id]) {
        const agentContext = validationResult.agentTemplate!.displayName
          ? `Agent "${validationResult.agentTemplate!.id}" (${validationResult.agentTemplate!.displayName})`
          : `Agent "${validationResult.agentTemplate!.id}"`

        validationErrors.push({
          filePath: agentKey,
          message: `${agentContext}: Duplicate agent ID`,
        })
        continue
      }
      templates[validationResult.agentTemplate!.id] =
        validationResult.agentTemplate!
      dynamicTemplates[validationResult.dynamicAgentTemplate!.id] =
        validationResult.dynamicAgentTemplate!
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      const agentContext = content?.id
        ? `Agent "${content.id}"${content.displayName ? ` (${content.displayName})` : ''}`
        : `Agent in ${agentKey}`

      validationErrors.push({
        filePath: agentKey,
        message: `${agentContext}: ${errorMessage}`,
      })

      logger.warn(
        { filePath: agentKey, error: errorMessage },
        'Failed to load dynamic agent template',
      )
    }
  }

  return {
    templates,
    dynamicTemplates,
    validationErrors,
  }
}

export function validateSingleAgent(params: {
  template: any
  filePath?: string
}): {
  success: boolean
  agentTemplate?: AgentTemplate
  dynamicAgentTemplate?: DynamicAgentTemplate
  error?: string
} {
  const { template, filePath = 'unknown' } = params

  try {
    let validatedConfig: DynamicAgentTemplate
    try {
      const typedAgentDefinition = DynamicAgentDefinitionSchema.parse(template)

      let handleStepsString: string | undefined
      if (template.handleSteps) {
        handleStepsString = template.handleSteps.toString()
      }
      const handleStepsFn =
        typeof template.handleSteps === 'function'
          ? template.handleSteps
          : template.handleStepsFn

      validatedConfig = DynamicAgentTemplateSchema.parse({
        ...typedAgentDefinition,
        systemPrompt: typedAgentDefinition.systemPrompt || '',
        instructionsPrompt: typedAgentDefinition.instructionsPrompt || '',
        stepPrompt: typedAgentDefinition.stepPrompt || '',
        handleSteps: handleStepsString,
        handleStepsFn,
      })
    } catch (error: any) {
      const agentContext = template.id
        ? `Agent "${template.id}"${template.displayName ? ` (${template.displayName})` : ''}`
        : filePath
          ? `Agent in ${filePath}`
          : 'Agent'

      return {
        success: false,
        error: `${agentContext}: Schema validation failed: ${error.message}`,
      }
    }

    let inputSchema: AgentTemplate['inputSchema']
    try {
      inputSchema = convertInputSchema(
        validatedConfig.inputSchema?.prompt,
        validatedConfig.inputSchema?.params,
        filePath,
      )
    } catch (error) {
      const agentContext = validatedConfig.id
        ? `Agent "${validatedConfig.id}"${validatedConfig.displayName ? ` (${validatedConfig.displayName})` : ''}`
        : filePath
          ? `Agent in ${filePath}`
          : 'Agent'
      return {
        success: false,
        error: `${agentContext}: ${
          error instanceof Error ? error.message : 'Schema conversion failed'
        }`,
      }
    }

    let outputSchema: AgentTemplate['outputSchema']
    if (validatedConfig.outputSchema) {
      try {
        outputSchema = convertJsonSchemaToZod(validatedConfig.outputSchema)
      } catch (error) {
        const agentContext = validatedConfig.id
          ? `Agent "${validatedConfig.id}"${validatedConfig.displayName ? ` (${validatedConfig.displayName})` : ''}`
          : filePath
            ? `Agent in ${filePath}`
            : 'Agent'

        return {
          success: false,
          error: `${agentContext}: Failed to convert outputSchema to Zod: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }
      }
    }

    if (validatedConfig.handleSteps) {
      if (!isValidGeneratorFunction(validatedConfig.handleSteps)) {
        const agentContext = validatedConfig.id
          ? `Agent "${validatedConfig.id}"${validatedConfig.displayName ? ` (${validatedConfig.displayName})` : ''}`
          : filePath
            ? `Agent in ${filePath}`
            : 'Agent'

        return {
          success: false,
          error: `${agentContext}: handleSteps must be a generator function: "function* (params) { ... }". Found: ${validatedConfig.handleSteps.substring(0, 50)}...`,
        }
      }
    }

    const agentTemplate: AgentTemplate = {
      ...validatedConfig,
      systemPrompt: validatedConfig.systemPrompt ?? '',
      instructionsPrompt: validatedConfig.instructionsPrompt ?? '',
      stepPrompt: validatedConfig.stepPrompt ?? '',
      outputSchema,
      inputSchema,
    }

    return {
      success: true,
      agentTemplate,
      dynamicAgentTemplate: validatedConfig,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    const agentContext = template?.id
      ? `Agent "${template.id}"${template.displayName ? ` (${template.displayName})` : ''}`
      : filePath
        ? `Agent in ${filePath}`
        : 'Agent'

    return {
      success: false,
      error: `${agentContext}: Error validating agent template: ${errorMessage}`,
    }
  }
}

function isValidGeneratorFunction(code: string): boolean {
  const trimmed = code.trim()
  return trimmed.startsWith('function*')
}

function convertInputSchema(
  inputPromptSchema?: Record<string, any>,
  paramsSchema?: Record<string, any>,
  filePath?: string,
): AgentTemplate['inputSchema'] {
  const result: any = {}
  const fileContext = filePath ? ` in ${filePath}` : ''

  if (inputPromptSchema) {
    try {
      if (
        typeof inputPromptSchema !== 'object' ||
        Object.keys(inputPromptSchema).length === 0
      ) {
        throw new Error(
          `Invalid inputSchema.prompt${fileContext}: Schema must be a valid non-empty JSON schema object. Found: ${typeof inputPromptSchema}`,
        )
      }
      const promptZodSchema = convertJsonSchemaToZod(inputPromptSchema)
      const testResult = promptZodSchema.safeParse('test')
      const testUndefined = promptZodSchema.safeParse(undefined)

      if (!testResult.success && !testUndefined.success) {
        const errorDetails =
          testResult.error?.issues?.[0]?.message || 'validation failed'
        throw new Error(
          `Invalid inputSchema.prompt${fileContext}: Schema must allow string or undefined values. ` +
            `Current schema validation error: ${errorDetails}. ` +
            `Please ensure your JSON schema accepts string types.`,
        )
      }

      result.prompt = promptZodSchema
    } catch (error) {
      if (error instanceof Error && error.message.includes('inputSchema')) {
        throw error
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to convert inputSchema.prompt to Zod${fileContext}: ${errorMessage}. ` +
          `Please check that your inputSchema.prompt is a valid non-empty JSON schema object.`,
      )
    }
  }

  if (paramsSchema) {
    try {
      if (
        typeof paramsSchema !== 'object' ||
        Object.keys(paramsSchema).length === 0
      ) {
        throw new Error(
          `Invalid inputSchema.params${fileContext}: Schema must be a valid non-empty JSON schema object. Found: ${typeof paramsSchema}`,
        )
      }
      const paramsZodSchema = convertJsonSchemaToZod(paramsSchema)
      result.params = paramsZodSchema
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to convert inputSchema.params to Zod${fileContext}: ${errorMessage}. ` +
          `Please check that your inputSchema.params is a valid non-empty JSON schema object.`,
      )
    }
  }
  return result
}
