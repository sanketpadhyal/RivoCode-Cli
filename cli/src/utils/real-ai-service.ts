import { exec, execSync, spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { AskUserBridge } from '@rivocode/common/utils/ask-user-bridge'
import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { updateProjectSettings } from '../workspace/project-context'
import { performNativeOcr } from './ocr-helper'
import { fetchWebContent, searchWeb } from './web-helper'

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
  ollama?: string
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

export function saveFallbackKeys(provider: keyof ApiKeysConfig, fallbacks: string[]) {
  try {
    ensureApiKeysFileExists()
    const raw = fs.existsSync(KEYS_FILE) ? fs.readFileSync(KEYS_FILE, 'utf-8') : '{}'
    const current = JSON.parse(raw)
    current[`${provider}_fallbacks`] = fallbacks.filter(Boolean).map((k) => k.trim())
    fs.writeFileSync(KEYS_FILE, JSON.stringify(current, null, 2), 'utf-8')
  } catch (_e) {}
}

export function getFallbackKeys(provider: keyof ApiKeysConfig): string[] {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      return (parsed[`${provider}_fallbacks`] || []).filter(Boolean)
    }
  } catch (_e) {}
  return []
}

let _currentFallbackIndex: Record<string, number> = {}

export function resolveApiKeyWithRotation(provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek' | 'ollama'): string | null {
  if (provider === 'ollama') return 'ollama-local'
  const primary = resolveApiKey(provider)
  const fallbacks = getFallbackKeys(provider)
  const allKeys = [primary, ...fallbacks].filter(Boolean) as string[]
  if (allKeys.length === 0) return null
  const idx = _currentFallbackIndex[provider] || 0
  return allKeys[idx % allKeys.length] || allKeys[0]
}

export function rotateToNextKey(provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek' | 'ollama') {
  if (provider === 'ollama') return
  const fallbacks = getFallbackKeys(provider)
  const total = 1 + fallbacks.length
  _currentFallbackIndex[provider] = ((_currentFallbackIndex[provider] || 0) + 1) % total
}

export function resolveApiKey(provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek' | 'ollama'): string | null {
  if (provider === 'ollama') {
    return 'ollama-local'
  }
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
    if (route.provider === 'ollama') return true
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
  provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek' | 'ollama'
  endpoint: string
  modelId: string
  displayName: string
  apiKeyUrl: string
}

export function resolveModelRoute(modelName: string): ModelRoute {
  const normalized = (modelName || 'gemini').toLowerCase()

  if (normalized.includes('minimax')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'minimax/minimax-m2.7:free',
      displayName: 'MiniMax M2.7 (Free Tier)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('cohere') || normalized.includes('north')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'cohere/north-mini-code:free',
      displayName: 'Cohere North Code (256k Context Free)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('r1') || normalized.includes('deepseek-r1')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'deepseek/deepseek-r1:free',
      displayName: 'DeepSeek R1 Reasoning (Free Tier)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('llama') || normalized.includes('openrouter')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'meta-llama/llama-3.3-70b-instruct:free',
      displayName: 'Meta Llama 3.3 70B (Free Tier)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('claude')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'anthropic/claude-3.7-sonnet',
      displayName: 'Claude 3.7 Sonnet (OpenRouter)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('deepseek')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'deepseek/deepseek-chat:free',
      displayName: 'DeepSeek V3 (Free OpenRouter)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  return {
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelId: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash (Google AI Studio)',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
  }
}

export async function testApiKeyConnection(
  provider: 'groq' | 'openrouter' | 'gemini' | 'deepseek' | 'ollama',
  apiKey: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    if (provider === 'ollama') {
      try {
        const res = await fetch('http://localhost:11434/api/tags')
        if (res.ok) {
          return { success: true, message: 'Connected to local Ollama!' }
        }
      } catch {
        return { success: false, error: 'Ollama is not running. Please start Ollama ("ollama serve")' }
      }
    }
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
          'HTTP-Referer': process.env.APP_URL || 'https://rivocode.app',
          'X-Title': 'RivoCode',
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
      description: 'Extract text from an image or screenshot using high-speed native OS OCR (Apple Vision / WinRT OCR)',
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
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Perform real-time live internet web search for any person, library, documentation, topic, or question',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The web search query string',
          },
        },
        required: ['query'],
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
                { label: '1. Yes' },
                { label: `2. Yes, and always allow in this conversation for '${relPath}'` },
                { label: '3. No' },
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
                { label: '1. Yes' },
                { label: `2. Yes, and always allow in this conversation for commands that start with '${cmdPrefix}'` },
                { label: `3. Yes, and always allow for commands that start with '${cmdPrefix}' (Persist to settings.json)` },
                { label: '4. No' },
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

      const sessionId = useChatStore.getState().addTerminalSession({
        command: rawCommand,
        cwd: projectRoot,
      })

      const runPromise = new Promise<string>((resolve) => {
        let stdoutAcc = ''
        let stderrAcc = ''
        let hasResolved = false

        const safeResolve = (res: string) => {
          if (!hasResolved) {
            hasResolved = true
            resolve(res)
          }
        }

        try {
          const child = spawn(rawCommand, {
            cwd: projectRoot,
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' },
          })

          if (child.pid) {
            useChatStore.setState((s) => {
              const sess = s.terminalSessions.find((t) => t.id === sessionId)
              if (sess) sess.pid = child.pid
            })
          }

          child.stdout?.on('data', (chunk: Buffer) => {
            const str = chunk.toString()
            stdoutAcc += str
            useChatStore.getState().appendTerminalLog(sessionId, str)
          })

          child.stderr?.on('data', (chunk: Buffer) => {
            const str = chunk.toString()
            stderrAcc += str
            useChatStore.getState().appendTerminalLog(sessionId, str)
          })

          child.on('error', (err) => {
            useChatStore.getState().finishTerminalSession(sessionId, { error: err.message, exitCode: 1 })
            safeResolve(`Error launching command: ${err.message}`)
          })

          child.on('close', (code) => {
            useChatStore.getState().finishTerminalSession(sessionId, { exitCode: code })
            const output = [stdoutAcc, stderrAcc].filter(Boolean).join('\n').trim()
            safeResolve(output || (code === 0 ? '(Command executed successfully with no output)' : `Command exited with code ${code}`))
          })

          // For servers / background tasks, resolve early so conversation never hangs
          const isBackground =
            rawCommand.includes('&') ||
            rawCommand.includes('nohup') ||
            rawCommand.includes('dev') ||
            rawCommand.includes('serve') ||
            rawCommand.includes('watch') ||
            rawCommand.includes('http.server')

          if (isBackground) {
            setTimeout(() => {
              const currentLogs = [stdoutAcc, stderrAcc].filter(Boolean).join('\n').trim()
              safeResolve(
                currentLogs
                  ? `(Background process started. Initial logs:)\n${currentLogs.slice(0, 1000)}`
                  : '(Background task started successfully. Live logs streaming in Terminal Monitor.)',
              )
            }, 1200)
          }
        } catch (spawnErr: any) {
          useChatStore.getState().finishTerminalSession(sessionId, { error: spawnErr.message, exitCode: 1 })
          safeResolve(`Failed to spawn command: ${spawnErr.message}`)
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

    if (name === 'search_web' || name === 'web_search') {
      const query = (args.query || args.q || '').trim()
      const searchResults = await searchWeb(query)
      return { success: true, result: searchResults }
    }

    return { success: false, result: `Unknown tool: ${name}` }
  } catch (err: any) {
    return {
      success: false,
      result: `Error executing tool ${name}: ${err.message || String(err)}`,
    }
  }
}

// Generate accurate snippet diff with line numbers and +/- markings
function computeDetailedDiff(
  oldText: string | null,
  newText: string,
  maxHunkLines = 14,
): { diffText: string; added: number; removed: number } {
  if (oldText === null) {
    const newLines = newText.split('\n')
    const added = newLines.length
    const sample = newLines.slice(0, 6).map((l, i) => `${String(i + 1).padStart(4, ' ')} +  ${l}`).join('\n')
    const diffText = sample + (newLines.length > 6 ? `\n       +  ... and ${newLines.length - 6} more lines` : '')
    return { diffText, added, removed: 0 }
  }

  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  const maxRows = Math.min(oldLines.length + 1, 600)
  const maxCols = Math.min(newLines.length + 1, 600)
  const dp = Array.from({ length: maxRows }, () => new Int32Array(maxCols))
  const limM = maxRows - 1
  const limN = maxCols - 1

  for (let i = 0; i < limM; i++) {
    for (let j = 0; j < limN; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  let i = limM
  let j = limN
  const ops: Array<{ type: 'same' | 'add' | 'del'; oldLine?: number; newLine?: number; text: string }> = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'same', oldLine: i, newLine: j, text: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', newLine: j, text: newLines[j - 1] })
      j--
    } else if (i > 0) {
      ops.unshift({ type: 'del', oldLine: i, text: oldLines[i - 1] })
      i--
    }
  }

  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.type === 'add') added++
    if (op.type === 'del') removed++
  }

  const firstChangeIdx = ops.findIndex((op) => op.type !== 'same')
  if (firstChangeIdx === -1) {
    return { added: 0, removed: 0, diffText: '' }
  }

  const start = Math.max(0, firstChangeIdx - 2)
  const end = Math.min(ops.length, start + maxHunkLines)
  const slice = ops.slice(start, end)

  const formattedLines = slice.map((op) => {
    if (op.type === 'add') {
      return `${String(op.newLine).padStart(4, ' ')} +  ${op.text}`
    } else if (op.type === 'del') {
      return `${String(op.oldLine).padStart(4, ' ')} -  ${op.text}`
    } else {
      return `${String(op.newLine || op.oldLine).padStart(4, ' ')}    ${op.text}`
    }
  })

  if (end < ops.length && ops.slice(end).some((op) => op.type !== 'same')) {
    const remainingChanges = ops.slice(end).filter((op) => op.type !== 'same').length
    formattedLines.push(`     ... and ${remainingChanges} more changes`)
  }

  return { added, removed, diffText: formattedLines.join('\n') }
}

function cleanStreamedContent(text: string): string {
  let cleaned = text
  cleaned = cleaned.replace(/```(?:json)?\s*\n?\{[\s\S]*?\}\s*\n?```/gi, '')
  cleaned = cleaned.replace(/<action\s+name=["'][^"']+["']>[\s\S]*?<\/action>/gi, '')
  cleaned = cleaned.replace(/\{\s*"(?:name|tool|tool_name)"\s*:\s*"[a-zA-Z0-9_-]+"[\s\S]*?\}\s*\}/gi, '')
  cleaned = cleaned.replace(/\{\s*"(?:name|tool|tool_name)"\s*:\s*"[a-zA-Z0-9_-]+"[\s\S]*$/gi, '')
  cleaned = cleaned.replace(/<action\s+name=["'][^"']+["']>[\s\S]*$/gi, '')
  cleaned = cleaned.replace(/```(?:json)?\s*\n?\{\s*"(?:name|tool)"[\s\S]*$/gi, '')
  return cleaned
}

function parseJsonLenient(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch (_e) {
    try {
      let inStr = false
      let esc = false
      let fixed = ''
      for (let i = 0; i < raw.length; i++) {
        const c = raw[i]
        if (esc) {
          esc = false
          fixed += c
          continue
        }
        if (c === '\\') {
          esc = true
          fixed += c
          continue
        }
        if (c === '"') {
          inStr = !inStr
          fixed += c
          continue
        }
        if (inStr && c === '\n') {
          fixed += '\\n'
          continue
        }
        if (inStr && c === '\r') {
          fixed += '\\r'
          continue
        }
        if (inStr && c === '\t') {
          fixed += '\\t'
          continue
        }
        fixed += c
      }
      return JSON.parse(fixed)
    } catch (_e2) {
      return null
    }
  }
}

function findJsonToolCalls(text: string): Array<{ name: string; args: string; rawMatch: string }> {
  const toolCalls: Array<{ name: string; args: string; rawMatch: string }> = []
  const KNOWN_TOOLS = new Set([
    'write_file',
    'run_terminal_command',
    'read_files',
    'list_directory',
    'ocr_image',
    'fetch_web_content',
    'search_web',
  ])

  let searchFrom = 0
  while (searchFrom < text.length) {
    const startIdx = text.indexOf('{', searchFrom)
    if (startIdx === -1) break

    let depth = 0
    let inString = false
    let isEscaped = false
    let endIdx = -1

    for (let i = startIdx; i < text.length; i++) {
      const char = text[i]
      if (isEscaped) {
        isEscaped = false
        continue
      }
      if (char === '\\') {
        isEscaped = true
        continue
      }
      if (char === '"' && !isEscaped) {
        inString = !inString
        continue
      }
      if (!inString) {
        if (char === '{') depth++
        else if (char === '}') {
          depth--
          if (depth === 0) {
            endIdx = i
            break
          }
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = text.slice(startIdx, endIdx + 1)
      const parsed = parseJsonLenient(candidate)
      if (parsed && typeof parsed === 'object') {
        const name = parsed.name || parsed.tool || parsed.tool_name || parsed.function?.name
        const args = parsed.arguments || parsed.parameters || parsed.args || parsed.function?.arguments
        if (name && KNOWN_TOOLS.has(name) && args) {
          toolCalls.push({
            name,
            args: typeof args === 'string' ? args : JSON.stringify(args),
            rawMatch: candidate,
          })
          searchFrom = endIdx + 1
          continue
        }
      }
    }
    searchFrom = startIdx + 1
  }
  return toolCalls
}

// Fallback: If model outputs markdown code blocks with a file header, auto-create/update them on disk
function autoExtractAndWriteCodeBlocks(projectRoot: string, text: string): string[] {
  const writtenFiles: string[] = []
  const VALID_EXTS = new Set(['.js','.ts','.tsx','.jsx','.py','.html','.css','.json','.md','.txt','.sh','.bash','.yaml','.yml','.toml','.env','.go','.rs','.java','.cpp','.c','.h','.rb','.php','.swift','.kt','.sql','.graphql','.proto'])

  function isValidFile(filename: string, content: string): boolean {
    if (!filename || content.length < 10) return false
    const ext = path.extname(filename).toLowerCase()
    return VALID_EXTS.has(ext) && !filename.includes('bash') && !filename.includes('output') && !filename.includes('terminal')
  }

  const blockRegex = /([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)[:\s\n]*\n*```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(text)) !== null) {
    const rawFilename = match[1]?.trim()
    const content = match[2] || ''
    if (isValidFile(rawFilename, content)) {
      try {
        const cleanFilename = rawFilename.replace(/^[`'"]+|[`'":]+$/g, '')
        const filePath = path.isAbsolute(cleanFilename) ? cleanFilename : path.join(projectRoot, cleanFilename)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, content, 'utf-8')
        writtenFiles.push(cleanFilename)
      } catch (_e) {}
    }
  }

  const headerRegex = new RegExp('```(?:[a-zA-Z0-9_-]+)?\\s*\\n(?:\\/\\*+|\\/\\/|#)\\s*(?:file:|\\.\\/)?\\ s*([a-zA-Z0-9_./-]+\\.[a-zA-Z0-9]+)[^\\n]*\\n([\\s\\S]*?)```', 'gi')
  while ((match = headerRegex.exec(text)) !== null) {
    const rawFilename = match[1]?.trim()
    const content = match[2] || ''
    if (isValidFile(rawFilename, content) && !writtenFiles.includes(rawFilename)) {
      try {
        const filePath = path.isAbsolute(rawFilename) ? rawFilename : path.join(projectRoot, rawFilename)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, content, 'utf-8')
        writtenFiles.push(rawFilename)
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
  const apiKey = resolveApiKeyWithRotation(route.provider)

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
        type: 'lastMessage',
        value: [{ type: 'text', content: missingMessage }],
      } as any,
    }
    onComplete(runState)
    return
  }

  const systemPrompt = `You are RivoCode, an autonomous AI coding assistant operating like Claude Code / Cursor.
You are running in mode: ${agentMode}.
Current workspace directory: ${projectRoot}.
Host Platform: ${os.platform()} (${os.arch()}).

Never assume the user's name or personal background unless they explicitly introduce themselves.

AUTONOMOUS CAPABILITIES (YOU HAVE FULL LOCAL SYSTEM & LIVE INTERNET ACCESS):
- write_file(path, content): Create or overwrite files directly in the workspace.
- run_terminal_command(command): Execute shell/terminal commands directly. For background tasks, dev servers, or long-running commands, run them directly without redirecting to /dev/null so live logs are streamed to the user's terminal monitor.
- read_files(paths): Read workspace files into context.
- list_directory(path): List folder contents.
- ocr_image(path): Extract text from images, screenshots, or UI mockups using native OS OCR (Apple Vision on macOS / WinRT OCR on Windows).
- search_web(query): Search the live internet for any person, library, API, documentation, or fact.
- fetch_web_content(url): Fetch real-time web documentation, online articles, APIs, GitHub repositories, and packages.

PROACTIVE WEB SEARCH & REAL-TIME ACCURACY RULES:
- You have LIVE, REAL-TIME INTERNET ACCESS!
- If the user asks about ANY person, public figure, company, framework, package, API, documentation, or topic that is not already in your context, NEVER say "I don't know" or ask "Should I search the web?".
- You MUST IMMEDIATELY and AUTONOMOUSLY call search_web(query) or fetch_web_content(url) on your very first turn, retrieve the real live web results, and answer accurately!

AUTONOMOUS TASK COMPLETION RULES (CRITICAL - NEVER VIOLATE):
- Once you have read the files you need, IMMEDIATELY write the code using write_file. Do NOT read more files unless absolutely necessary.
- NEVER say "Let me read the remaining files", "Let me first understand", "I'll now look at", or any other stalling phrase — just write the code directly!
- Do NOT say "I have read the files, should I proceed?" or "Here is what I plan to do" without actually writing the code! Take immediate action.
- NEVER read the same file twice. NEVER re-read files you already have in context.
- NEVER tell the user to manually create files, copy-paste code, or run bash commands when you can do it yourself!
- Complete the entire end-to-end task in one go so the user doesn't need to ask you to continue.
- After writing all code files, verify the implementation is complete and done.`

  const existingMessages = useChatStore.getState().messages
  const recentMessages = existingMessages.slice(-24)
  const chatHistory: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool'
    content?: string
    tool_call_id?: string
    tool_calls?: any[]
  }> = [{ role: 'system', content: systemPrompt }]

  for (const msg of recentMessages) {
    if (msg.id === aiMessageId) continue
    const role = msg.variant === 'user' ? 'user' : 'assistant'
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
  const maxTurns = 16

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    if (route.provider === 'gemini') {
      headers['x-goog-api-key'] = apiKey.trim()
    }

    if (route.provider === 'openrouter') {
      headers['HTTP-Referer'] = process.env.APP_URL || 'https://rivocode.app'
      headers['X-Title'] = 'RivoCode'
    }

    updater.addBlock({
      type: 'text',
      textType: 'text',
      content: '',
    })

    const isConversational = /^(hi|hey|hello|thanks|thank you|sup|yo|good|nice|cool|ok|okay|what is|who is|what can|what should|what do|what are|what would|tell me|explain|describe|how does|how do|what does|why is|when did|can you tell|is this|is there|are there|do you|does this|should i|can i|could you|would you)\b/i.test(prompt.trim())
    const isActionRequired = !isConversational && /\b(fix|add|create|build|update|make|implement|refactor|change|modify|write|delete|remove|put|apply|generate|install|run|start|serve|setup|port|replace|edit|patch|convert|migrate|optimize|debug|test|deploy|init|scaffold|extend|improve|enhance|support|enable|disable|integrate|connect|link|merge|split|extract|export|import|parse|format|style|animate|render|display|show|hide|toggle|handle|validate|sanitize)\b/i.test(prompt)
    const isClaude = route.modelId.includes('claude')
    let maxTokensSetting = isClaude ? undefined : route.provider === 'groq' ? 3500 : route.provider === 'openrouter' ? 4096 : 8192
    let hasExecutedInspection = false
    let hasExecutedModification = false
    const readFilesTracked = new Set<string>()
    const executedToolSignatures = new Map<string, string>()

    while (turns < maxTurns && !signal.aborted) {
      turns++
      const pendingToolCalls: Array<{ id: string; name: string; args: string }> = []

      if (chatHistory.length > 20) {
        const sysMsg = chatHistory[0]
        const recentTurns = chatHistory.slice(-10)
        chatHistory.length = 0
        if (sysMsg) chatHistory.push(sysMsg)
        chatHistory.push({
          role: 'system',
          content: '[Context compacted: earlier turns summarized]',
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

      // Auto-recover from 402 (credit reservation) or 413 (TPM limit) on Groq/OpenRouter
      if ((response.status === 402 || response.status === 413) && !signal.aborted) {
        const errText = await response.text().catch(() => '')
        if (errText.includes('max_tokens') || errText.includes('credits') || errText.includes('TPM') || errText.includes('too large') || response.status === 413) {
          maxTokensSetting = 2048
          requestBody.max_tokens = 2048
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

        rotateToNextKey(route.provider)
        const rotatedKey = resolveApiKeyWithRotation(route.provider)
        if (rotatedKey) {
          headers['Authorization'] = `Bearer ${rotatedKey}`
          if (route.provider === 'gemini') headers['x-goog-api-key'] = rotatedKey
        }

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
        let done: boolean
        let value: Uint8Array | undefined
        try {
          const chunk = await reader.read()
          done = chunk.done
          value = chunk.value
        } catch (_readErr) {
          break
        }
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
              const displayContent = cleanStreamedContent(accumulatedContent)
              const liveTokens = Math.max(1, Math.ceil((accumulatedContent.length + accumulatedThinking.length) / 4))
              useChatStore.getState().setLiveTokenCount(liveTokens)
              updater.updateAiMessageBlocks((blocks) =>
                blocks.map((b) =>
                  b.type === 'text' &&
                  (b as TextContentBlock).textType === 'text'
                    ? { ...b, content: displayContent }
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

      // If no function tool calls were made, check action tags and robust JSON tool calls from local/Ollama models
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

      if (pendingToolCalls.length === 0) {
        const jsonCalls = findJsonToolCalls(turnContent)
        let jsonIndex = 0
        for (const jc of jsonCalls) {
          pendingToolCalls.push({
            id: `json_call_${jsonIndex++}_${turns}`,
            name: jc.name,
            args: jc.args,
          })
        }
      }

      if (pendingToolCalls.length > 0) {
        accumulatedContent = cleanStreamedContent(accumulatedContent)
        updater.updateAiMessageBlocks((blocks) =>
          blocks.map((b) =>
            b.type === 'text' && (b as TextContentBlock).textType === 'text'
              ? { ...b, content: accumulatedContent }
              : b,
          ),
        )
      }

      const validToolCalls = pendingToolCalls.filter(
        (tc): tc is { id: string; name: string; args: string } =>
          Boolean(tc && typeof tc === 'object' && tc.name),
      )

      // If still no tool calls or actions, check fallback auto-extraction and stop loop
      if (validToolCalls.length === 0) {
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

        // If user requested an action/coding task, and model only inspected without writing code yet, auto-drive continuation!
        if (isActionRequired && hasExecutedInspection && !hasExecutedModification && turns < 10) {
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
      let hasNewToolExecution = false

      for (const tc of validToolCalls) {
        if (!tc || !tc.name) continue
        try {
          const parsedArgs = JSON.parse(tc.args || '{}')
          const cmdStr = (parsedArgs.command || '').trim()
          const toolSig = `${tc.name}:${JSON.stringify(parsedArgs)}`

          const isInspectCmd =
            tc.name === 'read_files' ||
            tc.name === 'list_directory' ||
            tc.name === 'ocr_image' ||
            tc.name === 'fetch_web_content' ||
            tc.name === 'search_web' ||
            (tc.name === 'run_terminal_command' &&
              /^(sed\s+-n|grep|cat|head|tail|wc|find|ls|file|stat|view|pwd|whoami)\b/i.test(cmdStr))

          // If identical inspection/read command was already executed in this session, use cached result
          if (isInspectCmd && executedToolSignatures.has(toolSig)) {
            const cachedRes = executedToolSignatures.get(toolSig) || ''
            toolResultsForHistory.push(`[${tc.name}]\nResult: ${cachedRes}`)
            continue
          }

          hasNewToolExecution = true
          if (isInspectCmd) {
            hasExecutedInspection = true
            if (tc.name === 'read_files') {
              for (const p of (parsedArgs.paths || [])) {
                readFilesTracked.add(String(p))
              }
            }
          } else if (tc.name === 'write_file' || tc.name === 'run_terminal_command') {
            hasExecutedModification = true
          }
          const filePath = parsedArgs.path ? (path.isAbsolute(parsedArgs.path) ? parsedArgs.path : path.join(projectRoot, parsedArgs.path)) : ''
          const oldContent = (tc.name === 'write_file' && filePath && fs.existsSync(filePath)) ? fs.readFileSync(filePath, 'utf-8') : null

          const toolExec = await executeLocalTool(projectRoot, tc.name, parsedArgs)
          if (tc.name === 'write_file' && !toolExec.success) {
            hasExecutedModification = false
          }
          const truncatedResult = toolExec.result.length > 4000 ? toolExec.result.slice(0, 4000) + '\n...[output truncated]' : toolExec.result
          executedToolSignatures.set(toolSig, truncatedResult)
          toolResultsForHistory.push(`[${tc.name}]\nResult: ${truncatedResult}`)

          let toolActionNotice = '\n\n'
          if (tc.name === 'write_file') {
            const newContentStr = parsedArgs.content || ''
            const rawPath = parsedArgs.path || 'file'
            const fullTarget = path.isAbsolute(rawPath) ? rawPath : path.join(projectRoot, rawPath)
            const displayPath = fullTarget.startsWith(os.homedir())
              ? '~' + fullTarget.slice(os.homedir().length)
              : fullTarget

            const diffResult = computeDetailedDiff(oldContent, newContentStr)

            toolActionNotice += `● **Edit**(\`${displayPath}\`)\n`
            if (!toolExec.success) {
              toolActionNotice += `  └ Failed: ${truncatedResult.slice(0, 80)}\n`
            } else if (oldContent !== null) {
              toolActionNotice += `  └ +${diffResult.added} / -${diffResult.removed} lines\n`
            } else {
              toolActionNotice += `  └ +${diffResult.added} lines\n`
            }

            if (diffResult.diffText) {
              toolActionNotice += `\`\`\`diff\n${diffResult.diffText}\n\`\`\`\n`
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
          } else if (tc.name === 'search_web' || tc.name === 'web_search') {
            const qDisplay = parsedArgs.query || parsedArgs.q || 'query'
            toolActionNotice += `● **WebSearch**("${qDisplay}")\n`
            const firstResult = (toolExec.result || '').split('\n').filter(l => l.trim().startsWith('•'))[0] || 'Results retrieved'
            toolActionNotice += `  ⎿  ${firstResult.slice(0, 80)}\n`
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

      if (!hasNewToolExecution && turns > 1) {
        // Break out of loop if all tool calls in this turn were duplicate reads
        break
      }

      chatHistory.push({
        role: 'assistant',
        content: turnContent || `Executed: ${validToolCalls.map((t) => t.name).join(', ')}`,
      })

      const nextUserInstruction = isActionRequired
        ? `Tool execution results:\n${toolResultsForHistory.join('\n\n')}\n\nYou have completed the necessary tools. Now finalize the task and present your final answer directly to the user.`
        : `Tool execution results:\n${toolResultsForHistory.join('\n\n')}\n\nBased on these tool results, provide your final direct answer to the user now. Do not call additional tools.`

      chatHistory.push({
        role: 'user',
        content: nextUserInstruction,
      })
    }

    try {
      useChatStore.getState().setSuggestedFollowups({
        toolCallId: aiMessageId,
        followups: [
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
        type: 'lastMessage',
        value: [{ type: 'text', content: accumulatedContent }],
      } as any,
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
        type: 'error',
        message: errorMessage,
      },
    }
    onComplete(errorRunState)
  }
}
