import { countTokens } from '@codebuff/agent-runtime/util/token-counter'
import { FILE_READ_STATUS } from '@codebuff/common/old-constants'
import { isFileIgnored } from '@codebuff/common/project-file-tree'
import {
  isEnvTemplateFilePath,
  isSensitiveEnvFilePath,
} from '@codebuff/common/util/env-file-path'
import {
  createFileReadLimiter,
  windowFileRead,
} from '@codebuff/common/util/file-read-limits'

import { resolveFilePath } from './path-utils'

import type { FileReadWindow } from '@codebuff/common/types/contracts/client'
import type { CodebuffFileSystem } from '@codebuff/common/types/filesystem'

export type FileFilterResult = {
  status: 'blocked' | 'allow-example' | 'allow'
}

export type FileFilter = (filePath: string) => FileFilterResult

export async function getFiles(params: {
  filePaths: string[]
  cwd: string
  fs: CodebuffFileSystem
  fileWindows?: Record<string, FileReadWindow[]>
  limitContent?: boolean
  enforceEnvPolicy?: boolean
  fileFilter?: FileFilter
}) {
  const {
    filePaths,
    cwd,
    fs,
    fileWindows,
    fileFilter,
    limitContent = true,
    enforceEnvPolicy = true,
  } = params
  const hasCustomFilter = fileFilter !== undefined

  const result = Object.create(null) as Record<string, string | null>
  const seenPaths = new Set<string>()
  const MAX_FILE_BYTES = 10 * 1024 * 1024
  const limiter = limitContent ? createFileReadLimiter({ countTokens }) : null

  for (const filePath of filePaths) {
    if (!filePath) {
      continue
    }

    const { relativePath, fullPath, isWithinProject } = resolveFilePath(
      cwd,
      filePath,
    )
    if (seenPaths.has(relativePath)) {
      continue
    }
    seenPaths.add(relativePath)

    if (enforceEnvPolicy && isSensitiveEnvFilePath(relativePath)) {
      result[relativePath] = FILE_READ_STATUS.IGNORED
      continue
    }

    const filterResult = fileFilter?.(relativePath)
    if (filterResult?.status === 'blocked') {
      result[relativePath] = FILE_READ_STATUS.IGNORED
      continue
    }
    const isEnvTemplate =
      enforceEnvPolicy && isEnvTemplateFilePath(relativePath)
    const isExampleFile =
      isEnvTemplate || filterResult?.status === 'allow-example'

    if ((!hasCustomFilter || isEnvTemplate) && isWithinProject) {
      const ignored = await isFileIgnored({
        filePath: relativePath,
        projectRoot: cwd,
        fs,
        ...(isEnvTemplate ? { allowEnvTemplate: true } : {}),
      })
      if (ignored) {
        result[relativePath] = FILE_READ_STATUS.IGNORED
        continue
      }
    }

    try {
      const stats = await fs.stat(fullPath)
      if (stats.size > MAX_FILE_BYTES) {
        result[relativePath] =
          FILE_READ_STATUS.TOO_LARGE +
          ` [${(stats.size / (1024 * 1024)).toFixed(1)}MB exceeds 10MB limit. Use code_search or glob to find specific content.]`
        continue
      }

      const content = await fs.readFile(fullPath, 'utf8')

      const windows = fileWindows?.[filePath]
      const windowedContent =
        limitContent && fileWindows !== undefined
          ? (windows?.length ? windows : [{}])
              .map((window: FileReadWindow) =>
                windowFileRead(content, window.offset, window.limit),
              )
              .join('\n\n')
          : content
      const returnedContent = limiter?.limit(windowedContent) ?? windowedContent
      result[relativePath] = isExampleFile
        ? FILE_READ_STATUS.TEMPLATE + '\n' + returnedContent
        : returnedContent
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        result[relativePath] = FILE_READ_STATUS.DOES_NOT_EXIST
      } else {
        result[relativePath] = FILE_READ_STATUS.ERROR
      }
    }
  }
  return { ...result }
}
