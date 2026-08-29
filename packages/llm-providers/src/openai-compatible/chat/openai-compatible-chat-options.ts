import { z } from 'zod/v4'

export type OpenAICompatibleChatModelId = string

export const openaiCompatibleProviderOptions = z.object({
  user: z.string().optional(),

  reasoningEffort: z.string().optional(),

  textVerbosity: z.string().optional(),
})

export type OpenAICompatibleProviderOptions = z.infer<
  typeof openaiCompatibleProviderOptions
>
