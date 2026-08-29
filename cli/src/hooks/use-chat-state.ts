
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useChatStore } from '../state/chat-store'

import type { InputValue, PendingBashMessage } from '../types/store'
import type { ChatMessage } from '../types/chat'
import type { AgentMode } from '../utils/constants'

export interface UseChatStateReturn {
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  inputFocused: boolean
  setInputFocused: (focused: boolean) => void

  slashSelectedIndex: number
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  agentSelectedIndex: number
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void

  streamingAgents: Set<string>
  focusedAgentId: string | null
  setFocusedAgentId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void

  messages: ChatMessage[]
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void

  agentMode: AgentMode
  setAgentMode: (mode: AgentMode) => void
  toggleAgentMode: () => void

  isRetrying: boolean
  isCapacityWait: boolean

  pendingBashMessages: PendingBashMessage[]
}

export function useChatState(): UseChatStateReturn {
  const {
    inputValue,
    cursorPosition,
    lastEditDueToNav,
    setInputValue,
    inputFocused,
    setInputFocused,
    slashSelectedIndex,
    setSlashSelectedIndex,
    agentSelectedIndex,
    setAgentSelectedIndex,
    streamingAgents: rawStreamingAgents,
    focusedAgentId,
    setFocusedAgentId,
    messages,
    setMessages,
    agentMode,
    setAgentMode,
    toggleAgentMode,
    isRetrying,
    isCapacityWait,
  } = useChatStore(
    useShallow((store) => ({
      inputValue: store.inputValue,
      cursorPosition: store.cursorPosition,
      lastEditDueToNav: store.lastEditDueToNav,
      setInputValue: store.setInputValue,
      inputFocused: store.inputFocused,
      setInputFocused: store.setInputFocused,
      slashSelectedIndex: store.slashSelectedIndex,
      setSlashSelectedIndex: store.setSlashSelectedIndex,
      agentSelectedIndex: store.agentSelectedIndex,
      setAgentSelectedIndex: store.setAgentSelectedIndex,
      streamingAgents: store.streamingAgents,
      focusedAgentId: store.focusedAgentId,
      setFocusedAgentId: store.setFocusedAgentId,
      messages: store.messages,
      setMessages: store.setMessages,
      agentMode: store.agentMode,
      setAgentMode: store.setAgentMode,
      toggleAgentMode: store.toggleAgentMode,
      isRetrying: store.isRetrying,
      isCapacityWait: store.isCapacityWait,
    })),
  )

  const pendingBashMessages = useChatStore((state) => state.pendingBashMessages)

  const streamingAgentsKey = useMemo(
    () => Array.from(rawStreamingAgents).sort().join(','),
    [rawStreamingAgents],
  )
  const streamingAgents = useMemo(
    () => rawStreamingAgents,
    [streamingAgentsKey],
  )

  return {
    inputValue,
    cursorPosition,
    lastEditDueToNav,
    setInputValue,
    inputFocused,
    setInputFocused,

    slashSelectedIndex,
    setSlashSelectedIndex,
    agentSelectedIndex,
    setAgentSelectedIndex,

    streamingAgents,
    focusedAgentId,
    setFocusedAgentId,

    messages,
    setMessages,

    agentMode,
    setAgentMode,
    toggleAgentMode,

    isRetrying,
    isCapacityWait,

    pendingBashMessages,
  }
}
