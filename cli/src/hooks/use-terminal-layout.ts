import { useMemo } from 'react'

import { useTerminalDimensions } from './use-terminal-dimensions'

export type TerminalWidthSize = 'xs' | 'sm' | 'md' | 'lg'

export type TerminalHeightSize = 'xs' | 'sm' | 'md'

export const WIDTH_XS_BREAKPOINT = 50
export const WIDTH_MD_BREAKPOINT = 100
export const WIDTH_LG_BREAKPOINT = 150

export const HEIGHT_XS_BREAKPOINT = 20
export const HEIGHT_MD_BREAKPOINT = 40

const WIDTH_SIZE_ORDER: TerminalWidthSize[] = ['xs', 'sm', 'md', 'lg']

const HEIGHT_SIZE_ORDER: TerminalHeightSize[] = ['xs', 'sm', 'md']

export interface WidthLayoutHelper {
  size: TerminalWidthSize
  is: (size: TerminalWidthSize) => boolean
  atLeast: (size: TerminalWidthSize) => boolean
  atMost: (size: TerminalWidthSize) => boolean
}

export interface HeightLayoutHelper {
  size: TerminalHeightSize
  is: (size: TerminalHeightSize) => boolean
  atLeast: (size: TerminalHeightSize) => boolean
  atMost: (size: TerminalHeightSize) => boolean
}

export interface TerminalLayout {
  width: WidthLayoutHelper
  height: HeightLayoutHelper
  terminalWidth: number
  terminalHeight: number
}

const createWidthHelper = (size: TerminalWidthSize): WidthLayoutHelper => {
  const sizeIndex = WIDTH_SIZE_ORDER.indexOf(size)

  return {
    size,
    is: (targetSize: TerminalWidthSize) => size === targetSize,
    atLeast: (targetSize: TerminalWidthSize) => {
      const targetIndex = WIDTH_SIZE_ORDER.indexOf(targetSize)
      return sizeIndex >= targetIndex
    },
    atMost: (targetSize: TerminalWidthSize) => {
      const targetIndex = WIDTH_SIZE_ORDER.indexOf(targetSize)
      return sizeIndex <= targetIndex
    },
  }
}

const createHeightHelper = (size: TerminalHeightSize): HeightLayoutHelper => {
  const sizeIndex = HEIGHT_SIZE_ORDER.indexOf(size)

  return {
    size,
    is: (targetSize: TerminalHeightSize) => size === targetSize,
    atLeast: (targetSize: TerminalHeightSize) => {
      const targetIndex = HEIGHT_SIZE_ORDER.indexOf(targetSize)
      return sizeIndex >= targetIndex
    },
    atMost: (targetSize: TerminalHeightSize) => {
      const targetIndex = HEIGHT_SIZE_ORDER.indexOf(targetSize)
      return sizeIndex <= targetIndex
    },
  }
}

const getWidthSize = (terminalWidth: number): TerminalWidthSize => {
  if (terminalWidth < WIDTH_XS_BREAKPOINT) {
    return 'xs'
  } else if (terminalWidth > WIDTH_LG_BREAKPOINT) {
    return 'lg'
  } else if (terminalWidth > WIDTH_MD_BREAKPOINT) {
    return 'md'
  } else {
    return 'sm'
  }
}

const getHeightSize = (terminalHeight: number): TerminalHeightSize => {
  if (terminalHeight < HEIGHT_XS_BREAKPOINT) {
    return 'xs'
  } else if (terminalHeight > HEIGHT_MD_BREAKPOINT) {
    return 'md'
  } else {
    return 'sm'
  }
}

export const computeTerminalLayout = (
  terminalWidth: number,
  terminalHeight: number,
): TerminalLayout => {
  const widthSize = getWidthSize(terminalWidth)
  const heightSize = getHeightSize(terminalHeight)

  return {
    width: createWidthHelper(widthSize),
    height: createHeightHelper(heightSize),
    terminalWidth,
    terminalHeight,
  }
}

export const useTerminalLayout = (): TerminalLayout => {
  const { terminalWidth, terminalHeight } = useTerminalDimensions()

  const layout = useMemo(
    () => computeTerminalLayout(terminalWidth, terminalHeight),
    [terminalWidth, terminalHeight],
  )

  return layout
}
