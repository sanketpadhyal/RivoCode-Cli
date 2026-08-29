import { z } from 'zod/v4'

export type OpenAICompatibleCompletionModelId = string

export const openaiCompatibleCompletionProviderOptions = z.object({
  echo: z.boolean().optional(),

  logitBias: z.record(z.string(), z.number()).optional(),

  suffix: z.string().optional(),

  user: z.string().optional(),
})

export type OpenAICompatibleCompletionProviderOptions = z.infer<
  typeof openaiCompatibleCompletionProviderOptions
>
