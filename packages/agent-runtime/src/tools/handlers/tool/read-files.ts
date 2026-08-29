import { jsonToolResult } from '@rivocode/common/util/messages'

import { getFileReadingUpdates } from '../../../get-file-reading-updates'
import { renderReadFilesResult } from '../../../util/render-read-files-result'

import type { CodebuffToolHandlerFunction } from '../handler-function-type'
import type {
  CodebuffToolCall,
  CodebuffToolOutput,
} from '@rivocode/common/tools/list'
import type { AgentTemplate } from '@rivocode/common/types/agent-template'
import type { FileReadWindow } from '@rivocode/common/types/contracts/client'
import type { ParamsExcluding } from '@rivocode/common/types/function-params'
import type { ProjectFileContext } from '@rivocode/common/util/file'

type ToolName = 'read_files'
export const handleReadFiles = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: CodebuffToolCall<ToolName>
    agentTemplate: AgentTemplate

    fileContext: ProjectFileContext
  } & ParamsExcluding<
    typeof getFileReadingUpdates,
    'requestedFiles' | 'fileWindows'
  >,
): Promise<{ output: CodebuffToolOutput<ToolName> }> => {
  const {
    previousToolCallFinished,
    toolCall,
    agentTemplate,

    fileContext,
  } = params
  const { paths } = toolCall.input

  await previousToolCallFinished

  const windowed = agentTemplate.windowedFileReads === true
  const requestedFiles: string[] = []
  const fileWindows: Record<string, FileReadWindow[]> = Object.create(null)
  const seenWindows: Record<string, Set<string>> = Object.create(null)
  for (const entry of paths) {
    const path = typeof entry === 'string' ? entry : entry.path
    requestedFiles.push(path)
    if (!windowed) continue
    const window =
      typeof entry === 'string'
        ? {}
        : { offset: entry.offset, limit: entry.limit }
    const key = `${window.offset ?? ''}:${window.limit ?? ''}`
    const seen = (seenWindows[path] ??= new Set())
    if (seen.has(key) || seen.has(':')) continue
    seen.add(key)
    if (key === ':') {
      fileWindows[path] = [window]
      continue
    }
    ;(fileWindows[path] ??= []).push(window)
  }

  const addedFiles = await getFileReadingUpdates({
    ...params,
    requestedFiles,
    fileWindows: windowed ? fileWindows : undefined,
  })

  return {
    output: jsonToolResult(
      renderReadFilesResult(addedFiles, fileContext.tokenCallers ?? {}),
    ),
  }
}) satisfies CodebuffToolHandlerFunction<ToolName>
