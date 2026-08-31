import fs from 'fs'
import path from 'path'

export interface ProjectSettingsData {
  model?: string
  agentMode?: string
  theme?: string
  version?: string
  allowedFiles?: string[]
  allowedCommands?: string[]
}

export interface ProjectKeysData {
  groq_api_key?: string
  openrouter_api_key?: string
  deepseek_api_key?: string
}

export interface ProjectContextData {
  workName: string
  projectPath: string
  createdAt: string
  lastActive: string
  sessionCount: number
  lastModel?: string
  lastAgentMode?: string
}

export interface WorkspaceInitResult {
  isReturningWork: boolean
  context: ProjectContextData
  settings: ProjectSettingsData
}

export function getProjectRivocodeDir(projectRoot: string): string {
  return path.join(projectRoot, '.rivocode')
}

export function initProjectWorkspace(projectRoot: string): WorkspaceInitResult {
  const rivoDir = getProjectRivocodeDir(projectRoot)
  const contextFile = path.join(rivoDir, 'context.json')
  const settingsFile = path.join(rivoDir, 'settings.json')
  const keysFile = path.join(rivoDir, 'keys.json')

  const isReturningWork = fs.existsSync(contextFile)

  if (!fs.existsSync(rivoDir)) {
    fs.mkdirSync(rivoDir, { recursive: true })
  }

  // 1. Context File
  let context: ProjectContextData
  const workName = path.basename(projectRoot) || 'workspace'

  if (isReturningWork) {
    try {
      const raw = fs.readFileSync(contextFile, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ProjectContextData>
      context = {
        workName: parsed.workName || workName,
        projectPath: projectRoot,
        createdAt: parsed.createdAt || new Date().toISOString(),
        lastActive: parsed.lastActive || new Date().toISOString(),
        sessionCount: (parsed.sessionCount || 1) + 1,
        lastModel: parsed.lastModel || 'deepseek',
        lastAgentMode: parsed.lastAgentMode || 'DEFAULT',
      }
    } catch {
      context = {
        workName,
        projectPath: projectRoot,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        sessionCount: 1,
        lastModel: 'deepseek',
        lastAgentMode: 'DEFAULT',
      }
    }
  } else {
    context = {
      workName,
      projectPath: projectRoot,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      sessionCount: 1,
      lastModel: 'gemini-3.6-flash',
      lastAgentMode: 'DEFAULT',
    }
  }

  fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf8')

  // 2. Settings File
  let settings: ProjectSettingsData = {
    model: 'gemini-3.6-flash',
    agentMode: 'DEFAULT',
    theme: 'dark',
  }

  if (fs.existsSync(settingsFile)) {
    try {
      const raw = fs.readFileSync(settingsFile, 'utf8')
      settings = { ...settings, ...JSON.parse(raw) }
    } catch {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
    }
  } else {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
  }

  // 3. Keys File (Template or linked keys)
  if (!fs.existsSync(keysFile)) {
    const keysTemplate: ProjectKeysData = {
      groq_api_key: process.env.GROQ_API_KEY || '',
      openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
      deepseek_api_key: process.env.DEEPSEEK_API_KEY || '',
    }
    fs.writeFileSync(keysFile, JSON.stringify(keysTemplate, null, 2), 'utf8')
  }

  // 4. Native Vision OCR Script
  const ocrSwiftFile = path.join(rivoDir, 'ocr.swift')
  if (!fs.existsSync(ocrSwiftFile)) {
    const swiftSource = `import Foundation
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
    try {
      fs.writeFileSync(ocrSwiftFile, swiftSource, 'utf8')
    } catch {}
  }

  // 5. Native Web Reader & Token-Optimized Markdown Extractor
  const webJsFile = path.join(rivoDir, 'web.js')
  if (!fs.existsSync(webJsFile)) {
    const webSource = `// RivoCode Native Web Access & Token-Optimized Markdown Extractor
const https = require('https');
const http = require('http');

function htmlToMarkdown(html) {
  if (!html) return '';
  return html
    .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
    .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, '')
    .replace(/<svg\\b[^<]*(?:(?!<\\/svg>)<[^<]*)*<\\/svg>/gi, '')
    .replace(/<noscript\\b[^<]*(?:(?!<\\/noscript>)<[^<]*)*<\\/noscript>/gi, '')
    .replace(/<nav\\b[^<]*(?:(?!<\\/nav>)<[^<]*)*<\\/nav>/gi, '')
    .replace(/<footer\\b[^<]*(?:(?!<\\/footer>)<[^<]*)*<\\/footer>/gi, '')
    .replace(/<header\\b[^<]*(?:(?!<\\/header>)<[^<]*)*<\\/header>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\\/h1>/gi, '\\n# $1\\n')
    .replace(/<h2[^>]*>(.*?)<\\/h2>/gi, '\\n## $1\\n')
    .replace(/<h3[^>]*>(.*?)<\\/h3>/gi, '\\n### $1\\n')
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\\/code><\\/pre>/gis, '\\n\`\`\`\\n$1\\n\`\`\`\\n')
    .replace(/<code[^>]*>(.*?)<\\/code>/gi, '\`$1\`')
    .replace(/<a\\s+(?:[^>]*?\\s+)?href="([^"]*)"[^>]*>(.*?)<\\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\\/li>/gi, '\\n* $1')
    .replace(/<p[^>]*>(.*?)<\\/p>/gi, '\\n$1\\n')
    .replace(/<br\\s*\\/?>/gi, '\\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();
}

async function fetchUrl(targetUrl) {
  return new Promise((resolve) => {
    try {
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 RivoCode/1.0' },
        timeout: 12000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; if (data.length > 500000) res.destroy(); });
        res.on('end', () => resolve(htmlToMarkdown(data)));
      }).on('error', (e) => resolve(\`[Fetch error: \${e.message}]\`));
    } catch (e) { resolve(\`[URL error: \${e.message}]\`); }
  });
}

if (require.main === module) {
  const url = process.argv[2];
  if (url) fetchUrl(url).then(console.log);
}

module.exports = { htmlToMarkdown, fetchUrl };
`
    try {
      fs.writeFileSync(webJsFile, webSource, 'utf8')
    } catch {}
  }

  // 6. Texts File (.rivocode/texts.json) for chat persistence
  const textsFile = path.join(rivoDir, 'texts.json')
  if (!fs.existsSync(textsFile)) {
    try {
      fs.writeFileSync(textsFile, JSON.stringify([], null, 2), 'utf8')
    } catch {}
  }

  return {
    isReturningWork,
    context,
    settings,
  }
}

export function saveChatTexts(projectRoot: string, messages: any[]): void {
  try {
    const rivoDir = getProjectRivocodeDir(projectRoot)
    if (!fs.existsSync(rivoDir)) {
      fs.mkdirSync(rivoDir, { recursive: true })
    }
    const textsFile = path.join(rivoDir, 'texts.json')
    fs.writeFileSync(textsFile, JSON.stringify(messages, null, 2), 'utf8')
  } catch (_e) {}
}

export function loadChatTexts(projectRoot: string): any[] | null {
  try {
    const rivoDir = getProjectRivocodeDir(projectRoot)
    const textsFile = path.join(rivoDir, 'texts.json')
    if (fs.existsSync(textsFile)) {
      const raw = fs.readFileSync(textsFile, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (_e) {}
  return null
}

export function clearChatTexts(projectRoot: string): void {
  try {
    const rivoDir = getProjectRivocodeDir(projectRoot)
    const textsFile = path.join(rivoDir, 'texts.json')
    fs.writeFileSync(textsFile, JSON.stringify([], null, 2), 'utf8')
  } catch (_e) {}
}

export function updateProjectSettings(
  projectRoot: string,
  updates: Partial<ProjectSettingsData>,
): void {
  try {
    const rivoDir = getProjectRivocodeDir(projectRoot)
    const settingsFile = path.join(rivoDir, 'settings.json')
    let current: ProjectSettingsData = {}
    if (fs.existsSync(settingsFile)) {
      try {
        current = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
      } catch {}
    }
    const updated = { ...current, ...updates }
    fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2), 'utf8')
  } catch (_e) {}
}

export function updateProjectContext(
  projectRoot: string,
  updates: Partial<ProjectContextData>,
): void {
  try {
    const rivoDir = getProjectRivocodeDir(projectRoot)
    const contextFile = path.join(rivoDir, 'context.json')
    if (fs.existsSync(contextFile)) {
      const raw = fs.readFileSync(contextFile, 'utf8')
      const current = JSON.parse(raw) as ProjectContextData
      const updated = {
        ...current,
        ...updates,
        lastActive: new Date().toISOString(),
      }
      fs.writeFileSync(contextFile, JSON.stringify(updated, null, 2), 'utf8')
    }
  } catch {
    // Ignore context update error
  }
}
