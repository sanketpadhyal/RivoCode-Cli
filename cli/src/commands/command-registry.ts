import { safeOpen } from '../utils/open-url'

import { handleAdsEnable, handleAdsDisable } from './ads'
import { handleCopyConversationCommand } from './copy-conversation'
import { handleHelpCommand } from './help'
import { handleImageCommand } from './image'
import { handleInitializationFlowLocally } from './init'
import {
  collectProcessDiagnostics,
  formatProcessDiagnostics,
} from './process-diagnostics'
import { buildInterviewPrompt, buildPlanPrompt, buildReviewPromptFromArgs } from './prompt-builders'
import { handleReasoningCommand } from './reasoning'
import { runBashCommand } from './router'
import { handleUsageCommand } from './usage'
import { returnToFreebuffLanding } from '../hooks/use-freebuff-session'
import { useThemeStore } from '../hooks/use-theme'
import { LOGIN_WEBSITE_URL, WEBSITE_URL } from '../login/constants'
import { startNewChat } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { stopActiveRun } from '../utils/active-run'
import { useFeedbackStore } from '../state/feedback-store'
import { useLoginStore } from '../state/login-store'
import { AGENT_MODES, END_SESSION_MESSAGE, IS_FREEBUFF } from '../utils/constants'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { getSystemMessage, getUserMessage } from '../utils/message-history'
import { capturePendingAttachments } from '../utils/pending-attachments'
import { getSkillByName } from '../utils/skill-registry'

import type { MultilineInputHandle } from '../components/multiline-input'
import type { InputValue, PendingAttachment } from '../types/store'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { User } from '../utils/auth'
import type { AgentMode } from '../utils/constants'
import type { UseMutationResult } from '@tanstack/react-query'

export type RouterParams = {
  agentMode: AgentMode
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  inputValue: string
  isChainInProgressRef: React.MutableRefObject<boolean>
  isStreaming: boolean
  logoutMutation: UseMutationResult<boolean, Error, void, unknown>
  streamMessageIdRef: React.MutableRefObject<string | null>
  addToQueue: (message: string, attachments?: PendingAttachment[]) => void
  clearMessages: () => void
  saveToHistory: (message: string) => void
  scrollToLatest: () => void
  sendMessage: SendMessageFn
  setCanProcessQueue: (value: React.SetStateAction<boolean>) => void
  setInputFocused: (focused: boolean) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  setIsAuthenticated: (value: React.SetStateAction<boolean | null>) => void
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  setUser: (value: React.SetStateAction<User | null>) => void
}

export type CommandResult = {
  openFeedbackMode?: boolean
  openPublishMode?: boolean
  openChatHistory?: boolean
  openReviewScreen?: boolean
  openQueuePanel?: boolean
  preSelectAgents?: string[]
} | void

export type CommandHandler = (
  params: RouterParams,
  args: string,
) => Promise<CommandResult> | CommandResult

export type CommandDefinition = {
  name: string
  aliases: string[]
  handler: CommandHandler
  acceptsArgs: boolean
}

type CommandHandlerNoArgs = (
  params: RouterParams,
) => Promise<CommandResult> | CommandResult

type CommandHandlerWithArgs = (
  params: RouterParams,
  args: string,
) => Promise<CommandResult> | CommandResult

type CommandConfig = {
  name: string
  aliases?: string[]
  handler: CommandHandlerNoArgs
}

type CommandWithArgsConfig = {
  name: string
  aliases?: string[]
  handler: CommandHandlerWithArgs
}

export function defineCommand(config: CommandConfig): CommandDefinition {
  return {
    name: config.name,
    aliases: config.aliases ?? [],
    acceptsArgs: false,
    handler: (params) => {
      return config.handler(params)
    },
  }
}

export function defineCommandWithArgs(
  config: CommandWithArgsConfig,
): CommandDefinition {
  return {
    name: config.name,
    aliases: config.aliases ?? [],
    acceptsArgs: true,
    handler: config.handler,
  }
}

const clearInput = (params: RouterParams) => {
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
}

const FREEBUFF_REMOVED_COMMANDS = new Set([
  'ads:enable',
  'ads:disable',
  'usage',
  'subscribe',
  'image',
  'publish',
  'gpt-5-agent',
])

const FREEBUFF_ONLY_COMMANDS = new Set([
  'plan',
  'end-session',
  'dashboard',
  'reasoning',
])

const ALL_COMMANDS: CommandDefinition[] = [
  defineCommand({
    name: 'ads:enable',
    handler: (params) => {
      const { postUserMessage } = handleAdsEnable()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'ads:disable',
    handler: (params) => {
      const { postUserMessage } = handleAdsDisable()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'help',
    aliases: ['h', '?'],
    handler: async (params) => {
      const { postUserMessage } = await handleHelpCommand()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'diagnostics',
    aliases: ['diag', 'processes'],
    handler: (params) => {
      const diagnostics = formatProcessDiagnostics(collectProcessDiagnostics())
      params.setMessages((prev) => [...prev, getSystemMessage(diagnostics)])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'copy',
    aliases: ['copy-chat', 'export'],
    handler: async (params) => {
      await handleCopyConversationCommand(params)
    },
  }),
  defineCommandWithArgs({
    name: 'feedback',
    aliases: ['bug', 'report'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      if (trimmedArgs) {
        useFeedbackStore.getState().setFeedbackText(trimmedArgs)
        useFeedbackStore.getState().setFeedbackCursor(trimmedArgs.length)
      }

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      return { openFeedbackMode: true }
    },
  }),
  defineCommandWithArgs({
    name: 'bash',
    aliases: ['!'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      if (trimmedArgs) {
        const commandWithBang = '!' + trimmedArgs
        params.saveToHistory(commandWithBang)
        clearInput(params)
        runBashCommand(trimmedArgs)
        return
      }

      useChatStore.getState().setInputMode('bash')
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'login',
    aliases: ['signin'],
    handler: (params) => {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          "You're already in the app. Use /logout to switch accounts.",
        ),
      ])
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'logout',
    aliases: ['signout'],
    handler: (params) => {
      stopActiveRun('logout')

      const { resetLoginState } = useLoginStore.getState()
      params.logoutMutation.mutate(undefined, {
        onSettled: () => {
          resetLoginState()
          params.setMessages((prev) => [
            ...prev,
            getSystemMessage('Logged out.'),
          ])
          clearInput(params)
          setTimeout(() => {
            stopActiveRun('logout')
            params.setUser(null)
            params.setIsAuthenticated(false)
          }, 300)
        },
      })
    },
  }),
  defineCommand({
    name: 'exit',
    aliases: ['quit', 'q'],
    handler: () => {
      void exitCliCleanly()
    },
  }),
  defineCommandWithArgs({
    name: 'new',
    aliases: ['n', 'clear', 'c', 'reset'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      stopActiveRun('new-chat')

      params.setMessages(() => [])
      params.clearMessages()
      startNewChat()
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      if (trimmedArgs) {
        params.setCanProcessQueue(true)
        params.sendMessage({
          content: trimmedArgs,
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
      } else {
        params.setCanProcessQueue(false)
      }
    },
  }),
  defineCommand({
    name: 'init',
    handler: async (params) => {
      const { postUserMessage } = handleInitializationFlowLocally()
      const trimmed = params.inputValue.trim()

      params.saveToHistory(trimmed)
      clearInput(params)

      if (
        params.isStreaming ||
        params.streamMessageIdRef.current ||
        params.isChainInProgressRef.current
      ) {
        const pendingAttachments = capturePendingAttachments()
        params.addToQueue(trimmed, pendingAttachments)
        params.setInputFocused(true)
        params.inputRef.current?.focus()
        return
      }

      params.sendMessage({
        content: trimmed,
        agentMode: params.agentMode,
        postUserMessage,
      })
      setTimeout(() => {
        params.scrollToLatest()
      }, 0)
    },
  }),
  defineCommand({
    name: 'usage',
    aliases: ['credits'],
    handler: async (params) => {
      const { postUserMessage } = await handleUsageCommand()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'subscribe',
    aliases: ['strong', 'sub', 'buy-credits'],
    handler: (params) => {
      safeOpen(WEBSITE_URL + '/subscribe')
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'dashboard',
    aliases: ['usage', 'stats', 'streak'],
    handler: (params) => {
      const url = `${LOGIN_WEBSITE_URL}/account`
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(
          `Opening your dashboard: ${url}\n\nStreak, activity, tokens, sessions and settings for your account — across the CLI, Desktop and web.`,
        ),
      ])
      void safeOpen(url)
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommandWithArgs({
    name: 'image',
    aliases: ['img', 'attach'],
    handler: async (params, args) => {
      const trimmedArgs = args.trim()

      if (trimmedArgs) {
        await handleImageCommand(trimmedArgs)
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      useChatStore.getState().setInputMode('image')
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  ...(IS_FREEBUFF ? [] : AGENT_MODES).map((mode) =>
    defineCommandWithArgs({
      name: `mode:${mode.toLowerCase()}`,
      aliases: [`model:${mode.toLowerCase()}`],
      handler: (params, args) => {
        const trimmedArgs = args.trim()

        useChatStore.getState().setAgentMode(mode)
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(`Switched to ${mode} mode.`),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)

        if (trimmedArgs) {
          params.setCanProcessQueue(true)
          params.sendMessage({
            content: trimmedArgs,
            agentMode: mode,
          })
          setTimeout(() => {
            params.scrollToLatest()
          }, 0)
        }
      },
    }),
  ),
  defineCommandWithArgs({
    name: 'publish',
    handler: (params, args) => {
      const trimmedArgs = args.trim()
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      if (trimmedArgs) {
        const agentIds = trimmedArgs.split(/\s+/).filter(Boolean)
        return { openPublishMode: true, preSelectAgents: agentIds }
      }

      return { openPublishMode: true }
    },
  }),
  defineCommand({
    name: 'gpt-5-agent',
    handler: (params) => {
      params.setInputValue({
        text: '@GPT-5 Agent ',
        cursorPosition: '@GPT-5 Agent '.length,
        lastEditDueToNav: false,
      })
      params.inputRef.current?.focus()
    },
  }),
  defineCommand({
    name: 'history',
    aliases: ['chats'],
    handler: (params) => {
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      return { openChatHistory: true }
    },
  }),
  defineCommandWithArgs({
    name: 'interview',
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      if (trimmedArgs) {
        params.sendMessage({
          content: buildInterviewPrompt(trimmedArgs),
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
        return
      }

      useChatStore.getState().setInputMode('interview')
    },
  }),
  defineCommandWithArgs({
    name: 'plan',
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      if (trimmedArgs) {
        params.sendMessage({
          content: buildPlanPrompt(trimmedArgs),
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
        return
      }

      useChatStore.getState().setInputMode('plan')
    },
  }),
  defineCommandWithArgs({
    name: 'review',
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      if (trimmedArgs) {
        params.sendMessage({
          content: buildReviewPromptFromArgs(trimmedArgs),
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
        return
      }

      return { openReviewScreen: true }
    },
  }),
  defineCommand({
    name: 'queue',
    aliases: ['queued'],
    handler: (params) => {
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      return { openQueuePanel: true }
    },
  }),
  defineCommand({
    name: 'theme:toggle',
    handler: (params) => {
      const { theme, setThemeName } = useThemeStore.getState()
      const newTheme = theme.name === 'dark' ? 'light' : 'dark'
      setThemeName(newTheme)
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(`Switched to ${newTheme} theme.`),
      ])
      clearInput(params)
    },
  }),
  defineCommandWithArgs({
    name: 'reasoning',
    aliases: ['effort', 'think'],
    handler: (params, args) => {
      const { message } = handleReasoningCommand(args)
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(message),
      ])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'end-session',
    aliases: ['model'],
    handler: (params) => {
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(END_SESSION_MESSAGE),
      ])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      returnToFreebuffLanding({ resetChat: true }).catch(() => {
      })
    },
  }),
]

export const COMMAND_REGISTRY: CommandDefinition[] = IS_FREEBUFF
  ? ALL_COMMANDS.filter((cmd) => !FREEBUFF_REMOVED_COMMANDS.has(cmd.name))
  : ALL_COMMANDS.filter((cmd) => !FREEBUFF_ONLY_COMMANDS.has(cmd.name))

export function findCommand(cmd: string): CommandDefinition | undefined {
  const lowerCmd = cmd.toLowerCase()

  const staticCommand = COMMAND_REGISTRY.find(
    (def) => def.name === lowerCmd || def.aliases.includes(lowerCmd),
  )
  if (staticCommand) {
    return staticCommand
  }

  if (lowerCmd.startsWith('skill:')) {
    const skillName = lowerCmd.slice('skill:'.length)
    const skill = getSkillByName(skillName)
    if (skill) {
      return createSkillCommand(skill.name)
    }
  }

  return undefined
}

function createSkillCommand(skillName: string): CommandDefinition {
  return defineCommandWithArgs({
    name: skillName,
    handler: (params, args) => {
      const skill = getSkillByName(skillName)
      if (!skill) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(`Skill not found: ${skillName}`),
        ])
        params.saveToHistory(params.inputValue.trim())
        params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
        return
      }

      const trimmed = params.inputValue.trim()
      params.saveToHistory(trimmed)
      params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

      const skillContext = `<skill name="${skill.name}">
${skill.content}
</skill>`

      const userPrompt = `I invoke the following skill:\n\n${skillContext}\n\n`
        + (args.trim()
          ? `User request: ${args.trim()}`
          : '')

      if (
        params.isStreaming ||
        params.streamMessageIdRef.current ||
        params.isChainInProgressRef.current
      ) {
        const pendingAttachments = capturePendingAttachments()
        params.addToQueue(userPrompt, pendingAttachments)
        params.setInputFocused(true)
        params.inputRef.current?.focus()
        return
      }

      params.sendMessage({
        content: userPrompt,
        agentMode: params.agentMode,
      })
      setTimeout(() => {
        params.scrollToLatest()
      }, 0)
    },
  })
}
