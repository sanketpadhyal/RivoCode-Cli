import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const RIVO_BIN_DIR = path.join(os.homedir(), '.rivocode', 'bin')
const OCR_BINARY_PATH = path.join(RIVO_BIN_DIR, 'rivo-ocr')
const OCR_SWIFT_PATH = path.join(RIVO_BIN_DIR, 'ocr.swift')
const OCR_PS1_PATH = path.join(RIVO_BIN_DIR, 'ocr.ps1')

export const SWIFT_SOURCE = `import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: rivo-ocr <image_path>\\n", stderr)
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let imageURL = URL(fileURLWithPath: imagePath)

guard let image = NSImage(contentsOf: imageURL),
      let tiffData = image.tiffRepresentation,
      let bitmapImage = NSBitmapImageRep(data: tiffData),
      let cgImage = bitmapImage.cgImage else {
    fputs("Error: Unable to load image at \\(imagePath)\\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest { (request, error) in
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        return
    }
    let recognizedStrings = observations.compactMap { observation in
        observation.topCandidates(1).first?.string
    }
    print(recognizedStrings.joined(separator: "\\n"))
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try requestHandler.perform([request])
} catch {
    fputs("OCR Error: \\(error.localizedDescription)\\n", stderr)
    exit(1)
}
`

export const POWERSHELL_SOURCE = `param([string]$ImagePath)

if (-not $ImagePath -or -not (Test-Path $ImagePath)) {
    Write-Output "(Image file not found: $ImagePath)"
    exit 0
}

try {
    $resolvedPath = (Resolve-Path $ImagePath).Path
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
    [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null

    $storageFile = [Windows.Storage.StorageFile]::GetFileFromPathAsync($resolvedPath).GetAwaiter().GetResult()
    $stream = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
    $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
    $bitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
    }

    $result = $engine.RecognizeAsync($bitmap).GetAwaiter().GetResult()
    if ($result -and $result.Text) {
        Write-Output $result.Text
    } else {
        Write-Output "(No text detected in image)"
    }
} catch {
    Write-Output "(OCR Error: $($_.Exception.Message))"
}
`

export function ensureOcrBinaryExists(): string {
  try {
    const isWindows = process.platform === 'win32'
    const isMac = process.platform === 'darwin'
    const workspaceRivoDir = path.join(process.cwd(), '.rivocode')

    if (isWindows) {
      // Write to workspace .rivocode
      if (fs.existsSync(workspaceRivoDir)) {
        try {
          fs.writeFileSync(path.join(workspaceRivoDir, 'ocr.ps1'), POWERSHELL_SOURCE, 'utf-8')
        } catch (_wsErr) {}
      }
      fs.mkdirSync(RIVO_BIN_DIR, { recursive: true })
      fs.writeFileSync(OCR_PS1_PATH, POWERSHELL_SOURCE, 'utf-8')
      return `powershell -ExecutionPolicy Bypass -NoProfile -File "${OCR_PS1_PATH}"`
    }

    if (isMac) {
      if (fs.existsSync(workspaceRivoDir)) {
        try {
          fs.writeFileSync(path.join(workspaceRivoDir, 'ocr.swift'), SWIFT_SOURCE, 'utf-8')
        } catch (_wsErr) {}
      }

      if (fs.existsSync(OCR_BINARY_PATH)) {
        return OCR_BINARY_PATH
      }

      fs.mkdirSync(RIVO_BIN_DIR, { recursive: true })
      fs.writeFileSync(OCR_SWIFT_PATH, SWIFT_SOURCE, 'utf-8')

      try {
        execSync(`swiftc "${OCR_SWIFT_PATH}" -o "${OCR_BINARY_PATH}" -O`, {
          timeout: 20000,
          stdio: 'ignore',
        })
        fs.chmodSync(OCR_BINARY_PATH, 0o755)
        return OCR_BINARY_PATH
      } catch (_compErr) {
        return `swift "${OCR_SWIFT_PATH}"`
      }
    }
  } catch (_err) {}
  return OCR_BINARY_PATH
}

export function performNativeOcr(imagePath: string): string {
  try {
    if (!fs.existsSync(imagePath)) {
      return '(Image file not found)'
    }

    const ocrCmd = ensureOcrBinaryExists()
    const output = execSync(`${ocrCmd} "${imagePath}"`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return output.trim() || '(No text detected in image)'
  } catch (err: any) {
    if (process.platform === 'darwin' && fs.existsSync(OCR_SWIFT_PATH)) {
      try {
        const directOutput = execSync(`swift "${OCR_SWIFT_PATH}" "${imagePath}"`, {
          encoding: 'utf-8',
          timeout: 15000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        return directOutput.trim() || '(No text detected in image)'
      } catch (_e) {}
    }
    return `(OCR error: ${err.message || String(err)})`
  }
}
