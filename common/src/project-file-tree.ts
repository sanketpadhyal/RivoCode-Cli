import path from 'path'

import * as ignore from 'ignore'
import { sortBy } from 'lodash'

import { DEFAULT_IGNORED_PATHS } from './constants/paths'
import { isEnvTemplateFilePath } from './util/env-file-path'
import { fileExists, isValidProjectRoot } from './util/file'
import { isPathInside } from './util/path'
import {
  addIgnoreFileContents,
  isIgnoredByIgnoreChain,
  PROJECT_IGNORE_FILES,
} from './util/project-ignore'

import type { CodebuffFileSystem } from './types/filesystem'
import type { DirectoryNode, FileTreeNode } from './util/file'
import type { DirIgnore } from './util/project-ignore'

function logFileTreeError(
  operation: string,
  filePath: string,
  error: unknown,
): void {
  if (!process.env.DEBUG && !process.env.CODEBUFF_DEBUG) {
    return
  }

  const err = error as { code?: string } | undefined
  const code = err?.code
  const errorMessage = error instanceof Error ? error.message : String(error)

  console.debug(
    `[FileTree] ${operation} failed for "${filePath}"${
      code ? ` (${code})` : ''
    }: ${errorMessage}`,
  )
}

export const DEFAULT_MAX_FILES = 10_000

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/')
}

function createDefaultIgnore(allowEnvTemplate = false): ignore.Ignore {
  const defaultIgnore = ignore.default()
  for (const pattern of DEFAULT_IGNORED_PATHS) {
    if (allowEnvTemplate && (pattern === '.env' || pattern === '.env.*')) {
      continue
    }
    defaultIgnore.add(pattern)
  }
  return defaultIgnore
}

export const SHALLOW_SCAN_MAX_DEPTH = 3
const SHALLOW_SCAN_MAX_FILES = 2_000
const SHALLOW_SCAN_MAX_DIRS = 500

export function isShallowScanRoot(
  projectRoot: string | undefined,
): projectRoot is string {
  return !!projectRoot && !isValidProjectRoot(projectRoot)
}

export async function getProjectFileTree(params: {
  projectRoot: string
  maxFiles?: number
  fs: CodebuffFileSystem
}): Promise<FileTreeNode[]> {
  const withDefaults = { maxFiles: DEFAULT_MAX_FILES, ...params }
  const { projectRoot, fs } = withDefaults
  let { maxFiles } = withDefaults
  let maxDepth = Infinity
  let maxDirs = Infinity

  const _start = Date.now()
  const defaultIgnore = createDefaultIgnore()

  if (isShallowScanRoot(projectRoot)) {
    defaultIgnore.add('.*')
    maxDepth = SHALLOW_SCAN_MAX_DEPTH
    maxFiles = Math.min(maxFiles, SHALLOW_SCAN_MAX_FILES)
    maxDirs = SHALLOW_SCAN_MAX_DIRS
  }

  const root: DirectoryNode = {
    name: path.basename(projectRoot),
    type: 'directory',
    children: [],
    filePath: '',
  }
  const queue: {
    node: DirectoryNode
    fullPath: string
    ignores: DirIgnore[]
    depth: number
  }[] = [
    {
      node: root,
      fullPath: projectRoot,
      ignores: [{ base: '', ig: defaultIgnore }],
      depth: 0,
    },
  ]
  let totalFiles = 0
  let dirsScanned = 0

  while (queue.length > 0 && totalFiles < maxFiles && dirsScanned < maxDirs) {
    const { node, fullPath, ignores, depth } = queue.shift()!
    dirsScanned++
    const dirIgnores = [
      ...ignores,
      {
        base: toPosixPath(path.relative(projectRoot, fullPath)),
        ig: await parseGitignore({ fullDirPath: fullPath, fs }),
      },
    ]

    try {
      const files = await fs.readdir(fullPath)
      for (const file of files) {
        if (totalFiles >= maxFiles) break

        const filePath = path.join(fullPath, file)
        const relativeFilePath = toPosixPath(path.relative(projectRoot, filePath))

        if (isIgnoredByIgnoreChain(dirIgnores, relativeFilePath)) continue

        try {
          const stats = await fs.stat(filePath)
          if (stats.isDirectory()) {
            const childNode: DirectoryNode = {
              name: file,
              type: 'directory',
              children: [],
              filePath: relativeFilePath,
            }
            node.children.push(childNode)
            if (depth + 1 < maxDepth) {
              queue.push({
                node: childNode,
                fullPath: filePath,
                ignores: dirIgnores,
                depth: depth + 1,
              })
            }
          } else {
            const lastReadTime = stats.atimeMs
            node.children.push({
              name: file,
              type: 'file',
              lastReadTime,
              filePath: relativeFilePath,
            })
            totalFiles++
          }
        } catch (error: unknown) {
          logFileTreeError('fs.stat', filePath, error)
        }
      }
    } catch (error: unknown) {
      logFileTreeError('fs.readdir', fullPath, error)
    }
  }
  return root.children
}

async function parseGitignoreWithMode(params: {
  fullDirPath: string
  fs: CodebuffFileSystem
  throwOnReadError: boolean
}): Promise<ignore.Ignore> {
  const { fullDirPath, fs, throwOnReadError } = params

  const ig = ignore.default()
  const directoryEntries = throwOnReadError
    ? new Set(await fs.readdir(fullDirPath))
    : undefined

  for (const fileName of PROJECT_IGNORE_FILES) {
    const ignoreFilePath = path.join(fullDirPath, fileName)
    if (directoryEntries) {
      if (!directoryEntries.has(fileName)) continue
    } else {
      const ignoreFileExists = await fileExists({ filePath: ignoreFilePath, fs })
      if (!ignoreFileExists) continue
    }

    let ignoreContent: string
    try {
      ignoreContent = await fs.readFile(ignoreFilePath, 'utf8')
    } catch (error: unknown) {
      logFileTreeError('fs.readFile (ignore file)', ignoreFilePath, error)
      if (throwOnReadError) throw error
      continue
    }
    addIgnoreFileContents(ig, ignoreContent, (pattern, error) =>
      logFileTreeError('ignore.add (pattern)', pattern, error),
    )
  }

  return ig
}

export async function parseGitignore(params: {
  fullDirPath: string
  fs: CodebuffFileSystem
}): Promise<ignore.Ignore> {
  return parseGitignoreWithMode({ ...params, throwOnReadError: false })
}

export function getAllFilePaths(
  nodes: FileTreeNode[],
  basePath: string = '',
): string[] {
  return nodes.flatMap((node) => {
    if (node.type === 'file') {
      return [path.join(basePath, node.name)]
    }
    return getAllFilePaths(node.children || [], path.join(basePath, node.name))
  })
}

export interface PathInfo {
  path: string
  isDirectory: boolean
}

export function getAllPathsWithDirectories(
  nodes: FileTreeNode[],
  basePath: string = '',
): PathInfo[] {
  return nodes.flatMap((node) => {
    const nodePath = basePath ? path.join(basePath, node.name) : node.name
    if (node.type === 'file') {
      return [{ path: nodePath, isDirectory: false }]
    }
    const dirEntry: PathInfo = { path: nodePath, isDirectory: true }
    const children = getAllPathsWithDirectories(node.children || [], nodePath)
    return [dirEntry, ...children]
  })
}

export function flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.flatMap((node) => {
    if (node.type === 'file') {
      return [node]
    }
    return flattenTree(node.children ?? [])
  })
}

export function getLastReadFilePaths(
  flattenedNodes: FileTreeNode[],
  count: number,
) {
  return sortBy(
    flattenedNodes.filter((node) => node.lastReadTime),
    'lastReadTime',
  )
    .reverse()
    .slice(0, count)
    .map((node) => node.filePath)
}

export async function isFileIgnored(params: {
  filePath: string
  projectRoot: string
  fs: CodebuffFileSystem
  allowEnvTemplate?: boolean
}): Promise<boolean> {
  const {
    filePath,
    projectRoot,
    fs,
    allowEnvTemplate: allowEnvTemplateRequested = false,
  } = params
  const allowEnvTemplate =
    allowEnvTemplateRequested && isEnvTemplateFilePath(filePath)

  const resolvedProjectRoot = path.resolve(projectRoot)
  const fullFilePath = path.resolve(resolvedProjectRoot, filePath)
  if (!isPathInside(resolvedProjectRoot, fullFilePath)) return false

  const defaultIgnore = createDefaultIgnore(allowEnvTemplate)

  const relativeFilePath = toPosixPath(
    path.relative(resolvedProjectRoot, fullFilePath),
  )

  const dirIgnores: DirIgnore[] = []
  let currentDir = path.dirname(fullFilePath)
  while (true) {
    let ig: ignore.Ignore
    try {
      ig = await parseGitignoreWithMode({
        fullDirPath: currentDir,
        fs,
        throwOnReadError: allowEnvTemplate,
      })
    } catch (error) {
      if (allowEnvTemplate) return true
      throw error
    }
    dirIgnores.push({
      base: toPosixPath(path.relative(resolvedProjectRoot, currentDir)),
      ig,
    })
    if (path.relative(resolvedProjectRoot, currentDir) === '') break

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  return isIgnoredByIgnoreChain(
    [{ base: '', ig: defaultIgnore }, ...dirIgnores.reverse()],
    relativeFilePath,
  )
}
