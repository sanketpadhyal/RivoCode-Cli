// Health check polling disabled — RivoCode runs fully local without cloud connectivity checks.

export function getNextInterval(_consecutiveSuccesses: number): number {
  return 600_000
}

export const useConnectionStatus = (
  _onReconnect?: (isInitialConnection: boolean) => void,
): boolean => {
  return true
}
