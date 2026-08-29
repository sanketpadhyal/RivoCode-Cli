import { models, PROFIT_MARGIN } from '@codebuff/common/old-constants'
import { buildArray } from '@codebuff/common/util/array'
import { STREAM_RECOVERY_EVENT } from '@codebuff/common/util/axiom-only-log'
import { normalizeProviderRequestBodyForCacheDebug } from '@codebuff/common/util/cache-debug'
import {
  getErrorObject,
  promptAborted,
  promptSuccess,
} from '@codebuff/common/util/error'
import { convertCbToModelMessages } from '@codebuff/common/util/messages'
import { isExplicitlyDefinedModel } from '@codebuff/common/util/model-utils'
import { StopSequenceHandler } from '@codebuff/common/util/stop-sequence'
import {
  streamText,
  generateText,
  Output,
  NoSuchToolError,
  APICallError,
  ToolCallRepairError,
  InvalidToolInputError,
  TypeValidationError,
} from 'ai'

import { getModelForRequest } from './model-provider'
import {
  classifyStreamEndRecovery,
  classifyThrownStreamRecovery,
  streamFinishInfoOf,
  type StreamEndRecovery,
  type StreamFinishInfo,
} from './stream-interruption'

import type {
  OpenRouterProviderOptions,
  OpenRouterProviderRoutingOptions,
} from '@codebuff/common/types/agent-template'
import type {
  PromptAiSdkFn,
  PromptAiSdkStreamFn,
  PromptAiSdkStructuredInput,
  PromptAiSdkStructuredOutput,
} from '@codebuff/common/types/contracts/llm'
import type { ParamsOf } from '@codebuff/common/types/function-params'
import type { ProviderMetadata } from '@codebuff/common/types/messages/provider-metadata'
import type { LanguageModel } from 'ai'

const providerOrder = {
  [models.openrouter_claude_sonnet_4]: [
    'Google',
    'Anthropic',
    'Amazon Bedrock',
  ],
  [models.openrouter_claude_sonnet_4_5]: [
    'Google',
    'Anthropic',
    'Amazon Bedrock',
  ],
  [models.openrouter_claude_opus_4]: ['Google', 'Anthropic'],
}

function calculateUsedCredits(params: { costDollars: number }): number {
  const { costDollars } = params

  return Math.round(costDollars * (1 + PROFIT_MARGIN) * 100)
}

export function getProviderOptions(params: {
  model: string
  runId: string
  clientSessionId: string
  providerOptions?: ProviderMetadata
  agentProviderOptions?: OpenRouterProviderRoutingOptions
  n?: number
  costMode?: string
  cacheDebugCorrelation?: string
  extraCodebuffMetadata?: Record<string, string>
}): ProviderMetadata {
  const {
    model,
    runId,
    clientSessionId,
    providerOptions,
    agentProviderOptions,
    n,
    costMode,
    cacheDebugCorrelation,
    extraCodebuffMetadata,
  } = params

  let providerConfig: Record<string, any>

  if (agentProviderOptions) {
    providerConfig = agentProviderOptions
  } else {
    const isExplicitlyDefined = isExplicitlyDefinedModel(model)

    providerConfig = {
      order: providerOrder[model as keyof typeof providerOrder],
      allow_fallbacks: !isExplicitlyDefined,
    }
  }

  return {
    ...providerOptions,
    codebuff: {
      ...providerOptions?.codebuff,
      codebuff_metadata: {
        ...(extraCodebuffMetadata ?? {}),
        run_id: runId,
        client_id: clientSessionId,
        ...(n && { n }),
        ...(costMode && { cost_mode: costMode }),
        ...(cacheDebugCorrelation && {
          cache_debug_correlation: cacheDebugCorrelation,
        }),
      },
      provider: providerConfig,
    },
  }
}

type OpenRouterUsageAccounting = {
  cost: number | null
  costDetails: {
    upstreamInferenceCost: number | null
  }
}

function getModelProvider(model: LanguageModel): string {
  if (typeof model === 'string') return model
  return model.provider
}

function emitCacheDebugProviderRequest(params: {
  callback?: (params: {
    provider: string
    rawBody: unknown
    normalizedBody?: unknown
  }) => void
  provider: string
  rawBody: unknown
}) {
  if (!params.callback) return

  const normalized = normalizeProviderRequestBodyForCacheDebug({
    provider: params.provider,
    body: params.rawBody,
  })

  params.callback({
    provider: params.provider,
    rawBody: params.rawBody,
    normalizedBody: normalized,
  })
}

function emitCacheDebugUsage(params: {
  callback?: (usage: {
    inputTokens: number
    outputTokens: number
    reasoningOutputTokens?: number
    cachedInputTokens: number
    totalTokens: number
  }) => void
  usage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    inputTokenDetails?: {
      cacheReadTokens?: number
    }
    outputTokenDetails?: {
      reasoningTokens?: number
    }
  }
}) {
  if (!params.callback) return

  params.callback({
    inputTokens: params.usage.inputTokens ?? 0,
    outputTokens: params.usage.outputTokens ?? 0,
    ...(params.usage.outputTokenDetails?.reasoningTokens !== undefined
      ? {
          reasoningOutputTokens:
            params.usage.outputTokenDetails.reasoningTokens,
        }
      : {}),
    cachedInputTokens: params.usage.inputTokenDetails?.cacheReadTokens ?? 0,
    totalTokens: params.usage.totalTokens ?? 0,
  })
}

export async function* promptAiSdkStream(
  params: ParamsOf<PromptAiSdkStreamFn>,
): ReturnType<PromptAiSdkStreamFn> {
  const { providerOptions: originalProviderOptions, ...streamParams } = params

  const { logger } = params
  const agentChunkMetadata =
    params.agentId != null ? { agentId: params.agentId } : undefined

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping stream due to canceled user input',
    )
    return promptAborted('User cancelled input')
  }

  const aiSDKModel = getModelForRequest({
    apiKey: params.apiKey,
    model: params.model,
    userId: params.userId,
  })

  const response = streamText({
    ...streamParams,
    abortSignal: params.signal,
    prompt: undefined,
    model: aiSDKModel,
    messages: convertCbToModelMessages(params),
    allowSystemInMessages: true,
    include: {
      ...streamParams.include,
      requestBody: true,
    },
    providerOptions: getProviderOptions({
      ...params,
      providerOptions: originalProviderOptions,
      agentProviderOptions: params.agentProviderOptions,
    }),
    experimental_repairToolCall: async ({ toolCall, tools, error }) => {
      const { spawnableAgents = [], localAgentTemplates = {} } = params
      const toolName = toolCall.toolName

      if (NoSuchToolError.isInstance(error) && 'spawn_agents' in tools) {
        const toolNameWithHyphens = toolName.replace(/_/g, '-')

        const matchingAgentId = spawnableAgents.find((agentId) => {
          const withoutVersion = agentId.split('@')[0]
          const parts = withoutVersion.split('/')
          const agentName = parts[parts.length - 1]
          return (
            agentName === toolName ||
            agentName === toolNameWithHyphens ||
            agentId === toolName
          )
        })
        const isSpawnableAgent = matchingAgentId !== undefined
        const isLocalAgent =
          toolName in localAgentTemplates ||
          toolNameWithHyphens in localAgentTemplates

        if (isSpawnableAgent || isLocalAgent) {
          const deepParseJson = (value: unknown): unknown => {
            if (typeof value === 'string') {
              try {
                return deepParseJson(JSON.parse(value))
              } catch {
                return value
              }
            }
            if (Array.isArray(value)) return value.map(deepParseJson)
            if (value !== null && typeof value === 'object') {
              return Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, deepParseJson(v)]),
              )
            }
            return value
          }

          let input: Record<string, unknown> = {}
          try {
            const rawInput =
              typeof toolCall.input === 'string'
                ? JSON.parse(toolCall.input)
                : (toolCall.input as Record<string, unknown>)
            input = deepParseJson(rawInput) as Record<string, unknown>
          } catch {
          }

          const prompt =
            typeof input.prompt === 'string' ? input.prompt : undefined
          const agentParams = Object.fromEntries(
            Object.entries(input).filter(
              ([key, value]) =>
                !(key === 'prompt' && typeof value === 'string'),
            ),
          )

          const correctedAgentType =
            matchingAgentId ??
            (toolNameWithHyphens in localAgentTemplates
              ? toolNameWithHyphens
              : toolName)

          const spawnAgentsInput = {
            agents: [
              {
                agent_type: correctedAgentType,
                ...(prompt !== undefined && { prompt }),
                ...(Object.keys(agentParams).length > 0 && {
                  params: agentParams,
                }),
              },
            ],
          }

          logger.info(
            { originalToolName: toolName, transformedInput: spawnAgentsInput },
            'Transformed agent tool call to spawn_agents',
          )

          return {
            ...toolCall,
            toolName: 'spawn_agents',
            input: JSON.stringify(spawnAgentsInput),
          }
        }
      }

      logger.info(
        {
          toolName,
          errorType: error.name,
          error: error.message,
        },
        'Tool error - passing through for graceful error handling',
      )
      return toolCall
    },
  })

  let usageReported = false
  let usageIncompleteReported = false
  const reportUsageIncomplete = () => {
    if (usageReported || usageIncompleteReported) return
    usageIncompleteReported = true
    params.onUsageIncomplete?.()
  }
  const reportUsage = (usage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    inputTokenDetails?: {
      cacheReadTokens?: number
    }
    outputTokenDetails?: {
      reasoningTokens?: number
    }
  }) => {
    if (usageReported || usageIncompleteReported) return
    usageReported = true
    emitCacheDebugUsage({
      callback: params.onCacheDebugUsageReceived,
      usage,
    })
    emitCacheDebugUsage({
      callback: params.onUsageReceived,
      usage,
    })
  }

  let costReported = false
  let finishProviderMetadata: ProviderMetadata | undefined
  const reportCost = async (providerMetadata: ProviderMetadata | undefined) => {
    if (costReported) return
    const openrouterUsage = providerMetadata?.codebuff?.usage as
      | OpenRouterUsageAccounting
      | undefined
    const costOverrideDollars = openrouterUsage
      ? (openrouterUsage.cost ?? 0) +
        (openrouterUsage.costDetails?.upstreamInferenceCost ?? 0)
      : undefined
    if (!params.onCostCalculated || !costOverrideDollars) return
    costReported = true
    await params.onCostCalculated(
      calculateUsedCredits({ costDollars: costOverrideDollars }),
    )
  }

  const stopSequenceHandler = new StopSequenceHandler(params.stopSequences)

  let hasYieldedContent = false
  let hasReceivedReasoning = false
  let hasYieldedToolCall = false

  let finishInfo: StreamFinishInfo | undefined
  let thrownStreamRecovery: StreamEndRecovery | undefined
  const streamIterator = response.stream[Symbol.asyncIterator]()
  const recoverThrownStream = (error: unknown): StreamEndRecovery | null => {
    const recovery = classifyThrownStreamRecovery({
      aborted: params.signal.aborted,
      error,
    })
    if (!recovery) return null
    void Promise.allSettled([
      response.response,
      response.request,
      response.usage,
      response.providerMetadata,
    ])
    return recovery
  }

  while (true) {
    let iteration: Awaited<ReturnType<typeof streamIterator.next>>
    try {
      iteration = await streamIterator.next()
    } catch (error) {
      if (params.signal.aborted) reportUsageIncomplete()
      const recovery = recoverThrownStream(error)
      if (!recovery) throw error
      thrownStreamRecovery = recovery
      break
    }
    if (iteration.done) break
    const chunkValue = iteration.value
    if (chunkValue.type === 'finish-step') {
      finishProviderMetadata = chunkValue.providerMetadata as
        | ProviderMetadata
        | undefined
    }
    if (chunkValue.type === 'finish') {
      finishInfo = streamFinishInfoOf(
        chunkValue,
        typeof aiSDKModel !== 'string' &&
          aiSDKModel.specificationVersion === 'v2',
      )
      if (finishInfo.hasUsage) reportUsage(chunkValue.totalUsage)
      await reportCost(finishProviderMetadata)
    }
    if (chunkValue.type !== 'text-delta') {
      const flushed = stopSequenceHandler.flush()
      if (flushed) {
        hasYieldedContent = true
        yield {
          type: 'text',
          text: flushed,
          ...(agentChunkMetadata ?? {}),
        }
      }
    }
    if (chunkValue.type === 'error') {
      if (params.signal.aborted) reportUsageIncomplete()

      const errorBody = APICallError.isInstance(chunkValue.error)
        ? chunkValue.error.responseBody
        : undefined
      const mainErrorMessage =
        chunkValue.error instanceof Error
          ? chunkValue.error.message
          : typeof chunkValue.error === 'string'
            ? chunkValue.error
            : JSON.stringify(chunkValue.error)
      const errorMessage = buildArray([mainErrorMessage, errorBody]).join('\n')

      if (
        NoSuchToolError.isInstance(chunkValue.error) ||
        InvalidToolInputError.isInstance(chunkValue.error) ||
        ToolCallRepairError.isInstance(chunkValue.error) ||
        TypeValidationError.isInstance(chunkValue.error)
      ) {
        logger.warn(
          {
            chunk: { ...chunkValue, error: undefined },
            error: getErrorObject(chunkValue.error),
            model: params.model,
          },
          'Tool call error in AI SDK stream - passing through to agent to retry',
        )
        yield {
          type: 'error',
          message: errorMessage,
        }
        continue
      }

      const recovery = recoverThrownStream(chunkValue.error)
      if (recovery) {
        thrownStreamRecovery = recovery
        break
      }

      logger.error(
        {
          chunk: { ...chunkValue, error: undefined },
          error: getErrorObject(chunkValue.error),
          model: params.model,
        },
        'Error in AI SDK stream',
      )

      throw chunkValue.error
    }
    if (chunkValue.type === 'reasoning-delta') {
      if (chunkValue.text) {
        hasReceivedReasoning = true
      }
      const reasoningExcluded = (['openrouter', 'codebuff'] as const).some(
        (p) =>
          (params.providerOptions?.[p] as OpenRouterProviderOptions | undefined)
            ?.reasoning?.exclude,
      )
      if (!reasoningExcluded) {
        yield {
          type: 'reasoning',
          text: chunkValue.text,
        }
      }
    }
    if (chunkValue.type === 'reasoning-end') {
      if (chunkValue.providerMetadata) {
        hasReceivedReasoning = true
        yield {
          type: 'reasoning',
          text: '',
          providerOptions: chunkValue.providerMetadata as ProviderMetadata,
        }
      }
    }
    if (chunkValue.type === 'text-delta') {
      if (!params.stopSequences) {
        if (chunkValue.text) {
          hasYieldedContent = true
          yield {
            type: 'text',
            text: chunkValue.text,
            ...(agentChunkMetadata ?? {}),
          }
        }
        continue
      }

      const stopSequenceResult = stopSequenceHandler.process(chunkValue.text)
      if (stopSequenceResult.text) {
        hasYieldedContent = true
        yield {
          type: 'text',
          text: stopSequenceResult.text,
          ...(agentChunkMetadata ?? {}),
        }
      }
    }
    if (chunkValue.type === 'tool-call') {
      hasYieldedToolCall = true
      yield chunkValue
    }
  }
  const flushed = stopSequenceHandler.flush()
  if (flushed) {
    hasYieldedContent = true
    yield {
      type: 'text',
      text: flushed,
      ...(agentChunkMetadata ?? {}),
    }
  }

  if (params.signal.aborted) reportUsageIncomplete()
  if (thrownStreamRecovery && params.signal.aborted) {
    return promptAborted('User cancelled input')
  }
  const recovery =
    thrownStreamRecovery ??
    classifyStreamEndRecovery({
      aborted: params.signal.aborted,
      finish: finishInfo,
      receivedReasoning: hasReceivedReasoning,
      yieldedText: hasYieldedContent,
      yieldedToolCall: hasYieldedToolCall,
    })
  if (recovery) {
    reportUsageIncomplete()
    logger.warn(
      {
        axiomEvent: STREAM_RECOVERY_EVENT,
        metric: 'stream_recovery_detected',
        source: recovery.source,
        model: params.model,
        userId: params.userId,
        userInputId: params.userInputId,
        finishReason: finishInfo?.finishReason,
        hasYieldedContent,
        hasReceivedReasoning,
      },
      'Completion stream ended without a usable response; forcing a retry step',
    )
    yield {
      type: 'error',
      source: recovery.source,
      message: recovery.message,
    }
  }

  if (thrownStreamRecovery) return promptSuccess(null)

  const responseValue = await response.response
  const messageId = responseValue.id

  const requestMetadata = await response.request
  emitCacheDebugProviderRequest({
    callback: params.onCacheDebugProviderRequestBuilt,
    provider: getModelProvider(aiSDKModel),
    rawBody: requestMetadata.body,
  })

  const usageResult = await response.usage
  if (finishInfo?.hasUsage) reportUsage(usageResult)
  else reportUsageIncomplete()

  const providerMetadata = (await response.providerMetadata) ?? {}
  await reportCost(providerMetadata as ProviderMetadata)

  return promptSuccess(messageId)
}

export async function promptAiSdk(
  params: ParamsOf<PromptAiSdkFn>,
): ReturnType<PromptAiSdkFn> {
  const { logger } = params

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping prompt due to canceled user input',
    )
    return promptAborted('User cancelled input')
  }

  const aiSDKModel = getModelForRequest({
    apiKey: params.apiKey,
    model: params.model,
    userId: params.userId,
  })

  const response = await generateText({
    ...params,
    prompt: undefined,
    model: aiSDKModel,
    messages: convertCbToModelMessages(params),
    allowSystemInMessages: true,
    include: {
      ...params.include,
      requestBody: true,
    },
    providerOptions: getProviderOptions({
      ...params,
      agentProviderOptions: params.agentProviderOptions,
      cacheDebugCorrelation: params.cacheDebugCorrelation,
    }),
  })
  emitCacheDebugProviderRequest({
    callback: params.onCacheDebugProviderRequestBuilt,
    provider: getModelProvider(aiSDKModel),
    rawBody: response.request?.body,
  })
  emitCacheDebugUsage({
    callback: params.onCacheDebugUsageReceived,
    usage: response.usage,
  })
  const content = response.text

  const providerMetadata = response.providerMetadata ?? {}
  let costOverrideDollars: number | undefined
  if (providerMetadata.codebuff) {
    if (providerMetadata.codebuff.usage) {
      const openrouterUsage = providerMetadata.codebuff
        .usage as OpenRouterUsageAccounting

      costOverrideDollars =
        (openrouterUsage.cost ?? 0) +
        (openrouterUsage.costDetails?.upstreamInferenceCost ?? 0)
    }
  }

  if (params.onCostCalculated && costOverrideDollars) {
    await params.onCostCalculated(
      calculateUsedCredits({ costDollars: costOverrideDollars }),
    )
  }

  return promptSuccess(content)
}

export async function promptAiSdkStructured<T>(
  params: PromptAiSdkStructuredInput<T>,
): PromptAiSdkStructuredOutput<T> {
  const { logger } = params

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping structured prompt due to canceled user input',
    )
    return promptAborted('User cancelled input')
  }
  const aiSDKModel = getModelForRequest({
    apiKey: params.apiKey,
    model: params.model,
    userId: params.userId,
  })

  const response = await generateText({
    ...params,
    prompt: undefined,
    model: aiSDKModel,
    output: Output.object({ schema: params.schema }),
    messages: convertCbToModelMessages(params),
    allowSystemInMessages: true,
    include: { requestBody: true },
    providerOptions: getProviderOptions({
      ...params,
      agentProviderOptions: params.agentProviderOptions,
      cacheDebugCorrelation: params.cacheDebugCorrelation,
    }),
  })

  emitCacheDebugProviderRequest({
    callback: params.onCacheDebugProviderRequestBuilt,
    provider: getModelProvider(aiSDKModel),
    rawBody: response.request?.body,
  })
  emitCacheDebugUsage({
    callback: params.onCacheDebugUsageReceived,
    usage: response.usage,
  })

  const content = response.output

  const providerMetadata = response.providerMetadata ?? {}
  let costOverrideDollars: number | undefined
  if (providerMetadata.codebuff) {
    if (providerMetadata.codebuff.usage) {
      const openrouterUsage = providerMetadata.codebuff
        .usage as OpenRouterUsageAccounting

      costOverrideDollars =
        (openrouterUsage.cost ?? 0) +
        (openrouterUsage.costDetails?.upstreamInferenceCost ?? 0)
    }
  }

  if (params.onCostCalculated && costOverrideDollars) {
    await params.onCostCalculated(
      calculateUsedCredits({ costDollars: costOverrideDollars }),
    )
  }

  return promptSuccess(content)
}
