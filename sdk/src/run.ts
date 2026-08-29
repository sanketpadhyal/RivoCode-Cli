import path from 'path'

import { callMainPrompt } from '@codebuff/agent-runtime/main-prompt'
import { adjustContextTokenCountForHistoryEdit } from '@codebuff/agent-runtime/util/context-token-count'
import {
  buildUserMessageContent,
  withSystemTags,
} from '@codebuff/agent-runtime/util/messages'
import { MAX_AGENT_STEPS_DEFAULT } from '@codebuff/common/constants/agents'
import { toRepoSnapshot } from '@codebuff/common/util/file'
import { dropUnansweredToolCalls } from '@codebuff/common/util/messages'
import {
  FILE_READ_STATUS,
  toOptionalFile,
} from '@codebuff/common/constants/paths'
import {
  getMCPClient,
  listMCPTools,
  callMCPTool,
} from '@codebuff/common/mcp/client'
import {
  COMPOSIO_META_TOOL_NAMES,
  isComposioMetaToolName,
} from '@codebuff/common/constants/composio'
import { toolNames } from '@codebuff/common/tools/constants'
import { clientToolCallSchema } from '@codebuff/common/tools/list'
import { AgentOutputSchema } from '@codebuff/common/types/session-state'
import {
  FETCH_IDLE_TIMEOUT_USER_MESSAGE,
  TRANSIENT_NETWORK_ERROR_USER_MESSAGE,
  extractApiErrorDetails,
  isFetchIdleTimeoutError,
  isTransientNetworkError,
} from '@codebuff/common/util/error'
import { isSensitiveEnvFilePath } from '@codebuff/common/util/env-file-path'
import { cloneDeep } from 'lodash'

import { executeComposioToolViaServer } from './composio'
import { getErrorStatusCode } from './error-utils'
import { getAgentRuntimeImpl } from './impl/agent-runtime'
import { getUserInfoFromApiKey } from './impl/database'
import { initialSessionState, applyOverridesToSessionState } from './run-state'
import type { ComputedProjectIndex } from './run-state'
import { changeFile } from './tools/change-file'
import { applyPatchTool } from './tools/apply-patch'
import { codeSearch } from './tools/code-search'
import { glob } from './tools/glob'
import { listDirectory } from './tools/list-directory'
import { getProjectPathLookupKeys } from './tools/path-utils'
import { getFiles } from './tools/read-files'
import { readUrl } from './tools/read-url'
import { runTerminalCommand } from './tools/run-terminal-command'
import type { TerminalCommandBroker } from './tools/run-terminal-command'

import type { CustomToolDefinition } from './custom-tool'
import type { RunState } from './run-state'
import type { FileFilter } from './tools/read-files'
import type { ServerAction } from '@codebuff/common/actions'
import type { FileReadWindow } from '@codebuff/common/types/contracts/client'
import type { AgentDefinition } from '@codebuff/common/templates/initial-agents-dir/types/agent-definition'
import type { ToolName } from '@codebuff/common/tools/constants'
import type { PublishedClientToolName } from '@codebuff/common/tools/list'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type {
  AgentUsageData,
  ContextCompactionData,
} from '@codebuff/common/types/contracts/llm'
import type { TraceWriter } from '@codebuff/common/types/contracts/trace'
import type { CodebuffFileSystem } from '@codebuff/common/types/filesystem'
import type {
  Message,
  ToolMessage,
} from '@codebuff/common/types/messages/codebuff-message'
import type { ToolResultOutput } from '@codebuff/common/types/messages/content-part'
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'
import type { SessionState } from '@codebuff/common/types/session-state'
import type { SkillsMap } from '@codebuff/common/types/skill'
import type { Source } from '@codebuff/common/types/source'
import type { CodebuffSpawn } from '@codebuff/common/types/spawn'

type OverrideToolHandlers = {
  [K in PublishedClientToolName]?: (input: any) => Promise<ToolResultOutput[]>
} & {
  read_files?: (input: {
    filePaths: string[]
    fileWindows?: Record<string, FileReadWindow[]>
  }) => Promise<Record<string, string | null>>
}

function isRunPauseError(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    (('codebuffRunPaused' in error &&
      (error as { codebuffRunPaused?: unknown }).codebuffRunPaused === true) ||
      ('name' in error &&
        (error as { name?: unknown }).name === 'CodebuffRunPausedError'))
  )
}

export type CodebuffClientOptions = {
  apiKey?: string

  cwd?: string
  skillsDir?: string
  skillsLoader?: () => Promise<SkillsMap>
  includeHomeSkills?: boolean
  projectFiles?: Record<string, string>
  projectIndex?: ComputedProjectIndex
  knowledgeFiles?: Record<string, string>
  agentDefinitions?: AgentDefinition[]
  maxAgentSteps?: number
  env?: Record<string, string>
  terminalCommandBroker?: TerminalCommandBroker

  handleEvent?: (event: PrintModeEvent) => void | Promise<void>
  handleStreamChunk?: (
    chunk:
      | string
      | {
          type: 'subagent_chunk'
          agentId: string
          agentType: string
          chunk: string
        }
      | {
          type: 'reasoning_chunk'
          agentId: string
          ancestorRunIds: string[]
          chunk: string
        },
  ) => void | Promise<void>

  fileFilter?: FileFilter

  overrideTools?: OverrideToolHandlers
  customToolDefinitions?: CustomToolDefinition[]

  fsSource?: Source<CodebuffFileSystem>
  spawnSource?: Source<CodebuffSpawn>
  logger?: Logger
  traceWriter?: TraceWriter
}

export type ImageContent = {
  type: 'image'
  image: string
  mediaType: string
}

export type TextContent = {
  type: 'text'
  text: string
}

export type MessageContent = TextContent | ImageContent

export type RunOptions = {
  agent: string | AgentDefinition
  prompt: string
  userId?: string
  content?: MessageContent[]
  params?: Record<string, any>
  previousRun?: RunState
  extraToolResults?: ToolMessage[]
  signal?: AbortSignal
  drainSteeringMessages?: () => string[]
  costMode?: string
  extraCodebuffMetadata?: Record<string, string>
  onStateSnapshot?: (runState: RunState) => void
  onUsage?: (usage: AgentUsageData) => void
  onUsageIncomplete?: () => void
  onCompaction?: (data: ContextCompactionData) => void
}

const STATE_SNAPSHOT_INTERVAL_MS = 5_000

export const STATE_SNAPSHOT_INTERRUPTION_MESSAGE =
  'The session ended before this response completed. Partial progress has been preserved.'

export function cloneSessionState(
  state: SessionState,
  logger?: Logger,
): SessionState {
  let mainAgentState: SessionState['mainAgentState']
  try {
    mainAgentState = JSON.parse(JSON.stringify(state.mainAgentState))
  } catch (error) {
    logger?.debug?.(
      { error: error instanceof Error ? error.message : String(error) },
      'JSON clone of mainAgentState failed; falling back to cloneDeep',
    )
    mainAgentState = cloneDeep(state.mainAgentState)
  }
  return { fileContext: state.fileContext, mainAgentState }
}

export function buildCancelledSessionState(params: {
  sessionState: SessionState
  runtimeMadeProgress: boolean
  promptMessage?: Message
  message: string
  logger?: Logger
}): SessionState {
  const { sessionState, runtimeMadeProgress, promptMessage, message, logger } =
    params

  const state = cloneSessionState(sessionState, logger)
  const previousHistory = state.mainAgentState.messageHistory
  const nextHistory = [...dropUnansweredToolCalls(previousHistory)]

  if (!runtimeMadeProgress && promptMessage) {
    nextHistory.push(promptMessage)
  }
  nextHistory.push({
    role: 'user' as const,
    content: [{ type: 'text' as const, text: withSystemTags(message) }],
  })

  state.mainAgentState.messageHistory = nextHistory
  state.mainAgentState.contextTokenCount = adjustContextTokenCountForHistoryEdit(
    {
      contextTokenCount: state.mainAgentState.contextTokenCount,
      previousHistory,
      nextHistory,
    },
  )
  return state
}

const createAbortError = (signal?: AbortSignal) => {
  if (signal?.reason instanceof Error) {
    return signal.reason
  }
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

type RunExecutionOptions = RunOptions &
  CodebuffClientOptions & {
    apiKey: string
    fingerprintId: string
  }
type RunReturnType = RunState

export async function run(options: RunExecutionOptions): Promise<RunState> {
  const { signal } = options

  if (signal?.aborted) {
    const abortError = createAbortError(signal)
    return {
      sessionState: options.previousRun?.sessionState,
      traceSessionId:
        options.previousRun?.traceSessionId ?? crypto.randomUUID(),
      output: {
        type: 'error',
        message: abortError.message,
      },
    }
  }

  return runOnce(options)
}

async function runOnce({
  apiKey,
  fingerprintId,

  cwd,
  skillsDir,
  skillsLoader,
  includeHomeSkills,
  projectFiles,
  projectIndex,
  knowledgeFiles,
  agentDefinitions,
  maxAgentSteps = MAX_AGENT_STEPS_DEFAULT,
  env,
  terminalCommandBroker,

  handleEvent,
  handleStreamChunk,

  fileFilter,
  overrideTools,
  customToolDefinitions,

  fsSource = () => require('fs').promises,
  spawnSource,
  logger,
  traceWriter,

  agent,
  prompt,
  userId: requestedUserId,
  content,
  params,
  previousRun,
  extraToolResults,
  signal,
  drainSteeringMessages,
  costMode,
  extraCodebuffMetadata,
  onStateSnapshot,
  onUsage,
  onUsageIncomplete,
  onCompaction,
}: RunExecutionOptions): Promise<RunState> {
  const fsSourceValue = typeof fsSource === 'function' ? fsSource() : fsSource
  const fs = await fsSourceValue
  let spawn: CodebuffSpawn
  if (spawnSource) {
    const spawnSourceValue = await spawnSource
    spawn = spawnSourceValue as CodebuffSpawn
  } else {
    spawn = require('child_process').spawn as CodebuffSpawn
  }
  let activeCustomToolDefinitions = customToolDefinitions ?? []

  let agentId
  if (typeof agent !== 'string') {
    const clonedDefs = agentDefinitions ? cloneDeep(agentDefinitions) : []
    agentDefinitions = [...clonedDefs, agent]
    agentId = agent.id
  } else {
    agentId = agent
  }
  let sessionState: SessionState
  if (previousRun?.sessionState) {
    sessionState = await applyOverridesToSessionState(
      cwd,
      previousRun.sessionState,
      {
        knowledgeFiles,
        agentDefinitions,
        customToolDefinitions,
        projectFiles,
        projectIndex,
        maxAgentSteps,
      },
    )
  } else {
    sessionState = await initialSessionState({
      cwd,
      skillsDir,
      skillsLoader,
      includeHomeSkills,
      knowledgeFiles,
      agentDefinitions,
      customToolDefinitions,
      projectFiles,
      projectIndex,
      maxAgentSteps,
      fs,
      spawn,
      logger,
    })
  }
  const traceSessionId = previousRun?.traceSessionId ?? crypto.randomUUID()

  for (const toolName of COMPOSIO_META_TOOL_NAMES) {
    delete sessionState.fileContext.customToolDefinitions[toolName]
  }

  let resolvePromise: (value: RunReturnType) => any = () => {}
  let _reject: (error: any) => any = () => {}
  const promise = new Promise<RunReturnType>((res, rej) => {
    resolvePromise = res
    _reject = rej
  })

  let settled = false
  let snapshotTimer: ReturnType<typeof setInterval> | null = null
  const resolve = (value: RunReturnType) => {
    settled = true
    if (snapshotTimer !== null) {
      clearInterval(snapshotTimer)
      snapshotTimer = null
    }
    resolvePromise(value)
  }

  async function onError(error: { message: string }) {
    if (handleEvent) {
      await handleEvent({ type: 'error', message: error.message })
    }
  }

  let initialMessageHistory = sessionState.mainAgentState.messageHistory

  function getCancelledSessionState(message: string): SessionState {
    const runtimeMadeProgress =
      sessionState.mainAgentState.messageHistory !== initialMessageHistory

    return buildCancelledSessionState({
      sessionState,
      runtimeMadeProgress,
      promptMessage:
        prompt || content
          ? {
              role: 'user' as const,
              content: buildUserMessageContent(prompt, params, content),
              tags: ['USER_PROMPT'] as string[],
            }
          : undefined,
      message,
      logger,
    })
  }
  function getCancelledRunState(message?: string): RunState {
    message = message ?? 'Run cancelled by user.'
    return {
      sessionState: getCancelledSessionState(message),
      traceSessionId,
      output: {
        type: 'error',
        message,
      },
    }
  }

  const onResponseChunk = async (
    action: ServerAction<'response-chunk'>,
  ): Promise<void> => {
    if (signal?.aborted) {
      return
    }
    const { chunk } = action

    if (typeof chunk !== 'string') {
      if (chunk.type === 'reasoning_delta') {
        handleStreamChunk?.({
          type: 'reasoning_chunk',
          chunk: chunk.text,
          agentId: chunk.agentId,
          ancestorRunIds: chunk.ancestorRunIds,
        })
      } else {
        await handleEvent?.(chunk)
      }
      return
    }

    if (handleStreamChunk) {
      await handleStreamChunk(chunk)
    }
  }
  const onSubagentResponseChunk = async (
    action: ServerAction<'subagent-response-chunk'>,
  ) => {
    if (signal?.aborted) {
      return
    }
    const { agentId, agentType, chunk } = action

    if (handleStreamChunk && chunk) {
      await handleStreamChunk({
        type: 'subagent_chunk',
        agentId,
        agentType,
        chunk,
      })
    }
  }

  const agentRuntimeImpl = getAgentRuntimeImpl({
    logger,
    traceWriter,
    apiKey,
    handleStepsLogChunk: () => {
    },
    requestToolCall: async ({ userInputId, toolName, input, mcpConfig }) => {
      return handleToolCall({
        action: {
          type: 'tool-call-request',
          requestId: crypto.randomUUID(),
          userInputId,
          toolName,
          input,
          timeout: undefined,
          mcpConfig,
        },
        overrides: overrideTools ?? {},
        customToolDefinitions: activeCustomToolDefinitions
          ? Object.fromEntries(
              activeCustomToolDefinitions.map((def) => [def.toolName, def]),
            )
          : {},
        cwd,
        fs,
        env,
        terminalCommandBroker,
        apiKey,
        signal,
      })
    },
    requestMcpToolData: async ({ mcpConfig, toolNames }) => {
      const mcpClientId = await getMCPClient(mcpConfig)
      const listToolsResult = await listMCPTools(mcpClientId)
      const tools = listToolsResult.tools
      const filteredTools: typeof tools = []
      for (const tool of tools) {
        if (!toolNames) {
          filteredTools.push(tool)
          continue
        }
        if (toolNames.includes(tool.name)) {
          filteredTools.push(tool)
          continue
        }
      }

      return filteredTools
    },
    requestFiles: ({ filePaths, fileWindows }) =>
      readFiles({
        filePaths,
        fileWindows,
        override: overrideTools?.read_files,
        fileFilter,
        cwd,
        fs,
      }),
    requestOptionalFile: async ({ filePath }) => {
      const files = await readFiles({
        filePaths: [filePath],
        override: overrideTools?.read_files,
        fileFilter,
        cwd,
        fs,
        limitContent: false,
        enforceEnvPolicy: false,
      })
      const lookupKeys = cwd
        ? getProjectPathLookupKeys(cwd, filePath)
        : [filePath]
      const fileKey = lookupKeys.find((key) => key in files)
      return toOptionalFile(fileKey === undefined ? null : files[fileKey]!)
    },
    sendAction: ({ action }) => {
      if (action.type === 'action-error') {
        onError({ message: action.message })
        return
      }
      if (action.type === 'response-chunk') {
        onResponseChunk(action)
        return
      }
      if (action.type === 'subagent-response-chunk') {
        onSubagentResponseChunk(action)
        return
      }
      if (action.type === 'prompt-response') {
        handlePromptResponse({
          action,
          resolve,
          onError,
          initialSessionState: sessionState,
          traceSessionId,
        })
        return
      }
      if (action.type === 'prompt-error') {
        handlePromptResponse({
          action,
          resolve,
          onError,
          initialSessionState: sessionState,
          traceSessionId,
        })
        return
      }
    },
    sendSubagentChunk: ({
      userInputId,
      agentId,
      agentType,
      chunk,
      prompt,
      forwardToPrompt = true,
    }) => {
      onSubagentResponseChunk({
        type: 'subagent-response-chunk',
        userInputId,
        agentId,
        agentType,
        chunk,
        prompt,
        forwardToPrompt,
      })
    },
  })

  const promptId = Math.random().toString(36).substring(2, 15)

  const userInfo = await getUserInfoFromApiKey({
    ...agentRuntimeImpl,
    apiKey,
    fields: ['id'],
  })
  if (!userInfo) {
    return getCancelledRunState('Invalid API key or user not found')
  }
  const authenticatedUserId = userInfo.id
  const userId = requestedUserId ?? authenticatedUserId

  if (signal?.aborted) {
    return getCancelledRunState('Run cancelled by user.')
  }

  if (onStateSnapshot) {
    let lastSnapshotHistory: unknown = null
    const emitStateSnapshot = () => {
      if (settled || signal?.aborted) {
        return
      }
      const history = sessionState.mainAgentState.messageHistory
      if (history === lastSnapshotHistory) {
        return
      }
      lastSnapshotHistory = history
      try {
        onStateSnapshot(
          getCancelledRunState(STATE_SNAPSHOT_INTERRUPTION_MESSAGE),
        )
      } catch (error) {
        logger?.debug?.(
          { error: error instanceof Error ? error.message : String(error) },
          'onStateSnapshot handler threw',
        )
      }
    }
    emitStateSnapshot()
    snapshotTimer = setInterval(emitStateSnapshot, STATE_SNAPSHOT_INTERVAL_MS)
    if (typeof (snapshotTimer as any).unref === 'function') {
      ;(snapshotTimer as any).unref()
    }
  }

  const report = <T>(callback: ((value: T) => void) | undefined) =>
    callback
      ? (value: T) => {
          try {
            callback(value)
          } catch (error) {
            agentRuntimeImpl.logger.debug?.(
              { error: error instanceof Error ? error.message : String(error) },
              'Run metrics handler threw',
            )
          }
        }
      : undefined
  const reportSignal = (callback: (() => void) | undefined) =>
    callback
      ? () => {
          try {
            callback()
          } catch (error) {
            agentRuntimeImpl.logger.debug?.(
              { error: error instanceof Error ? error.message : String(error) },
              'Run metrics handler threw',
            )
          }
        }
      : undefined

  const repoSnapshot = toRepoSnapshot(sessionState.fileContext?.gitChanges)

  callMainPrompt({
    ...agentRuntimeImpl,
    promptId,
    action: {
      type: 'prompt',
      promptId,
      prompt,
      promptParams: params,
      content,
      fingerprintId: fingerprintId,
      costMode: costMode ?? 'normal',
      sessionState,
      toolResults: extraToolResults ?? [],
      agentId,
    },
    drainSteeringMessages,
    repoUrl: undefined,
    repoId: undefined,
    clientSessionId: promptId,
    userId,
    extraCodebuffMetadata: {
      ...(extraCodebuffMetadata ?? {}),
      trace_session_id: traceSessionId,
      ...(repoSnapshot && { repo_snapshot: JSON.stringify(repoSnapshot) }),
    },
    signal: signal ?? new AbortController().signal,
    onAgentUsageReceived: report(onUsage),
    onAgentUsageIncomplete: reportSignal(onUsageIncomplete),
    onCompaction: report(onCompaction),
  }).catch((error) => {
    let errorMessage = isFetchIdleTimeoutError(error)
      ? FETCH_IDLE_TIMEOUT_USER_MESSAGE
      : isTransientNetworkError(error)
        ? TRANSIENT_NETWORK_ERROR_USER_MESSAGE
        : error instanceof Error
          ? error.message
          : String(error ?? '')
    const apiErrorDetails = extractApiErrorDetails(error)
    const statusCode = apiErrorDetails.statusCode ?? getErrorStatusCode(error)
    const {
      countryBlockReason,
      countryCode,
      errorCode,
      ipPrivacySignals,
      message: parsedMessage,
    } = apiErrorDetails
    if (parsedMessage) {
      errorMessage = parsedMessage
    }

    resolve({
      sessionState: getCancelledSessionState(errorMessage),
      traceSessionId,
      output: {
        type: 'error',
        message: errorMessage,
        ...(statusCode !== undefined && { statusCode }),
        ...(errorCode !== undefined && { error: errorCode }),
        ...(countryCode !== undefined && { countryCode }),
        ...(countryBlockReason !== undefined && { countryBlockReason }),
        ...(ipPrivacySignals !== undefined && { ipPrivacySignals }),
      },
    })
  })

  return promise
}

function requireCwd(cwd: string | undefined, toolName: string): string {
  if (!cwd) {
    throw new Error(
      `cwd is required for the ${toolName} tool. Please provide cwd in CodebuffClientOptions or override the ${toolName} tool.`,
    )
  }
  return cwd
}

async function readFiles({
  filePaths,
  fileWindows,
  override,
  fileFilter,
  cwd,
  fs,
  limitContent,
  enforceEnvPolicy = true,
}: {
  filePaths: string[]
  fileWindows?: Record<string, FileReadWindow[]>
  override?: NonNullable<
    Required<CodebuffClientOptions>['overrideTools']['read_files']
  >
  fileFilter?: FileFilter
  cwd?: string
  fs: CodebuffFileSystem
  limitContent?: boolean
  enforceEnvPolicy?: boolean
}) {
  if (override) {
    if (!enforceEnvPolicy) {
      return await override({
        filePaths,
        ...(fileWindows ? { fileWindows } : {}),
      })
    }

    const result = Object.create(null) as Record<string, string | null>
    const readablePaths: string[] = []
    for (const filePath of filePaths) {
      if (!filePath) continue
      if (isSensitiveEnvFilePath(filePath)) {
        result[filePath] = FILE_READ_STATUS.IGNORED
      } else {
        readablePaths.push(filePath)
      }
    }
    if (readablePaths.length > 0) {
      const loadedFiles = await override({
        filePaths: readablePaths,
        ...(fileWindows ? { fileWindows } : {}),
      })
      if (
        !loadedFiles ||
        typeof loadedFiles !== 'object' ||
        Array.isArray(loadedFiles)
      ) {
        return { ...result }
      }
      for (const [filePath, content] of Object.entries(loadedFiles)) {
        result[filePath] = isSensitiveEnvFilePath(filePath)
          ? FILE_READ_STATUS.IGNORED
          : content
      }
    }
    return { ...result }
  }
  return getFiles({
    filePaths,
    cwd: requireCwd(cwd, 'read_files'),
    fs,
    fileWindows,
    fileFilter,
    limitContent,
    enforceEnvPolicy,
  })
}

async function handleToolCall({
  action,
  overrides,
  customToolDefinitions,
  cwd,
  fs,
  env,
  terminalCommandBroker,
  apiKey,
  signal,
}: {
  action: ServerAction<'tool-call-request'>
  overrides: NonNullable<CodebuffClientOptions['overrideTools']>
  customToolDefinitions: Record<string, CustomToolDefinition>
  cwd?: string
  fs: CodebuffFileSystem
  env?: Record<string, string>
  terminalCommandBroker?: TerminalCommandBroker
  apiKey: string
  signal?: AbortSignal
}): Promise<{ output: ToolResultOutput[] }> {
  const toolName = action.toolName
  const input = action.input

  if (signal?.aborted) {
    return {
      output: [
        {
          type: 'json',
          value: {
            message: 'Tool call cancelled: the run was aborted by the user.',
          },
        },
      ],
    }
  }

  if (action.mcpConfig) {
    try {
      const mcpClientId = await getMCPClient(action.mcpConfig)
      const result = await callMCPTool(
        mcpClientId,
        {
          name: toolName,
          arguments: input,
        },
        undefined,
        signal ? { signal } : undefined,
      )
      return { output: result }
    } catch (error) {
      return {
        output: [
          {
            type: 'json',
            value: {
              errorMessage:
                error instanceof Error ? error.message : String(error),
            },
          },
        ],
      }
    }
  }

  let result: ToolResultOutput[]
  if (toolNames.includes(toolName as ToolName)) {
    clientToolCallSchema.parse(action)
  } else {
    const customToolHandler = customToolDefinitions[toolName]

    if (!customToolHandler) {
      throw new Error(
        `Custom tool handler not found for user input ID ${action.userInputId}`,
      )
    }
    return {
      output: await customToolHandler.execute(action.input),
    }
  }

  try {
    let override = overrides[toolName as PublishedClientToolName]
    if (
      !override &&
      (toolName === 'str_replace' || toolName === 'apply_patch')
    ) {
      override = overrides['write_file']
    }
    if (override) {
      result = await override(input as any)
    } else if (toolName === 'end_turn') {
      result = [{ type: 'json', value: { message: 'Turn ended.' } }]
    } else if (toolName === 'write_file' || toolName === 'str_replace') {
      result = await changeFile({
        parameters: input,
        cwd: requireCwd(cwd, toolName),
        fs,
      })
    } else if (toolName === 'apply_patch') {
      result = await applyPatchTool({
        parameters: input,
        cwd: requireCwd(cwd, toolName),
        fs,
      })
    } else if (toolName === 'run_terminal_command') {
      const resolvedCwd = requireCwd(cwd, 'run_terminal_command')
      result = await runTerminalCommand({
        ...input,
        cwd: path.resolve(resolvedCwd, input.cwd ?? '.'),
        env,
        signal,
        terminalCommandBroker,
      } as Parameters<typeof runTerminalCommand>[0])
    } else if (toolName === 'read_url') {
      result = await readUrl({
        ...(input as Parameters<typeof readUrl>[0]),
        signal,
      })
    } else if (toolName === 'code_search') {
      result = await codeSearch({
        projectPath: requireCwd(cwd, 'code_search'),
        ...input,
        signal,
      } as Parameters<typeof codeSearch>[0])
    } else if (toolName === 'list_directory') {
      result = await listDirectory({
        directoryPath: (input as { path: string }).path,
        projectPath: requireCwd(cwd, 'list_directory'),
        fs,
      })
    } else if (toolName === 'glob') {
      const globInput = input as {
        pattern: string
        cwd?: string
        max_results?: number
      }
      result = await glob({
        pattern: globInput.pattern,
        projectPath: requireCwd(cwd, 'glob'),
        cwd: globInput.cwd,
        maxResults: globInput.max_results,
        fs,
      })
    } else if (toolName === 'run_file_change_hooks') {
      result = [
        {
          type: 'json',
          value: {
            message: 'File change hooks are not supported in SDK mode',
          },
        },
      ]
    } else if (isComposioMetaToolName(toolName)) {
      result = await executeComposioToolViaServer({
        apiKey,
        toolName,
        input,
      })
    } else {
      throw new Error(
        `Tool not implemented in SDK. Please provide an override or modify your agent to not use this tool: ${toolName}`,
      )
    }
  } catch (error) {
    if (isRunPauseError(error)) {
      throw error
    }

    result = [
      {
        type: 'json',
        value: {
          errorMessage:
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string'
              ? error.message
              : typeof error === 'string'
                ? error
                : 'Unknown error',
        },
      },
    ]
  }
  return {
    output: result,
  }
}

export const extractStatusCodeFromMessage = (
  errorMessage: string,
): number | undefined => {
  const lowerMessage = errorMessage.toLowerCase()

  if (
    lowerMessage.includes('failed after') &&
    lowerMessage.includes('attempts')
  ) {
    if (lowerMessage.includes('service unavailable')) {
      return 503
    }
    if (lowerMessage.includes('timeout')) {
      return 408
    }
    if (lowerMessage.includes('connection refused')) {
      return 503
    }
    return 500
  }

  if (
    errorMessage.includes('503') ||
    lowerMessage.includes('service unavailable')
  ) {
    return 503
  }
  if (errorMessage.includes('504')) {
    return 504
  }
  if (errorMessage.includes('502')) {
    return 502
  }
  if (lowerMessage.includes('timeout') || errorMessage.includes('408')) {
    return 408
  }
  if (
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('connection refused')
  ) {
    return 503
  }
  if (lowerMessage.includes('dns') || lowerMessage.includes('enotfound')) {
    return 503
  }
  if (lowerMessage.includes('server error') || errorMessage.includes('500')) {
    return 500
  }
  if (errorMessage.includes('429') || lowerMessage.includes('rate limit')) {
    return 429
  }
  if (
    lowerMessage.includes('network error') ||
    lowerMessage.includes('fetch failed')
  ) {
    return 503
  }

  return undefined
}

async function handlePromptResponse({
  action,
  resolve,
  onError,
  initialSessionState,
  traceSessionId,
}: {
  action: ServerAction<'prompt-response'> | ServerAction<'prompt-error'>
  resolve: (value: RunReturnType) => any
  onError: (error: { message: string }) => void
  initialSessionState: SessionState
  traceSessionId: string
}) {
  if (action.type === 'prompt-error') {
    onError({ message: action.message })

    const statusCode = extractStatusCodeFromMessage(action.message)
    resolve({
      sessionState: initialSessionState,
      traceSessionId,
      output: {
        type: 'error',
        message: action.message,
        ...(statusCode !== undefined && { statusCode }),
      },
    })
  } else if (action.type === 'prompt-response') {
    const parsedOutput = AgentOutputSchema.safeParse(action.output)
    if (!parsedOutput.success) {
      const message = [
        'Received invalid prompt response from server:',
        JSON.stringify(parsedOutput.error.issues),
        'If this issues persists, please contact support@codebuff.com',
      ].join('\n')
      onError({ message })
      resolve({
        sessionState: initialSessionState,
        traceSessionId,
        output: {
          type: 'error',
          message,
        },
      })
      return
    }
    const { sessionState, output } = action

    const state: RunState = {
      sessionState,
      traceSessionId,
      output: output ?? {
        type: 'error',
        message: 'No output from agent',
      },
    }
    resolve(state)
  } else {
    action satisfies never
    onError({
      message: 'Internal error: prompt response type not handled',
    })
    resolve({
      sessionState: initialSessionState,
      traceSessionId,
      output: {
        type: 'error',
        message: 'Internal error: prompt response type not handled',
      },
    })
  }
}
