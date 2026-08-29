#!/usr/bin/env bun

import './pre-init/tree-sitter-wasm'

import fs from 'fs'
import os from 'os'
import path from 'path'

import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'
import { getProjectFileTree } from '@rivocode/common/project-file-tree'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query'
import { cyan, green, red, yellow } from 'picocolors'
import React from 'react'

import { App } from './app'
import { loadPackageVersion, parseArgs } from './cli-args'
import { handlePublish } from './commands/publish'
import { runPlainLogin } from './login/plain-login'
import { initializeApp } from './init/init-app'
import { getProjectRoot, setProjectRoot } from './project-files'
import { trackEvent } from './utils/analytics'
import { getAuthToken, getAuthTokenDetails } from './utils/auth'
import { resetCodebuffClient } from './utils/codebuff-client'
import { setApiClientAuthToken } from './utils/codebuff-api'
import { IS_FREEBUFF } from './utils/constants'
import { initializeAgentRegistry } from './utils/local-agent-registry'
import { trimOversizedChatLogs } from './utils/chat-history'
import { clearLogFile, logger } from './utils/logger'
import { drainClientLogs } from './utils/log-shipper'
import { shouldShowProjectPicker } from './utils/project-picker'
import { saveRecentProject } from './utils/recent-projects'
import { startEngagementTracking } from './utils/engagement'
import {
  exitCliWithFatalError,
  installProcessCleanupHandlers,
} from './utils/renderer-cleanup'
import { startTerminalWatchdog } from './utils/terminal-watchdog'
import { installTerminalProtocolController } from './utils/terminal-protocol-controller'
import { initializeSkillRegistry } from './utils/skill-registry'
import { detectTerminalTheme } from './utils/terminal-color-detection'
import { setOscDetectedTheme } from './utils/theme-system'

import type { FileTreeNode } from '@rivocode/common/util/file'

focusManager.setEventListener(() => {
  return () => {}
})
focusManager.setFocused(true)

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

async function main(): Promise<void> {
  if (process.argv.includes('--smoke-tree-sitter')) {
    const wasmBinary = (
      globalThis as { __CODEBUFF_TREE_SITTER_WASM_BINARY__?: Uint8Array }
    ).__CODEBUFF_TREE_SITTER_WASM_BINARY__
    const wasmPath = (
      globalThis as { __CODEBUFF_TREE_SITTER_WASM_PATH__?: string }
    ).__CODEBUFF_TREE_SITTER_WASM_PATH__

    const fs = await import('fs')
    const path = await import('path')
    const execDir = path.dirname(process.execPath)
    const siblingPath = path.join(execDir, 'tree-sitter.wasm')
    let dirListing: string[] = []
    try {
      dirListing = fs.readdirSync(execDir)
    } catch (err) {
      dirListing = [
        `<readdir failed: ${err instanceof Error ? err.message : err}>`,
      ]
    }
    console.error(
      `[smoke diag] execPath=${process.execPath}\n` +
        `[smoke diag] execDir=${execDir}\n` +
        `[smoke diag] siblingPath=${siblingPath}\n` +
        `[smoke diag] siblingExists=${fs.existsSync(siblingPath)}\n` +
        `[smoke diag] dir contents (${dirListing.length}): ${dirListing.slice(0, 30).join(', ')}\n` +
        `[smoke diag] globalThis wasmPath=${wasmPath ?? '<unset>'}\n` +
        `[smoke diag] globalThis wasmBinary bytes=${wasmBinary?.byteLength ?? 0}\n`,
    )

    try {
      const { Parser } = await import('web-tree-sitter')
      let effectiveBinary = wasmBinary
      let effectivePath = wasmPath
      if (!effectiveBinary && !effectivePath && fs.existsSync(siblingPath)) {
        effectivePath = siblingPath
        effectiveBinary = new Uint8Array(fs.readFileSync(siblingPath))
      }

      if (effectiveBinary) {
        await Parser.init({ wasmBinary: effectiveBinary })
        console.log(
          `tree-sitter smoke ok (wasmBinary, ${effectiveBinary.byteLength} bytes)`,
        )
      } else if (effectivePath) {
        await Parser.init({
          locateFile: (name: string) =>
            name === 'tree-sitter.wasm' ? effectivePath! : name,
        })
        console.log(`tree-sitter smoke ok (locateFile, path=${effectivePath})`)
      } else {
        console.error(
          'tree-sitter smoke FAIL: no wasm available — pre-init published ' +
            'nothing and the sibling-of-execPath fallback also missed. See ' +
            'the diag above for paths.',
        )
        process.exit(1)
      }
      process.exit(0)
    } catch (err) {
      console.error('tree-sitter smoke FAIL:', err)
      process.exit(1)
    }
  }

  const terminalBrokerSmokeIndex = process.argv.indexOf(
    '--smoke-terminal-broker',
  )
  const endOfOptionsIndex = process.argv.indexOf('--')
  const isTerminalBrokerSmoke =
    terminalBrokerSmokeIndex !== -1 &&
    (endOfOptionsIndex === -1 || terminalBrokerSmokeIndex < endOfOptionsIndex)
  if (isTerminalBrokerSmoke) {
    const resultPath = process.argv[terminalBrokerSmokeIndex + 1]
    const exchangeDir = process.argv[terminalBrokerSmokeIndex + 2]
    if (!resultPath || !exchangeDir) {
      console.error(
        'terminal broker smoke requires <result-path> <exchange-dir>',
      )
      process.exit(2)
    }
    const { runPackagedTerminalBrokerSmoke } =
      await import('./smoke/terminal-command-broker')
    const exitCode = await runPackagedTerminalBrokerSmoke({
      resultPath,
      exchangeDir,
    })
    process.exit(exitCode)
  }

  if (process.stdin.isTTY && process.platform !== 'win32') {
    try {
      const oscTheme = await detectTerminalTheme()
      if (oscTheme) {
        setOscDetectedTheme(oscTheme)
      }
    } catch {
    }
  }

  const {
    initialPrompt,
    command,
    agent,
    clearLogs,
    continue: continueChat,
    continueId,
    cwd,
    initialMode,
  } = parseArgs()

  const isLoginCommand = command === 'login'
  const isPublishCommand = command === 'publish'
  const hasAgentOverride = Boolean(agent?.trim())

  await initializeApp({ cwd })

  setApiClientAuthToken(getAuthToken())

  if (isLoginCommand) {
    await runPlainLogin()
    return
  }

  const projectRoot = getProjectRoot()
  const homeDir = os.homedir()
  const startCwd = process.cwd()
  const showProjectPicker = shouldShowProjectPicker(startCwd, homeDir)

  trackEvent(AnalyticsEvent.APP_LAUNCHED, {
    version: loadPackageVersion(),
    platform: process.platform,
    arch: process.arch,
    hasInitialPrompt: Boolean(initialPrompt),
    hasAgentOverride: hasAgentOverride,
    continueChat,
    initialMode: initialMode ?? 'DEFAULT',
    isFreeBuff: IS_FREEBUFF,
  })
  if (IS_FREEBUFF && process.platform === 'win32') {
    void drainClientLogs()
  }

  if (isPublishCommand || !hasAgentOverride) {
    await initializeAgentRegistry()
  }

  await initializeSkillRegistry()

  if (isPublishCommand) {
    const publishIndex = process.argv.indexOf('publish')
    const agentIds = process.argv.slice(publishIndex + 1)
    const result = await handlePublish(agentIds)

    if (result.success && result.publisherId && result.agents) {
      logger.info(green('✅ Successfully published:'))
      for (const agent of result.agents) {
        logger.info(
          cyan(
            `  - ${agent.displayName} (${result.publisherId}/${agent.id}@${agent.version})`,
          ),
        )
      }
      process.exit(0)
    } else {
      logger.error(red('❌ Publish failed'))
      if (result.error) logger.error(red(`Error: ${result.error}`))
      if (result.details) logger.error(red(result.details))
      if (result.hint) logger.warn(yellow(`Hint: ${result.hint}`))
      process.exit(1)
    }
  }

  if (clearLogs) {
    clearLogFile()
  }

  setTimeout(trimOversizedChatLogs, 0)

  const queryClient = createQueryClient()

  const AppWithAsyncAuth = () => {
    const [requireAuth, setRequireAuth] = React.useState<boolean | null>(null)
    const [hasInvalidCredentials, setHasInvalidCredentials] =
      React.useState(false)
    const [fileTree, setFileTree] = React.useState<FileTreeNode[]>([])
    const [currentProjectRoot, setCurrentProjectRoot] =
      React.useState(projectRoot)
    const [showProjectPickerScreen, setShowProjectPickerScreen] =
      React.useState(showProjectPicker)

    React.useEffect(() => {
      const apiKey = getAuthTokenDetails().token ?? ''

      if (!apiKey) {
        setRequireAuth(true)
        setHasInvalidCredentials(false)
        return
      }

      setHasInvalidCredentials(true)
      setRequireAuth(false)
    }, [])

    const loadFileTree = React.useCallback(async (root: string) => {
      try {
        if (root) {
          const tree = await getProjectFileTree({
            projectRoot: root,
            fs: fs.promises,
          })
          setFileTree(tree)
        }
      } catch (error) {
      }
    }, [])

    React.useEffect(() => {
      loadFileTree(currentProjectRoot)
    }, [currentProjectRoot, loadFileTree])

    const handleProjectChange = React.useCallback(
      async (newProjectPath: string) => {
        process.chdir(newProjectPath)

        const isGitRepo = fs.existsSync(path.join(newProjectPath, '.git'))
        const pathDepth = newProjectPath.split(path.sep).filter(Boolean).length
        trackEvent(AnalyticsEvent.CHANGE_DIRECTORY, {
          isGitRepo,
          pathDepth,
          isHomeDir: newProjectPath === os.homedir(),
        })
        setProjectRoot(newProjectPath)
        resetCodebuffClient()
        saveRecentProject(newProjectPath)
        setCurrentProjectRoot(newProjectPath)
        setFileTree([])
        setShowProjectPickerScreen(false)
      },
      [],
    )

    return (
      <App
        initialPrompt={initialPrompt}
        agentId={agent}
        requireAuth={requireAuth}
        hasInvalidCredentials={hasInvalidCredentials}
        fileTree={fileTree}
        continueChat={continueChat}
        continueChatId={continueId ?? undefined}
        initialMode={initialMode}
        showProjectPicker={showProjectPickerScreen}
        onProjectChange={handleProjectChange}
      />
    )
  }

  const earlyFatalHandler = (error: unknown) =>
    exitCliWithFatalError('Fatal error during startup', error)
  process.on('uncaughtException', earlyFatalHandler)
  process.on('unhandledRejection', earlyFatalHandler)

  startTerminalWatchdog()

  const renderer = await createCliRenderer({
    backgroundColor: 'transparent',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
  })

  installProcessCleanupHandlers(renderer)
  const terminalProtocols = installTerminalProtocolController(renderer, {
    onError: (error) =>
      logger.debug(error, 'Terminal protocol transition failed'),
  })
  renderer.once('destroy', () => terminalProtocols.dispose())
  process.removeListener('uncaughtException', earlyFatalHandler)
  process.removeListener('unhandledRejection', earlyFatalHandler)

  if (IS_FREEBUFF) {
    startEngagementTracking()
  }

  createRoot(renderer).render(
    <QueryClientProvider client={queryClient}>
      <AppWithAsyncAuth />
    </QueryClientProvider>,
  )
}

void main()
