import fs from 'fs'
import path from 'path'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Chat } from './chat'
import { ChatHistoryScreen } from './components/chat-history-screen'
import { ChatRuntimeProvider } from './contexts/chat-runtime-context'
import { SettingUpSession } from './settingup/settingupsession'
import { ContinueWorkScreen } from './workspace/continue-work-screen'
import {
  clearChatTexts,
  initProjectWorkspace,
  updateProjectContext,
  updateProjectSettings,
} from './workspace/project-context'
import { ModelPickerScreen } from './components/model-picker-screen'
import { ApiKeySetupScreen } from './components/api-key-setup-screen'
import { WorkspaceTrustScreen } from './components/workspace-trust-screen'
import { resolveApiKey, resolveModelRoute } from './utils/real-ai-service'
import {
  isWorkspaceTrusted as checkWorkspaceTrusted,
  trustWorkspace,
} from './utils/trusted-workspaces'
import { useTerminalFocus } from './hooks/use-terminal-focus'
import { getProjectRoot, startNewChat } from './project-files'
import { useChatHistoryStore } from './state/chat-history-store'
import { stopActiveRun } from './utils/active-run'
import { useChatStore } from './state/chat-store'
import type { TopBannerType } from './types/store'
import { findGitRoot } from './utils/git'

import type { MultilineInputHandle } from './components/multiline-input'
import type { AgentMode } from './utils/constants'
import type { FileTreeNode } from '@rivocode/common/util/file'

interface AppProps {
  initialPrompt: string | null
  agentId?: string
  fileTree: FileTreeNode[]
  continueChat: boolean
  continueChatId?: string
  initialMode?: AgentMode
  showProjectPicker: boolean
  onProjectChange: (projectPath: string) => void
}

export const App = ({
  initialPrompt,
  agentId,
  fileTree,
  continueChat,
  continueChatId,
  initialMode,
  showProjectPicker,
  onProjectChange,
}: AppProps) => {
  const inputRef = useRef<MultilineInputHandle | null>(null)
  const initialPromptConsumedRef = useRef(false)
  const consumeInitialPrompt = useCallback(() => {
    if (!initialPrompt || initialPromptConsumedRef.current) {
      return null
    }
    initialPromptConsumedRef.current = true
    return initialPrompt
  }, [initialPrompt])
  const {
    setInputFocused,
    setIsFocusSupported,
    resetChatStore,
    activeTopBanner,
    setActiveTopBanner,
    closeTopBanner,
    chatSessionId,
    selectedModel,
  } = useChatStore(
    useShallow((store) => ({
      setInputFocused: store.setInputFocused,
      setIsFocusSupported: store.setIsFocusSupported,
      resetChatStore: store.reset,
      activeTopBanner: store.activeTopBanner,
      setActiveTopBanner: store.setActiveTopBanner,
      closeTopBanner: store.closeTopBanner,
      chatSessionId: store.chatSessionId,
      selectedModel: store.selectedModel,
    })),
  )

  const handleSupportDetected = useCallback(() => {
    setIsFocusSupported(true)
  }, [setIsFocusSupported])

  useTerminalFocus({
    onFocusChange: setInputFocused,
    onSupportDetected: handleSupportDetected,
  })

  const projectRoot = getProjectRoot()
  const gitRoot = useMemo(
    () => findGitRoot({ cwd: projectRoot }),
    [projectRoot],
  )
  const showGitRootBanner = Boolean(gitRoot && gitRoot !== projectRoot)
  const [gitRootBannerDismissed, setGitRootBannerDismissed] = useState(false)
  const prevTopBannerRef = useRef<TopBannerType | null>(null)

  useEffect(() => {
    setGitRootBannerDismissed(false)
  }, [projectRoot])

  useEffect(() => {
    const prevBanner = prevTopBannerRef.current
    if (
      prevBanner === 'gitRoot' &&
      activeTopBanner === null &&
      showGitRootBanner
    ) {
      setGitRootBannerDismissed(true)
    }
    prevTopBannerRef.current = activeTopBanner
  }, [activeTopBanner, showGitRootBanner])

  useEffect(() => {
    if (!showGitRootBanner) {
      if (activeTopBanner === 'gitRoot') {
        closeTopBanner()
      }
      return
    }
    if (!gitRootBannerDismissed && activeTopBanner === null) {
      setActiveTopBanner('gitRoot')
    }
  }, [
    activeTopBanner,
    closeTopBanner,
    gitRootBannerDismissed,
    setActiveTopBanner,
    showGitRootBanner,
  ])

  const handleSwitchToGitRoot = useCallback(() => {
    if (gitRoot) {
      onProjectChange(gitRoot)
    }
  }, [gitRoot, onProjectChange])

  const { showChatHistory, closeChatHistory } = useChatHistoryStore()

  const [resumeChatId, setResumeChatId] = useState<string | null>(null)

  const handleResumeChat = useCallback(
    (chatId: string) => {
      stopActiveRun('history-resume')
      closeChatHistory()
      resetChatStore()
      setResumeChatId(chatId)
    },
    [closeChatHistory, resetChatStore],
  )

  const handleNewChat = useCallback(() => {
    stopActiveRun('new-chat')
    closeChatHistory()
    resetChatStore()
    startNewChat()
    setResumeChatId(null)
  }, [closeChatHistory, resetChatStore])

  const effectiveContinueChat = continueChat || resumeChatId !== null
  const effectiveContinueChatId = resumeChatId ?? continueChatId

  const hadExistingWorkspace = useMemo(
    () => fs.existsSync(path.join(projectRoot, '.rivocode', 'context.json')),
    [projectRoot],
  )
  const workspaceInit = useMemo(
    () => initProjectWorkspace(projectRoot),
    [projectRoot],
  )
  const [isSettingUpComplete, setIsSettingUpComplete] = useState(false)
  const [continueWorkDismissed, setContinueWorkDismissed] = useState(false)
  const [isWorkspaceTrusted, setIsWorkspaceTrusted] = useState(false)
  const [isModelSelected, setIsModelSelected] = useState(false)
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false)

  if (!isSettingUpComplete) {
    return (
      <SettingUpSession
        isReturning={hadExistingWorkspace}
        onComplete={() => {
          setIsSettingUpComplete(true)
        }}
      />
    )
  }

  if (workspaceInit.isReturningWork && !continueWorkDismissed) {
    return (
      <ContinueWorkScreen
        context={workspaceInit.context}
        onContinue={() => {
          const modelToUse =
            workspaceInit.settings.model ||
            workspaceInit.context.lastModel ||
            'gemini-3.6-flash'
          useChatStore.getState().setSelectedModel(modelToUse)
          trustWorkspace(projectRoot)
          setIsWorkspaceTrusted(true)
          setIsModelSelected(true)
          setIsApiKeyConfigured(true)
          setContinueWorkDismissed(true)
        }}
        onStartFresh={() => {
          clearChatTexts(projectRoot)
          useChatStore.getState().setMessages([])
          startNewChat()
          trustWorkspace(projectRoot)
          setIsWorkspaceTrusted(true)
          setIsModelSelected(false)
          setIsApiKeyConfigured(false)
          setContinueWorkDismissed(true)
        }}
      />
    )
  }

  if (!isWorkspaceTrusted) {
    return (
      <WorkspaceTrustScreen
        workspacePath={projectRoot}
        onTrust={() => {
          trustWorkspace(projectRoot)
          setIsWorkspaceTrusted(true)
        }}
      />
    )
  }

  if (!isModelSelected) {
    return (
      <ModelPickerScreen
        onSelectModel={(model) => {
          useChatStore.getState().setSelectedModel(model.name)
          updateProjectContext(projectRoot, { lastModel: model.name })
          updateProjectSettings(projectRoot, { model: model.name })
          setIsModelSelected(true)
          setIsApiKeyConfigured(false)
        }}
        onBack={() => {
          setIsWorkspaceTrusted(false)
        }}
      />
    )
  }

  if (!isApiKeyConfigured) {
    const activeModel = selectedModel || 'gemini-3.6-flash'
    return (
      <ApiKeySetupScreen
        key={`apikey-${activeModel}`}
        modelName={activeModel}
        onComplete={() => {
          setIsApiKeyConfigured(true)
        }}
        onBack={() => {
          setIsModelSelected(false)
        }}
      />
    )
  }

  return (
    <ChatSurface
      runtimeKey={chatSessionId}
      consumeInitialPrompt={consumeInitialPrompt}
      agentId={agentId}
      fileTree={fileTree}
      inputRef={inputRef}
      continueChat={effectiveContinueChat}
      continueChatId={effectiveContinueChatId}
      initialMode={initialMode}
      gitRoot={gitRoot}
      onSwitchToGitRoot={handleSwitchToGitRoot}
      showChatHistory={showChatHistory}
      onSelectChat={handleResumeChat}
      onCancelChatHistory={closeChatHistory}
      onNewChat={handleNewChat}
    />
  )
}

interface ChatSurfaceProps {
  runtimeKey: string
  consumeInitialPrompt: () => string | null
  agentId?: string
  fileTree: FileTreeNode[]
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  continueChat: boolean
  continueChatId: string | undefined
  initialMode: AgentMode | undefined
  gitRoot: string | null | undefined
  onSwitchToGitRoot: () => void
  showChatHistory: boolean
  onSelectChat: (chatId: string) => void
  onCancelChatHistory: () => void
  onNewChat: () => void
}

const ChatSurface = (props: ChatSurfaceProps) => {
  return (
    <ChatRuntimeProvider
      key={props.runtimeKey}
      agentId={props.agentId}
      inputRef={props.inputRef}
      continueChat={props.continueChat}
      continueChatId={props.continueChatId}
    >
      <ChatSurfaceRoutes {...props} />
    </ChatRuntimeProvider>
  )
}

const ChatSurfaceRoutes = ({
  consumeInitialPrompt,
  fileTree,
  inputRef,
  initialMode,
  gitRoot,
  onSwitchToGitRoot,
  showChatHistory,
  onSelectChat,
  onCancelChatHistory,
  onNewChat,
}: ChatSurfaceProps) => {
  if (showChatHistory) {
    return (
      <ChatHistoryScreen
        onSelectChat={onSelectChat}
        onCancel={onCancelChatHistory}
        onNewChat={onNewChat}
      />
    )
  }

  return (
    <Chat
      consumeInitialPrompt={consumeInitialPrompt}
      fileTree={fileTree}
      inputRef={inputRef}
      initialMode={initialMode}
      gitRoot={gitRoot}
      onSwitchToGitRoot={onSwitchToGitRoot}
    />
  )
}
