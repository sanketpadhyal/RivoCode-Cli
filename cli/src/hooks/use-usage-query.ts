import { env } from '@rivocode/common/env'
import { useCallback } from 'react'

import { invalidateActivityQuery, useActivityQuery } from './use-activity-query'
import { getAuthToken } from '../utils/auth'
import { logger as defaultLogger } from '../utils/logger'

import type { ClientEnv } from '@rivocode/common/types/contracts/env'
import type { Logger } from '@rivocode/common/types/contracts/logger'

export const usageQueryKeys = {
  all: ['usage'] as const,
  current: () => [...usageQueryKeys.all, 'current'] as const,
}

interface UsageResponse {
  type: 'usage-response'
  usage: number
  remainingBalance: number | null
  balanceBreakdown?: {
    free: number
    paid: number
    ad?: number
    referral?: number
    admin?: number
  }
  next_quota_reset: string | null
  autoTopupEnabled?: boolean
}

interface FetchUsageParams {
  authToken: string
  logger?: Logger
  clientEnv?: ClientEnv
}

export async function fetchUsageData({
  authToken,
  logger = defaultLogger,
  clientEnv = env,
}: FetchUsageParams): Promise<UsageResponse> {
  const appUrl = clientEnv.NEXT_PUBLIC_CODEBUFF_APP_URL
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_CODEBUFF_APP_URL is not set')
  }

  const response = await fetch(`${appUrl}/api/v1/usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fingerprintId: 'cli-usage',
      authToken,
    }),
  })

  if (!response.ok) {
    logger.error(
      { status: response.status },
      'Failed to fetch usage data from API',
    )
    throw new Error(`Failed to fetch usage: ${response.status}`)
  }

  const responseBody = await response.json()
  const data = responseBody as UsageResponse
  return data
}

export interface UseUsageQueryDeps {
  logger?: Logger
  enabled?: boolean
  refetchInterval?: number | false
  refetchOnActivity?: boolean
  pauseWhenIdle?: boolean
  idleThreshold?: number
}

export function useUsageQuery(deps: UseUsageQueryDeps = {}) {
  const {
    logger = defaultLogger,
    enabled = true,
    refetchInterval = false,
    refetchOnActivity = false,
    pauseWhenIdle = true,
    idleThreshold = 30_000,
  } = deps
  const authToken = getAuthToken()

  return useActivityQuery({
    queryKey: usageQueryKeys.current(),
    queryFn: () => fetchUsageData({ authToken: authToken!, logger }),
    enabled: enabled && !!authToken,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnMount: 'always',
    refetchInterval,
    refetchOnActivity,
    pauseWhenIdle,
    idleThreshold,
  })
}

export function useRefreshUsage() {
  return useCallback(() => {
    invalidateActivityQuery(usageQueryKeys.current())
  }, [])
}
