import { API_KEY_ENV_VAR } from '@rivocode/common/constants/paths'

import { getWebsiteUrl } from './constants'
import { getCodebuffApiKeyFromEnv } from './env'
import { run } from './run'

import type { RunOptions, CodebuffClientOptions } from './run'
import type { RunState } from './run-state'

export class CodebuffClient {
  public options: CodebuffClientOptions & {
    apiKey: string
    fingerprintId: string
  }

  constructor(options: CodebuffClientOptions) {
    const foundApiKey = options.apiKey ?? getCodebuffApiKeyFromEnv()
    if (!foundApiKey) {
      throw new Error(
        `Codebuff API key not found. Please provide an apiKey in the constructor of CodebuffClient or set the ${API_KEY_ENV_VAR} environment variable.`,
      )
    }

    this.options = {
      apiKey: foundApiKey,
      handleEvent: (event) => {
        if (event.type === 'error') {
          throw new Error(
            `Received error: ${event.message}.\n\nProvide a handleEvent function to handle this error.`,
          )
        }
      },
      fingerprintId: `codebuff-sdk-${Math.random().toString(36).substring(2, 15)}`,
      ...options,
    }
  }

  public async run(
    options: RunOptions & CodebuffClientOptions,
  ): Promise<RunState> {
    return run({ ...this.options, ...options })
  }

  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${getWebsiteUrl()}/api/healthz`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) return false

      const result = await response.json()
      return (
        typeof result === 'object' &&
        result !== null &&
        'status' in result &&
        (result as { status?: unknown }).status === 'ok'
      )
    } catch {
      return false
    }
  }
}
