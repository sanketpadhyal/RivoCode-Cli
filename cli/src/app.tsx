import { isRetryableStatusCode, getErrorStatusCode } from '@rivocode/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Chat } from './chat'
import { ChatHistoryScreen } from './components/chat-history-screen'
import { ChatRuntimeProvider } from './contexts/chat-runtime-context'
import { FreebuffSupersededScreen } from './components/freebuff-superseded-screen'
import { LoginModal } from './components/login-modal'
import { ProjectPickerScreen } from './components/project-picker-screen'
import { SigningInScreen } from './components/signing-in-screen'
import { WorkspaceTrustScreen } from './components/workspace-trust-screen'
import { DEFAULT_BYPASS_USER, saveUserCredentials } from './utils/auth'
import {
  isWorkspaceTrusted as checkWorkspaceTrusted,
  trustWorkspace,
} from './utils/trusted-workspaces'
import { FreebuffLandingScreen } from './components/freebuff-landing-screen'
import { useAuthQuery } from './hooks/use-auth-query'
import { useAuthState } from './hooks/use-auth-state'
import { useFreebuffSession } from './hooks/use-freebuff-session'
import { useTerminalFocus } from './hooks/use-terminal-focus'
import { getProjectRoot, startNewChat } from './project-files'
import { useChatHistoryStore } from './state/chat-history-store'
import { stopActiveRun } from './utils/active-run'
import { useChatStore } from './state/chat-store'
import type { TopBannerType } from './types/store'
import { IS_FREEBUFF } from './utils/constants'
import { findGitRoot } from './utils/git'

import type { MultilineInputHandle } from './components/multiline-input'
import type { AgentMode } from './utils/constants'
import type { AuthStatus } from './utils/status-indicator-state'
import type { FileTreeNode } from '@rivocode/common/util/file'

interface AppProps {
  initialPrompt: string | null
  agentId?: string
  requireAuth: boolean | null
  hasInvalidCredentials: boolean
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
  requireAuth,
  hasInvalidCredentials,
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
  } = useChatStore(
    useShallow((store) => ({
      setInputFocused: store.setInputFocused,
      setIsFocusSupported: store.setIsFocusSupported,
      resetChatStore: store.reset,
      activeTopBanner: store.activeTopBanner,
      setActiveTopBanner: store.setActiveTopBanner,
      closeTopBanner: store.closeTopBanner,
      chatSessionId: store.chatSessionId,
    })),
  )

  const handleSupportDetected = useCallback(() => {
    setIsFocusSupported(true)
  }, [setIsFocusSupported])

  useTerminalFocus({
    onFocusChange: setInputFocused,
    onSupportDetected: handleSupportDetected,
  })

  const authQuery = useAuthQuery()

  const {
    isAuthenticated,
    setIsAuthenticated,
    setUser,
    handleLoginSuccess,
    logoutMutation,
  } = useAuthState({
    requireAuth,
    inputRef,
    setInputFocused,
    resetChatStore,
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

  const authError = authQuery.error
  const authErrorStatusCode = authError
    ? getErrorStatusCode(authError)
    : undefined

  let authStatus: AuthStatus = 'ok'
  if (authQuery.isError && authErrorStatusCode !== undefined) {
    if (isRetryableStatusCode(authErrorStatusCode)) {
      authStatus = 'retrying'
    } else if (authErrorStatusCode >= 500) {
      authStatus = 'unreachable'
    }
  }

  const [signingInComplete, setSigningInComplete] = useState(false)
  const [isWorkspaceTrusted, setIsWorkspaceTrusted] = useState(() => checkWorkspaceTrusted(projectRoot))

  if (!signingInComplete) {
    return (
      <SigningInScreen
        onComplete={() => {
          saveUserCredentials(DEFAULT_BYPASS_USER)
          handleLoginSuccess(DEFAULT_BYPASS_USER)
          setSigningInComplete(true)
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

  if (showProjectPicker) {
    return (
      <ProjectPickerScreen
        onSelectProject={onProjectChange}
        initialPath={projectRoot}
      />
    )
  }

  return (
    <AuthedSurface
      runtimeKey={chatSessionId}
      consumeInitialPrompt={consumeInitialPrompt}
      agentId={agentId}
      fileTree={fileTree}
      inputRef={inputRef}
      setIsAuthenticated={setIsAuthenticated}
      setUser={setUser}
      logoutMutation={logoutMutation}
      continueChat={effectiveContinueChat}
      continueChatId={effectiveContinueChatId}
      authStatus={authStatus}
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

interface AuthedSurfaceProps {
  runtimeKey: string
  consumeInitialPrompt: () => string | null
  agentId?: string
  fileTree: FileTreeNode[]
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean | null>>
  setUser: React.Dispatch<
    React.SetStateAction<import('./utils/auth').User | null>
  >
  logoutMutation: ReturnType<typeof useAuthState>['logoutMutation']
  continueChat: boolean
  continueChatId: string | undefined
  authStatus: AuthStatus
  initialMode: AgentMode | undefined
  gitRoot: string | null | undefined
  onSwitchToGitRoot: () => void
  showChatHistory: boolean
  onSelectChat: (chatId: string) => void
  onCancelChatHistory: () => void
  onNewChat: () => void
}

const AuthedSurface = (props: AuthedSurfaceProps) => {
  const { session, failure: sessionFailure } = useFreebuffSession()

  return (
    <ChatRuntimeProvider
      key={props.runtimeKey}
      agentId={props.agentId}
      inputRef={props.inputRef}
      continueChat={props.continueChat}
      continueChatId={props.continueChatId}
    >
      <AuthedSurfaceRoutes
        {...props}
        session={session}
        sessionFailure={sessionFailure}
      />
    </ChatRuntimeProvider>
  )
}

const AuthedSurfaceRoutes = ({
  consumeInitialPrompt,
  fileTree,
  inputRef,
  setIsAuthenticated,
  setUser,
  logoutMutation,
  authStatus,
  initialMode,
  gitRoot,
  onSwitchToGitRoot,
  showChatHistory,
  onSelectChat,
  onCancelChatHistory,
  onNewChat,
  session,
  sessionFailure,
}: AuthedSurfaceProps & {
  session: ReturnType<typeof useFreebuffSession>['session']
  sessionFailure: ReturnType<typeof useFreebuffSession>['failure']
}) => {
  if (IS_FREEBUFF && session?.status === 'superseded') {
    return <FreebuffSupersededScreen />
  }

  if (
    IS_FREEBUFF &&
    (session === null ||
      session.status === 'none' ||
      session.status === 'country_blocked' ||
      session.status === 'banned' ||
      session.status === 'rate_limited' ||
      session.status === 'spend_limited' ||
      session.status === 'ip_capped' ||
      session.status === 'takeover_prompt')
  ) {
    return <FreebuffLandingScreen session={session} failure={sessionFailure} />
  }

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
      setIsAuthenticated={setIsAuthenticated}
      setUser={setUser}
      logoutMutation={logoutMutation}
      authStatus={authStatus}
      initialMode={initialMode}
      gitRoot={gitRoot}
      onSwitchToGitRoot={onSwitchToGitRoot}
      freebuffSession={session}
    />
  )
}
