import { jsonToolResult } from '@codebuff/common/util/messages'

import { getAgentTemplate } from '../../../templates/agent-registry'
import { formatValueForError } from '../../../util/format-value'

import type { CodebuffToolHandlerFunction } from '../handler-function-type'
import type {
  CodebuffToolCall,
  CodebuffToolOutput,
} from '@codebuff/common/tools/list'
import type {
  AgentTemplate,
  Logger,
} from '@codebuff/common/types/agent-template'
import type { FetchAgentFromDatabaseFn } from '@codebuff/common/types/contracts/database'
import type { AgentState } from '@codebuff/common/types/session-state'

type ToolName = 'set_output'
export const handleSetOutput = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: CodebuffToolCall<ToolName>

  agentState: AgentState
  apiKey: string
  databaseAgentCache: Map<string, AgentTemplate | null>
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  fetchAgentFromDatabase: FetchAgentFromDatabaseFn
}): Promise<{ output: CodebuffToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, agentState, logger } = params
  const output = toolCall.input
  const { data } = output ?? {}

  await previousToolCallFinished

  let agentTemplate = null
  if (agentState.agentType) {
    agentTemplate = await getAgentTemplate({
      ...params,
      agentId: agentState.agentType,
    })
  }

  let finalOutput: unknown
  if (agentTemplate?.outputSchema) {
    try {
      agentTemplate.outputSchema.parse(output)
      finalOutput = output
    } catch (error) {
      try {
        agentTemplate.outputSchema.parse(data)
        finalOutput = data
      } catch (error2) {
        const issues1 = getZodIssueCount(error)
        const issues2 = getZodIssueCount(error2)
        const usedData = issues2 < issues1
        const bestError = usedData ? error2 : error
        const prefix = usedData
          ? 'Output validation error: Your output was found inside the `data` field but still failed validation. Please fix the issues and try again without wrapping in `data`. Issues: '
          : 'Output validation error: Output failed to match the output schema and was ignored. You might want to try again! Issues: '
        const errorMessage = `${prefix}${bestError}\n\nOriginal output value:\n${formatValueForError(output)}`
        logger.error(
          {
            output,
            agentType: agentState.agentType,
            agentId: agentState.agentId,
            topLevelError: error,
            dataFieldError: error2,
            usedDataFieldError: usedData,
          },
          'set_output validation error',
        )
        return { output: jsonToolResult({ message: errorMessage }) }
      }
    }
  } else {
    const keys = Object.keys(output)
    const hasOnlyDataField = keys.length === 1 && keys[0] === 'data'
    finalOutput = hasOnlyDataField ? data : output
  }

  agentState.output = finalOutput as Record<string, unknown>

  return { output: jsonToolResult({ message: 'Output set' }) }
}) satisfies CodebuffToolHandlerFunction<ToolName>

function getZodIssueCount(error: unknown): number {
  if (
    error != null &&
    typeof error === 'object' &&
    'issues' in error &&
    Array.isArray((error as { issues: unknown }).issues)
  ) {
    return (error as { issues: unknown[] }).issues.length
  }
  return Infinity
}
