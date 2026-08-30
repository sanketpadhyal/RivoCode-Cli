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
const KEYS_FILE = path.join(CONFIG_DIR, 'keys.json')

export function getStoredApiKeys(): ApiKeysConfig {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (_e) {}
  return {}
}

export function saveStoredApiKey(provider: keyof ApiKeysConfig, key: string) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    const current = getStoredApiKeys()
    current[provider] = key.trim()
    fs.writeFileSync(KEYS_FILE, JSON.stringify(current, null, 2), 'utf-8')
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

interface ModelRoute {
  provider: 'groq' | 'openrouter'
  endpoint: string
  modelId: string
  displayName: string
  apiKeyUrl: string
}

function resolveModelRoute(modelName: string): ModelRoute {
  const normalized = (modelName || 'groq').toLowerCase()

  if (normalized.includes('deepseek')) {
    const groqKey = resolveApiKey('groq')
    if (groqKey) {
      return {
        provider: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        modelId: 'deepseek-r1-distill-llama-70b',
        displayName: 'DeepSeek R1 (Groq)',
        apiKeyUrl: 'https://console.groq.com/keys',
      }
    }
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'deepseek/deepseek-r1:free',
      displayName: 'DeepSeek R1 (OpenRouter Free)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  if (normalized.includes('gpt-oss') || normalized.includes('openrouter')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelId: 'meta-llama/llama-3.3-70b-instruct:free',
      displayName: 'Llama 3.3 70B (OpenRouter Free)',
      apiKeyUrl: 'https://openrouter.ai/keys',
    }
  }

  return {
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelId: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
    apiKeyUrl: 'https://console.groq.com/keys',
  }
}

export async function simulateFakeAiResponse({
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
    const envVarName = route.provider === 'groq' ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY'
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

Guidelines:
- Provide concise, clean, production-ready code with complete implementations.
- Reference workspace files using Markdown formatting.
- When generating code or plans, format them clearly with syntax highlighting.
- Be proactive, efficient, and precise.`

  const existingMessages = useChatStore.getState().messages
  const chatHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  for (const msg of existingMessages) {
    if (msg.id === aiMessageId) continue
    const role = msg.type === 'user' ? 'user' : 'assistant'
    const textContent =
      msg.blocks
        ?.filter((b) => b.type === 'text' && (b as TextContentBlock).textType !== 'reasoning')
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

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    if (route.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/sanketpadhyal/RivoCode-Cli'
      headers['X-Title'] = 'RivoCode CLI'
    }

    const response = await fetch(route.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: route.modelId,
        messages: chatHistory,
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
                b.type === 'text' && (b as TextContentBlock).textType === 'reasoning'
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
                b.type === 'text' && (b as TextContentBlock).textType === 'text'
                  ? { ...b, content: currentContent }
                  : b,
              ),
            )
          }
        } catch (_jsonErr) {}
      }
    }

    useChatStore.getState().setFollowups([
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
    ])

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
