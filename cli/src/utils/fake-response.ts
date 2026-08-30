import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'

import type { MessageUpdater } from './message-updater'
import type { AgentMode } from './constants'
import type { RunState } from '@rivocode/sdk'

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
  const selectedModel =
    useChatStore.getState().selectedModel ?? 'glm-5.3-flash:cloud'
  const lower = prompt.toLowerCase().trim()

  let reasoningText = `Analyzing user prompt and workspace context at ${projectRoot} using ${selectedModel}...`
  let responseText = ''

  if (lower === 'hey' || lower === 'hello' || lower === 'hi') {
    reasoningText = `Recognized friendly greeting. Initializing RivoCode agent assistance on ${selectedModel}.`
    responseText = `Hello! 👋 I am **RivoCode**, your agentic AI coding assistant created by **Sanket Padhyal** (running on **${selectedModel}**).\n\nI'm connected to your workspace (\`${projectRoot}\`) and ready to help you:\n\n- 🔍 **Explore Codebase**: Read, search, and analyze project files\n- ⚡ **Build & Refactor**: Write code, create components, fix bugs\n- 🛠️ **Run Terminal Commands**: Execute builds, tests, and scripts\n\nHow can I help you build today?`
  } else if (lower.includes('test') || lower.includes('check')) {
    reasoningText = `Checking testing suites and project verification scripts with ${selectedModel}.`
    responseText = `I'm analyzing the workspace for test suites using **${selectedModel}**.\n\nEverything looks clear and ready. You can specify a test command or file to run checks on.`
  } else {
    reasoningText = `Processing request: "${prompt}". Preparing execution plan with ${selectedModel} in ${agentMode} mode.`
    responseText = `I have received your request:\n\n> *${prompt}*\n\n### 🚀 Execution Plan (${selectedModel}):\n1. **Inspect Workspace**: Check relevant source files and dependencies\n2. **Plan & Implement**: Apply clean changes adhering to project conventions\n3. **Verify & Test**: Ensure zero regression and type safety\n\n\`\`\`ts\n// RivoCode Agent Active (${selectedModel})\nconsole.log("Ready to execute your instructions in ${agentMode} mode.");\n\`\`\`\n\nTell me what specific file or task you would like to begin with!`
  }

  // 1. Add reasoning / thinking block
  updater.addBlock({
    type: 'text',
    textType: 'reasoning',
    content: reasoningText,
    thinkingOpen: true,
  })

  // Short pause for thinking feel
  await new Promise((r) => setTimeout(r, 600))
  if (signal.aborted) return

  // 2. Add text content block and stream tokens
  updater.addBlock({
    type: 'text',
    textType: 'text',
    content: '',
  })

  const words = responseText.split(' ')
  let currentAccumulated = ''

  for (let i = 0; i < words.length; i++) {
    if (signal.aborted) return
    currentAccumulated += (i === 0 ? '' : ' ') + words[i]
    const textSnapshot = currentAccumulated

    updater.updateAiMessageBlocks((blocks) => {
      return blocks.map((block) => {
        if (block.type === 'text' && (block as any).textType === 'text') {
          return {
            ...block,
            content: textSnapshot,
          }
        }
        return block
      })
    })

    await new Promise((r) => setTimeout(r, 20))
  }

  // 3. Mark complete & set follow-ups in chat store
  useChatStore.getState().setFollowups([
    {
      label: 'Explore files',
      prompt: 'List and explain the main files in this project',
    },
    {
      label: 'Show project info',
      prompt: 'Summarize the architecture and dependencies of this workspace',
    },
    {
      label: 'Help build a feature',
      prompt: 'Help me design and implement a new feature',
    },
  ])

  updater.markComplete()

  const fakeRunState: RunState = {
    traceSessionId: aiMessageId,
    output: {
      type: 'text',
      message: responseText,
    },
  }

  onComplete(fakeRunState)
}
