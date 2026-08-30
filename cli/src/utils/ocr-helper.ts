import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const RIVO_BIN_DIR = path.join(os.homedir(), '.rivocode', 'bin')
const OCR_BINARY_PATH = path.join(RIVO_BIN_DIR, 'rivo-ocr')
const OCR_SWIFT_PATH = path.join(RIVO_BIN_DIR, 'ocr.swift')

const SWIFT_SOURCE = `import Foundation
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

export function ensureOcrBinaryExists(): string {
  try {
    // Also write to current workspace .rivocode folder so user can inspect it
    try {
      const workspaceRivoDir = path.join(process.cwd(), '.rivocode')
      if (fs.existsSync(workspaceRivoDir)) {
        fs.writeFileSync(path.join(workspaceRivoDir, 'ocr.swift'), SWIFT_SOURCE, 'utf-8')
      }
    } catch (_wsErr) {}

    if (fs.existsSync(OCR_BINARY_PATH)) {
      return OCR_BINARY_PATH
    }

    fs.mkdirSync(RIVO_BIN_DIR, { recursive: true })
    fs.writeFileSync(OCR_SWIFT_PATH, SWIFT_SOURCE, 'utf-8')

    if (process.platform === 'darwin') {
      try {
        execSync(`swiftc "${OCR_SWIFT_PATH}" -o "${OCR_BINARY_PATH}" -O`, {
          timeout: 20000,
          stdio: 'ignore',
        })
        fs.chmodSync(OCR_BINARY_PATH, 0o755)
        return OCR_BINARY_PATH
      } catch (_compErr) {
        // Fall back to running swift directly
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
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return output.trim() || '(No text detected in image)'
  } catch (err: any) {
    // If swift binary failed, try running swift directly
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
