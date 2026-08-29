
import type { StreamRecoverySource } from '@codebuff/common/types/contracts/llm'
import { isTransientNetworkError } from '@codebuff/common/util/error'

export interface StreamFinishInfo {
  finishReason: string
  hasUsage: boolean
}

export function streamFinishInfoOf(
  part: {
    finishReason: string
    rawFinishReason?: string
    totalUsage: {
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
    }
  },
  v2Compatibility = false,
): StreamFinishInfo {
  const { inputTokens, outputTokens, totalTokens } = part.totalUsage
  return {
    finishReason:
      part.finishReason === 'other' &&
      (part.rawFinishReason === 'unknown' ||
        (v2Compatibility && part.rawFinishReason === undefined))
        ? 'unknown'
        : part.finishReason,
    hasUsage: [inputTokens, outputTokens, totalTokens].some(
      (tokens) => typeof tokens === 'number' && Number.isFinite(tokens),
    ),
  }
}

export interface StreamEndRecovery {
  source: StreamRecoverySource
  message: string
}

const STREAM_INTERRUPTED_RECOVERY: StreamEndRecovery = {
  source: 'stream-interrupted',
  message:
    'The connection dropped while the response was streaming, so the output above may be cut off mid-thought. Continue from where it left off (or start the step over if nothing useful arrived).',
}

const OUTPUT_LIMIT_RECOVERY: StreamEndRecovery = {
  source: 'output-limit',
  message:
    'The response hit its output token limit while still reasoning, so no answer was produced. Redo this step thinking much more briefly, and get to the response or tool calls quickly.',
}

const REASONING_ONLY_RECOVERY: StreamEndRecovery = {
  source: 'output-limit',
  message:
    'The response ended after reasoning without producing an answer or tool call. Continue this step, think more briefly, and get to the response or tool calls quickly.',
}

export function classifyStreamEndRecovery(params: {
  aborted: boolean
  finish: StreamFinishInfo | undefined
  receivedReasoning: boolean
  yieldedText: boolean
  yieldedToolCall: boolean
}): StreamEndRecovery | null {
  const { aborted, finish, receivedReasoning, yieldedText, yieldedToolCall } =
    params
  if (aborted) return null

  const interrupted =
    finish === undefined ||
    (finish.finishReason === 'unknown' && !finish.hasUsage)
  if (interrupted) return STREAM_INTERRUPTED_RECOVERY

  if (yieldedText || yieldedToolCall) return null

  if (finish.finishReason === 'length') return OUTPUT_LIMIT_RECOVERY

  if (receivedReasoning) return REASONING_ONLY_RECOVERY

  return null
}

export function classifyThrownStreamRecovery(params: {
  aborted: boolean
  error: unknown
}): StreamEndRecovery | null {
  if (params.aborted || !isTransientNetworkError(params.error)) return null
  return STREAM_INTERRUPTED_RECOVERY
}
