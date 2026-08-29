import { extractImagePaths, processImageFile } from './image-handler'
import { logger } from './logger'

import type { PendingImageAttachment } from '../types/store'
import type { MessageContent } from '@codebuff/sdk'

export type ProcessedImagePart = {
  type: 'image'
  image: string
  mediaType: string
  filename?: string
  size?: number
  width?: number
  height?: number
  path: string
}

export const processImagesForMessage = async (params: {
  content: string
  pendingImages: PendingImageAttachment[]
  projectRoot: string
  processor?: typeof processImageFile
  log?: typeof logger
}): Promise<{
  attachments: { path: string; filename: string; size?: number }[]
  messageContent: MessageContent[] | undefined
}> => {
  const {
    content,
    pendingImages,
    projectRoot,
    processor = processImageFile,
    log = logger,
  } = params

  const attachments = pendingImages.map((img) => ({
    path: img.path,
    filename: img.filename,
    size: img.size,
  }))

  const validImageParts: ProcessedImagePart[] = []

  const pendingImagePaths = new Set<string>()
  for (const img of pendingImages) {
    pendingImagePaths.add(img.path)

    if (img.processedImage) {
      validImageParts.push({
        type: 'image',
        image: img.processedImage.base64,
        mediaType: img.processedImage.mediaType,
        filename: img.filename,
        size: img.size,
        width: img.width,
        height: img.height,
        path: img.path,
      })
    } else if (img.status === 'ready') {
      log.warn(
        { imagePath: img.path },
        'Pending image marked ready but missing processedImage data, re-processing from disk',
      )
      const result = await processor(img.path, projectRoot)
      if (result.success && result.imagePart) {
        validImageParts.push({
          type: 'image',
          image: result.imagePart.image,
          mediaType: result.imagePart.mediaType,
          filename: result.imagePart.filename,
          size: result.imagePart.size,
          width: result.imagePart.width,
          height: result.imagePart.height,
          path: img.path,
        })
      } else if (!result.success) {
        log.warn(
          { imagePath: img.path, error: result.error },
          'Failed to process pending image from disk',
        )
      }
    }
  }

  const detectedImagePaths = extractImagePaths(content)
  for (const imagePath of detectedImagePaths) {
    if (pendingImagePaths.has(imagePath)) {
      continue
    }

    const result = await processor(imagePath, projectRoot)
    if (result.success && result.imagePart) {
      validImageParts.push({
        type: 'image',
        image: result.imagePart.image,
        mediaType: result.imagePart.mediaType,
        filename: result.imagePart.filename,
        size: result.imagePart.size,
        width: result.imagePart.width,
        height: result.imagePart.height,
        path: imagePath,
      })
    } else if (!result.success) {
      log.warn(
        { imagePath, error: result.error },
        'Failed to process inline image path for SDK',
      )
    }
  }

  let messageContent: MessageContent[] | undefined
  if (validImageParts.length > 0) {
    messageContent = validImageParts.map((img) => ({
      type: 'image',
      image: img.image,
      mediaType: img.mediaType,
    }))
  }

  return {
    attachments,
    messageContent,
  }
}
