import { memo, type ReactNode } from 'react'

interface ErrorBoundaryPlaceholderProps {
  children: ReactNode
  fallback: ReactNode
  componentName?: string
}

export const ErrorBoundaryPlaceholder = memo(
  ({ children }: ErrorBoundaryPlaceholderProps) => {
    return <>{children}</>
  },
)

export const ErrorBoundary = ErrorBoundaryPlaceholder

export function withErrorFallback<T>(
  renderFn: () => T,
  fallback: T,
  componentName?: string,
): T {
  try {
    return renderFn()
  } catch (error) {
    console.error(`[${componentName ?? 'withErrorFallback'}] Error caught:`, error)
    return fallback
  }
}
