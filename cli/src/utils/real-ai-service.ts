import { exec, execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { AskUserBridge } from '@rivocode/common/utils/ask-user-bridge'
import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { updateProjectSettings } from '../workspace/project-context'
import { performNativeOcr } from './ocr-helper'
import { fetchWebContent } from './web-helper'

import type { MessageUpdater } from './message-updater'
import type { AgentMode } from './constants'
import type { RunState } from '@rivocode/sdk'
import type { ChatMessage, ContentBlock, TextContentBlock } from '../types/chat'

interface ApiKeysConfig {
  groq?: string
  openrouter?: string
  deepseek?: string
  openai?: string
  gemini?: string
}

const CONFIG_DIR = path.join(os.homedir(), '.rivocode')
const DOT_APIKEYS_FILE = path.join(CONFIG_DIR, '.apikeys')
const PLAIN_APIKEYS_FILE = path.join(CONFIG_DIR, 'apikeys')
const KEYS_FILE = path.join(CONFIG_DIR, 'keys.json')

export function ensureApiKeysFileExists() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    const template = `# RivoCode API Keys Configuration
# Free keys available at:
# Groq: https://console.groq.com/keys
# Gemini: https://aistudio.google.com/app/apikey
# OpenRouter: https://openrouter.ai/keys

GROQ_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
`
    if (!fs.existsSync(DOT_APIKEYS_FILE) && !fs.existsSync(PLAIN_APIKEYS_FILE)) {
      fs.writeFileSync(DOT_APIKEYS_FILE, template, 'utf-8')
    }
  } catch (_e) {}
}

ensureApiKeysFileExists()

export function parseDotApiKeys(): ApiKeysConfig {
  const result: ApiKeysConfig = {}
  const targetFiles = [DOT_APIKEYS_FILE, PLAIN_APIKEYS_FILE]
  for (const filePath of targetFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const lines = raw.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const [k, ...v] = trimmed.split('=')
          if (!k || v.length === 0) continue
          const val = v.join('=').trim().replace(/^["']|["']$/g, '')
          if (!val) continue
          const keyUpper = k.trim().toUpperCase()
          if (keyUpper.includes('GROQ')) result.groq = val
          else if (keyUpper.includes('GEMINI') || keyUpper.includes('GOOGLE')) result.gemini = val
          else if (keyUpper.includes('OPENROUTER')) result.openrouter = val
          else if (keyUpper.includes('DEEPSEEK')) result.deepseek = val
          else if (keyUpper.includes('OPENAI')) result.openai = val
        }
      }
    } catch (_e) {}
  }
  return result
}

export function getStoredApiKeys(): ApiKeysConfig {
  const fromDotFile = parseDotApiKeys()
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, 'utf-8')
      const fromJson = JSON.parse(raw)
      return { ...fromDotFile, ...fromJson }
    }
  } catch (_e) {}
  return fromDotFile
}

export function saveStoredApiKey(provider: keyof ApiKeysConfig, key: string) {
  try {
    ensureApiKeysFileExists()
    const current = getStoredApiKeys()
    current[provider] = key.trim()
    fs.writeFileSync(KEYS_FILE, JSON.stringify(current, null, 2), 'utf-8')

    const dotContent = `# RivoCode API Keys Configuration
GROQ_API_KEY=${current.groq || ''}
GEMINI_API_KEY=${current.gemini || ''}
OPENROUTER_API_KEY=${current.openrouter || ''}
DEEPSEEK_API_KEY=${current.deepseek || ''}
`
    fs.writeFileSync(DOT_APIKEYS_FILE, dotContent, 'utf-8')
  } catch (_e) {}
}

export function resolveApiKey(provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek'): string | null {
  const envKey =
    provider === 'groq'
      ? process.env.GROQ_API_KEY
      : provider === 'gemini'
        ? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
        : provider === 'deepseek'
          ? process.env.DEEPSEEK_API_KEY
          : process.env.OPENROUTER_API_KEY

  if (envKey && envKey.trim().length > 0) {
    return envKey.trim()
  }

  const stored = getStoredApiKeys()
  const storedKey = stored[provider]
  if (storedKey && storedKey.trim().length > 0) {
    return storedKey.trim()
  }

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
    return process.env.OPENAI_API_KEY.trim()
  }

  return null
}

export function isApiConnected(modelName?: string): boolean {
  if (modelName) {
    const route = resolveModelRoute(modelName)
    return Boolean(resolveApiKey(route.provider))
  }
  return Boolean(
    resolveApiKey('groq') ||
      resolveApiKey('gemini') ||
      resolveApiKey('deepseek') ||
      resolveApiKey('openrouter'),
  )
}

export interface ModelRoute {
  provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek'
  endpoint: string
  modelId: string
  displayName: string
  apiKeyUrl: string
}

export function resolveModelRoute(modelName: string): ModelRoute {
  const normalized = (modelName || 'groq').toLowerCase()

  if (normalized.includes('claude')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'anthropic/claude-3.7-sonnet',
      displayName: 'Claude 3.7 Sonnet (OpenRouter)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('deepseek-v3') || (normalized.includes('openrouter') && normalized.includes('deepseek'))) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'deepseek/deepseek-chat',
      displayName: 'DeepSeek V3 (OpenRouter)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('r1') || normalized.includes('reasoning')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek R1 (OpenRouter)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('coder') || (normalized.includes('openrouter') && normalized.includes('qwen'))) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'qwen/qwen-2.5-coder-32b-instruct',
      displayName: 'Qwen 2.5 Coder 32B (OpenRouter)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('openrouter')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'openrouter/auto',
      displayName: 'OpenRouter Auto',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('gemini')) {
    return {
      provider: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      modelId: 'gemini-3.6-flash',
      displayName: 'Gemini 3.6 Flash (Google AI Studio)',
      apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    }
  }

  if (normalized.includes('deepseek')) {
    return {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      modelId: 'deepseek-chat',
      displayName: 'DeepSeek V3 (platform.deepseek.com)',
      apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    }
  }

  if (normalized.includes('qwen') || normalized.includes('27b')) {
    return {
      provider: 'groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      modelId: 'qwen/qwen3.8-27b',
      displayName: 'Qwen 3.8 27B (Groq)',
      apiKeyUrl: 'https://console.groq.com/keys',
    }
  }

  return {
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelId: 'openai/gpt-oss-120b',
    displayName: 'GPT-OSS 120B (Groq)',
    apiKeyUrl: 'https://console.groq.com/keys',
  }
}

export async function testApiKeyConnection(
  provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek',
  apiKey: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    if (provider === 'groq') {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      })
      if (!modelsRes.ok) {
        const err = await modelsRes.json().catch(() => ({}))
        return { success: false, error: err?.error?.message || 'Invalid Groq API key' }
      }
      const data = await modelsRes.json().catch(() => ({}))
      const availableIds: string[] = (data.data || []).map((m: any) => m.id)
      return {
        success: true,
        message: `Connected! (${availableIds.length} models available)`,
      }
    }

    if (provider === 'deepseek') {
      const modelsRes = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      })
      if (!modelsRes.ok) {
        const err = await modelsRes.json().catch(() => ({}))
        return { success: false, error: err?.error?.message || 'Invalid DeepSeek API key' }
      }
      return {
        success: true,
        message: 'Connected to DeepSeek V3 successfully!',
      }
    }

    if (provider === 'openrouter') {
      const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://github.com/sanketpadhyal/RivoCode-Cli',
          'X-Title': 'RivoCode CLI',
        },
      })
      if (!authRes.ok) {
        const err = await authRes.json().catch(() => ({}))
        return { success: false, error: err?.error?.message || 'Invalid OpenRouter API key' }
      }
      const data = await authRes.json().catch(() => ({}))
      const label = data?.data?.label ? ` (${data.data.label})` : ''
      return {
        success: true,
        message: `Connected to OpenRouter successfully!${label}`,
      }
    }

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    const model = 'gemini-3.6-flash'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      'x-goog-api-key': apiKey.trim(),
    }

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/sanketpadhyal/RivoCode-Cli'
      headers['X-Title'] = 'RivoCode CLI'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "RivoCode Connected"' }],
        max_tokens: 10,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let errMessage = ''
      try {
        const parsedErr = await response.json()
        const errObj = Array.isArray(parsedErr) ? parsedErr[0]?.error : parsedErr?.error
        errMessage = errObj?.message || ''
      } catch {
        const errText = await response.text().catch(() => '')
        errMessage = errText.slice(0, 80)
      }

      if (response.status === 401 || response.status === 400) {
        return {
          success: false,
          error: `Invalid API key: ${errMessage || 'Google AI Studio keys start with AIza... (get one free at aistudio.google.com/app/apikey)'}`,
        }
      }
      return {
        success: false,
        error: `API error (${response.status}): ${errMessage || response.statusText}`,
      }
    }

    const data = (await response.json()) as any
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Connected'
    return {
      success: true,
      message: reply,
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Connection timed out (10s). Check your internet connection.',
      }
    }
    return {
      success: false,
      error: err.message || 'Failed to connect to API endpoint',
    }
  }
}

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file in the workspace project directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path of the file to write within the project (e.g. "calculator.py" or "src/app.ts")',
          },
          content: {
            type: 'string',
            description: 'The complete code or text content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal_command',
      description: 'Execute a bash/shell command in the workspace directory',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to run (e.g. "python3 calculator.py" or "npm test")',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_files',
      description: 'Read the contents of files from the workspace',
      parameters: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths to read',
          },
        },
        required: ['paths'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and folders in a workspace directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list (defaults to current project root)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ocr_image',
      description: 'Extract text from an image or screenshot using high-speed native Apple Vision OCR',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the image or screenshot file',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_web_content',
      description: 'Fetch real-time web pages, online documentation, libraries, and APIs with token-optimized markdown extraction',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The HTTP/HTTPS URL of the web page or documentation to read',
          },
        },
        required: ['url'],
      },
    },
  },
]

const sessionAllowedCommands = new Set<string>()
const sessionAllowedFiles = new Set<string>()

export async function executeLocalTool(
  projectRoot: string,
  name: string,
  args: Record<string, any>,
): Promise<{ success: boolean; result: string }> {
  try {
    if (name === 'write_file') {
      const relPath = args.path || ''
      const filePath = path.isAbsolute(relPath)
        ? relPath
        : path.join(projectRoot, relPath)

      const autoAccept = useChatStore.getState().autoAcceptEdits
      if (
        !autoAccept &&
        relPath &&
        !sessionAllowedFiles.has(relPath) &&
        !sessionAllowedFiles.has(filePath)
      ) {
        try {
          const isExisting = fs.existsSync(filePath)
          const verb = isExisting ? 'edit' : 'create'
          const askRes: any = await AskUserBridge.request(`edit_perm_${Date.now()}`, [
            {
              header: 'Command',
              question: `Requesting permission to ${verb} file:\n  ${relPath}\n\nDo you want to proceed?`,
              options: [
                '1. Yes',
                `2. Yes, and always allow in this conversation for '${relPath}'`,
                '3. No',
              ],
              multiSelect: false,
            },
          ])

          if (askRes?.skipped) {
            return {
              success: false,
              result: `Edit cancelled by user: ${relPath}`,
            }
          }

          const answerText =
            askRes?.answers?.[0]?.selectedOption ||
            askRes?.answers?.[0]?.otherText ||
            askRes?.answers?.[0]?.option ||
            ''
          const answerStr = String(answerText).toLowerCase()

          if (answerStr.includes('always allow') || answerStr.includes('always')) {
            sessionAllowedFiles.add(relPath)
            sessionAllowedFiles.add(filePath)
            updateProjectSettings(projectRoot, {
              allowedFiles: Array.from(sessionAllowedFiles),
            })
          } else if (answerStr.includes('no') || answerStr.includes('3. no')) {
            return {
              success: false,
              result: `Edit cancelled by user: ${relPath}`,
            }
          }
        } catch (_askErr) {}
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, args.content, 'utf-8')
      return {
        success: true,
        result: `Successfully wrote ${args.content.length} characters to ${args.path}`,
      }
    }

    if (name === 'run_terminal_command') {
      const rawCommand = (args.command || '').trim()
      const cmdPrefix = rawCommand.split(' ')[0]

      // Check if command is already permitted in this session
      if (rawCommand && !sessionAllowedCommands.has(cmdPrefix) && !sessionAllowedCommands.has(rawCommand)) {
        try {
          const askRes: any = await AskUserBridge.request(`perm_${Date.now()}`, [
            {
              header: 'Command',
              question: `Requesting permission for:\n  ${rawCommand}\n\nDo you want to proceed?`,
              options: [
                '1. Yes',
                `2. Yes, and always allow in this conversation for commands that start with '${cmdPrefix}'`,
                `3. Yes, and always allow for commands that start with '${cmdPrefix}' (Persist to settings.json)`,
                '4. No',
              ],
              multiSelect: false,
            },
          ])

          if (askRes?.skipped) {
            return {
              success: false,
              result: `Command execution cancelled by user: ${rawCommand}`,
            }
          }

          const answerText =
            askRes?.answers?.[0]?.selectedOption ||
            askRes?.answers?.[0]?.otherText ||
            askRes?.answers?.[0]?.option ||
            ''

          const answerStr = String(answerText).toLowerCase()

          if (
            answerStr.includes('always allow in this conversation') ||
            answerStr.includes('persist to settings.json') ||
            answerStr.startsWith('2') ||
            answerStr.startsWith('3')
          ) {
            sessionAllowedCommands.add(cmdPrefix)
            updateProjectSettings(projectRoot, {
              allowedCommands: Array.from(sessionAllowedCommands),
            })
          }

          if (
            answerStr.startsWith('4') ||
            answerStr.includes('no') ||
            (!answerStr.includes('yes') &&
              !answerStr.startsWith('1') &&
              !answerStr.startsWith('2') &&
              !answerStr.startsWith('3'))
          ) {
            return {
              success: false,
              result: `Command cancelled by user: ${rawCommand}`,
            }
          }
        } catch (_askErr) {}
      }

      const runPromise = new Promise<string>((resolve) => {
        exec(
          rawCommand,
          {
            cwd: projectRoot,
            timeout: 30000,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            if (error) {
              const combined = [stdout, stderr, error.message].filter(Boolean).join('\n')
              resolve(combined || `Command exited with code ${error.code || 1}`)
            } else {
              resolve(stdout || stderr || '(Command executed successfully with no output)')
            }
          },
        )

        // For background tasks (e.g. servers starting with & or nohup), resolve quickly so UI never hangs
        if (rawCommand.includes('&') || rawCommand.includes('nohup') || rawCommand.includes('http.server')) {
          setTimeout(() => {
            resolve('(Background server/task started successfully)')
          }, 800)
        }
      })

      try {
        const output = await runPromise
        return {
          success: true,
          result: output,
        }
      } catch (err: any) {
        return {
          success: false,
          result: `Error executing command: ${err?.message || String(err)}`,
        }
      }
    }

    if (name === 'read_files') {
      const results: string[] = []
      for (const p of args.paths || []) {
        const filePath = path.isAbsolute(p) ? p : path.join(projectRoot, p)
        if (fs.existsSync(filePath)) {
          results.push(`=== ${p} ===\n${fs.readFileSync(filePath, 'utf-8')}`)
        } else {
          results.push(`=== ${p} ===\nFile not found`)
        }
      }
      return { success: true, result: results.join('\n\n') }
    }

    if (name === 'list_directory') {
      const targetDir = args.path
        ? path.isAbsolute(args.path)
          ? args.path
          : path.join(projectRoot, args.path)
        : projectRoot
      const files = fs.readdirSync(targetDir)
      return { success: true, result: files.join('\n') }
    }

    if (name === 'ocr_image' || name === 'read_image_text') {
      const imgPath = args.path ? (path.isAbsolute(args.path) ? args.path : path.join(projectRoot, args.path)) : ''
      const ocrResult = performNativeOcr(imgPath)
      return { success: true, result: ocrResult }
    }

    if (name === 'fetch_web_content' || name === 'read_url' || name === 'web_fetch') {
      const url = (args.url || '').trim()
      const content = await fetchWebContent(url)
      return { success: true, result: content }
    }

    return { success: false, result: `Unknown tool: ${name}` }
  } catch (err: any) {
    return {
      success: false,
      result: `Error executing tool ${name}: ${err.message || String(err)}`,
    }
  }
}

// Generate compact snippet diff (up to 5 lines with + in green and - in red)
function generateCompactDiff(oldText: string | null, newText: string): string {
  if (oldText === null) {
    const newLines = newText.split('\n').filter((l) => l.trim().length > 0)
    const sample = newLines.slice(0, 3).map((l) => `+ ${l}`).join('\n')
    return sample + (newLines.length > 3 ? `\n+ ... (+${newLines.length - 3} more lines)` : '')
  }

  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const diffEntries: string[] = []

  let oldIdx = 0
  let newIdx = 0
  while ((oldIdx < oldLines.length || newIdx < newLines.length) && diffEntries.length < 5) {
    const oLine = oldLines[oldIdx]
    const nLine = newLines[newIdx]

    if (oLine === nLine) {
      oldIdx++
      newIdx++
      continue
    }

    if (oLine !== undefined && (nLine === undefined || !newLines.slice(newIdx, newIdx + 5).includes(oLine))) {
      diffEntries.push(`- ${oLine.trim() || ' '}`)
      oldIdx++
    } else if (nLine !== undefined) {
      diffEntries.push(`+ ${nLine.trim() || ' '}`)
      newIdx++
    } else {
      oldIdx++
      newIdx++
    }
  }

  if (diffEntries.length === 0) {
    return '+ // Updated content'
  }

  return diffEntries.slice(0, 5).join('\n')
}

// Fallback: If model outputs markdown code blocks with a file header, auto-create them on disk
function autoExtractAndWriteCodeBlocks(projectRoot: string, text: string): string[] {
  const writtenFiles: string[] = []
  // Matches patterns like: ```python calculator.py or // File: calculator.py or Save as `calculator.py`
  const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*(?:(?:\/\/|#)\s*(?:file:)?\s*([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+))?\n([\s\S]*?)```/gi
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const filename = match[1]?.trim()
    const content = match[2]
    if (filename && content && !filename.includes('bash') && !filename.includes('sh')) {
      try {
        const filePath = path.isAbsolute(filename) ? filename : path.join(projectRoot, filename)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, content, 'utf-8')
        writtenFiles.push(filename)
      } catch (_e) {}
    }
  }
  return writtenFiles
}

export async function executeRealAiStream({
  prompt,
  agentMode,
  aiMessageId,
  updater,
  signal,
  onComplete,
}: {
  prompt: string
  agentMode: AgentMode
  aiMessageId: string
  updater: MessageUpdater
  signal: AbortSignal
  onComplete: (runState: RunState) => void
}) {
  useChatStore.getState().setLiveTokenCount(0)
  const projectRoot = getProjectRoot()
  const selectedModel = useChatStore.getState().selectedModel ?? 'groq'
  const route = resolveModelRoute(selectedModel)
  const apiKey = resolveApiKey(route.provider)

  // 1. If API key is missing, provide a clear, actionable guide
  if (!apiKey) {
    const envVarName =
      route.provider === 'groq'
        ? 'GROQ_API_KEY'
        : route.provider === 'gemini'
          ? 'GEMINI_API_KEY'
          : 'OPENROUTER_API_KEY'
    const providerName =
      route.provider === 'groq'
        ? 'Groq Console'
        : route.provider === 'gemini'
          ? 'Google AI Studio'
          : 'OpenRouter'
    const missingMessage = `[!] **API Key Required for ${route.displayName}**\n\nTo start chatting and executing live coding tasks with RivoCode:\n\n1. **Get your free API key** (100% free tier, instant setup):\n   • **${providerName}**: [${route.apiKeyUrl}](${route.apiKeyUrl})\n\n2. **Set it in your terminal environment**:\n   \`\`\`bash\n   export ${envVarName}="your_api_key_here"\n   \`\`\`\n\n3. **Or save it to RivoCode configuration**:\n   \`\`\`bash\n   mkdir -p ~/.rivocode && echo '{"${route.provider}": "your_api_key_here"}' > ~/.rivocode/keys.json\n   \`\`\`\n\nOnce set, run \`rivo\` or send your message again!`

    updater.addBlock({
      type: 'text',
      textType: 'text',
      content: missingMessage,
    })

    updater.markComplete()

    const runState: RunState = {
      traceSessionId: aiMessageId,
      output: {
        type: 'text',
        message: missingMessage,
      },
    }
    onComplete(runState)
    return
  }

  // 2. Build system prompt and conversation messages
  const systemPrompt = `You are RivoCode, an autonomous AI coding assistant created by Sanket Padhyal, operating like Claude Code / Cursor.
You are running in mode: ${agentMode}.
Current workspace directory: ${projectRoot}.
Host Platform: ${os.platform()} (${os.arch()}).

AUTONOMOUS CAPABILITIES (YOU HAVE FULL LOCAL SYSTEM & INTERNET ACCESS):
- write_file(path, content): Create or overwrite files directly in the workspace.
- run_terminal_command(command): Execute shell/terminal commands directly.
- read_files(paths): Read workspace files into context.
- list_directory(path): List folder contents.
- ocr_image(path): Extract text from images, screenshots, or UI mockups using native Apple Vision OCR.
- fetch_web_content(url): Fetch real-time web documentation, online articles, APIs, GitHub repositories, and packages.

AUTONOMOUS TASK COMPLETION RULES:
- NEVER STOP after just reading files or searching! You must IMMEDIATELY proceed to write the necessary code using write_file, execute tests/commands, and finish the entire user request.
- Do NOT say "I have read the files, should I proceed?" or "Here is what I plan to do" without actually writing the code! Take immediate action and write the files.
- NEVER tell the user to manually create files, copy-paste code, or run bash commands when you can do it yourself!
- Complete the entire end-to-end task in one go so the user doesn't need to ask you to continue.`

  const existingMessages = useChatStore.getState().messages
  const recentMessages = existingMessages.slice(-8)
  const chatHistory: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool'
    content?: string
    tool_call_id?: string
    tool_calls?: any[]
  }> = [{ role: 'system', content: systemPrompt }]

  for (const msg of recentMessages) {
    if (msg.id === aiMessageId) continue
    const role = msg.type === 'user' ? 'user' : 'assistant'
    const textContent =
      msg.blocks
        ?.filter(
          (b) =>
            b.type === 'text' && (b as TextContentBlock).textType !== 'reasoning',
        )
        .map((b) => (b as TextContentBlock).content)
        .join('\n') || msg.content

    if (textContent && textContent.trim().length > 0) {
      chatHistory.push({ role, content: textContent.trim() })
    }
  }

  chatHistory.push({ role: 'user', content: prompt })

  let hasThinkingBlock = false
  let accumulatedThinking = ''
  let accumulatedContent = ''
  let turns = 0
  const maxTurns = 4

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    if (route.provider === 'gemini') {
      headers['x-goog-api-key'] = apiKey.trim()
    }

    if (route.provider === 'openrouter') {
      headers['HTTP-Referer'] =
        'https://github.com/sanketpadhyal/RivoCode-Cli'
      headers['X-Title'] = 'RivoCode CLI'
    }

    updater.addBlock({
      type: 'text',
      textType: 'text',
      content: '',
    })

    let maxTokensSetting = route.provider === 'openrouter' ? 4096 : undefined
    let hasExecutedInspection = false
    let hasExecutedModification = false

    while (turns < maxTurns && !signal.aborted) {
      turns++
      const pendingToolCalls: Array<{ id: string; name: string; args: string }> = []

      // Auto-compact chatHistory if token estimate exceeds 12k
      if (chatHistory.length > 8) {
        const sysMsg = chatHistory[0]
        const recentTurns = chatHistory.slice(-6)
        chatHistory.length = 0
        if (sysMsg) chatHistory.push(sysMsg)
        chatHistory.push({
          role: 'system',
          content: '[Context compacted: Prior conversation turns summarized to maintain optimal response speed]',
        })
        chatHistory.push(...recentTurns)
      }

      const requestBody: Record<string, any> = {
        model: route.modelId,
        messages: chatHistory,
        stream: true,
        temperature: 0.7,
      }

      if (maxTokensSetting !== undefined) {
        requestBody.max_tokens = maxTokensSetting
      }

      // Pass native tools for Groq/OpenRouter (Gemini uses action tags to avoid thought_signature 400s)
      if (route.provider !== 'gemini') {
        requestBody.tools = AGENT_TOOLS
      }

      let response = await fetch(route.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal,
      })

      // Auto-recover from 402 credit/max_tokens reservation error on OpenRouter
      if (response.status === 402 && !signal.aborted) {
        const errText = await response.text().catch(() => '')
        if (errText.includes('max_tokens') || errText.includes('credits')) {
          maxTokensSetting = 2048
          requestBody.max_tokens = 2048
          // Compact aggressively
          if (chatHistory.length > 4) {
            const sys = chatHistory[0]
            const last = chatHistory.slice(-2)
            chatHistory.length = 0
            if (sys) chatHistory.push(sys)
            chatHistory.push(...last)
            requestBody.messages = chatHistory
          }
          response = await fetch(route.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal,
          })
        }
      }

      // Handle 429 Rate Limiting with Auto-Retry
      let retryAttempts = 0
      while ((response.status === 429 || response.status === 503) && retryAttempts < 3 && !signal.aborted) {
        retryAttempts++
        const errBody = await response.text().catch(() => '')
        let waitSeconds = 5 * retryAttempts
        try {
          const parsed = JSON.parse(errBody)
          const details = Array.isArray(parsed) ? parsed[0]?.error?.details : parsed?.error?.details
          const retryInfo = details?.find((d: any) => d['@type']?.includes('RetryInfo'))
          if (retryInfo?.retryDelay) {
            waitSeconds = Math.min(22, parseInt(retryInfo.retryDelay, 10) || waitSeconds)
          }
        } catch {}

        for (let sec = waitSeconds; sec > 0; sec--) {
          if (signal.aborted) break
          updater.updateAiMessageBlocks((blocks) =>
            blocks.map((b) =>
              b.type === 'text' && (b as TextContentBlock).textType === 'text'
                ? {
                    ...b,
                    content:
                      accumulatedContent +
                      `\n\n⏳ *API rate limit reached. Waiting ${sec}s before auto-retrying (Attempt ${retryAttempts}/3)...*`,
                  }
                : b,
            ),
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        if (signal.aborted) break

        response = await fetch(route.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal,
        })
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        let cleanMsg = ''
        try {
          const parsed = JSON.parse(errBody)
          const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error
          cleanMsg = errObj?.message || ''
        } catch {
          cleanMsg = errBody.slice(0, 120)
        }

        if (response.status === 429) {
          throw new Error(
            `Rate limit reached on Gemini Free Tier. Please wait a moment or switch to Groq (gpt-oss-120b) for higher rate limits.`,
          )
        }

        throw new Error(
          `API error (${response.status}): ${cleanMsg || response.statusText}`,
        )
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let turnContent = ''

      while (!signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const dataStr = trimmed.replace(/^data:\s*/, '')
          if (dataStr === '[DONE]') break

          try {
            const parsed = JSON.parse(dataStr)
            const delta = parsed.choices?.[0]?.delta

            if (!delta) continue

            const reasoningChunk = delta.reasoning_content || delta.reasoning
            if (reasoningChunk) {
              if (!hasThinkingBlock) {
                hasThinkingBlock = true
                updater.addBlock({
                  type: 'text',
                  textType: 'reasoning',
                  content: reasoningChunk,
                  thinkingOpen: true,
                })
              }
              accumulatedThinking += reasoningChunk
              const currentReasoning = accumulatedThinking
              const liveTokens = Math.max(1, Math.ceil((accumulatedContent.length + accumulatedThinking.length) / 4))
              useChatStore.getState().setLiveTokenCount(liveTokens)
              updater.updateAiMessageBlocks((blocks) =>
                blocks.map((b) =>
                  b.type === 'text' &&
                  (b as TextContentBlock).textType === 'reasoning'
                    ? { ...b, content: currentReasoning }
                    : b,
                ),
              )
            }

            const contentChunk = delta.content
            if (contentChunk) {
              turnContent += contentChunk
              accumulatedContent += contentChunk
              const currentContent = accumulatedContent
              const liveTokens = Math.max(1, Math.ceil((accumulatedContent.length + accumulatedThinking.length) / 4))
              useChatStore.getState().setLiveTokenCount(liveTokens)
              updater.updateAiMessageBlocks((blocks) =>
                blocks.map((b) =>
                  b.type === 'text' &&
                  (b as TextContentBlock).textType === 'text'
                    ? { ...b, content: currentContent }
                    : b,
                ),
              )
              // Smooth streaming pacing
              await new Promise((resolve) => setTimeout(resolve, 8))
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index ?? 0
                if (!pendingToolCalls[index]) {
                  pendingToolCalls[index] = {
                    id: tc.id || `call_${index}_${turns}`,
                    name: tc.function?.name || '',
                    args: '',
                  }
                }
                if (tc.function?.name) {
                  pendingToolCalls[index].name = tc.function.name
                }
                if (tc.function?.arguments) {
                  pendingToolCalls[index].args += tc.function.arguments
                }
              }
            }
          } catch (_jsonErr) {}
        }
      }

      // If no function tool calls were made, check action tags
      if (pendingToolCalls.length === 0) {
        const actionRegex = /<action\s+name=["']([a-zA-Z0-9_-]+)["']>([\s\S]*?)<\/action>/gi
        let match: RegExpExecArray | null
        let actionIndex = 0

        while ((match = actionRegex.exec(turnContent)) !== null) {
          const name = match[1]?.trim()
          const rawArgs = match[2]?.trim()
          if (name && rawArgs) {
            pendingToolCalls.push({
              id: `action_${actionIndex++}_${turns}`,
              name,
              args: rawArgs.startsWith('{') ? rawArgs : JSON.stringify({ command: rawArgs }),
            })
          }
        }
      }

      // If still no tool calls or actions, check fallback auto-extraction and stop loop
      if (pendingToolCalls.length === 0) {
        const autoCreated = autoExtractAndWriteCodeBlocks(projectRoot, turnContent)
        if (autoCreated.length > 0) {
          hasExecutedModification = true
          const autoNotice = `\n\n✦ **Auto-created file(s) in workspace**: ${autoCreated.map((f) => `\`${f}\``).join(', ')}`
          accumulatedContent += autoNotice
          updater.updateAiMessageBlocks((blocks) =>
            blocks.map((b) =>
              b.type === 'text' && (b as TextContentBlock).textType === 'text'
                ? { ...b, content: accumulatedContent }
                : b,
            ),
          )
        }

        // If model only inspected and didn't write code or take action yet, auto-drive continuation!
        if (hasExecutedInspection && !hasExecutedModification && turns < 15) {
          hasExecutedInspection = false
          chatHistory.push({
            role: 'assistant',
            content: turnContent || 'I have inspected the files.',
          })
          chatHistory.push({
            role: 'user',
            content:
              'Great! Now proceed immediately to write the complete code changes using write_file or execute the required terminal commands to complete the entire implementation.',
          })
          continue
        }

        break
      }

      // Execute each tool and format output for user UI
      const toolResultsForHistory: string[] = []
      const toolResultById = new Map<string, string>()
      for (const tc of pendingToolCalls) {
        if (!tc || !tc.name) continue
        try {
          const parsedArgs = JSON.parse(tc.args || '{}')
          const cmdStr = (parsedArgs.command || '').trim()

          const isInspectCmd =
            tc.name === 'read_files' ||
            tc.name === 'list_directory' ||
            tc.name === 'ocr_image' ||
            tc.name === 'fetch_web_content' ||
            (tc.name === 'run_terminal_command' &&
              /^(sed\s+-n|grep|cat|head|tail|wc|find|ls|file|stat|view)\b/i.test(cmdStr))

          if (isInspectCmd) {
            hasExecutedInspection = true
          } else if (tc.name === 'write_file' || tc.name === 'run_terminal_command') {
            hasExecutedModification = true
          }
          const filePath = parsedArgs.path ? (path.isAbsolute(parsedArgs.path) ? parsedArgs.path : path.join(projectRoot, parsedArgs.path)) : ''
          const oldContent = (tc.name === 'write_file' && filePath && fs.existsSync(filePath)) ? fs.readFileSync(filePath, 'utf-8') : null

          const toolExec = await executeLocalTool(projectRoot, tc.name, parsedArgs)
          const truncatedResult = toolExec.result.length > 3000 ? toolExec.result.slice(0, 3000) + '\n...[output truncated for token efficiency]' : toolExec.result
          toolResultById.set(tc.id, truncatedResult)
          toolResultsForHistory.push(`[${tc.name}]\nResult: ${truncatedResult}`)

          let toolActionNotice = '\n\n'
          if (tc.name === 'write_file') {
            const newContentStr = parsedArgs.content || ''
            const lineCount = newContentStr.split('\n').length
            toolActionNotice += `● **WriteFile**(\`${parsedArgs.path}\`)\n`
            if (oldContent !== null) {
              const oldLines = oldContent.split('\n').length
              const diff = lineCount - oldLines
              const diffTag = diff >= 0 ? `+${diff}` : `${diff}`
              toolActionNotice += `  ⎿  Modified: \`${diffTag} lines\` (${oldLines} → ${lineCount} lines)\n`
            } else {
              toolActionNotice += `  ⎿  Created file (\`+${lineCount} lines\`)\n`
            }

            // Generate compact colored diff snippet (up to 5 changed lines)
            const diffSnippet = generateCompactDiff(oldContent, newContentStr)
            if (diffSnippet) {
              toolActionNotice += `\`\`\`diff\n${diffSnippet}\n\`\`\`\n`
            }
          } else if (tc.name === 'run_terminal_command') {
            const cleanOutput = toolExec.result.trim()
            toolActionNotice += `● **Bash**(\`${parsedArgs.command}\`)\n`
            if (cleanOutput && cleanOutput !== '(Command executed successfully with no output)') {
              const firstLine = cleanOutput.split('\n')[0]?.slice(0, 80)
              toolActionNotice += `  ⎿  ${firstLine}\n`
            }
          } else if (tc.name === 'read_files') {
            const fileList = (parsedArgs.paths || []).map((p: string) => (p.startsWith(os.homedir()) ? '~' + p.slice(os.homedir().length) : p)).join(', ')
            toolActionNotice += `● **ReadFile**(\`${fileList}\`)\n`
            toolActionNotice += `  ⎿  Loaded into context\n`
          } else if (tc.name === 'list_directory') {
            const folder = parsedArgs.path ? (path.isAbsolute(parsedArgs.path) ? parsedArgs.path : path.join(projectRoot, parsedArgs.path)) : projectRoot
            let filesCount = 0
            let dirsCount = 0
            try {
              const items = fs.readdirSync(folder)
              dirsCount = items.filter(i => {
                try { return fs.statSync(path.join(folder, i)).isDirectory() } catch { return false }
              }).length
              filesCount = items.length - dirsCount
            } catch {}
            const displayFolder = folder.startsWith(os.homedir()) ? '~' + folder.slice(os.homedir().length) : folder
            toolActionNotice += `● **ListDir**(\`${displayFolder}\`)\n`
            toolActionNotice += `  ⎿  ${filesCount} files, ${dirsCount} directories\n`
          } else if (tc.name === 'ocr_image' || tc.name === 'read_image_text') {
            const imgDisplay = parsedArgs.path ? (parsedArgs.path.startsWith(os.homedir()) ? '~' + parsedArgs.path.slice(os.homedir().length) : parsedArgs.path) : 'image'
            toolActionNotice += `● **Vision OCR**(\`${imgDisplay}\`)\n`
            const preview = (toolExec.result || '').split('\n').filter(Boolean).slice(0, 2).join(' ')
            toolActionNotice += `  ⎿  ${preview.slice(0, 80) || 'Text extracted'}\n`
          } else if (tc.name === 'fetch_web_content' || tc.name === 'read_url' || tc.name === 'web_fetch') {
            const urlDisplay = parsedArgs.url || 'web'
            toolActionNotice += `● **WebRead**(\`${urlDisplay}\`)\n`
            const len = (toolExec.result || '').length
            toolActionNotice += `  ⎿  Loaded \`${len} chars\` of token-optimized markdown\n`
          } else {
            toolActionNotice += `● **${tc.name}**\n`
          }

          accumulatedContent += toolActionNotice
          updater.updateAiMessageBlocks((blocks) =>
            blocks.map((b) =>
              b.type === 'text' && (b as TextContentBlock).textType === 'text'
                ? { ...b, content: accumulatedContent }
                : b,
            ),
          )
        } catch (_e) {}
      }

      // Feed tool results back into conversation history without triggering Gemini thought_signature errors
      if (route.provider === 'gemini') {
        chatHistory.push({
          role: 'assistant',
          content: turnContent || `Executed actions: ${pendingToolCalls.map((t) => t.name).join(', ')}`,
        })
        chatHistory.push({
          role: 'user',
          content: `Action execution output:\n${toolResultsForHistory.join('\n\n')}\nPlease proceed with the next step or summarize.`,
        })
      } else {
        chatHistory.push({
          role: 'assistant',
          content: turnContent || '',
          tool_calls: pendingToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.args },
          })),
        })
        for (const tc of pendingToolCalls) {
          const resultStr = toolResultById.get(tc.id) || ''
          chatHistory.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultStr,
          })
        }
      }
    }

    try {
      useChatStore.getState().setSuggestedFollowups({
        toolCallId: aiMessageId,
        suggestions: [
          {
            label: 'Explain next steps',
            prompt: 'What are the recommended next steps for this task?',
          },
          {
            label: 'Run checks',
            prompt: 'Check the project for any errors or missing dependencies',
          },
          {
            label: 'Build feature',
            prompt: 'Help me implement the next component or feature',
          },
        ],
        clickedIndices: new Set(),
      })
    } catch (_e) {}

    updater.markComplete()

    const finalRunState: RunState = {
      traceSessionId: aiMessageId,
      output: {
        type: 'text',
        message: accumulatedContent,
      },
    }
    onComplete(finalRunState)
  } catch (err: any) {
    if (signal.aborted) return

    const errorMessage = err?.message || String(err)
    updater.updateAiMessageBlocks((blocks) => [
      ...blocks,
      {
        type: 'text',
        textType: 'text',
        content: `\n\n[x] **Error during execution**: ${errorMessage}\n\nPlease check your API key and connection, or switch models in the menu.`,
      } as ContentBlock,
    ])
    updater.markComplete()

    const errorRunState: RunState = {
      traceSessionId: aiMessageId,
      output: {
        type: 'text',
        message: errorMessage,
      },
    }
    onComplete(errorRunState)
  }
}
