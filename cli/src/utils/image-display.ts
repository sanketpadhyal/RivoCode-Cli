
const CELL_ASPECT_RATIO = 2

const PIXELS_PER_CELL = 15

const MAX_DISPLAY_WIDTH = 60

export interface DisplaySizeInput {
  width?: number
  height?: number
  availableWidth: number
}

export interface DisplaySize {
  width: number
  height: number
}

export function calculateDisplaySize(input: DisplaySizeInput): DisplaySize {
  const { width, height, availableWidth } = input

  const maxWidth = Math.max(1, Math.min(availableWidth - 4, MAX_DISPLAY_WIDTH))

  if (!width || !height || width <= 0 || height <= 0) {
    const fallbackWidth = Math.max(1, Math.floor(maxWidth * 0.5))
    const fallbackHeight = Math.max(1, Math.floor(fallbackWidth / CELL_ASPECT_RATIO))
    return { width: fallbackWidth, height: fallbackHeight }
  }

  const aspectRatio = width / height

  const naturalCellWidth = Math.ceil(width / PIXELS_PER_CELL)

  const displayWidth = Math.max(1, Math.min(naturalCellWidth, maxWidth))

  const displayHeight = Math.max(1, Math.floor(displayWidth / aspectRatio / CELL_ASPECT_RATIO))

  return { width: displayWidth, height: displayHeight }
}
