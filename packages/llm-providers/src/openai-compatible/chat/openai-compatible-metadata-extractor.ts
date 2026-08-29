import type { SharedV2ProviderMetadata } from '@ai-sdk/provider'

export type MetadataExtractor = {
  extractMetadata: ({
    parsedBody,
  }: {
    parsedBody: unknown
  }) => Promise<SharedV2ProviderMetadata | undefined>

  createStreamExtractor: () => {
    processChunk(parsedChunk: unknown): void

    buildMetadata(): SharedV2ProviderMetadata | undefined
  }
}
