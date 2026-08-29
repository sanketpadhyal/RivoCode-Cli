
export interface AgentDefinition {
  id: string

  version?: string

  publisher?: string

  displayName: string

  model: ModelName

  reasoningOptions?: {
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

  providerOptions?: {
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

  mcpServers?: Record<string, MCPConfig>

  toolNames?: (ToolName | (string & {}))[]

  spawnableAgents?: string[]

  inputSchema?: {
    prompt?: { type: 'string'; description?: string }
    params?: JsonObjectSchema
  }

  outputMode?: 'last_message' | 'all_messages' | 'structured_output'

  outputSchema?: JsonObjectSchema

  spawnerPrompt?: string

  includeMessageHistory?: boolean

  inheritParentSystemPrompt?: boolean

  windowedFileReads?: boolean

  compactContext?:
    | boolean
    | {
        cacheExpiryMs?: number | null
        cacheExpiryMinTokens?: number | null
      }

  systemPrompt?: string

  instructionsPrompt?: string

  stepPrompt?: string

  handleSteps?: (context: AgentStepContext) => Generator<
    ToolCall | 'STEP' | 'STEP_ALL' | StepText | GenerateN,
    void,
    {
      agentState: AgentState
      toolResult: ToolResultOutput[] | undefined
      stepsComplete: boolean
      nResponses?: string[]
    }
  >
}

export interface AgentState {
  agentId: string
  runId: string
  parentId: string | undefined

  messageHistory: Message[]

  output: Record<string, any> | undefined

  systemPrompt: string

  toolDefinitions: Record<
    string,
    { description: string | undefined; inputSchema: {} }
  >

  contextTokenCount: number
}

export interface AgentStepContext {
  agentState: AgentState
  prompt?: string
  params?: Record<string, any>
  model?: string
  logger: Logger
}

export type StepText = { type: 'STEP_TEXT'; text: string }
export type GenerateN = { type: 'GENERATE_N'; n: number }

export type ToolCall<T extends ToolName = ToolName> = {
  [K in T]: {
    toolName: K
    input: GetToolParams<K>
    includeToolCall?: boolean
  }
}[T]

export type FileEditingTools = 'read_files' | 'write_file' | 'str_replace'

export type CodeAnalysisTools = 'code_search' | 'find_files' | 'read_files'

export type TerminalTools = 'run_terminal_command' | 'code_search'

export type WebTools = 'web_search' | 'read_docs' | 'read_url'

export type AgentTools = 'spawn_agents'

export type OutputTools = 'set_output'

export type ModelName =

  | 'openai/gpt-5.3'
  | 'openai/gpt-5.3-codex'
  | 'openai/gpt-5.2'
  | 'openai/gpt-5.1'
  | 'openai/gpt-5.1-chat'
  | 'openai/gpt-5-mini'
  | 'openai/gpt-5-nano'

  | 'anthropic/claude-fable-5'
  | 'anthropic/claude-opus-5'
  | 'anthropic/claude-sonnet-4.6'
  | 'anthropic/claude-opus-4.8'
  | 'anthropic/claude-opus-4.7'
  | 'anthropic/claude-opus-4.6'
  | 'anthropic/claude-opus-4.5'
  | 'anthropic/claude-haiku-4.5'
  | 'anthropic/claude-sonnet-4.5'
  | 'anthropic/claude-opus-4.1'

  | 'google/gemini-3.1-pro-preview'
  | 'google/gemini-3-pro-preview'
  | 'google/gemini-3-flash-preview'
  | 'google/gemini-3.5-flash-lite'
  | 'google/gemini-3.1-flash-lite'
  | 'google/gemini-2.5-pro'
  | 'google/gemini-2.5-flash'
  | 'google/gemini-2.5-flash-lite'

  | 'qwen/qwen3-max'
  | 'qwen/qwen3-coder-plus'
  | 'qwen/qwen3-coder'
  | 'qwen/qwen3-coder:nitro'
  | 'qwen/qwen3-coder-flash'
  | 'qwen/qwen3-235b-a22b-2507'
  | 'qwen/qwen3-235b-a22b-2507:nitro'
  | 'qwen/qwen3-235b-a22b-thinking-2507'
  | 'qwen/qwen3-235b-a22b-thinking-2507:nitro'
  | 'qwen/qwen3-30b-a3b'
  | 'qwen/qwen3-30b-a3b:nitro'

  | 'deepseek/deepseek-v4-pro'
  | 'deepseek-v4-pro'
  | 'deepseek/deepseek-v4-flash'
  | 'deepseek-v4-flash'
  | 'deepseek/deepseek-chat-v3-0324'
  | 'deepseek/deepseek-chat-v3-0324:nitro'
  | 'deepseek/deepseek-r1-0528'
  | 'deepseek/deepseek-r1-0528:nitro'

  | 'mimo/mimo-v2.5'
  | 'mimo-v2.5'
  | 'mimo/mimo-v2.5-pro'
  | 'mimo-v2.5-pro'

  | 'moonshotai/kimi-k2'
  | 'moonshotai/kimi-k2:nitro'
  | 'moonshotai/kimi-k2.6'
  | 'moonshotai/kimi-k2.7-code'
  | 'z-ai/glm-5'
  | 'z-ai/glm-5.1'
  | 'z-ai/glm-4.6'
  | 'z-ai/glm-4.6:nitro'
  | 'z-ai/glm-4.7'
  | 'z-ai/glm-4.7:nitro'
  | 'z-ai/glm-4.7-flash'
  | 'z-ai/glm-4.7-flash:nitro'
  | 'minimax/minimax-m2.5'
  | 'minimax/minimax-m3'
  | (string & {})

import type { ToolName, GetToolParams } from './tools'
import type {
  Message,
  ToolResultOutput,
  JsonObjectSchema,
  MCPConfig,
  Logger,
} from './util-types'

export type { ToolName, GetToolParams }
