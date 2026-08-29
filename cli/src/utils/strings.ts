import path from 'path'

export const MAX_COLLAPSED_LINES = 3

export function truncateToLines(
  text: string | null | undefined,
  maxLines: number,
): string | null | undefined {
  if (!text) return text
  const lines = text.split('\n')
  if (lines.length <= maxLines) {
    return text
  }
  return lines.slice(0, maxLines).join('\n').trimEnd() + '...'
}

import { statSync } from 'fs'

import {
  getFileOrFolderPathFromText,
  getImageFilePathFromText,
  hasClipboardImage,
  readClipboardFilePath,
  readClipboardImageFilePath,
  readClipboardText,
} from './clipboard-image'
import { isImageFile } from './image-handler'

import type { InputValue } from '../types/store'

export function getSubsequenceIndices(
  str: string,
  sub: string,
): number[] | null {
  let strIndex = 0
  let subIndex = 0

  const indices: number[] = []

  while (strIndex < str.length && subIndex < sub.length) {
    if (str[strIndex] === sub[subIndex]) {
      indices.push(strIndex)
      subIndex++
    }
    strIndex++
  }

  if (subIndex >= sub.length) {
    return indices
  }

  return null
}

export const BULLET_CHAR = '• '

export const LONG_TEXT_THRESHOLD = 2000

function insertTextAtCursor(
  text: string,
  cursorPosition: number,
  textToInsert: string,
): { newText: string; newCursor: number } {
  const before = text.slice(0, cursorPosition)
  const after = text.slice(cursorPosition)
  return {
    newText: before + textToInsert + after,
    newCursor: before.length + textToInsert.length,
  }
}

export function createTextPasteHandler(
  text: string,
  cursorPosition: number,
  onChange: (value: InputValue) => void,
): (eventText?: string) => void {
  return (eventText) => {
    const rawPaste = eventText || readClipboardText()
    if (!rawPaste) return
    const pasteText = Bun.stripANSI(rawPaste)
    if (!pasteText) return
    const { newText, newCursor } = insertTextAtCursor(
      text,
      cursorPosition,
      pasteText,
    )
    onChange({
      text: newText,
      cursorPosition: newCursor,
      lastEditDueToNav: false,
    })
  }
}

export function createPasteHandler(options: {
  text: string
  cursorPosition: number
  onChange: (value: InputValue) => void
  onPasteImage?: () => void
  onPasteImagePath?: (imagePath: string) => void
  onPasteFilePath?: (filePath: string, isDirectory: boolean) => void
  onPasteLongText?: (text: string) => void
  cwd?: string
}): (eventText?: string) => void {
  const {
    text,
    cursorPosition,
    onChange,
    onPasteImage,
    onPasteImagePath,
    onPasteFilePath,
    onPasteLongText,
    cwd,
  } = options
  return (eventText) => {
    if (eventText) {
      eventText = Bun.stripANSI(eventText)
    }

    if (eventText && onPasteImagePath) {
      const looksLikeImageFilename =
        isImageFile(eventText) &&
        !eventText.includes('/') &&
        !eventText.includes('\\')

      if (looksLikeImageFilename) {
        const clipboardFilePath = readClipboardImageFilePath()
        if (
          clipboardFilePath &&
          path.basename(clipboardFilePath) === eventText
        ) {
          onPasteImagePath(clipboardFilePath)
          return
        }
      }

      if (cwd) {
        const imagePath = getImageFilePathFromText(eventText, cwd)
        if (imagePath) {
          onPasteImagePath(imagePath)
          return
        }
      }
    }

    if (eventText && onPasteFilePath && cwd) {
      const fileInfo = getFileOrFolderPathFromText(eventText, cwd)
      if (fileInfo) {
        onPasteFilePath(fileInfo.path, fileInfo.isDirectory)
        return
      }
    }

    if (eventText) {
      if (onPasteLongText && eventText.length > LONG_TEXT_THRESHOLD) {
        onPasteLongText(eventText)
        return
      }

      const { newText, newCursor } = insertTextAtCursor(
        text,
        cursorPosition,
        eventText,
      )
      onChange({
        text: newText,
        cursorPosition: newCursor,
        lastEditDueToNav: false,
      })
      return
    }

    if (onPasteImagePath || onPasteFilePath) {
      const copiedFilePath = readClipboardFilePath()
      if (copiedFilePath) {
        if (isImageFile(copiedFilePath) && onPasteImagePath) {
          onPasteImagePath(copiedFilePath)
          return
        }
        if (!isImageFile(copiedFilePath) && onPasteFilePath) {
          try {
            const stats = statSync(copiedFilePath)
            onPasteFilePath(copiedFilePath, stats.isDirectory())
            return
          } catch {
          }
        }
      }
    }

    const rawClipboardText = readClipboardText()
    const clipboardText = rawClipboardText ? Bun.stripANSI(rawClipboardText) : null

    if (clipboardText && onPasteImagePath && cwd) {
      const imagePath = getImageFilePathFromText(clipboardText, cwd)
      if (imagePath) {
        onPasteImagePath(imagePath)
        return
      }
    }

    if (onPasteImage && hasClipboardImage()) {
      onPasteImage()
      return
    }

    if (!clipboardText) return

    if (onPasteLongText && clipboardText.length > LONG_TEXT_THRESHOLD) {
      onPasteLongText(clipboardText)
      return
    }

    const { newText, newCursor } = insertTextAtCursor(
      text,
      cursorPosition,
      clipboardText,
    )
    onChange({
      text: newText,
      cursorPosition: newCursor,
      lastEditDueToNav: false,
    })
  }
}
