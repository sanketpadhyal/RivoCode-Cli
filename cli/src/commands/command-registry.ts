import { handleCopyConversationCommand } from './copy-conversation'
import { useChatStore } from '../state/chat-store'
import { AGENT_MODES } from '../utils/constants'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { MultilineInputHandle } from '../components/multiline-input'
import type { InputValue, PendingAttachment } from '../types/store'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { AgentMode } from '../utils/constants'

export type RouterParams = {
  agentMode: AgentMode
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  inputValue: string
  isChainInProgressRef: React.MutableRefObject<boolean>
  isStreaming: boolean
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
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
}

export interface CommandDefinition {
  name: string
  aliases: string[]
  handler: (
    params: RouterParams,
    args: string,
  ) => void | CommandResult | Promise<void | CommandResult>
}

export type CommandResult = {
  openFeedbackMode?: boolean
  openReviewScreen?: boolean
  openPublishMode?: boolean
  preSelectAgents?: string[]
  openChatHistory?: boolean
  openQueuePanel?: boolean
} | void

export interface CommandConfig {
  name: string
  aliases?: string[]
  handler: (
    params: RouterParams,
  ) => void | CommandResult | Promise<void | CommandResult>
}

export interface CommandWithArgsConfig {
  name: string
  aliases?: string[]
  handler: (
    params: RouterParams,
    args: string,
  ) => void | CommandResult | Promise<void | CommandResult>
}

export function defineCommand(config: CommandConfig): CommandDefinition {
  return {
    name: config.name,
    aliases: config.aliases || [],
    handler: (params: RouterParams) => config.handler(params),
  }
}

export function defineCommandWithArgs(
  config: CommandWithArgsConfig,
): CommandDefinition {
  return {
    name: config.name,
    aliases: config.aliases || [],
    handler: config.handler,
  }
}

const clearInput = (params: RouterParams) => {
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
}

const ALL_COMMANDS: CommandDefinition[] = [
  defineCommand({
    name: 'copy',
    aliases: ['copy-chat', 'export'],
    handler: async (params) => {
      await handleCopyConversationCommand(params)
    },
  }),
  defineCommand({
    name: 'exit',
    aliases: ['quit', 'q'],
    handler: () => {
      void exitCliCleanly()
    },
  }),
  ...AGENT_MODES.map((mode) =>
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
]

export const COMMAND_REGISTRY: CommandDefinition[] = ALL_COMMANDS

export function findCommand(cmd: string): CommandDefinition | undefined {
  const lowerCmd = cmd.toLowerCase()

  const staticCommand = COMMAND_REGISTRY.find(
    (def) => def.name === lowerCmd || def.aliases.includes(lowerCmd),
  )
  if (staticCommand) {
    return staticCommand
  }

  return undefined
}
