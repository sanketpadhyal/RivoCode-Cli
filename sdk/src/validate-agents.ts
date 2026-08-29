import {
  validateAgents as validateAgentsCommon,
  type DynamicAgentValidationError,
} from '@codebuff/common/templates/agent-validation'

import { getWebsiteUrl } from './constants'

import type { AgentDefinition } from '@codebuff/common/templates/initial-agents-dir/types/agent-definition'

export interface ValidationResult {
  success: boolean
  validationErrors: Array<{
    id: string
    message: string
  }>
  errorCount: number
}

export interface ValidateAgentsOptions {
  remote?: boolean

  websiteUrl?: string
}

export async function validateAgents(
  definitions: AgentDefinition[],
  options?: ValidateAgentsOptions,
): Promise<ValidationResult> {
  const agentTemplates: Record<string, AgentDefinition> = {}
  for (const [index, definition] of definitions.entries()) {
    if (!definition) {
      agentTemplates[`agent_${index}`] = definition
      continue
    }
    const key = definition.id ? `${definition.id}_${index}` : `agent_${index}`
    agentTemplates[key] = definition
  }

  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }

  let validationErrors: DynamicAgentValidationError[] = []

  if (options?.remote) {
    const websiteUrl = options.websiteUrl || getWebsiteUrl()

    try {
      const response = await fetch(`${websiteUrl}/api/agents/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentDefinitions: definitions }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          (errorData as any).error ||
          `HTTP ${response.status}: ${response.statusText}`

        return {
          success: false,
          validationErrors: [
            {
              id: 'network_error',
              message: `Failed to validate via API: ${errorMessage}`,
            },
          ],
          errorCount: 1,
        }
      }

      const data = await response.json()
      validationErrors = data.validationErrors || []
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        success: false,
        validationErrors: [
          {
            id: 'network_error',
            message: `Failed to connect to validation API: ${errorMessage}`,
          },
        ],
        errorCount: 1,
      }
    }
  } else {
    const result = validateAgentsCommon({
      agentTemplates,
      logger,
    })

    validationErrors = result.validationErrors
  }

  const transformedErrors = validationErrors.map((error) => ({
    id: error.filePath ?? 'unknown',
    message: error.message,
  }))

  return {
    success: transformedErrors.length === 0,
    validationErrors: transformedErrors,
    errorCount: transformedErrors.length,
  }
}
