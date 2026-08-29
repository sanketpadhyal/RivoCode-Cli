import * as os from 'os'
import * as path from 'path'

import { z } from 'zod/v4'

import type { CodebuffFileSystem } from '../types/filesystem'
import type { SkillsMap } from '../types/skill'

export const FileTreeNodeSchema: z.ZodType<FileTreeNode> = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory']),
  children: z.lazy(() => z.array(FileTreeNodeSchema).optional()),
  filePath: z.string(),
})

export interface FileTreeNode {
  name: string
  type: 'file' | 'directory'
  filePath: string
  lastReadTime?: number
  children?: FileTreeNode[]
}

export interface DirectoryNode extends FileTreeNode {
  type: 'directory'
  children: FileTreeNode[]
}

export interface FileNode extends FileTreeNode {
  type: 'file'
  lastReadTime: number
}

export const FileVersionSchema = z.object({
  path: z.string(),
  content: z.string(),
})

export type FileVersion = z.infer<typeof FileVersionSchema>

export const customToolDefinitionsSchema = z
  .record(
    z.string(),
    z.object({
      inputSchema: z.custom<z.ZodType | Record<string, unknown>>(),
      endsAgentStep: z.boolean().optional().default(false),
      description: z.string().optional(),
      exampleInputs: z.record(z.string(), z.any()).array().optional(),
    }),
  )
  .default(() => ({}))
export type CustomToolDefinitions = NonNullable<
  z.input<typeof customToolDefinitionsSchema>
>

export const ProjectFileContextSchema = z.object({
  projectRoot: z.string(),
  cwd: z.string(),
  fileTree: z.array(z.custom<FileTreeNode>()),
  fileTokenScores: z.record(z.string(), z.record(z.string(), z.number())),
  tokenCallers: z
    .record(z.string(), z.record(z.string(), z.array(z.string())))
    .optional(),
  knowledgeFiles: z.record(z.string(), z.string()),
  userKnowledgeFiles: z.record(z.string(), z.string()).optional(),
  agentTemplates: z.record(z.string(), z.any()).default(() => ({})),
  customToolDefinitions: customToolDefinitionsSchema,
  skills: z.record(z.string(), z.any()).optional(),
  includeHomeSkills: z.boolean().optional(),
  gitChanges: z.object({
    gitAvailable: z.boolean().optional(),
    branch: z.string().optional(),
    changedFiles: z.array(z.string()).optional(),
    changedFileCount: z.number().optional(),
    changedFileScanTruncated: z.boolean().optional(),
    repositoryVisibility: z
      .enum(['public', 'private', 'internal', 'unknown'])
      .optional(),
    commitCount: z.number().optional(),
    historyIsShallow: z.boolean().optional(),
    commitDatePercentiles: z
      .object({
        p0: z.string(),
        p25: z.string(),
        p50: z.string(),
        p75: z.string(),
        p100: z.string(),
      })
      .optional(),
    mergedPullRequestCount: z.number().optional(),
    humanContributorCount: z.number().optional(),
    botContributorCount: z.number().optional(),
    historyScanTruncated: z.boolean().optional(),
    contributorCount: z.number().optional(),
    fileCount: z.number().optional(),
    fileCountIsLowerBound: z.boolean().optional(),
    testFileCount: z.number().optional(),
    status: z.string().optional(),
    diff: z.string().optional(),
    diffCached: z.string().optional(),
    lastCommitMessages: z.string().optional(),
  }),
  changesSinceLastChat: z.record(z.string(), z.string()),
  shellConfigFiles: z.record(z.string(), z.string()),
  systemInfo: z.object({
    platform: z.string(),
    shell: z.string(),
    nodeVersion: z.string(),
    arch: z.string(),
    homedir: z.string(),
    cpus: z.number(),
    chromeAvailable: z.boolean(),
  }),
})

export type ProjectFileContext = {
  projectRoot: string
  cwd: string
  fileTree: FileTreeNode[]
  fileTokenScores: Record<string, Record<string, number>>
  tokenCallers?: Record<string, Record<string, string[]>>
  knowledgeFiles: Record<string, string>
  userKnowledgeFiles?: Record<string, string>
  agentTemplates: Record<string, any>
  customToolDefinitions: CustomToolDefinitions
  skills?: SkillsMap
  includeHomeSkills?: boolean
  gitChanges: {
    gitAvailable?: boolean
    branch?: string
    changedFiles?: string[]
    changedFileCount?: number
    changedFileScanTruncated?: boolean
    repositoryVisibility?: 'public' | 'private' | 'internal' | 'unknown'
    commitCount?: number
    historyIsShallow?: boolean
    commitDatePercentiles?: {
      p0: string
      p25: string
      p50: string
      p75: string
      p100: string
    }
    mergedPullRequestCount?: number
    humanContributorCount?: number
    botContributorCount?: number
    historyScanTruncated?: boolean
    contributorCount?: number
    fileCount?: number
    fileCountIsLowerBound?: boolean
    testFileCount?: number
    status?: string
    diff?: string
    diffCached?: string
    lastCommitMessages?: string
  }
  changesSinceLastChat: Record<string, string>
  shellConfigFiles: Record<string, string>
  systemInfo: {
    platform: string
    shell: string
    nodeVersion: string
    arch: string
    homedir: string
    cpus: number
    chromeAvailable: boolean
  }
}

export const REPO_SNAPSHOT_FIELDS = [
  'gitAvailable',
  'repositoryVisibility',
  'fileCount',
  'fileCountIsLowerBound',
  'testFileCount',
  'commitCount',
  'historyIsShallow',
  'historyScanTruncated',
  'commitDatePercentiles',
  'mergedPullRequestCount',
  'humanContributorCount',
  'botContributorCount',
  'contributorCount',
  'changedFileCount',
  'changedFileScanTruncated',
] as const

export type RepoSnapshot = Pick<
  ProjectFileContext['gitChanges'],
  (typeof REPO_SNAPSHOT_FIELDS)[number]
>

export const toRepoSnapshot = (
  gitChanges: ProjectFileContext['gitChanges'] | undefined,
): RepoSnapshot | undefined => {
  if (!gitChanges) return undefined
  const snapshot: Record<string, unknown> = {}
  for (const field of REPO_SNAPSHOT_FIELDS) {
    const value = gitChanges[field]
    if (value !== undefined) snapshot[field] = value
  }
  return Object.keys(snapshot).length > 0
    ? (snapshot as RepoSnapshot)
    : undefined
}

export const fileRegex =
  /<write_file>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_file>/g
export const fileWithNoPathRegex = /<write_file>([\s\S]*?)<\/write_file>/g

export const parseFileBlocks = (fileBlocks: string) => {
  let fileMatch
  const files: Record<string, string> = {}
  while ((fileMatch = fileRegex.exec(fileBlocks)) !== null) {
    const [, filePath, fileContent] = fileMatch
    files[filePath] = fileContent.startsWith('\n')
      ? fileContent.slice(1)
      : fileContent
  }
  return files
}

export const getStubProjectFileContext = (): ProjectFileContext => ({
  projectRoot: '',
  cwd: '',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  skills: {},
  gitChanges: {
    gitAvailable: false,
    changedFiles: [],
    changedFileCount: 0,
    repositoryVisibility: 'unknown',
    fileCount: 0,
    testFileCount: 0,
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  systemInfo: {
    platform: '',
    shell: '',
    nodeVersion: '',
    arch: '',
    homedir: '',
    cpus: 0,
    chromeAvailable: false,
  },
})

export const createMarkdownFileBlock = (filePath: string, content: string) => {
  return `\`\`\`${filePath}\n${content}\n\`\`\``
}

export const parseMarkdownCodeBlock = (content: string) => {
  const match = content.match(/^```(?:[a-zA-Z]+)?\n([\s\S]*)\n```$/)
  if (match) {
    return match[1] + '\n'
  }
  return content
}

export const createSearchReplaceBlock = (search: string, replace: string) => {
  return `<<<<<<< SEARCH\n${search}\n=======\n${replace}\n>>>>>>> REPLACE`
}

export function printFileTree(
  nodes: FileTreeNode[],
  depth: number = 0,
): string {
  let result = ''
  const indentation = ' '.repeat(depth)
  for (const node of nodes) {
    result += `${indentation}${node.name}${node.type === 'directory' ? '/' : ''}\n`
    if (node.type === 'directory' && node.children) {
      result += printFileTree(node.children, depth + 1)
    }
  }
  return result
}

export function printFileTreeWithTokens(
  nodes: FileTreeNode[],
  fileTokenScores: Record<string, Record<string, number>>,
  path: string[] = [],
): string {
  let result = ''
  const depth = path.length
  const indentToken = ' '
  const indentation = indentToken.repeat(depth)
  const indentationWithFile = indentToken.repeat(depth + 1)
  for (const node of nodes) {
    if (
      node.type === 'directory' &&
      (!node.children || node.children.length === 0)
    ) {
      continue
    }
    result += `${indentation}${node.name}${node.type === 'directory' ? '/' : ''}`
    path.push(node.name)
    const filePath = path.join('/')
    const tokenScores = fileTokenScores[filePath]
    if (node.type === 'file' && tokenScores) {
      const tokens = Object.keys(tokenScores)
      if (tokens.length > 0) {
        result += `\n${indentationWithFile}${tokens.join(' ')}`
      }
    }
    result += '\n'
    if (node.type === 'directory' && node.children) {
      result += printFileTreeWithTokens(node.children, fileTokenScores, path)
    }
    path.pop()
  }
  return result
}

export const ensureEndsWithNewline = (
  contents: string | null,
): string | null => {
  if (contents === null || contents === '') {
    return contents
  }
  if (contents.endsWith('\n')) {
    return contents
  }
  return contents + '\n'
}

export async function fileExists(params: {
  filePath: string
  fs: CodebuffFileSystem
}): Promise<boolean> {
  const { filePath, fs } = params

  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

async function directoryExists(params: {
  path: string
  fs: CodebuffFileSystem
}): Promise<boolean> {
  try {
    return (await params.fs.stat(params.path)).isDirectory()
  } catch {
    return false
  }
}

function errorCode(error: unknown): string | null {
  return error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null
}

export const ensureDirectoryExists = async (params: {
  baseDir: string
  fs: CodebuffFileSystem
}) => {
  const { baseDir, fs } = params

  if (await directoryExists({ path: baseDir, fs })) return

  try {
    await fs.mkdir(baseDir, { recursive: true })
  } catch (error) {
    if (errorCode(error) !== 'EEXIST') throw error

    for (const delayMs of [0, 10, 50, 100]) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
      if (await directoryExists({ path: baseDir, fs })) return
    }

    throw error
  }
}

export const cleanMarkdownCodeBlock = (content: string): string => {
  const cleanResponse = content.match(/^```(?:[a-zA-Z]+)?\n([\s\S]*)\n```$/)
    ? content.replace(/^```(?:[a-zA-Z]+)?\n/, '').replace(/\n```$/, '')
    : content
  return cleanResponse
}

export function isValidFilePath(path: string) {
  if (!path) return false

  if (/\s/.test(path)) return false

  const invalidChars = /[<>:"|?*\x00-\x1F]/g
  if (invalidChars.test(path)) return false

  return true
}

export async function isDir(params: {
  path: string
  fs: CodebuffFileSystem
}): Promise<boolean> {
  const { path, fs } = params

  try {
    const stats = await fs.stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

export function isSubdir(fromPath: string, toPath: string) {
  const resolvedFrom = path.resolve(fromPath)
  const resolvedTo = path.resolve(toPath)

  if (process.platform === 'win32') {
    const fromDrive = path.parse(resolvedFrom).root.toLowerCase()
    const toDrive = path.parse(resolvedTo).root.toLowerCase()
    if (fromDrive !== toDrive) {
      return false
    }
  }

  return !path.relative(resolvedFrom, resolvedTo).startsWith('..')
}

export function isValidProjectRoot(dir: string): boolean {
  return !isSubdir(dir, os.homedir())
}
