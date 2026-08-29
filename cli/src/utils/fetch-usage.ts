import { getAuthToken } from './auth'
import { getApiClient } from './codebuff-api'
import { logger } from './logger'
import { useChatStore } from '../state/chat-store'

import type { CodebuffApiClient } from './codebuff-api'
import type { Logger } from '@rivocode/common/types/contracts/logger'

export interface FetchAndUpdateUsageParams {
  showBanner?: boolean
  getAuthToken?: () => string | undefined
  getChatStore?: () => {
    sessionCreditsUsed: number
    setInputMode: (mode: 'usage' | 'default') => void
  }
  logger?: Logger
  apiClient?: CodebuffApiClient
}

export async function fetchAndUpdateUsage(
  params: FetchAndUpdateUsageParams = {},
): Promise<boolean> {
  const {
    showBanner = false,
    getAuthToken: getAuthTokenFn = getAuthToken,
    getChatStore = () => useChatStore.getState(),
    logger: loggerInstance = logger,
    apiClient: providedApiClient,
  } = params

  const authToken = getAuthTokenFn()
  const chatStore = getChatStore()

  if (!authToken) {
    loggerInstance.debug('Cannot fetch usage: not authenticated')
    return false
  }

  const apiClient =
    providedApiClient ?? getApiClient()

  try {
    const response = await apiClient.usage()

    if (!response.ok) {
      loggerInstance.error(
        { status: response.status, errorText: response.error },
        'Usage request failed',
      )
      return false
    }

    if (showBanner) {
      chatStore.setInputMode('usage')
    }

    return true
  } catch (error) {
    loggerInstance.error(
      {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      'Error fetching usage',
    )
    return false
  }
}
