import { useCallback, useState } from 'react'

import {
  getActivityQueryData,
  invalidateActivityQuery,
  setActivityQueryData,
} from './use-activity-query'
import { subscriptionQueryKeys } from './use-subscription-query'
import { showClipboardMessage } from '../utils/clipboard'
import { getApiClient } from '../utils/codebuff-api'
import { logger } from '../utils/logger'

import type { SubscriptionResponse } from '@codebuff/common/types/subscription'

interface UpdatePreferenceParams {
  fallbackToALaCarte?: boolean
}

export function useUpdatePreference() {
  const [isPending, setIsPending] = useState(false)

  const mutate = useCallback(async (params: UpdatePreferenceParams) => {
    const queryKey = subscriptionQueryKeys.current()

    const previousData = getActivityQueryData<SubscriptionResponse>(queryKey)

    if (previousData && params.fallbackToALaCarte !== undefined) {
      setActivityQueryData<SubscriptionResponse>(queryKey, {
        ...previousData,
        fallbackToALaCarte: params.fallbackToALaCarte,
      })
    }

    setIsPending(true)

    try {
      const client = getApiClient()
      const response = await client.patch<{ success: boolean; error?: string }>(
        '/api/user/preferences',
        params as Record<string, unknown>,
        { includeCookie: true },
      )

      if (!response.ok) {
        const errorMessage = response.error || 'Failed to update preference'
        throw new Error(errorMessage)
      }

      invalidateActivityQuery(queryKey)
    } catch (err) {
      if (previousData) {
        setActivityQueryData(queryKey, previousData)
      }
      logger.error({ err }, 'Failed to update preference')
      showClipboardMessage('Failed to update preference', { durationMs: 3000 })
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutate, isPending }
}
