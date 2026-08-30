import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'

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
# OpenRouter: https://openrouter.ai/keys

GROQ_API_KEY=
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
OPENROUTER_API_KEY=${current.openrouter || ''}
DEEPSEEK_API_KEY=${current.deepseek || ''}
`
    fs.writeFileSync(DOT_APIKEYS_FILE, dotContent, 'utf-8')
  } catch (_e) {}
}

export function resolveApiKey(provider: 'groq' | 'openrouter'): string | null {
  const envKey =
    provider === 'groq'
      ? process.env.GROQ_API_KEY
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
  return Boolean(resolveApiKey('groq') || resolveApiKey('openrouter'))
}

export interface ModelRoute {
  provider: 'groq' | 'openrouter'
  endpoint: string
  modelId: string
  displayName: string
  apiKeyUrl: string
}

export function resolveModelRoute(modelName: string): ModelRoute {
  const normalized = (modelName || 'groq').toLowerCase()

  if (normalized.includes('qwen')) {
    return {
      provider: 'groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      modelId: 'qwen/qwen3.8-27b',
      displayName: 'Qwen 3.8 27B (Groq)',
      apiKeyUrl: 'https://console.groq.com/keys',
    }
  }

  if (normalized.includes('openrouter')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'meta-llama/llama-3.3-70b-instruct:free',
      displayName: 'OpenRouter Free',
      apiKeyUrl: 'https://openrouter.ai/keys',
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
  provider: 'groq' | 'openrouter',
  apiKey: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const isGroq = provider === 'groq'
    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions'
    const model = isGroq
      ? 'openai/gpt-oss-120b'
      : 'meta-llama/llama-3.3-70b-instruct:free'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    }

    if (!isGroq) {
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
      const errText = await response.text().catch(() => '')
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key (401 Unauthorized). Please check your key.',
        }
      }
      return {
        success: false,
        error: `API returned error ${response.status}: ${errText.slice(0, 80) || response.statusText}`,
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
]

export function executeLocalTool(
  projectRoot: string,
  name: string,
  args: Record<string, any>,
): { success: boolean; result: string } {
  try {
    if (name === 'write_file') {
      const filePath = path.isAbsolute(args.path)
        ? args.path
        : path.join(projectRoot, args.path)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, args.content, 'utf-8')
      return {
        success: true,
        result: `Successfully wrote ${args.content.length} characters to ${args.path}`,
      }
    }

    if (name === 'run_terminal_command') {
      const output = execSync(args.command, {
        cwd: projectRoot,
        timeout: 30000,
        encoding: 'utf-8',
      })
      return {
        success: true,
        result: output || '(Command executed successfully with no output)',
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

    return { success: false, result: `Unknown tool: ${name}` }
  } catch (err: any) {
    return {
      success: false,
      result: `Error executing tool ${name}: ${err.message || String(err)}`,
    }
  }
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
  const projectRoot = getProjectRoot()
  const selectedModel = useChatStore.getState().selectedModel ?? 'groq'
  const route = resolveModelRoute(selectedModel)
  const apiKey = resolveApiKey(route.provider)

  // 1. If API key is missing, provide a clear, actionable guide
  if (!apiKey) {
    const envVarName =
      route.provider === 'groq' ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY'
    const missingMessage = `⚠️ **API Key Required for ${route.displayName}**\n\nTo start chatting and executing live coding tasks with RivoCode:\n\n1. **Get your free API key** (100% free tier, instant setup):\n   • **${route.provider === 'groq' ? 'Groq Console' : 'OpenRouter'}**: [${route.apiKeyUrl}](${route.apiKeyUrl})\n\n2. **Set it in your terminal environment**:\n   \`\`\`bash\n   export ${envVarName}="your_api_key_here"\n   \`\`\`\n\n3. **Or save it to RivoCode configuration**:\n   \`\`\`bash\n   mkdir -p ~/.rivocode && echo '{"${route.provider}": "your_api_key_here"}' > ~/.rivocode/keys.json\n   \`\`\`\n\nOnce set, run \`rivo\` or send your message again!`

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
  const systemPrompt = `You are RivoCode, an elite autonomous AI coding assistant created by Sanket Padhyal.
You are running in mode: ${agentMode}.
You are connected to the user's workspace at: ${projectRoot}.
Host Platform: ${os.platform()} (${os.arch()}).

YOU HAVE REAL SYSTEM TOOLS ATTACHED:
- write_file(path, content): Create or overwrite files directly on the user's workspace.
- run_terminal_command(command): Execute shell/terminal commands directly.
- read_files(paths): Read workspace files.
- list_directory(path): List folder contents.

AUTONOMOUS EXECUTION RULES:
- NEVER tell the user to manually create, copy-paste, or save files if they asked you to build, create, or modify code. ALWAYS use write_file to create the file directly in the workspace.
- When asked to run tests or execute code, use run_terminal_command.
- Be proactive and take direct action.`

  const existingMessages = useChatStore.getState().messages
  const chatHistory: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool'
    content?: string
    tool_call_id?: string
    tool_calls?: any[]
  }> = [{ role: 'system', content: systemPrompt }]

  for (const msg of existingMessages) {
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
  const pendingToolCalls: Array<{ id: string; name: string; args: string }> = []

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    if (route.provider === 'openrouter') {
      headers['HTTP-Referer'] =
        'https://github.com/sanketpadhyal/RivoCode-Cli'
      headers['X-Title'] = 'RivoCode CLI'
    }

    const response = await fetch(route.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: route.modelId,
        messages: chatHistory,
        tools: AGENT_TOOLS,
        stream: true,
        temperature: 0.7,
      }),
      signal,
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(
        `API returned status ${response.status} (${response.statusText}): ${errBody || 'Unknown error'}`,
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    updater.addBlock({
      type: 'text',
      textType: 'text',
      content: '',
    })

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
            accumulatedContent += contentChunk
            const currentContent = accumulatedContent
            updater.updateAiMessageBlocks((blocks) =>
              blocks.map((b) =>
                b.type === 'text' &&
                (b as TextContentBlock).textType === 'text'
                  ? { ...b, content: currentContent }
                  : b,
              ),
            )
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0
              if (!pendingToolCalls[index]) {
                pendingToolCalls[index] = {
                  id: tc.id || `call_${index}`,
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

    // Execute any function tool calls generated by the model
    if (pendingToolCalls.length > 0) {
      for (const tc of pendingToolCalls) {
        if (!tc || !tc.name) continue
        try {
          const parsedArgs = JSON.parse(tc.args || '{}')
          const toolExec = executeLocalTool(projectRoot, tc.name, parsedArgs)

          let toolActionNotice = `\n\n⚡ **Executed Action [${tc.name}]**\n`
          if (tc.name === 'write_file') {
            toolActionNotice += `Created file: \`${parsedArgs.path}\` in workspace.`
          } else if (tc.name === 'run_terminal_command') {
            toolActionNotice += `Command: \`${parsedArgs.command}\`\nOutput:\n\`\`\`\n${toolExec.result}\n\`\`\``
          } else {
            toolActionNotice += `${toolExec.result}`
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
        content: `\n\n❌ **Error during execution**: ${errorMessage}\n\nPlease check your API key and connection, or switch models in the menu.`,
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
