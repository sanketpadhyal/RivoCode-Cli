// Usage query disabled — RivoCode is a local-first CLI with no cloud usage tracking.

export const usageQueryKeys = {
  all: ['usage'] as const,
  current: () => [...usageQueryKeys.all, 'current'] as const,
}

export function fetchUsageData(_params: unknown): Promise<unknown> {
  return Promise.resolve(null)
}

export function useUsageQuery(_deps?: unknown) {
  return { data: null, isLoading: false, error: null }
}

export function useRefreshUsage() {
  return () => {}
}
