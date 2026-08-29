import type { FileProcessingState } from './tool/write-file'
import type { ToolName } from '@rivocode/common/tools/constants'
import type {
  ClientToolCall,
  ClientToolName,
  CodebuffToolCall,
  CodebuffToolMessage,
  CodebuffToolOutput,
} from '@rivocode/common/tools/list'
import type { AgentTemplate } from '@rivocode/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@rivocode/common/types/contracts/agent-runtime'
import type { TrackEventFn } from '@rivocode/common/types/contracts/analytics'
import type { SendSubagentChunkFn } from '@rivocode/common/types/contracts/client'
import type { Logger } from '@rivocode/common/types/contracts/logger'
import type { PrintModeEvent } from '@rivocode/common/types/print-mode'
import type { AgentState, Subgoal } from '@rivocode/common/types/session-state'
import type { ProjectFileContext } from '@rivocode/common/util/file'
import type { ToolSet } from 'ai'

type PresentOrAbsent<K extends PropertyKey, V> =
  | { [P in K]: V }
  | { [P in K]: never }

export type CodebuffToolHandlerFunction<T extends ToolName = ToolName> = (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: CodebuffToolCall<T>

    agentContext: Record<string, Subgoal>
    agentState: AgentState
    agentStepId: string
    agentTemplate: AgentTemplate
    ancestorRunIds: string[]
    apiKey: string
    clientSessionId: string
    fetch: typeof globalThis.fetch
    fileContext: ProjectFileContext
    fileProcessingState: FileProcessingState
    fingerprintId: string
    fullResponse: string
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    prompt: string | undefined
    repoId: string | undefined
    repoUrl: string | undefined
    runId: string
    sendSubagentChunk: SendSubagentChunkFn
    signal: AbortSignal
    system: string
    tools: ToolSet
    trackEvent: TrackEventFn
    userId: string | undefined
    userInputId: string
    writeToClient: (chunk: string | PrintModeEvent) => void
  } & PresentOrAbsent<
    'requestClientToolCall',
    (
      toolCall: ClientToolCall<T extends ClientToolName ? T : never>,
    ) => Promise<CodebuffToolOutput<T extends ClientToolName ? T : never>>
  > &
    AgentRuntimeDeps &
    AgentRuntimeScopedDeps,
) => Promise<{
  output: CodebuffToolMessage<T>['content']
  creditsUsed?: number
}>
