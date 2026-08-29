import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { formatCodeSearchOutput } from '../../../common/src/util/format-code-search'
import { getBundledRgPath } from '../native/ripgrep'

import type { CodebuffToolOutput } from '../../../common/src/tools/list'
import { Logger } from '@rivocode/common/types/contracts/logger'

const INCLUDED_HIDDEN_DIRS = [
  '.agents',
  '.claude',
  '.github',
  '.gitlab',
  '.circleci',
  '.husky',
]

export function codeSearch({
  projectPath,
  pattern,
  flags,
  cwd,
  maxResults = 15,
  globalMaxResults = 250,
  maxOutputStringLength = 20_000,
  timeoutSeconds = 10,
  logger,
  signal,
}: {
  projectPath: string
  pattern: string
  flags?: string
  cwd?: string
  maxResults?: number
  globalMaxResults?: number
  maxOutputStringLength?: number
  timeoutSeconds?: number
  logger?: Logger
  signal?: AbortSignal
}): Promise<CodebuffToolOutput<'code_search'>> {
  return new Promise((resolve) => {
    let isResolved = false

    const projectRoot = path.resolve(projectPath)
    const searchCwd = cwd ? path.resolve(projectRoot, cwd) : projectRoot

    const flagsArray = (flags || '')
      .split(' ')
      .filter(Boolean)
      .map((token) => token.replace(/^['"]|['"]$/g, ''))

    const existingHiddenDirs = INCLUDED_HIDDEN_DIRS.filter((dir) => {
      try {
        return fs.statSync(path.join(searchCwd, dir)).isDirectory()
      } catch {
        return false
      }
    })
    const searchPaths = ['.', ...existingHiddenDirs]
    const args = [
      '--no-config',
      '-n',
      '--json',
      ...flagsArray,
      '--',
      pattern,
      ...searchPaths,
    ]

    if (signal?.aborted) {
      return resolve([
        {
          type: 'json',
          value: {
            stdout: '',
            message: 'Code search cancelled: the run was aborted by the user.',
          },
        },
      ])
    }

    const rgPath = getBundledRgPath(import.meta.url)
    if (logger) {
      logger.info(
        { rgPath, args, searchCwd },
        'code-search: Spawning ripgrep process',
      )
    }
    const childProcess = spawn(rgPath, args, {
      cwd: searchCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let jsonRemainder = ''
    let stderrBuf = ''
    const fileGroups = new Map<string, string[]>()
    const fileMatchCounts = new Map<string, number>()
    const filesLimitedByMaxResults = new Set<string>()
    let matchesGlobal = 0
    let estimatedOutputLen = 0
    let killedForLimit = false

    let killTimeoutId: ReturnType<typeof setTimeout> | null = null

    const settle = (payload: any) => {
      if (isResolved) return
      isResolved = true

      childProcess.stdout.removeAllListeners()
      childProcess.stderr.removeAllListeners()
      childProcess.removeAllListeners()
      signal?.removeEventListener('abort', onAbort)

      clearTimeout(timeoutId)
      if (killTimeoutId) {
        clearTimeout(killTimeoutId)
        killTimeoutId = null
      }

      resolve([{ type: 'json', value: payload }])
    }

    const hardKill = () => {
      try {
        childProcess.kill('SIGTERM')
      } catch {}
      killTimeoutId = setTimeout(() => {
        try {
          childProcess.kill('SIGKILL')
        } catch {
          try {
            childProcess.kill()
          } catch {}
        }
        killTimeoutId = null
      }, 1000)
    }

    const formatCollectedOutput = (rawOutput: string) =>
      formatCodeSearchOutput(rawOutput, {
        matchCount: matchesGlobal,
      })

    const truncateOutput = (output: string, maxLength: number) =>
      output.length > maxLength
        ? output.substring(0, maxLength) + '\n\n[Output truncated]'
        : output

    const onAbort = () => {
      if (isResolved) return
      hardKill()

      const collectedLines: string[] = []
      for (const fileLines of fileGroups.values()) {
        collectedLines.push(...fileLines)
      }
      const partialOutput = collectedLines.join('\n')

      settle({
        stdout: truncateOutput(formatCollectedOutput(partialOutput), 1000),
        message: 'Code search cancelled: the run was aborted by the user.',
      })
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const timeoutId = setTimeout(() => {
      if (isResolved) return
      hardKill()

      const collectedLines: string[] = []
      for (const fileLines of fileGroups.values()) {
        collectedLines.push(...fileLines)
      }
      const partialOutput = collectedLines.join('\n')

      const truncatedStdout = truncateOutput(
        formatCollectedOutput(partialOutput),
        1000,
      )
      const truncatedStderr =
        stderrBuf.length > 1000
          ? stderrBuf.substring(0, 1000) + '\n\n[Error output truncated]'
          : stderrBuf

      settle({
        errorMessage: `Code search timed out after ${timeoutSeconds} seconds. The search may be too broad or the pattern too complex. Try narrowing your search with more specific flags or a more specific pattern.`,
        stdout: truncatedStdout,
        stderr: truncatedStderr,
      })
    }, timeoutSeconds * 1000)

    childProcess.stdout.on('data', (chunk: Buffer | string) => {
      if (isResolved) return
      const chunkStr =
        typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      jsonRemainder += chunkStr

      const lines = jsonRemainder.split('\n')
      jsonRemainder = lines.pop() || ''

      for (const line of lines) {
        if (!line) continue
        let evt: any
        try {
          evt = JSON.parse(line)
        } catch {
          continue
        }

        if (evt.type === 'match' || evt.type === 'context') {
          const filePath = evt.data.path?.text ?? evt.data.path?.bytes ?? ''
          const lineNumber = evt.data.line_number ?? 0
          const rawText = evt.data.lines?.text ?? ''
          const lineText = rawText.replace(/\r?\n$/, '')

          const formattedLine = `${filePath}:${lineNumber}:${lineText}`

          if (!fileGroups.has(filePath)) {
            fileGroups.set(filePath, [])
            fileMatchCounts.set(filePath, 0)
          }
          const fileLines = fileGroups.get(filePath)!
          const fileMatchCount = fileMatchCounts.get(filePath)!

          const isMatch = evt.type === 'match'

          const shouldInclude = !isMatch || fileMatchCount < maxResults
          if (isMatch && !shouldInclude) {
            filesLimitedByMaxResults.add(filePath)
          }

          if (shouldInclude) {
            fileLines.push(formattedLine)
            estimatedOutputLen += formattedLine.length + 1

            if (isMatch) {
              fileMatchCounts.set(filePath, fileMatchCount + 1)
              matchesGlobal++

              if (
                matchesGlobal >= globalMaxResults ||
                estimatedOutputLen >= maxOutputStringLength
              ) {
                killedForLimit = true
                hardKill()

                const limitedLines: string[] = []
                for (const lines of fileGroups.values()) {
                  limitedLines.push(...lines)
                }
                const rawOutput = limitedLines.join('\n')
                const finalOutput = truncateOutput(
                  formatCollectedOutput(rawOutput),
                  maxOutputStringLength,
                )

                const limitReason =
                  matchesGlobal >= globalMaxResults
                    ? `[Global limit of ${globalMaxResults} results reached.]`
                    : '[Output size limit reached.]'

                return settle({
                  stdout: finalOutput + '\n\n' + limitReason,
                  message: `Stopped early after ${matchesGlobal} match(es).`,
                })
              }
            }
          }
        }
      }
    })

    childProcess.stderr.on('data', (chunk: Buffer | string) => {
      if (isResolved) return
      const chunkStr =
        typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const limit = Math.floor(maxOutputStringLength / 5)
      if (stderrBuf.length < limit) {
        const space = limit - stderrBuf.length
        stderrBuf += chunkStr.slice(0, space)
      }
    })

    childProcess.once('close', (code) => {
      if (isResolved) return

      try {
        if (jsonRemainder) {
          const maybeMany = jsonRemainder.endsWith('\n')
            ? jsonRemainder
            : jsonRemainder + '\n'
          for (const ln of maybeMany.split('\n')) {
            if (!ln) continue
            try {
              const evt = JSON.parse(ln)
              if (evt?.type === 'match' || evt?.type === 'context') {
                const filePath =
                  evt.data.path?.text ?? evt.data.path?.bytes ?? ''
                const lineNumber = evt.data.line_number ?? 0
                const rawText = evt.data.lines?.text ?? ''
                const lineText = rawText.replace(/\r?\n$/, '')
                const formattedLine = `${filePath}:${lineNumber}:${lineText}`

                if (!fileGroups.has(filePath)) {
                  fileGroups.set(filePath, [])
                  fileMatchCounts.set(filePath, 0)
                }
                const fileLines = fileGroups.get(filePath)!
                const fileMatchCount = fileMatchCounts.get(filePath)!
                const isMatch = evt.type === 'match'

                const shouldInclude =
                  !isMatch ||
                  (fileMatchCount < maxResults &&
                    matchesGlobal < globalMaxResults)
                if (
                  isMatch &&
                  fileMatchCount >= maxResults &&
                  matchesGlobal < globalMaxResults
                ) {
                  filesLimitedByMaxResults.add(filePath)
                }

                if (shouldInclude) {
                  fileLines.push(formattedLine)

                  if (isMatch) {
                    fileMatchCounts.set(filePath, fileMatchCount + 1)
                    matchesGlobal++
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}

      const limitedLines: string[] = []
      const truncatedFiles: string[] = []

      for (const [filename, fileLines] of fileGroups) {
        limitedLines.push(...fileLines)
        if (filesLimitedByMaxResults.has(filename)) {
          truncatedFiles.push(
            `${filename}: limited to ${maxResults} results per file`,
          )
        }
      }

      let rawOutput = limitedLines.join('\n')

      const truncationMessages: string[] = []
      if (truncatedFiles.length > 0) {
        truncationMessages.push(
          `Results limited to ${maxResults} per file. Truncated files:\n${truncatedFiles.join('\n')}`,
        )
      }
      if (killedForLimit) {
        truncationMessages.push(
          `Global limit of ${globalMaxResults} results reached.`,
        )
      }

      if (truncationMessages.length > 0) {
        rawOutput += `\n\n[${truncationMessages.join('\n\n')}]`
      }

      const truncatedStdout = truncateOutput(
        formatCollectedOutput(rawOutput),
        maxOutputStringLength,
      )

      const truncatedStderr = stderrBuf
        ? stderrBuf +
          (stderrBuf.length >= Math.floor(maxOutputStringLength / 5)
            ? '\n\n[Error output truncated]'
            : '')
        : ''

      settle({
        stdout: truncatedStdout,
        ...(truncatedStderr && { stderr: truncatedStderr }),
        message:
          code !== null
            ? `Exit code: ${code}${killedForLimit ? ' (early stop)' : ''}`
            : '',
      })
    })

    childProcess.once('error', (error) => {
      if (isResolved) return
      settle({
        errorMessage: `Failed to execute ripgrep: ${error.message}. Vendored ripgrep not found; ensure @rivocode/sdk is up-to-date or set CODEBUFF_RG_PATH.`,
      })
    })
  })
}
