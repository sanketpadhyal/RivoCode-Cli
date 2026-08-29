import type { TrackEventFn } from './analytics'
import type { SendActionFn } from './client'
import type {
  OpenRouterProviderRoutingOptions,
  AgentTemplate,
} from '../agent-template'
import type { ParamsExcluding } from '../function-params'
import type { Logger } from './logger'
import type { Model } from '../../old-constants'
import type { Message } from '../messages/codebuff-message'
import type { ProviderMetadata } from '../messages/provider-metadata'
import type { PromptResult } from '../../util/error'
import type { generateText, streamText, ToolCallPart } from 'ai'
import type z from 'zod/v4'

export type StreamRecoverySource = 'stream-interrupted' | 'output-limit'

export type StreamChunk =
  | {
      type: 'text'
      text: string
      agentId?: string
    }
  | {
      type: 'reasoning'
      text: string
      providerOptions?: ProviderMetadata
    }
  | Pick<
      ToolCallPart,
      'type' | 'toolCallId' | 'toolName' | 'input' | 'providerOptions'
    >
  | {
      type: 'error'
      message: string
      source?: StreamRecoverySource
    }

export type CacheDebugUsageData = {
  inputTokens: number
  outputTokens: number
  reasoningOutputTokens?: number
  cachedInputTokens: number
  totalTokens: number
}

export type ModelUsageData = CacheDebugUsageData

export type AgentUsageData = ModelUsageData & {
  isRoot: boolean
  agentId?: string
}

export type ContextCompactionData = {
  trigger: 'context_limit' | 'cache_expiry' | 'context_limit_and_cache_expiry'
  thresholdTokens: number
}

export type PromptAiSdkStreamFn = (
  params: {
    apiKey: string
    runId: string
    messages: Message[]
    clientSessionId: string
    fingerprintId: string
    model: Model
    userId: string | undefined
    chargeUser?: boolean
    thinkingBudget?: number
    userInputId: string
    agentId?: string
    maxRetries?: number
    onCostCalculated?: (credits: number) => Promise<void>
    onCacheDebugProviderRequestBuilt?: (params: {
      provider: string
      rawBody: unknown
      normalizedBody?: unknown
    }) => void
    onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
    onUsageReceived?: (usage: ModelUsageData) => void
    onUsageIncomplete?: () => void
    includeCacheControl?: boolean
    cacheDebugCorrelation?: string
    agentProviderOptions?: OpenRouterProviderRoutingOptions
    spawnableAgents?: string[]
    localAgentTemplates?: Record<string, AgentTemplate>
    costMode?: string
    extraCodebuffMetadata?: Record<string, string>
    sendAction: SendActionFn
    logger: Logger
    trackEvent: TrackEventFn
    signal: AbortSignal
  } & ParamsExcluding<typeof streamText, 'model' | 'messages'>,
) => AsyncGenerator<StreamChunk, PromptResult<string | null>>

export type PromptAiSdkFn = (
  params: {
    apiKey: string
    runId: string
    messages: Message[]
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    model: Model
    userId: string | undefined
    chargeUser?: boolean
    agentId?: string
    onCostCalculated?: (credits: number) => Promise<void>
    onCacheDebugProviderRequestBuilt?: (params: {
      provider: string
      rawBody: unknown
      normalizedBody?: unknown
    }) => void
    onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
    includeCacheControl?: boolean
    cacheDebugCorrelation?: string
    agentProviderOptions?: OpenRouterProviderRoutingOptions
    maxRetries?: number
    costMode?: string
    sendAction: SendActionFn
    logger: Logger
    trackEvent: TrackEventFn
    n?: number
    signal: AbortSignal
  } & ParamsExcluding<typeof generateText, 'model' | 'messages'>,
) => Promise<PromptResult<string>>

export type PromptAiSdkStructuredInput<T> = {
  apiKey: string
  runId: string
  messages: Message[]
  schema: z.ZodType<T>
  clientSessionId: string
  fingerprintId: string
  userInputId: string
  model: Model
  userId: string | undefined
  maxTokens?: number
  temperature?: number
  timeout?: number
  chargeUser?: boolean
  agentId?: string
  onCostCalculated?: (credits: number) => Promise<void>
  onCacheDebugProviderRequestBuilt?: (params: {
    provider: string
    rawBody: unknown
    normalizedBody?: unknown
  }) => void
  onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
  includeCacheControl?: boolean
  cacheDebugCorrelation?: string
  agentProviderOptions?: OpenRouterProviderRoutingOptions
  maxRetries?: number
  sendAction: SendActionFn
  logger: Logger
  trackEvent: TrackEventFn
  signal: AbortSignal
}
export type PromptAiSdkStructuredOutput<T> = Promise<PromptResult<T>>
export type PromptAiSdkStructuredFn = <T>(
  params: PromptAiSdkStructuredInput<T>,
) => PromptAiSdkStructuredOutput<T>

export type HandleOpenRouterStreamFn = (params: {
  body: any
  userId: string
  agentId: string
}) => Promise<ReadableStream>
