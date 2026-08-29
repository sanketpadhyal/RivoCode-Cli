import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { isImageFile, resolveFilePath } from './image-handler'

export interface ClipboardImageResult {
  success: boolean
  imagePath?: string
  filename?: string
  error?: string
}

function getClipboardTempDir(): string {
  const tempDir = path.join(os.tmpdir(), 'codebuff-clipboard-images')
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

function generateImageFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `clipboard-${timestamp}.png`
}

function hasImageMacOS(): boolean {
  try {
    const result = spawnSync('osascript', [
      '-e',
      'clipboard info',
    ], { encoding: 'utf-8', timeout: 1000 })

    if (result.status !== 0) {
      return false
    }

    const output = result.stdout || ''

    return output.includes('«class PNGf»') ||
           output.includes('TIFF') ||
           output.includes('«class JPEG»') ||
           output.includes('public.png') ||
           output.includes('public.tiff') ||
           output.includes('public.jpeg')
  } catch {
    return false
  }
}

function readImageMacOS(): ClipboardImageResult {
  try {
    const tempDir = getClipboardTempDir()
    const filename = generateImageFilename()
    const imagePath = path.join(tempDir, filename)

    const pngpasteResult = spawnSync('pngpaste', [imagePath], {
      encoding: 'utf-8',
      timeout: 5000,
    })

    if (pngpasteResult.status === 0 && existsSync(imagePath)) {
      return { success: true, imagePath, filename }
    }

    const script = `
      set thePath to "${imagePath}"
      try
        set imageData to the clipboard as «class PNGf»
        set fileRef to open for access thePath with write permission
        write imageData to fileRef
        close access fileRef
        return "success"
      on error
        try
          set imageData to the clipboard as TIFF picture
          -- Convert TIFF to PNG using sips
          set tiffPath to "${imagePath}.tiff"
          set fileRef to open for access tiffPath with write permission
          write imageData to fileRef
          close access fileRef
          do shell script "sips -s format png " & quoted form of tiffPath & " --out " & quoted form of thePath
          do shell script "rm " & quoted form of tiffPath
          return "success"
        on error errMsg
          return "error: " & errMsg
        end try
      end try
    `

    const result = spawnSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (result.status === 0 && existsSync(imagePath)) {
      return { success: true, imagePath, filename }
    }

    return {
      success: false,
      error: result.stderr || 'Failed to read image from clipboard',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function hasImageLinux(): boolean {
  try {
    const result = spawnSync('xclip', [
      '-selection', 'clipboard',
      '-t', 'TARGETS',
      '-o',
    ], { encoding: 'utf-8', timeout: 5000 })

    if (result.status !== 0) {
      const wlResult = spawnSync('wl-paste', ['--list-types'], {
        encoding: 'utf-8',
        timeout: 5000,
      })
      if (wlResult.status === 0) {
        const output = wlResult.stdout || ''
        return output.includes('image/')
      }
      return false
    }

    const output = result.stdout || ''
    return output.includes('image/png') ||
           output.includes('image/jpeg') ||
           output.includes('image/tiff')
  } catch {
    return false
  }
}

function readImageLinux(): ClipboardImageResult {
  try {
    const tempDir = getClipboardTempDir()
    const filename = generateImageFilename()
    const imagePath = path.join(tempDir, filename)

    let result = spawnSync('xclip', [
      '-selection', 'clipboard',
      '-t', 'image/png',
      '-o',
    ], { timeout: 5000, maxBuffer: 50 * 1024 * 1024 })

    if (result.status === 0 && result.stdout && result.stdout.length > 0) {
      writeFileSync(imagePath, result.stdout)
      return { success: true, imagePath, filename }
    }

    result = spawnSync('wl-paste', ['--type', 'image/png'], {
      timeout: 5000,
      maxBuffer: 50 * 1024 * 1024,
    })

    if (result.status === 0 && result.stdout && result.stdout.length > 0) {
      writeFileSync(imagePath, result.stdout)
      return { success: true, imagePath, filename }
    }

    return {
      success: false,
      error: 'No image found in clipboard or failed to read',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function hasImageWindows(): boolean {
  try {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      if ([System.Windows.Forms.Clipboard]::ContainsImage()) { Write-Output "true" } else { Write-Output "false" }
    `
    const result = spawnSync('powershell', ['-STA', '-Command', script], {
      encoding: 'utf-8',
      timeout: 5000,
    })

    return result.stdout?.trim() === 'true'
  } catch {
    return false
  }
}

function readImageWindows(): ClipboardImageResult {
  try {
    const tempDir = getClipboardTempDir()
    const filename = generateImageFilename()
    const imagePath = path.join(tempDir, filename)

    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $img = [System.Windows.Forms.Clipboard]::GetImage()
      if ($img -ne $null) {
        $img.Save('${imagePath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "success"
      } else {
        Write-Output "no image"
      }
    `

    const result = spawnSync('powershell', ['-STA', '-Command', script], {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (result.stdout?.trim() === 'success' && existsSync(imagePath)) {
      return { success: true, imagePath, filename }
    }

    return {
      success: false,
      error: 'No image in clipboard or failed to save',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function hasClipboardImage(): boolean {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return hasImageMacOS()
    case 'linux':
      return hasImageLinux()
    case 'win32':
      return hasImageWindows()
    default:
      return false
  }
}

export function readClipboardImage(): ClipboardImageResult {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return readImageMacOS()
    case 'linux':
      return readImageLinux()
    case 'win32':
      return readImageWindows()
    default:
      return {
        success: false,
        error: `Unsupported platform: ${platform}`,
      }
  }
}

export function getFileOrFolderPathFromText(text: string, cwd: string): { path: string; isDirectory: boolean } | null {
  if (text.includes('\n') || text.includes('\r')) return null

  let trimmed = text.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('file://')) {
    trimmed = decodeURIComponent(trimmed.slice(7))
  }

  if (trimmed.includes('://')) return null

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1)
  }

  try {
    const resolvedPath = resolveFilePath(trimmed, cwd)
    if (!existsSync(resolvedPath)) return null
    if (isImageFile(resolvedPath)) return null

    const stats = statSync(resolvedPath)
    return {
      path: resolvedPath,
      isDirectory: stats.isDirectory(),
    }
  } catch {
    return null
  }
}

export function getImageFilePathFromText(text: string, cwd: string): string | null {
  if (text.includes('\n') || text.includes('\r')) return null

  let trimmed = text.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('file://')) {
    trimmed = decodeURIComponent(trimmed.slice(7))
  }

  if (trimmed.includes('://')) return null

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1)
  }

  try {
    const resolvedPath = resolveFilePath(trimmed, cwd)

    if (!existsSync(resolvedPath)) return null

    if (!isImageFile(resolvedPath)) return null

    return resolvedPath
  } catch {
    return null
  }
}

function readClipboardFilePathMacOS(): string | null {
  try {
    const infoResult = spawnSync('osascript', [
      '-e',
      'clipboard info',
    ], { encoding: 'utf-8', timeout: 1000 })

    if (infoResult.status !== 0) return null

    const info = infoResult.stdout || ''
    if (!info.includes('«class furl»') && !info.includes('public.file-url')) {
      return null
    }

    const script = `
      try
        set theFile to the clipboard as «class furl»
        return POSIX path of theFile
      on error
        return ""
      end try
    `

    const result = spawnSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      timeout: 1000,
    })

    if (result.status === 0 && result.stdout) {
      const filePath = result.stdout.trim()
      if (filePath && existsSync(filePath)) {
        return filePath
      }
    }
    return null
  } catch {
    return null
  }
}

function readClipboardFilePathWindows(): string | null {
  try {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
      if ($files.Count -gt 0) {
        Write-Output $files[0]
      }
    `
    const result = spawnSync('powershell', ['-STA', '-Command', script], {
      encoding: 'utf-8',
      timeout: 1000,
    })

    if (result.status === 0 && result.stdout) {
      const filePath = result.stdout.trim()
      if (filePath && existsSync(filePath)) {
        return filePath
      }
    }
    return null
  } catch {
    return null
  }
}

function readClipboardFilePathLinux(): string | null {
  try {
    let result = spawnSync('xclip', [
      '-selection', 'clipboard',
      '-t', 'text/uri-list',
      '-o',
    ], { encoding: 'utf-8', timeout: 1000 })

    if (result.status !== 0) {
      result = spawnSync('wl-paste', ['--type', 'text/uri-list'], {
        encoding: 'utf-8',
        timeout: 1000,
      })
    }

    if (result.status === 0 && result.stdout) {
      const output = result.stdout.trim()
      const lines = output.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('file://')) {
          const filePath = decodeURIComponent(trimmed.slice(7))
          if (existsSync(filePath)) {
            return filePath
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

export function readClipboardFilePath(): string | null {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return readClipboardFilePathMacOS()
    case 'win32':
      return readClipboardFilePathWindows()
    case 'linux':
      return readClipboardFilePathLinux()
    default:
      return null
  }
}

export function readClipboardImageFilePath(): string | null {
  const filePath = readClipboardFilePath()
  if (filePath && isImageFile(filePath)) {
    return filePath
  }
  return null
}

export function readClipboardText(): string | null {
  try {
    const platform = process.platform
    let result: ReturnType<typeof spawnSync>

    switch (platform) {
      case 'darwin':
        result = spawnSync('pbpaste', [], { encoding: 'utf-8', timeout: 1000 })
        break
      case 'win32':
        result = spawnSync('powershell', ['-Command', 'Get-Clipboard'], { encoding: 'utf-8', timeout: 1000 })
        break
      case 'linux':
        result = spawnSync('xclip', ['-selection', 'clipboard', '-o'], { encoding: 'utf-8', timeout: 1000 })
        break
      default:
        return null
    }

    if (result.status === 0 && result.stdout) {
      const output = typeof result.stdout === 'string' ? result.stdout : result.stdout.toString('utf-8')
      return output.replace(/\n+$/, '')
    }
    return null
  } catch {
    return null
  }
}
