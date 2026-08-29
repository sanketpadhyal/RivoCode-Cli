import { getAllFilePaths } from '@rivocode/common/project-file-tree'
import { jsonToolResult } from '@rivocode/common/util/messages'

import { truncateFileTreeBasedOnTokenBudget } from '../../../system-prompt/truncate-file-tree'

import type { CodebuffToolHandlerFunction } from '../handler-function-type'
import type {
  CodebuffToolCall,
  CodebuffToolOutput,
} from '@rivocode/common/tools/list'
import type { Logger } from '@rivocode/common/types/contracts/logger'
import type {
  FileTreeNode,
  ProjectFileContext,
} from '@rivocode/common/util/file'

type ToolName = 'read_subtree'
export const handleReadSubtree = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: CodebuffToolCall<ToolName>
  fileContext: ProjectFileContext
  logger: Logger
}): Promise<{
  output: CodebuffToolOutput<ToolName>
}> => {
  const { previousToolCallFinished, toolCall, fileContext, logger } = params
  const { paths, maxTokens } = toolCall.input
  const tokenBudget = maxTokens

  const allFiles = new Set(getAllFilePaths(fileContext.fileTree))

  const buildDirectoryResult = (dirNodes: FileTreeNode[], outPath: string) => {
    const subTree = deepClone(dirNodes)

    const remappedTokenScores: Record<string, Record<string, number>> = {}
    const prefix =
      outPath === '.' || outPath === '/' || outPath === ''
        ? ''
        : outPath.replace(/\\/g, '/')

    for (const [filePath, tokens] of Object.entries(
      fileContext.fileTokenScores,
    )) {
      const normalized = filePath.replace(/\\/g, '/')
      if (!prefix || normalized.startsWith(prefix + '/')) {
        const fullPrefix = prefix
          ? prefix.split('/').slice(0, -1).join('/')
          : ''
        const afterParent = fullPrefix
          ? normalized.startsWith(fullPrefix + '/')
            ? normalized.slice(fullPrefix.length + 1)
            : null
          : normalized

        if (afterParent && !afterParent.startsWith('../')) {
          remappedTokenScores[afterParent] = tokens
        }
      }
    }

    const subctx: ProjectFileContext = {
      ...fileContext,
      fileTree: subTree,
      fileTokenScores: remappedTokenScores,
    }
    const { printedTree, tokenCount, truncationLevel } =
      truncateFileTreeBasedOnTokenBudget({
        fileContext: subctx,
        tokenBudget,
        logger,
      })
    return {
      path: outPath,
      type: 'directory' as const,
      printedTree,
      tokenCount,
      truncationLevel,
    }
  }

  const buildFileResult = (filePath: string) => {
    const tokensMap = fileContext.fileTokenScores[filePath] ?? {}
    const variables = Object.entries(tokensMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
    return {
      path: filePath,
      type: 'file' as const,
      variables,
    }
  }

  await previousToolCallFinished

  const requested = paths && paths.length > 0 ? paths : ['.']
  const outputs: Array<
    | {
        path: string
        type: 'directory'
        printedTree: string
        tokenCount: number
        truncationLevel: 'none' | 'unimportant-files' | 'tokens' | 'depth-based'
      }
    | { path: string; type: 'file'; variables: string[] }
    | { path: string; errorMessage: string }
  > = []

  for (const rawPath of requested) {
    const p = rawPath.replace(/\/+$/, '')

    if (p === '.' || p === '/' || p === '') {
      outputs.push(buildDirectoryResult(fileContext.fileTree, p))
      continue
    }
    if (allFiles.has(p)) {
      outputs.push(buildFileResult(p))
      continue
    }
    const node = findNodeByFilePath(fileContext.fileTree, p)
    if (node && node.type === 'directory') {
      outputs.push(buildDirectoryResult([node], p))
      continue
    }
    if (node && node.type === 'file') {
      outputs.push(buildFileResult(p))
      continue
    }
    outputs.push({
      path: p,
      errorMessage: `Path not found or ignored: ${p}`,
    })
  }

  return { output: jsonToolResult(outputs) }
}) satisfies CodebuffToolHandlerFunction<ToolName>

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function findNodeByFilePath(
  nodes: FileTreeNode[],
  target: string,
): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.filePath === target) return node
    if (node.type === 'directory' && node.children) {
      const found = findNodeByFilePath(node.children, target)
      if (found) return found
    }
  }
  return undefined
}
