import {
  withoutTrailingSlash,
  withUserAgentSuffix,
} from '@ai-sdk/provider-utils'

import { OpenAICompatibleChatLanguageModel } from './chat/openai-compatible-chat-language-model'
import { OpenAICompatibleCompletionLanguageModel } from './completion/openai-compatible-completion-language-model'
import { OpenAICompatibleEmbeddingModel } from './embedding/openai-compatible-embedding-model'
import { OpenAICompatibleImageModel } from './image/openai-compatible-image-model'
import { VERSION } from './version'

import type { OpenAICompatibleChatConfig } from './chat/openai-compatible-chat-language-model'
import type {
  EmbeddingModelV2,
  ImageModelV2,
  LanguageModelV2,
  ProviderV2,
} from '@ai-sdk/provider'
import type { FetchFunction } from '@ai-sdk/provider-utils'

export interface OpenAICompatibleProvider<
  CHAT_MODEL_IDS extends string = string,
  COMPLETION_MODEL_IDS extends string = string,
  EMBEDDING_MODEL_IDS extends string = string,
  IMAGE_MODEL_IDS extends string = string,
> extends Omit<ProviderV2, 'imageModel'> {
  (modelId: CHAT_MODEL_IDS): LanguageModelV2

  languageModel(
    modelId: CHAT_MODEL_IDS,
    config?: Partial<OpenAICompatibleChatConfig>,
  ): LanguageModelV2

  chatModel(modelId: CHAT_MODEL_IDS): LanguageModelV2

  completionModel(modelId: COMPLETION_MODEL_IDS): LanguageModelV2

  textEmbeddingModel(modelId: EMBEDDING_MODEL_IDS): EmbeddingModelV2<string>

  imageModel(modelId: IMAGE_MODEL_IDS): ImageModelV2
}

export interface OpenAICompatibleProviderSettings {
  baseURL: string

  name: string

  apiKey?: string

  headers?: Record<string, string>

  queryParams?: Record<string, string>

  fetch?: FetchFunction

  includeUsage?: boolean

  supportsStructuredOutputs?: boolean
}

export function createOpenAICompatible<
  CHAT_MODEL_IDS extends string,
  COMPLETION_MODEL_IDS extends string,
  EMBEDDING_MODEL_IDS extends string,
  IMAGE_MODEL_IDS extends string,
>(
  options: OpenAICompatibleProviderSettings,
): OpenAICompatibleProvider<
  CHAT_MODEL_IDS,
  COMPLETION_MODEL_IDS,
  EMBEDDING_MODEL_IDS,
  IMAGE_MODEL_IDS
> {
  const baseURL = withoutTrailingSlash(options.baseURL)
  const providerName = options.name

  interface CommonModelConfig {
    provider: string
    url: ({ path }: { path: string }) => string
    headers: () => Record<string, string>
    fetch?: FetchFunction
  }

  const headers = {
    ...(options.apiKey && { Authorization: `Bearer ${options.apiKey}` }),
    ...options.headers,
  }

  const getHeaders = () =>
    withUserAgentSuffix(headers, `ai-sdk/openai-compatible/${VERSION}`)

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `${providerName}.${modelType}`,
    url: ({ path }) => {
      const url = new URL(`${baseURL}${path}`)
      if (options.queryParams) {
        url.search = new URLSearchParams(options.queryParams).toString()
      }
      return url.toString()
    },
    headers: getHeaders,
    fetch: options.fetch,
  })

  const createLanguageModel = (modelId: CHAT_MODEL_IDS) =>
    createChatModel(modelId)

  const createChatModel = (modelId: CHAT_MODEL_IDS) =>
    new OpenAICompatibleChatLanguageModel(modelId, {
      ...getCommonModelConfig('chat'),
      includeUsage: options.includeUsage,
      supportsStructuredOutputs: options.supportsStructuredOutputs,
    })

  const createCompletionModel = (modelId: COMPLETION_MODEL_IDS) =>
    new OpenAICompatibleCompletionLanguageModel(modelId, {
      ...getCommonModelConfig('completion'),
      includeUsage: options.includeUsage,
    })

  const createEmbeddingModel = (modelId: EMBEDDING_MODEL_IDS) =>
    new OpenAICompatibleEmbeddingModel(modelId, {
      ...getCommonModelConfig('embedding'),
    })

  const createImageModel = (modelId: IMAGE_MODEL_IDS) =>
    new OpenAICompatibleImageModel(modelId, getCommonModelConfig('image'))

  const provider = (modelId: CHAT_MODEL_IDS) => createLanguageModel(modelId)

  provider.languageModel = createLanguageModel
  provider.chatModel = createChatModel
  provider.completionModel = createCompletionModel
  provider.textEmbeddingModel = createEmbeddingModel
  provider.imageModel = createImageModel

  return provider as OpenAICompatibleProvider<
    CHAT_MODEL_IDS,
    COMPLETION_MODEL_IDS,
    EMBEDDING_MODEL_IDS,
    IMAGE_MODEL_IDS
  >
}
