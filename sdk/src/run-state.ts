import * as os from 'os'
import path from 'path'

import { getSystemInfo } from '@codebuff/common/util/system-info'
import {
  KNOWLEDGE_FILE_NAMES_LOWERCASE,
  isKnowledgeFile,
} from '@codebuff/common/constants/knowledge'
import {
  DEFAULT_MAX_FILES,
  getProjectFileTree,
  getAllFilePaths,
} from '@codebuff/common/project-file-tree'
import { getInitialSessionState } from '@codebuff/common/types/session-state'
import { getErrorObject } from '@codebuff/common/util/error'
import { cloneDeep } from 'lodash'
import z from 'zod/v4'

import { loadLocalAgents } from './agents/load-agents'
import { loadSkills } from './skills/load-skills'

export {
  KNOWLEDGE_FILE_NAMES,
  isKnowledgeFile,
} from '@codebuff/common/constants/knowledge'

import type { CustomToolDefinition } from './custom-tool'
import type { AgentDefinition } from '@codebuff/common/templates/initial-agents-dir/types/agent-definition'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { CodebuffFileSystem } from '@codebuff/common/types/filesystem'
import type { Message } from '@codebuff/common/types/messages/codebuff-message'
import type {
  AgentOutput,
  SessionState,
} from '@codebuff/common/types/session-state'
import type { SkillsMap } from '@codebuff/common/types/skill'
import type { CodebuffSpawn } from '@codebuff/common/types/spawn'
import type {
  CustomToolDefinitions,
  FileTreeNode,
} from '@codebuff/common/util/file'
import type * as fsType from 'fs'

export function selectHighestPriorityKnowledgeFile(
  candidates: string[],
): string | undefined {
  for (const priorityName of KNOWLEDGE_FILE_NAMES_LOWERCASE) {
    const match = candidates.find((f) => f.toLowerCase().endsWith(priorityName))
    if (match) return match
  }
  return undefined
}

export type RunState = {
  sessionState?: SessionState
  output: AgentOutput
  traceSessionId: string
}

export type ComputedProjectIndex = {
  fileTree: FileTreeNode[]
  fileTokenScores: Record<string, any>
  tokenCallers: Record<string, any>
}

export type InitialSessionStateOptions = {
  cwd?: string
  skillsDir?: string
  skillsLoader?: () => Promise<SkillsMap>
  includeHomeSkills?: boolean
  projectFiles?: Record<string, string>
  projectIndex?: ComputedProjectIndex
  knowledgeFiles?: Record<string, string>
  userKnowledgeFiles?: Record<string, string>
  agentDefinitions?: AgentDefinition[]
  customToolDefinitions?: CustomToolDefinition[]
  maxAgentSteps?: number
  fs?: CodebuffFileSystem
  spawn?: CodebuffSpawn
  logger?: Logger
}

function processAgentDefinitions(
  agentDefinitions: AgentDefinition[],
): Record<string, any> {
  const processedAgentTemplates: Record<string, any> = {}
  agentDefinitions.forEach((definition) => {
    const processedConfig = { ...definition } as Record<string, any>
    if (
      processedConfig.handleSteps &&
      typeof processedConfig.handleSteps === 'function'
    ) {
      processedConfig.handleStepsFn = processedConfig.handleSteps
      processedConfig.handleSteps = processedConfig.handleSteps.toString()
    }
    if (processedConfig.id) {
      processedAgentTemplates[processedConfig.id] = processedConfig
    }
  })
  return processedAgentTemplates
}

function processCustomToolDefinitions(
  customToolDefinitions: CustomToolDefinition[],
): CustomToolDefinitions {
  return Object.fromEntries(
    customToolDefinitions.map((toolDefinition) => {
      const jsonSchema = z.toJSONSchema(toolDefinition.inputSchema, {
        io: 'input',
      }) as Record<string, unknown>
      delete jsonSchema['$schema']

      return [
        toolDefinition.toolName,
        {
          inputSchema: jsonSchema,
          description: toolDefinition.description,
          endsAgentStep: toolDefinition.endsAgentStep,
          exampleInputs: toolDefinition.exampleInputs,
        },
      ]
    }),
  )
}

type ProjectIndexInput = {
  cwd: string
  fileTree: FileTreeNode[]
  filePaths: string[]
  readFile?: (filePath: string) => string | null | Promise<string | null>
}

const MAX_DISCOVERED_PROJECT_READ_BYTES = 1_000_000

const MAX_SUBPROCESS_OUTPUT_CHARS = 10_000_000
const MAX_GIT_PATH_OUTPUT_CHARS = 500_000
const MAX_CHANGED_FILES = 25
const REPOSITORY_VISIBILITY_TIMEOUT_MS = 1_000
const SUBPROCESS_TRUNCATION_MARKER = '\n[output truncated]'

const KNOWN_BOT_PATTERN =
  /(?:\[bot\]|(?:^|[\s._+/@-])(?:bot|dependabot|renovate|github-actions|codecov|coveralls|greenkeeper|mergify|semantic-release|release-please)(?:$|[\s._+/@-]))/i
const MERGED_PULL_REQUEST_PATTERNS = [
  /^Merge pull request #(\d+)\b/i,
  /\(#(\d+)\)\s*$/,
  /\(pull request #(\d+)\)\s*$/i,
]
const TEST_DIRECTORY_NAMES = new Set([
  '__tests__',
  '__specs__',
  'test',
  'tests',
  'spec',
  'specs',
])

export function isTestFilePath(filePath: string): boolean {
  const segments = filePath.replaceAll('\\', '/').split('/')
  const fileName = segments.pop() ?? ''
  if (
    segments.some((segment) => TEST_DIRECTORY_NAMES.has(segment.toLowerCase()))
  ) {
    return true
  }

  const lowerFileName = fileName.toLowerCase()
  return (
    /\.(?:test|tests|spec|specs|cy)\./.test(lowerFileName) ||
    /^(?:test|spec)_.+\.[^.]+$/.test(lowerFileName) ||
    /_(?:test|tests|spec|specs)\.[^.]+$/.test(lowerFileName) ||
    /^(?:test|tests|spec|specs)\.[^.]+$/.test(lowerFileName) ||
    /(?:Test|Tests|TestCase|Spec)\.[^.]+$/.test(fileName)
  )
}

function getCompleteOutput(result: {
  stdout: string
  truncated: boolean
}): string {
  if (!result.truncated) return result.stdout
  const prefix = result.stdout.slice(0, -SUBPROCESS_TRUNCATION_MARKER.length)
  const lastNewline = prefix.lastIndexOf('\n')
  return lastNewline === -1 ? '' : prefix.slice(0, lastNewline)
}

function getHistoryStats(output: string): {
  humanContributorCount: number
  botContributorCount: number
  mergedPullRequestCount: number
  commitDatePercentiles?: {
    p0: string
    p25: string
    p50: string
    p75: string
    p100: string
  }
} {
  const contributors = new Map<string, boolean>()
  const mergedPullRequests = new Set<string>()
  const commitDates: string[] = []

  for (const line of output.split('\n')) {
    const [rawName = '', rawEmail = '', rawDate = '', ...subjectParts] =
      line.split('\t')
    const name = rawName.trim()
    const email = rawEmail.trim().toLowerCase()
    const date = rawDate.trim()
    const subject = subjectParts.join('\t').trim()
    if (!name && !email) continue

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      commitDates.push(date)
    }

    const githubEmail = email.replace(
      /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/,
      '$1@users.noreply.github.com',
    )
    const key = githubEmail || name.toLowerCase()
    const isBot = KNOWN_BOT_PATTERN.test(`${name} ${email}`)
    contributors.set(key, (contributors.get(key) ?? false) || isBot)

    for (const pattern of MERGED_PULL_REQUEST_PATTERNS) {
      const match = subject.match(pattern)
      if (match?.[1]) {
        mergedPullRequests.add(match[1])
        break
      }
    }
  }

  let botContributorCount = 0
  for (const isBot of contributors.values()) {
    if (isBot) botContributorCount++
  }
  commitDates.sort()
  const percentileDate = (percentile: number): string | undefined => {
    if (commitDates.length === 0) return undefined
    const index =
      percentile === 0 ? 0 : Math.ceil(percentile * commitDates.length) - 1
    return commitDates[Math.min(index, commitDates.length - 1)]
  }
  const p0 = percentileDate(0)
  const p25 = percentileDate(0.25)
  const p50 = percentileDate(0.5)
  const p75 = percentileDate(0.75)
  const p100 = percentileDate(1)

  return {
    humanContributorCount: contributors.size - botContributorCount,
    botContributorCount,
    mergedPullRequestCount: mergedPullRequests.size,
    commitDatePercentiles:
      p0 && p25 && p50 && p75 && p100 ? { p0, p25, p50, p75, p100 } : undefined,
  }
}

async function computeProjectIndex(params: ProjectIndexInput): Promise<{
  fileTree: FileTreeNode[]
  fileTokenScores: Record<string, any>
  tokenCallers: Record<string, any>
}> {
  const { cwd, fileTree, filePaths, readFile } = params
  let fileTokenScores = {}
  let tokenCallers = {}

  if (filePaths.length > 0) {
    try {
      const { getFileTokenScores } = await import('@codebuff/code-map/parse')
      const tokenData = await getFileTokenScores(cwd, filePaths, readFile)
      fileTokenScores = tokenData.tokenScores
      tokenCallers = tokenData.tokenCallers
    } catch (error) {
      console.warn('Failed to generate parsed symbol scores:', error)
    }
  }

  return { fileTree, fileTokenScores, tokenCallers }
}

export async function computeProjectIndexFromFiles(params: {
  cwd: string
  projectFiles: Record<string, string>
}): Promise<ComputedProjectIndex> {
  const input = getProjectIndexInput({
    cwd: params.cwd,
    projectFiles: params.projectFiles,
  })
  if (!input) {
    return { fileTree: [], fileTokenScores: {}, tokenCallers: {} }
  }
  return computeProjectIndex(input)
}

function getProjectIndexInput(params: {
  cwd: string
  fs?: CodebuffFileSystem
  logger?: Logger
  projectFiles?: Record<string, string>
  discoveredProject?: { fileTree: FileTreeNode[]; filePaths: string[] }
}): ProjectIndexInput | undefined {
  const { cwd, fs, logger, projectFiles, discoveredProject } = params

  if (projectFiles) {
    const filePaths = Object.keys(projectFiles).sort()
    return {
      cwd,
      fileTree: buildFileTree(filePaths),
      filePaths,
      readFile: (filePath: string) => projectFiles[filePath] || null,
    }
  }

  if (discoveredProject) {
    if (!fs || !logger) return undefined

    return {
      cwd,
      fileTree: discoveredProject.fileTree,
      filePaths: discoveredProject.filePaths.sort(),
      readFile: createDiscoveredProjectReader({ cwd, fs, logger }),
    }
  }

  return undefined
}

function createDiscoveredProjectReader(params: {
  cwd: string
  fs: CodebuffFileSystem
  logger: Logger
}): (filePath: string) => Promise<string | null> {
  const { cwd, fs, logger } = params

  return async (filePath: string) => {
    const fullPath = path.join(cwd, filePath)
    try {
      const stats = await fs.stat(fullPath)
      if (getFileSize(stats) > MAX_DISCOVERED_PROJECT_READ_BYTES) {
        return null
      }
      return await fs.readFile(fullPath, 'utf8')
    } catch (error) {
      logger.debug?.(
        { filePath, error: getErrorObject(error) },
        'Failed to read discovered project file for symbol scoring',
      )
      return null
    }
  }
}

function getFileSize(stats: Awaited<ReturnType<CodebuffFileSystem['stat']>>) {
  return typeof stats.size === 'number' ? stats.size : 0
}

function childProcessToPromise(
  proc: ReturnType<CodebuffSpawn>,
  maxOutputChars: number = MAX_SUBPROCESS_OUTPUT_CHARS,
  timeoutMs?: number,
): Promise<{ stdout: string; stderr: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let truncated = false
    let settled = false
    const timeout =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            if (settled) return
            settled = true
            proc.kill()
            reject(new Error(`Command timed out after ${timeoutMs}ms`))
          }, timeoutMs)

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      callback()
    }

    const collect = (existing: string, data: Buffer): string => {
      if (truncated) return existing
      const next = existing + data.toString()
      if (next.length <= maxOutputChars) return next
      truncated = true
      proc.kill()
      return next.slice(0, maxOutputChars) + SUBPROCESS_TRUNCATION_MARKER
    }

    proc.stdout?.on('data', (data: Buffer) => {
      stdout = collect(stdout, data)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr = collect(stderr, data)
    })

    proc.on('close', (code: number | null) => {
      if (code === 0 || truncated) {
        finish(() => resolve({ stdout, stderr, truncated }))
      } else {
        finish(() => reject(new Error(`Command exited with code ${code}`)))
      }
    })

    proc.on('error', (error) => finish(() => reject(error)))
  })
}

export async function getGitChanges(params: {
  cwd: string
  spawn: CodebuffSpawn
  logger: Logger
  fileCount?: number
  fileCountIsLowerBound?: boolean
  testFileCount?: number
}): Promise<{
  gitAvailable: boolean
  branch?: string
  changedFiles: string[]
  changedFileCount: number
  changedFileScanTruncated: boolean
  repositoryVisibility: 'public' | 'private' | 'internal' | 'unknown'
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
  fileCount?: number
  fileCountIsLowerBound?: boolean
  testFileCount?: number
}> {
  const {
    cwd,
    spawn,
    logger,
    fileCount,
    fileCountIsLowerBound,
    testFileCount,
  } = params

  const stdoutOf =
    (command: string) =>
    ({ stdout, truncated }: { stdout: string; truncated: boolean }) => {
      if (truncated) {
        logger.info?.(
          { command, chars: stdout.length },
          'Git command output truncated at cap',
        )
      }
      return stdout
    }

  const gitOutput = (
    args: string[],
    label: string,
    maxOutputChars = MAX_SUBPROCESS_OUTPUT_CHARS,
  ) =>
    childProcessToPromise(spawn('git', args, { cwd }), maxOutputChars)
      .then((result) => ({
        stdout: stdoutOf(label)(result),
        truncated: result.truncated,
      }))
      .catch((error) => {
        logger.debug?.({ error }, `Failed to get ${label}`)
        return undefined
      })

  const branch = gitOutput(['rev-parse', '--abbrev-ref', 'HEAD'], 'git branch')
  const unstagedFiles = gitOutput(
    ['diff', '--name-only', '--'],
    'git unstaged file names',
    MAX_GIT_PATH_OUTPUT_CHARS,
  )
  const stagedFiles = gitOutput(
    ['diff', '--cached', '--name-only', '--'],
    'git staged file names',
    MAX_GIT_PATH_OUTPUT_CHARS,
  )
  const untrackedFiles = gitOutput(
    ['ls-files', '--others', '--exclude-standard'],
    'git untracked file names',
    MAX_GIT_PATH_OUTPUT_CHARS,
  )
  const commitCount = gitOutput(
    ['rev-list', '--count', 'HEAD'],
    'git commit count',
  )
  const history = gitOutput(
    ['log', '--use-mailmap', '--format=%aN%x09%aE%x09%cs%x09%s', 'HEAD'],
    'git history summary',
  )
  const historyIsShallow = gitOutput(
    ['rev-parse', '--is-shallow-repository'],
    'git shallow status',
  )
  const visibility = childProcessToPromise(
    spawn(
      'gh',
      ['repo', 'view', '--json', 'visibility', '--jq', '.visibility'],
      { cwd },
    ),
    1_000,
    REPOSITORY_VISIBILITY_TIMEOUT_MS,
  ).catch((error) => {
    logger.debug?.({ error }, 'Failed to get repository visibility')
    return undefined
  })

  const pathResults = await Promise.all([
    unstagedFiles,
    stagedFiles,
    untrackedFiles,
  ])
  const changedPaths = Array.from(
    new Set(
      pathResults.flatMap((result) => {
        if (!result) return []
        return getCompleteOutput(result)
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      }),
    ),
  ).sort()
  const gitAvailable = pathResults.some((result) => result !== undefined)
  const pathOutputTruncated = pathResults.some((result) => result?.truncated)

  const parseCount = (value: string | undefined): number | undefined => {
    if (value === undefined) return undefined
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const historyResult = await history
  const parsedHistoryStats = historyResult
    ? getHistoryStats(getCompleteOutput(historyResult))
    : undefined
  const shallowResult = await historyIsShallow
  const shallow = shallowResult
    ? shallowResult.stdout.trim() === 'true'
    : undefined
  const historyStats = parsedHistoryStats
    ? {
        ...parsedHistoryStats,
        commitDatePercentiles: historyResult?.truncated
          ? undefined
          : parsedHistoryStats.commitDatePercentiles,
      }
    : undefined
  const visibilityValue = (await visibility)?.stdout.trim().toLowerCase()
  const repositoryVisibility =
    visibilityValue === 'public' ||
    visibilityValue === 'private' ||
    visibilityValue === 'internal'
      ? visibilityValue
      : 'unknown'

  return {
    gitAvailable,
    branch: (await branch)?.stdout.trim() || undefined,
    changedFiles: changedPaths.slice(0, MAX_CHANGED_FILES),
    changedFileCount: changedPaths.length,
    changedFileScanTruncated: pathOutputTruncated,
    repositoryVisibility,
    commitCount: parseCount((await commitCount)?.stdout),
    historyIsShallow: shallow,
    ...historyStats,
    historyScanTruncated: historyResult?.truncated,
    fileCount,
    fileCountIsLowerBound,
    testFileCount,
  }
}

async function discoverProjectPaths(params: {
  cwd: string
  fs: CodebuffFileSystem
}): Promise<{ fileTree: FileTreeNode[]; filePaths: string[] }> {
  const { cwd, fs } = params

  const fileTree = await getProjectFileTree({ projectRoot: cwd, fs })
  const filePaths = getAllFilePaths(fileTree)

  return { fileTree, filePaths }
}

export async function loadUserKnowledgeFiles(params: {
  fs: CodebuffFileSystem
  logger: Logger
  homeDir?: string
}): Promise<Record<string, string>> {
  const { fs, logger } = params
  const homeDir = params.homeDir ?? os.homedir()
  const userKnowledgeFiles: Record<string, string> = {}

  let entries: string[]
  try {
    entries = await fs.readdir(homeDir)
  } catch (error) {
    logger.debug?.(
      { homeDir, error: getErrorObject(error) },
      'Failed to read home directory',
    )
    return userKnowledgeFiles
  }

  const candidates = new Map<string, string>()
  for (const entry of entries) {
    if (!entry.startsWith('.')) continue
    const nameWithoutDot = entry.slice(1)
    const lowerName = nameWithoutDot.toLowerCase()
    if (KNOWLEDGE_FILE_NAMES_LOWERCASE.includes(lowerName)) {
      candidates.set(lowerName, entry)
    }
  }

  for (const priorityName of KNOWLEDGE_FILE_NAMES_LOWERCASE) {
    const actualFileName = candidates.get(priorityName)
    if (actualFileName) {
      const filePath = path.join(homeDir, actualFileName)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const tildeKey = `~/${actualFileName}`
        userKnowledgeFiles[tildeKey] = content
        break
      } catch (error) {
        logger.debug?.(
          { filePath, error: getErrorObject(error) },
          'Failed to read user knowledge file',
        )
      }
    }
  }

  return userKnowledgeFiles
}

export function selectKnowledgeFilePaths(allFilePaths: string[]): string[] {
  const knowledgeCandidates = allFilePaths.filter(isKnowledgeFile)

  const byDirectory = new Map<string, string[]>()
  for (const filePath of knowledgeCandidates) {
    const dir = path.dirname(filePath)
    if (!byDirectory.has(dir)) {
      byDirectory.set(dir, [])
    }
    byDirectory.get(dir)!.push(filePath)
  }

  const selectedFiles: string[] = []

  for (const files of byDirectory.values()) {
    const selected = selectHighestPriorityKnowledgeFile(files)
    if (selected) {
      selectedFiles.push(selected)
    }
  }

  return selectedFiles
}

function deriveKnowledgeFiles(
  projectFiles: Record<string, string>,
): Record<string, string> {
  const allFilePaths = Object.keys(projectFiles)
  const selectedFilePaths = selectKnowledgeFilePaths(allFilePaths)

  const knowledgeFiles: Record<string, string> = {}
  for (const filePath of selectedFilePaths) {
    knowledgeFiles[filePath] = projectFiles[filePath]
  }
  return knowledgeFiles
}

async function loadKnowledgeFilesFromPaths(params: {
  cwd: string
  filePaths: string[]
  fs: CodebuffFileSystem
  logger: Logger
}): Promise<Record<string, string>> {
  const { cwd, filePaths, fs, logger } = params
  const selectedFilePaths = selectKnowledgeFilePaths(filePaths)

  const knowledgeFiles: Record<string, string> = {}
  for (const filePath of selectedFilePaths) {
    try {
      knowledgeFiles[filePath] = await fs.readFile(
        path.join(cwd, filePath),
        'utf8',
      )
    } catch (error) {
      logger.debug?.(
        { filePath, error: getErrorObject(error) },
        'Failed to read project knowledge file',
      )
    }
  }
  return knowledgeFiles
}

export async function initialSessionState(
  params: InitialSessionStateOptions,
): Promise<SessionState> {
  const {
    cwd,
    maxAgentSteps,
    skillsDir,
    skillsLoader,
    includeHomeSkills = false,
  } = params
  let {
    agentDefinitions,
    customToolDefinitions,
    projectFiles,
    knowledgeFiles,
    userKnowledgeFiles: providedUserKnowledgeFiles,
    fs,
    spawn,
    logger,
  } = params
  if (!agentDefinitions) {
    agentDefinitions = []
  }
  if (!customToolDefinitions) {
    customToolDefinitions = []
  }
  if (!fs) {
    fs = (require('fs') as typeof fsType).promises
  }
  if (!spawn) {
    const { spawn: nodeSpawn } = require('child_process')
    spawn = nodeSpawn as CodebuffSpawn
  }
  if (!logger) {
    logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
  }

  const gitChangesPromise = cwd
    ? getGitChanges({ cwd, spawn, logger })
    : undefined

  let discoveredProject:
    | { fileTree: FileTreeNode[]; filePaths: string[] }
    | undefined

  if (projectFiles === undefined && cwd) {
    discoveredProject = await discoverProjectPaths({ cwd, fs })
  }
  if (knowledgeFiles === undefined) {
    if (projectFiles) {
      knowledgeFiles = deriveKnowledgeFiles(projectFiles)
    } else if (cwd && discoveredProject) {
      knowledgeFiles = await loadKnowledgeFilesFromPaths({
        cwd,
        filePaths: discoveredProject.filePaths,
        fs,
        logger,
      })
    } else {
      knowledgeFiles = {}
    }
  }

  let processedAgentTemplates: Record<string, any> = {}
  if (agentDefinitions && agentDefinitions.length > 0) {
    processedAgentTemplates = processAgentDefinitions(agentDefinitions)
  } else {
    processedAgentTemplates = await loadLocalAgents({ verbose: false })
  }
  const processedCustomToolDefinitions = processCustomToolDefinitions(
    customToolDefinitions,
  )

  let fileTree: FileTreeNode[] = []
  let fileTokenScores: Record<string, any> = {}
  let tokenCallers: Record<string, any> = {}

  if (params.projectIndex && projectFiles !== undefined) {
    fileTree = params.projectIndex.fileTree
    fileTokenScores = params.projectIndex.fileTokenScores
    tokenCallers = params.projectIndex.tokenCallers
  } else {
    const projectIndex = cwd
      ? getProjectIndexInput({
          cwd,
          fs,
          logger,
          projectFiles,
          discoveredProject,
        })
      : undefined
    if (projectIndex) {
      const result = await computeProjectIndex(projectIndex)
      fileTree = result.fileTree
      fileTokenScores = result.fileTokenScores
      tokenCallers = result.tokenCallers
    }
  }

  const projectFilePaths = getAllFilePaths(fileTree)
  const fileCount = projectFilePaths.length
  const testFileCount = projectFilePaths.filter(isTestFilePath).length
  const fileCountIsLowerBound =
    projectFiles === undefined &&
    discoveredProject !== undefined &&
    discoveredProject.filePaths.length >= DEFAULT_MAX_FILES

  const gitChanges = cwd
    ? {
        ...(await gitChangesPromise!),
        fileCount,
        fileCountIsLowerBound,
        testFileCount,
      }
    : {
        gitAvailable: false,
        changedFiles: [],
        changedFileCount: 0,
        changedFileScanTruncated: false,
        repositoryVisibility: 'unknown' as const,
        fileCount,
        fileCountIsLowerBound,
        testFileCount,
      }

  const homeKnowledgeFiles = await loadUserKnowledgeFiles({ fs, logger })
  const userKnowledgeFiles = {
    ...homeKnowledgeFiles,
    ...providedUserKnowledgeFiles,
  }

  let skills: SkillsMap
  if (skillsLoader) {
    try {
      skills = await skillsLoader()
    } catch (error) {
      logger.error(
        { error: getErrorObject(error) },
        'Injected skills loader failed; continuing with no skills',
      )
      skills = {}
    }
  } else {
    skills = await loadSkills({
      cwd: cwd ?? process.cwd(),
      skillsPath: skillsDir,
      verbose: false,
      includeHomeSkills,
    })
  }

  const initialState = getInitialSessionState({
    projectRoot: cwd ?? process.cwd(),
    cwd: cwd ?? process.cwd(),
    fileTree,
    fileTokenScores,
    tokenCallers,
    knowledgeFiles,
    userKnowledgeFiles,
    agentTemplates: processedAgentTemplates,
    customToolDefinitions: processedCustomToolDefinitions,
    skills,
    includeHomeSkills,
    gitChanges,
    changesSinceLastChat: {},
    shellConfigFiles: {},
    systemInfo: getSystemInfo(),
  })

  if (maxAgentSteps) {
    initialState.mainAgentState.stepsRemaining = maxAgentSteps
  }

  return initialState
}

export async function generateInitialRunState({
  cwd,
  skillsDir,
  projectFiles,
  knowledgeFiles,
  userKnowledgeFiles,
  agentDefinitions,
  customToolDefinitions,
  maxAgentSteps,
  fs,
}: {
  cwd: string
  skillsDir?: string
  projectFiles?: Record<string, string>
  knowledgeFiles?: Record<string, string>
  userKnowledgeFiles?: Record<string, string>
  agentDefinitions?: AgentDefinition[]
  customToolDefinitions?: CustomToolDefinition[]
  maxAgentSteps?: number
  fs: CodebuffFileSystem
}): Promise<RunState> {
  return {
    traceSessionId: crypto.randomUUID(),
    sessionState: await initialSessionState({
      cwd,
      skillsDir,
      projectFiles,
      knowledgeFiles,
      userKnowledgeFiles,
      agentDefinitions,
      customToolDefinitions,
      maxAgentSteps,
      fs,
    }),
    output: {
      type: 'error',
      message: 'No output yet',
    },
  }
}

export function withAdditionalMessage({
  runState,
  message,
}: {
  runState: RunState
  message: Message
}): RunState {
  const newRunState = cloneDeep(runState)

  if (newRunState.sessionState) {
    newRunState.sessionState.mainAgentState.messageHistory.push(message)
  }

  return newRunState
}

export function withMessageHistory({
  runState,
  messages,
}: {
  runState: RunState
  messages: Message[]
}): RunState {
  const newRunState = JSON.parse(JSON.stringify(runState)) as typeof runState

  if (newRunState.sessionState) {
    newRunState.sessionState.mainAgentState.messageHistory = messages
  }

  return newRunState
}

export async function applyOverridesToSessionState(
  cwd: string | undefined,
  baseSessionState: SessionState,
  overrides: {
    projectFiles?: Record<string, string>
    projectIndex?: ComputedProjectIndex
    knowledgeFiles?: Record<string, string>
    agentDefinitions?: AgentDefinition[]
    customToolDefinitions?: CustomToolDefinition[]
    maxAgentSteps?: number
  },
): Promise<SessionState> {
  const sessionState = JSON.parse(
    JSON.stringify(baseSessionState),
  ) as SessionState

  if (overrides.maxAgentSteps !== undefined) {
    sessionState.mainAgentState.stepsRemaining = overrides.maxAgentSteps
  }

  if (overrides.projectFiles !== undefined) {
    if (overrides.projectIndex) {
      sessionState.fileContext.fileTree = overrides.projectIndex.fileTree
      sessionState.fileContext.fileTokenScores =
        overrides.projectIndex.fileTokenScores
      sessionState.fileContext.tokenCallers =
        overrides.projectIndex.tokenCallers
    } else if (cwd) {
      const projectIndex = getProjectIndexInput({
        cwd,
        projectFiles: overrides.projectFiles,
      })
      if (projectIndex) {
        const { fileTree, fileTokenScores, tokenCallers } =
          await computeProjectIndex(projectIndex)
        sessionState.fileContext.fileTree = fileTree
        sessionState.fileContext.fileTokenScores = fileTokenScores
        sessionState.fileContext.tokenCallers = tokenCallers
      }
    } else {
      sessionState.fileContext.fileTree = []
      sessionState.fileContext.fileTokenScores = {}
      sessionState.fileContext.tokenCallers = {}
    }

    if (overrides.knowledgeFiles === undefined) {
      sessionState.fileContext.knowledgeFiles = deriveKnowledgeFiles(
        overrides.projectFiles,
      )
    }
  }

  if (overrides.knowledgeFiles !== undefined) {
    sessionState.fileContext.knowledgeFiles = overrides.knowledgeFiles
  }

  if (overrides.agentDefinitions !== undefined) {
    const processedAgentTemplates = processAgentDefinitions(
      overrides.agentDefinitions,
    )
    sessionState.fileContext.agentTemplates = {
      ...sessionState.fileContext.agentTemplates,
      ...processedAgentTemplates,
    }
  }

  if (overrides.customToolDefinitions !== undefined) {
    const processedCustomToolDefinitions = processCustomToolDefinitions(
      overrides.customToolDefinitions,
    )
    sessionState.fileContext.customToolDefinitions = {
      ...sessionState.fileContext.customToolDefinitions,
      ...processedCustomToolDefinitions,
    }
  }

  return sessionState
}

function buildFileTree(filePaths: string[]): FileTreeNode[] {
  const tree: Record<string, FileTreeNode> = {}

  for (const filePath of filePaths) {
    const parts = filePath.split('/')

    for (let i = 0; i < parts.length; i++) {
      const currentPath = parts.slice(0, i + 1).join('/')
      const isFile = i === parts.length - 1

      if (!tree[currentPath]) {
        tree[currentPath] = {
          name: parts[i],
          type: isFile ? 'file' : 'directory',
          filePath: currentPath,
          children: isFile ? undefined : [],
        }
      }
    }
  }

  const rootNodes: FileTreeNode[] = []
  const processed = new Set<string>()

  for (const [path, node] of Object.entries(tree)) {
    if (processed.has(path)) continue

    const parentPath = path.substring(0, path.lastIndexOf('/'))
    if (parentPath && tree[parentPath]) {
      const parent = tree[parentPath]
      if (
        parent.children &&
        !parent.children.some((child) => child.filePath === path)
      ) {
        parent.children.push(node)
      }
    } else {
      rootNodes.push(node)
    }
    processed.add(path)
  }

  function sortNodes(nodes: FileTreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children)
      }
    }
  }

  sortNodes(rootNodes)
  return rootNodes
}
