import { useRenderer } from '@opentui/react'
import { useMemo } from 'react'

export interface TerminalBreakpoints {
  width: number
  isNarrow: boolean
  isMediumWidth: boolean
  isWide: boolean

  height: number
  isVerySmall: boolean
  isSmall: boolean
  isMedium: boolean
  isLarge: boolean
  isTall: boolean
}

const WIDTH_BREAKPOINTS = {
  narrow: 60,
  mediumWidth: 100,
} as const

const HEIGHT_BREAKPOINTS = {
  verySmall: 15,
  small: 20,
  medium: 30,
} as const

export const useTerminalBreakpoints = (): TerminalBreakpoints => {
  const renderer = useRenderer()

  return useMemo(() => {
    const width = renderer?.width || 80
    const height = renderer?.height || 24

    return {
      width,
      height,

      isNarrow: width < WIDTH_BREAKPOINTS.narrow,
      isMediumWidth:
        width >= WIDTH_BREAKPOINTS.narrow &&
        width < WIDTH_BREAKPOINTS.mediumWidth,
      isWide: width >= WIDTH_BREAKPOINTS.mediumWidth,

      isVerySmall: height < HEIGHT_BREAKPOINTS.verySmall,
      isSmall:
        height >= HEIGHT_BREAKPOINTS.verySmall &&
        height < HEIGHT_BREAKPOINTS.small,
      isMedium:
        height >= HEIGHT_BREAKPOINTS.small &&
        height < HEIGHT_BREAKPOINTS.medium,
      isLarge: height >= HEIGHT_BREAKPOINTS.medium,
      isTall: height >= HEIGHT_BREAKPOINTS.small,
    }
  }, [renderer?.width, renderer?.height])
}
