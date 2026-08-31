export type UsageData = {
  type?: 'usage-response'
  usage?: number
  remainingBalance?: number | null
  balanceBreakdown?: { free: number; paid: number; ad?: number }
  next_quota_reset?: string | null
}

export const usageQueryKeys = {
  all: ['usage'] as const,
  current: () => [...usageQueryKeys.all, 'current'] as const,
}

export function fetchUsageData(_params: unknown): Promise<UsageData | null> {
  return Promise.resolve(null)
}

export function useUsageQuery(_deps?: unknown) {
  return { data: null as UsageData | null, isLoading: false, isFetching: false, error: null }
}

export function useRefreshUsage() {
  return () => {}
}
