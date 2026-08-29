import { APICallError } from '@ai-sdk/provider'
import { z } from 'zod/v4'

import type { ZodType } from 'zod/v4'

export const openaiCompatibleErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),

    type: z.string().nullish(),
    param: z.any().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),

    metadata: z
      .looseObject({
        raw: z.string().nullish(),
        provider_name: z.string().nullish(),
      })
      .nullish(),
  }),
})

export type OpenAICompatibleErrorData = z.infer<
  typeof openaiCompatibleErrorDataSchema
>

export type ProviderErrorStructure<T> = {
  errorSchema: ZodType<T>
  errorToMessage: (error: T) => string
  isRetryable?: (response: Response, error?: T) => boolean
}

export const defaultOpenAICompatibleErrorStructure: ProviderErrorStructure<OpenAICompatibleErrorData> =
  {
    errorSchema: openaiCompatibleErrorDataSchema,
    errorToMessage: (data) => data.error.message,
  }

const MAX_PROVIDER_DETAIL_LENGTH = 1000

export function streamErrorChunkToApiCallError(params: {
  errorValue: unknown
  url: string
  requestBodyValues: unknown
}): APICallError {
  const { errorValue, url, requestBodyValues } = params
  const error =
    errorValue && typeof errorValue === 'object'
      ? (errorValue as {
          message?: unknown
          code?: unknown
          metadata?: { raw?: unknown; provider_name?: unknown } | null
        })
      : {}

  const baseMessage =
    typeof error.message === 'string' && error.message.length > 0
      ? error.message
      : JSON.stringify(errorValue)

  const raw =
    typeof error.metadata?.raw === 'string' && error.metadata.raw.length > 0
      ? error.metadata.raw
      : undefined
  const providerLabel =
    typeof error.metadata?.provider_name === 'string'
      ? error.metadata.provider_name
      : 'Provider details'
  const truncatedRaw =
    raw !== undefined && raw.length > MAX_PROVIDER_DETAIL_LENGTH
      ? raw.slice(0, MAX_PROVIDER_DETAIL_LENGTH) + '...'
      : raw
  const message =
    truncatedRaw !== undefined
      ? `${baseMessage} [${providerLabel}: ${truncatedRaw}]`
      : baseMessage

  const statusCode =
    typeof error.code === 'number' && Number.isInteger(error.code)
      ? error.code
      : typeof error.code === 'string' && /^\d{3}$/.test(error.code)
        ? Number(error.code)
        : undefined

  return new APICallError({
    message,
    url,
    requestBodyValues,
    statusCode,
    responseBody: JSON.stringify({ error: { ...error, message } }),
  })
}
