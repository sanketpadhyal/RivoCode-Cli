import { z } from 'zod/v4'

export type OpenAICompatibleEmbeddingModelId = string

export const openaiCompatibleEmbeddingProviderOptions = z.object({
  dimensions: z.number().optional(),

  user: z.string().optional(),
})

export type OpenAICompatibleEmbeddingProviderOptions = z.infer<
  typeof openaiCompatibleEmbeddingProviderOptions
>
