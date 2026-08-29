import { useCallback, useRef } from 'react'

export function useEvent<TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  const callbackRef = useRef<(...args: TArgs) => TReturn>(callback)

  callbackRef.current = callback

  return useCallback(
    (...args: TArgs) => callbackRef.current(...args),
    [],
  )
}
