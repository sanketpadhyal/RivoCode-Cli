
import { Jimp, ResizeStrategy } from 'jimp'

import { logger } from './logger'

export interface ThumbnailPixel {
  r: number
  g: number
  b: number
}

export interface ThumbnailData {
  width: number
  height: number
  pixels: ThumbnailPixel[][]
}

export async function extractThumbnailColors(
  source: string | Buffer,
  targetWidth: number,
  targetHeight: number,
): Promise<ThumbnailData | null> {
  try {
    const image = await Jimp.read(source)

    const resizedHeight = targetHeight * 2
    image.resize({ w: targetWidth, h: resizedHeight, mode: ResizeStrategy.BILINEAR })

    const width = image.width
    const height = image.height

    const pixels: ThumbnailPixel[][] = []

    for (let y = 0; y < height; y++) {
      const row: ThumbnailPixel[] = []
      for (let x = 0; x < width; x++) {
        const color = image.getPixelColor(x, y)
        const r = (color >> 24) & 0xff
        const g = (color >> 16) & 0xff
        const b = (color >> 8) & 0xff
        row.push({ r, g, b })
      }
      pixels.push(row)
    }

    return { width, height, pixels }
  } catch (error) {
    logger.warn(
      {
        source: typeof source === 'string' ? source : `Buffer(len=${source.length})`,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to extract thumbnail colors from image',
    )
    return null
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
