
import { z } from 'zod/v4'

import type { MCPConfig } from './mcp'
import type { Model } from '../old-constants'
import type { ToolResultOutput } from './messages/content-part'
import type { AgentState, AgentTemplateType } from './session-state'
import type {
  ToolCall,
  AgentState as PublicAgentState,
} from '../templates/initial-agents-dir/types/agent-definition'
import type { Logger } from '../templates/initial-agents-dir/types/util-types'
import type { ToolName } from '../tools/constants'

export type AgentId = `${string}/${string}@${number}.${number}.${number}`

export type OpenRouterReasoningOptions = {
  enabled?: boolean
  exclude?: boolean
} & (
  | {
      max_tokens: number
    }
  | {
      effort: 'high' | 'medium' | 'low' | 'minimal' | 'none'
    }
)

export type OpenRouterProviderRoutingOptions = {
  order?: string[]
  allow_fallbacks?: boolean
  require_parameters?: boolean
  data_collection?: 'allow' | 'deny'
  only?: string[]
  ignore?: string[]
  quantizations?: Array<
    | 'int4'
    | 'int8'
    | 'fp4'
    | 'fp6'
    | 'fp8'
    | 'fp16'
    | 'bf16'
    | 'fp32'
    | 'unknown'
  >
  sort?: 'price' | 'throughput' | 'latency'
  max_price?: {
    prompt?: number | string
    completion?: number | string
    image?: number | string
    audio?: number | string
    request?: number | string
  }
}

export type OpenRouterProviderOptions = {
  models?: string[]
  reasoning?: OpenRouterReasoningOptions
  user?: string
}

export type AgentTemplate<
  P = string | undefined,
  T = Record<string, any> | undefined,
> = {
  id: AgentTemplateType
  displayName: string
  model: Model
  reasoningOptions?: OpenRouterReasoningOptions
  providerOptions?: OpenRouterProviderRoutingOptions

  mcpServers: Record<string, MCPConfig>
  toolNames: (ToolName | (string & {}))[]
  spawnableAgents: AgentTemplateType[]

  spawnerPrompt?: string
  systemPrompt: string
  instructionsPrompt: string
  stepPrompt: string
  parentInstructions?: Record<string, string>

  inputSchema: {
    prompt?: z.ZodSchema<P>
    params?: z.ZodSchema<T>
  }
  includeMessageHistory: boolean
  inheritParentSystemPrompt: boolean
  windowedFileReads?: boolean
  compactContext?:
    | boolean
    | { cacheExpiryMs?: number | null; cacheExpiryMinTokens?: number | null }
  outputMode: 'last_message' | 'all_messages' | 'structured_output'
  outputSchema?: z.ZodSchema<any>

  handleSteps?: StepHandler<P, T> | string
  handleStepsFn?: StepHandler<P, T>
}

export type StepText = { type: 'STEP_TEXT'; text: string }
export type GenerateN = { type: 'GENERATE_N'; n: number }

export const StepTextSchema = z.object({
  type: z.literal('STEP_TEXT'),
  text: z.string(),
})

export const GenerateNSchema = z.object({
  type: z.literal('GENERATE_N'),
  n: z.number().int().positive(),
})

export const HandleStepsToolCallSchema = z.object({
  toolName: z.string().min(1),
  input: z.record(z.string(), z.any()),
  includeToolCall: z.boolean().optional(),
})

export const HandleStepsYieldValueSchema = z.union([
  z.literal('STEP'),
  z.literal('STEP_ALL'),
  StepTextSchema,
  GenerateNSchema,
  HandleStepsToolCallSchema,
])

export type HandleStepsYieldValue = z.infer<typeof HandleStepsYieldValueSchema>

export type StepGenerator = Generator<
  Omit<ToolCall, 'toolCallId'> | 'STEP' | 'STEP_ALL' | StepText | GenerateN,
  void,
  {
    agentState: PublicAgentState
    toolResult: ToolResultOutput[]
    stepsComplete: boolean
    nResponses?: string[]
  }
>

export type StepHandler<
  P = string | undefined,
  T = Record<string, any> | undefined,
> = (context: {
  agentState: AgentState
  prompt: P
  params: T
  model?: string
  logger: Logger
}) => StepGenerator

export { Logger, PublicAgentState }
