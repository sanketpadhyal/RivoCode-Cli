import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { processImageFile, resolveFilePath, isImageFile } from './image-handler'
import { useChatStore } from '../state/chat-store'
import type { PendingAttachment } from '../types/store'

function exitImageModeIfActive(): void {
  if (useChatStore.getState().inputMode === 'image') {
    useChatStore.getState().setInputMode('default')
  }
}

export async function addPendingImageFromFile(
  imagePath: string,
  cwd: string,
  replacePlaceholder?: string,
): Promise<void> {
  const filename = path.basename(imagePath)

  if (replacePlaceholder) {
    useChatStore.setState((state) => ({
      pendingAttachments: state.pendingAttachments.map((att) =>
        att.kind === 'image' && att.path === replacePlaceholder
          ? { ...att, path: imagePath, filename }
          : att
      ),
    }))
  } else {
    useChatStore.getState().addPendingImage({
      path: imagePath,
      filename,
      status: 'processing',
    })
  }

  const result = await processImageFile(imagePath, cwd)

  useChatStore.setState((state) => ({
    pendingAttachments: state.pendingAttachments.map((att) => {
      if (att.kind !== 'image' || att.path !== imagePath) return att

      if (result.success && result.imagePart) {
        return {
          ...att,
          status: 'ready' as const,
          size: result.imagePart.size,
          width: result.imagePart.width,
          height: result.imagePart.height,
          note: result.wasCompressed ? 'compressed' : undefined,
          processedImage: {
            base64: result.imagePart.image,
            mediaType: result.imagePart.mediaType,
          },
        }
      }

      return {
        ...att,
        status: 'error' as const,
        note: result.error || 'failed',
      }
    }),
  }))

  if (result.success) {
    exitImageModeIfActive()
  }
}

export async function addPendingImageFromBase64(
  base64Data: string,
  mediaType: string,
  filename: string,
  tempPath?: string,
): Promise<void> {
  const size = Math.round((base64Data.length * 3) / 4)

  useChatStore.getState().addPendingImage({
    path: tempPath || `clipboard:${filename}`,
    filename,
    status: 'ready',
    size,
    processedImage: {
      base64: base64Data,
      mediaType,
    },
  })
}

const AUTO_REMOVE_ERROR_DELAY_MS = 3000

let clipboardPlaceholderCounter = 0

const errorImageTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function addClipboardPlaceholder(): string {
  const placeholderPath = `clipboard:pending-${++clipboardPlaceholderCounter}`
  useChatStore.getState().addPendingImage({
    path: placeholderPath,
    filename: 'clipboard image',
    status: 'processing',
  })
  return placeholderPath
}

export function addPendingImageWithError(
  imagePath: string,
  note: string,
): void {
  const filename = path.basename(imagePath)
  useChatStore.getState().addPendingImage({
    path: imagePath,
    filename,
    status: 'error',
    note,
  })

  const existingTimer = errorImageTimers.get(imagePath)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(() => {
    errorImageTimers.delete(imagePath)
    useChatStore.getState().removePendingImage(imagePath)
  }, AUTO_REMOVE_ERROR_DELAY_MS)

  errorImageTimers.set(imagePath, timer)
}

export function clearErrorImageTimer(imagePath: string): void {
  const timer = errorImageTimers.get(imagePath)
  if (timer) {
    clearTimeout(timer)
    errorImageTimers.delete(imagePath)
  }
}

export async function validateAndAddImage(
  imagePath: string,
  cwd: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const cleaned = imagePath
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\ /g, ' ')
  const resolvedPath = resolveFilePath(cleaned, cwd)

  if (!existsSync(resolvedPath)) {
    const error = 'file not found'
    addPendingImageWithError(resolvedPath, `❌ ${error}`)
    return { success: false, error }
  }

  if (!isImageFile(resolvedPath)) {
    const ext = path.extname(cleaned).toLowerCase()
    const error = ext ? `unsupported format ${ext}` : 'unsupported format'
    addPendingImageWithError(resolvedPath, `❌ ${error}`)
    return { success: false, error }
  }

  await addPendingImageFromFile(resolvedPath, cwd)
  return { success: true }
}

const MAX_FILE_READ_SIZE = 1024 * 1024
const MAX_CONTENT_CHARS = 100 * 1024
const MAX_DIR_ENTRIES = 100

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function isBinaryBuffer(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 8192)
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

export function addPendingFileFromPath(
  filePath: string,
  isDirectory: boolean,
): void {
  const id = crypto.randomUUID()
  const filename = path.basename(filePath) || filePath

  useChatStore.getState().addPendingFileAttachment({
    id,
    path: filePath,
    filename,
    isDirectory,
    content: '',
    status: 'processing',
  })

  setTimeout(() => {
    try {
      let content: string
      let note: string

      if (isDirectory) {
        const entries = readdirSync(filePath, { withFileTypes: true })
        const count = entries.length
        note = `${count} item${count !== 1 ? 's' : ''}`

        if (count === 0) {
          content = '(empty directory)'
        } else {
          const sorted = [...entries].sort((a, b) => {
            const aIsDir = a.isDirectory()
            const bIsDir = b.isDirectory()
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          const listing = sorted
            .slice(0, MAX_DIR_ENTRIES)
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
            .join('\n')
          content = listing
          if (count > MAX_DIR_ENTRIES) {
            content += `\n… and ${count - MAX_DIR_ENTRIES} more`
          }
        }
      } else {
        const stats = statSync(filePath)

        if (stats.size === 0) {
          content = '(empty file)'
          note = '0 B'
        } else if (stats.size > MAX_FILE_READ_SIZE) {
          content = `(file too large to preview: ${formatFileSize(stats.size)})`
          note = formatFileSize(stats.size)
        } else {
          const buffer = readFileSync(filePath)
          if (isBinaryBuffer(buffer)) {
            content = '(binary file)'
            note = `${formatFileSize(stats.size)} (binary)`
          } else {
            const text = buffer.toString('utf-8')
            if (text.length > MAX_CONTENT_CHARS) {
              content = text.slice(0, MAX_CONTENT_CHARS) + '\n… (truncated)'
              note = formatFileSize(stats.size)
            } else {
              content = text
              note = formatFileSize(stats.size)
            }
          }
        }
      }

      useChatStore.setState((state) => ({
        pendingAttachments: state.pendingAttachments.map((att) => {
          if (att.kind !== 'file' || att.id !== id) return att
          return { ...att, content, status: 'ready' as const, note }
        }),
      }))
    } catch {
      useChatStore.setState((state) => ({
        pendingAttachments: state.pendingAttachments.map((att) => {
          if (att.kind !== 'file' || att.id !== id) return att
          return { ...att, status: 'error' as const, note: 'Failed to read' }
        }),
      }))
    }
  }, 0)
}

export function hasProcessingImages(): boolean {
  return useChatStore.getState().pendingAttachments.some(
    (att) => att.kind === 'image' && att.status === 'processing',
  )
}

export function hasProcessingFiles(): boolean {
  return useChatStore.getState().pendingAttachments.some(
    (att) => att.kind === 'file' && att.status === 'processing',
  )
}

export function capturePendingAttachments(): PendingAttachment[] {
  const pendingAttachments = [...useChatStore.getState().pendingAttachments]
  if (pendingAttachments.length > 0) {
    useChatStore.getState().clearPendingAttachments()
  }
  return pendingAttachments
}
