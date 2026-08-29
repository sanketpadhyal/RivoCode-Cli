
export const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
}

export const SUPPORTED_IMAGE_EXTENSIONS = new Set(Object.keys(IMAGE_EXTENSION_TO_MIME))

export function isSupportedImageExtension(ext: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext.toLowerCase())
}

export function getImageMimeType(ext: string): string | null {
  return IMAGE_EXTENSION_TO_MIME[ext.toLowerCase()] ?? null
}

export const IMAGE_EXTENSIONS_PATTERN = Object.keys(IMAGE_EXTENSION_TO_MIME)
  .map((ext) => ext.slice(1))
  .join('|')

export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024
export const MAX_IMAGE_BASE64_SIZE = 1 * 1024 * 1024
export const MAX_TOTAL_IMAGE_SIZE = 5 * 1024 * 1024
