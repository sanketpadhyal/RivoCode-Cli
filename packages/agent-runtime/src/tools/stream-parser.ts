import { toolNames } from '@codebuff/common/tools/constants'
import { buildArray } from '@codebuff/common/util/array'
import { STREAM_RECOVERY_EVENT } from '@codebuff/common/util/axiom-only-log'
import { AbortError } from '@codebuff/common/util/error'
import {
  assistantMessage,
  userMessage,
} from '@codebuff/common/util/messages'
import { generateCompactId } from '@codebuff/common/util/string'

import { processStreamWithTools } from '../tool-stream-parser'
import { INCLUDE_REASONING_IN_MESSAGE_HISTORY } from '../constants'
import {
  executeCustomToolCall,
  executeToolCall,
  parseRawToolCall,
  tryTransformAgentToolCall,
} from './tool-executor'
import { withSystemTags } from '../util/messages'
import {
  historyLeaksThinkTags,
  stripThinkScaffolding,
  ThinkTagStream,
} from '../util/think-tag-stream'

import type { CustomToolCall, ExecuteToolCallParams } from './tool-executor'
import type { ThinkStreamSegment } from '../util/think-tag-stream'
import type { AgentTemplate } from '../templates/types'
import type { FileProcessingState } from './handlers/tool/write-file'
import type { ToolName } from '@codebuff/common/tools/constants'
import type { CodebuffToolCall } from '@codebuff/common/tools/list'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { StreamRecoverySource } from '@codebuff/common/types/contracts/llm'
import type { ParamsExcluding } from '@codebuff/common/types/function-params'
import type {
  Message,
  ToolMessage,
} from '@codebuff/common/types/messages/codebuff-message'
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'
import type { Subgoal } from '@codebuff/common/types/session-state'
import type { ProjectFileContext } from '@codebuff/common/util/file'

export const STREAM_INTERRUPTED_TAG = 'STREAM_INTERRUPTED'
export const OUTPUT_LIMIT_TAG = 'OUTPUT_LIMIT'

export const MAX_CONSECUTIVE_STREAM_RECOVERIES = 3

export const REPEATED_STREAM_INTERRUPTIONS_MESSAGE =
  'The connection kept dropping mid-response after several retries. Please check your network connection and try again.'

export const REPEATED_OUTPUT_LIMIT_MESSAGE =
  'The model kept ending after reasoning without producing a response. Try a simpler request or a different model.'

const RECOVERY_BY_SOURCE: Record<
  StreamRecoverySource,
  { tag: string; giveUpMessage: string }
> = {
  'stream-interrupted': {
    tag: STREAM_INTERRUPTED_TAG,
    giveUpMessage: REPEATED_STREAM_INTERRUPTIONS_MESSAGE,
  },
  'output-limit': {
    tag: OUTPUT_LIMIT_TAG,
    giveUpMessage: REPEATED_OUTPUT_LIMIT_MESSAGE,
  },
}

const SOURCE_BY_RECOVERY_TAG: ReadonlyMap<string, StreamRecoverySource> =
  new Map(
    Object.entries(RECOVERY_BY_SOURCE).map(([source, recovery]) => [
      recovery.tag,
      source as StreamRecoverySource,
    ]),
  )

export interface TrailingStreamRecoveryStreak {
  count: number
  lastSource: StreamRecoverySource | undefined
}

export function trailingStreamRecoveryStreak(
  messages: Message[],
): TrailingStreamRecoveryStreak {
  let count = 0
  let lastSource: StreamRecoverySource | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!
    if (message.role === 'tool') break
    if (message.role !== 'user') continue
    if (message.tags?.includes('STEP_PROMPT')) continue
    const tag = message.tags?.find((t) => SOURCE_BY_RECOVERY_TAG.has(t))
    if (!tag) break
    if (count === 0) lastSource = SOURCE_BY_RECOVERY_TAG.get(tag)
    count++
  }
  return { count, lastSource }
}

export async function processStream(
  params: {
    agentContext: Record<string, Subgoal>
    agentTemplate: AgentTemplate
    ancestorRunIds: string[]
    fileContext: ProjectFileContext
    fingerprintId: string
    fullResponse: string
    logger: Logger
    messages: Message[]
    repoId: string | undefined
    runId: string
    signal: AbortSignal
    userId: string | undefined

    onCostCalculated: (credits: number) => Promise<void>
    onResponseChunk: (chunk: string | PrintModeEvent) => void
  } & Omit<
    ExecuteToolCallParams<any>,
    | 'currentAssistantMessages'
    | 'fileProcessingState'
    | 'fromHandleSteps'
    | 'fullResponse'
    | 'input'
    | 'previousToolCallFinished'
    | 'state'
    | 'toolCallId'
    | 'toolCalls'
    | 'toolCallsToAddToMessageHistory'
    | 'toolName'
    | 'toolResults'
    | 'toolResultsToAddToMessageHistory'
  > &
    ParamsExcluding<
      typeof processStreamWithTools,
      | 'processors'
      | 'defaultProcessor'
      | 'executeXmlToolCall'
    >,
) {
  const {
    agentState,
    agentTemplate,
    ancestorRunIds,
    fileContext,
    fullResponse,
    logger,
    onCostCalculated,
    onResponseChunk,
    runId,
    signal,
    userId,
  } = params
  const fullResponseChunks: string[] = [fullResponse]

  const thinkTagStream = new ThinkTagStream({
    implicitOpen: historyLeaksThinkTags(agentState.messageHistory),
  })
  const emitThinkSegments = (segments: ThinkStreamSegment[]): void => {
    for (const segment of segments) {
      if (segment.type === 'text') {
        onResponseChunk(segment.text)
      } else {
        onResponseChunk({
          type: 'reasoning_delta',
          text: segment.text,
          ancestorRunIds,
          runId,
          agentId: agentState.agentId,
        })
      }
    }
  }

  const toolResults: ToolMessage[] = []
  const toolResultsToAddToMessageHistory: ToolMessage[] = []
  const toolCalls: (CodebuffToolCall | CustomToolCall)[] = []
  const toolCallsToAddToMessageHistory: (CodebuffToolCall | CustomToolCall)[] = []
  const assistantMessages: Message[] = []
  const claimedByInlineAgent = new Set<Message>()
  let hadToolCallError = false
  let sawStreamRecovery = false
  const errorMessages: Message[] = []
  let resolveStreamDonePromise!: () => void
  const streamDonePromise = new Promise<void>((resolve) => {
    resolveStreamDonePromise = resolve
  })
  let previousToolCallFinished = streamDonePromise

  const fileProcessingState: FileProcessingState = {
    promisesByPath: {},
    allPromises: [],
    fileChangeErrors: [],
    fileChanges: [],
    firstFileProcessed: false,
  }

  function createResponseHandler() {
    return (chunk: string | PrintModeEvent) => {
      if (typeof chunk !== 'string') {
        if (chunk.type === 'error') {
          hadToolCallError = true
          errorMessages.push(
            userMessage({
              content: withSystemTags(
                `Error during tool call: ${chunk.message}. Please check the tool name and arguments and try again.`,
              ),
              tags: ['TOOL_CALL_ERROR'],
            }),
          )
        }
      }
      return onResponseChunk(chunk)
    }
  }

  function createToolExecutionCallback(toolName: string, isXmlMode: boolean) {
    const responseHandler = createResponseHandler()
    return {
      onTagStart: () => { },
      onTagEnd: async (_: string, input: Record<string, string>) => {
        if (signal.aborted) {
          return
        }
        const toolCallId = generateCompactId()
        const isNativeTool = toolNames.includes(toolName as ToolName)

        const transformed = !isNativeTool
          ? tryTransformAgentToolCall({
            toolName,
            input,
            spawnableAgents: agentTemplate.spawnableAgents,
          })
          : null
        const isSpawnCall =
          Boolean(transformed) ||
          toolName === 'spawn_agents' ||
          toolName === 'spawn_agent_inline'
        const currentAssistantMessages = isSpawnCall
          ? assistantMessages.filter(
              (message) => !claimedByInlineAgent.has(message),
            )
          : []
        const parsedInlineCall =
          toolName === 'spawn_agent_inline'
            ? parseRawToolCall({
                rawToolCall: { toolName, toolCallId, input },
              })
            : null
        const inlineWillConsumeHistory = Boolean(
          parsedInlineCall &&
          !('error' in parsedInlineCall) &&
          agentTemplate.toolNames.includes('spawn_agent_inline'),
        )
        if (inlineWillConsumeHistory) {
          currentAssistantMessages.forEach((message) =>
            claimedByInlineAgent.add(message),
          )
        }

        const previousPromise =
          isXmlMode && previousToolCallFinished === streamDonePromise
            ? Promise.resolve()
            : previousToolCallFinished

        let toolPromise: Promise<void>
        if (isNativeTool || transformed) {
          toolPromise = executeToolCall({
            ...params,
            toolName: transformed
              ? transformed.toolName
              : (toolName as ToolName),
            input: transformed ? transformed.input : input,
            fromHandleSteps: false,

            fileProcessingState,
            currentAssistantMessages: isSpawnCall
              ? structuredClone(currentAssistantMessages)
              : undefined,
            fullResponse: fullResponseChunks.join(''),
            previousToolCallFinished: previousPromise,
            toolCallId,
            toolCalls,
            toolCallsToAddToMessageHistory,
            toolResults,
            toolResultsToAddToMessageHistory,
            excludeToolFromMessageHistory: false,
            onCostCalculated,
            onResponseChunk: responseHandler,
          })
        } else {
          toolPromise = executeCustomToolCall({
            ...params,
            toolName,
            input,

            fileProcessingState,
            fullResponse: fullResponseChunks.join(''),
            previousToolCallFinished: previousPromise,
            toolCallId,
            toolCalls,
            toolCallsToAddToMessageHistory,
            toolResults,
            toolResultsToAddToMessageHistory,
            excludeToolFromMessageHistory: false,
            onResponseChunk: responseHandler,
          })
        }

        if (inlineWillConsumeHistory) {
          toolPromise = toolPromise.catch((error) => {
            currentAssistantMessages.forEach((message) =>
              claimedByInlineAgent.delete(message),
            )
            throw error
          })
        }

        previousToolCallFinished = toolPromise

        if (isXmlMode) {
          await toolPromise
        }
      },
    }
  }

  const streamWithTags = processStreamWithTools({
    ...params,
    processors: Object.fromEntries([
      ...toolNames.map((name) => [
        name,
        createToolExecutionCallback(name, false),
      ]),
      ...Object.keys(fileContext.customToolDefinitions ?? {}).map((name) => [
        name,
        createToolExecutionCallback(name, false),
      ]),
    ]),
    defaultProcessor: (name: string) =>
      createToolExecutionCallback(name, false),
    onResponseChunk: (chunk) => {
      if (chunk.type === 'text') {
        if (chunk.text) {
          assistantMessages.push(assistantMessage(chunk.text))
        }
        const visible = stripThinkScaffolding(chunk.text)
        if (visible !== chunk.text) {
          return onResponseChunk({ ...chunk, text: visible })
        }
      } else if (chunk.type === 'error') {
      } else {
        chunk satisfies never
        throw new Error(
          `Internal error: unhandled chunk type: ${(chunk as { type: unknown }).type}`,
        )
      }
      return onResponseChunk(chunk)
    },
    executeXmlToolCall: async ({ toolName, input }) => {
      if (signal.aborted) {
        return
      }
      const callback = createToolExecutionCallback(toolName, true)
      await callback.onTagEnd(toolName, input as Record<string, string>)
    },
  })

  let messageId: string | null = null

  try {
    while (true) {
      if (signal.aborted) {
        break
      }
      const { value: chunk, done } = await streamWithTags.next()
      if (done) {
        if (chunk && typeof chunk === 'object' && 'aborted' in chunk) {
          messageId = chunk.aborted ? null : chunk.value
        } else {
          messageId = chunk
        }
        break
      }

      if (chunk.type === 'reasoning') {
        if (
          INCLUDE_REASONING_IN_MESSAGE_HISTORY &&
          (chunk.text || chunk.providerOptions)
        ) {
          const last = assistantMessages[assistantMessages.length - 1]
          const lastPart =
            last?.role === 'assistant' && Array.isArray(last.content)
              ? last.content[last.content.length - 1]
              : undefined
          if (
            lastPart &&
            lastPart.type === 'reasoning' &&
            !claimedByInlineAgent.has(last)
          ) {
            lastPart.text += chunk.text
            if (chunk.providerOptions) {
              lastPart.providerOptions = chunk.providerOptions
            }
          } else {
            assistantMessages.push(
              assistantMessage({
                type: 'reasoning',
                text: chunk.text,
                ...(chunk.providerOptions
                  ? { providerOptions: chunk.providerOptions }
                  : {}),
              }),
            )
          }
        }
        if (chunk.text) {
          emitThinkSegments(thinkTagStream.disarmImplicitOpen())
          onResponseChunk({
            type: 'reasoning_delta',
            text: chunk.text,
            ancestorRunIds,
            runId,
            agentId: agentState.agentId,
          })
        }
      } else if (chunk.type === 'text') {
        emitThinkSegments(thinkTagStream.push(chunk.text))
        fullResponseChunks.push(chunk.text)
      } else if (chunk.type === 'error') {
        onResponseChunk(chunk)
        if (chunk.source) {
          const recovery = RECOVERY_BY_SOURCE[chunk.source]
          sawStreamRecovery = true
          const { count: priorRecoveries } = trailingStreamRecoveryStreak(
            agentState.messageHistory,
          )
          if (priorRecoveries >= MAX_CONSECUTIVE_STREAM_RECOVERIES) {
            logger.error(
              {
                metric: 'stream_recovery_gave_up',
                source: chunk.source,
                model: agentTemplate.model,
                agentId: agentTemplate.id,
                userId,
                runId,
                consecutive: priorRecoveries + 1,
              },
              'Giving up after repeated stream recoveries',
            )
            throw new Error(recovery.giveUpMessage)
          }
          hadToolCallError = true
          errorMessages.push(
            userMessage({
              content: withSystemTags(chunk.message),
              tags: [recovery.tag],
            }),
          )
        } else {
          hadToolCallError = true
          errorMessages.push(
            userMessage({
              content: withSystemTags(
                `Error during tool call: ${chunk.message}. Please check the tool name and arguments and try again.`,
              ),
              tags: ['TOOL_CALL_ERROR'],
            }),
          )
        }
      } else if (chunk.type === 'tool-call') {
      } else {
        chunk satisfies never
        throw new Error(
          `Unhandled chunk type: ${(chunk as { type: unknown }).type}`,
        )
      }
    }

    emitThinkSegments(thinkTagStream.flush())

    if (!sawStreamRecovery && !signal.aborted) {
      const { count: recoveredFrom, lastSource } = trailingStreamRecoveryStreak(
        agentState.messageHistory,
      )
      if (recoveredFrom > 0) {
        logger.info(
          {
            axiomEvent: STREAM_RECOVERY_EVENT,
            metric: 'stream_recovery_rescued',
            source: lastSource,
            model: agentTemplate.model,
            agentId: agentTemplate.id,
            userId,
            runId,
            consecutive: recoveredFrom,
          },
          'Stream-interruption retry succeeded; turn continued normally',
        )
      }
    }

    if (!signal.aborted) {
      resolveStreamDonePromise()
      await previousToolCallFinished
    }
  } finally {
    emitThinkSegments(thinkTagStream.flush())

    try {
      await streamWithTags.return({ aborted: true })
    } catch {
    }

    const completedToolCallIds = new Set(
      toolResultsToAddToMessageHistory.map((r) => r.toolCallId),
    )
    const filteredToolCalls =
      toolCallsToAddToMessageHistory.filter((tc) =>
        completedToolCallIds.has(tc.toolCallId),
      )

    agentState.messageHistory = buildArray<Message>([
      ...agentState.messageHistory,
      ...assistantMessages.filter(
        (message) => !claimedByInlineAgent.has(message),
      ),
      ...filteredToolCalls.map((toolCall) => assistantMessage({ ...toolCall, type: 'tool-call' })),
      ...toolResultsToAddToMessageHistory,
      ...errorMessages,
    ])
  }

  if (signal.aborted) {
    throw new AbortError()
  }

  return {
    fullResponse: fullResponseChunks.join(''),
    fullResponseChunks,
    hadToolCallError,
    messageId,
    toolCalls,
    toolResults,
  }
}
