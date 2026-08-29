
import React, { useEffect, useState, memo } from 'react'

import { type ImageCardImage } from './image-card'
import {
  extractThumbnailColors,
  rgbToHex,
  type ThumbnailData,
} from '../utils/image-thumbnail'

interface ImageThumbnailProps {
  image: ImageCardImage
  width: number
  height: number
  fallback?: React.ReactNode
}

export const ImageThumbnail = memo(({
  image,
  width,
  height,
  fallback,
}: ImageThumbnailProps) => {
  const [thumbnailData, setThumbnailData] = useState<ThumbnailData | null>(null)

  useEffect(() => {
    if ((image.status ?? 'ready') !== 'ready') return

    let cancelled = false

    const loadThumbnail = async () => {
      let data: ThumbnailData | null = null
      try {
        if (image.processedImage) {
          const imageBuffer = Buffer.from(image.processedImage.base64, 'base64')
          data = await extractThumbnailColors(imageBuffer, width, height)
        } else if (!image.path.startsWith('clipboard:')) {
          data = await extractThumbnailColors(image.path, width, height)
        }
      } catch {
      }

      if (!cancelled) {
        setThumbnailData(data)
      }
    }

    loadThumbnail()

    return () => {
      cancelled = true
    }
  }, [image, width, height])

  if (!thumbnailData) {
    return <>{fallback}</>
  }

  const rows: React.ReactNode[] = []

  for (let rowIndex = 0; rowIndex < thumbnailData.height; rowIndex += 2) {
    const topRow = thumbnailData.pixels[rowIndex]
    const bottomRow = thumbnailData.pixels[rowIndex + 1] || topRow

    const cells: React.ReactNode[] = []

    for (let col = 0; col < thumbnailData.width; col++) {
      const topPixel = topRow[col]
      const bottomPixel = bottomRow[col]

      const fgColor = rgbToHex(topPixel.r, topPixel.g, topPixel.b)
      const bgColor = rgbToHex(bottomPixel.r, bottomPixel.g, bottomPixel.b)

      cells.push(
        <box
          key={col}
          style={{
            backgroundColor: bgColor,
          }}
        >
          <text style={{ fg: fgColor }}>▀</text>
        </box>
      )
    }

    rows.push(
      <box key={rowIndex} style={{ flexDirection: 'row' }}>
        {cells}
      </box>
    )
  }

  return (
    <box style={{ flexDirection: 'column' }}>
      {rows}
    </box>
  )
})
