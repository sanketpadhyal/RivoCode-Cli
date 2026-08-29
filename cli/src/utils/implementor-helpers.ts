import type {
  AgentContentBlock,
  ContentBlock,
  ToolContentBlock,
} from '../types/chat'

export const IMPLEMENTOR_AGENT_IDS = [
  'editor-implementor',
  'editor-implementor-opus',
  'editor-implementor-gemini',
  'editor-implementor-gpt-5',
] as const

const ALL_EDIT_TOOL_NAMES = [
  'str_replace',
  'write_file',
  'propose_str_replace',
  'propose_write_file',
] as const

const isProposedToolName = (toolName: ToolContentBlock['toolName']): boolean =>
  typeof toolName === 'string' && toolName.startsWith('propose_')

const getBaseToolName = (toolName: ToolContentBlock['toolName']): string =>
  isProposedToolName(toolName) ? toolName.slice('propose_'.length) : toolName

const SUCCESSFUL_EDIT_MESSAGES = [
  'String replace applied successfully',
  'Created file successfully',
  'Created new file',
  'Overwrote file successfully',
  'Wrote file successfully',
  'Updated file',
  'Proposed new file',
  'Proposed changes',
  'Proposed string replacement',
] as const

const hasProposedTools = (blocks?: ContentBlock[]): boolean => {
  if (!blocks || blocks.length === 0) return false

  return blocks.some(
    (block) => block.type === 'tool' && isProposedToolName(block.toolName),
  )
}

export const isImplementorAgent = (
  agentBlock: Pick<AgentContentBlock, 'agentType' | 'blocks'>,
): boolean => {
  if (hasProposedTools(agentBlock.blocks)) {
    return true
  }

  return IMPLEMENTOR_AGENT_IDS.some((id) => agentBlock.agentType.includes(id))
}

const IMPLEMENTOR_DISPLAY_NAMES = [
  ['editor-implementor-opus', 'Opus'],
  ['editor-implementor-gemini', 'Gemini'],
  ['editor-implementor-gpt-5', 'GPT-5'],
  ['editor-implementor', 'Sonnet'],
] as const

export const getImplementorDisplayName = (
  agentType: string,
  index?: number,
): string => {
  const match = IMPLEMENTOR_DISPLAY_NAMES.find(([id]) => agentType.includes(id))
  const baseName = match ? match[1] : 'Implementor'

  if (index !== undefined) {
    return `${baseName} #${index + 1}`
  }
  return baseName
}

export const getImplementorIndex = (
  currentAgent: AgentContentBlock,
  siblingBlocks: ContentBlock[],
): number | undefined => {
  if (!isImplementorAgent(currentAgent)) return undefined

  const implementorSiblings = siblingBlocks.filter(
    (block): block is AgentContentBlock =>
      block.type === 'agent' &&
      isImplementorAgent(block) &&
      block.agentType === currentAgent.agentType,
  )

  if (implementorSiblings.length <= 1) {
    return undefined
  }

  return implementorSiblings.findIndex(
    (block) => block.agentId === currentAgent.agentId,
  )
}

export function groupConsecutiveBlocks<T extends ContentBlock>(
  blocks: ContentBlock[],
  startIndex: number,
  predicate: (block: ContentBlock) => block is T,
): { group: T[]; nextIndex: number } {
  const group: T[] = []
  let i = startIndex

  while (i < blocks.length) {
    const block = blocks[i]
    if (!predicate(block)) {
      break
    }
    group.push(block)
    i++
  }

  return { group, nextIndex: i }
}

export function groupConsecutiveImplementors(
  blocks: ContentBlock[],
  startIndex: number,
): { group: AgentContentBlock[]; nextIndex: number } {
  return groupConsecutiveBlocks(
    blocks,
    startIndex,
    (block): block is AgentContentBlock =>
      block.type === 'agent' && isImplementorAgent(block),
  )
}

export function groupConsecutiveNonImplementorAgents(
  blocks: ContentBlock[],
  startIndex: number,
): { group: AgentContentBlock[]; nextIndex: number } {
  return groupConsecutiveBlocks(
    blocks,
    startIndex,
    (block): block is AgentContentBlock =>
      block.type === 'agent' && !isImplementorAgent(block),
  )
}

export function groupConsecutiveToolBlocks(
  blocks: ContentBlock[],
  startIndex: number,
): { group: ToolContentBlock[]; nextIndex: number } {
  return groupConsecutiveBlocks(
    blocks,
    startIndex,
    (block): block is ToolContentBlock => block.type === 'tool',
  )
}

export function extractValueForKey(output: string, key: string): string | null {
  if (!output) return null
  const lines = output.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^\s*([A-Za-z0-9_]+):\s*(.*)$/)
    if (match && match[1] === key) {
      const rest = match[2]
      if (rest.trim().startsWith('|')) {
        const baseIndent = lines[i + 1]?.match(/^\s*/)?.[0].length ?? 0
        const acc: string[] = []
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j]
          const indent = l.match(/^\s*/)?.[0].length ?? 0
          if (l.trim().length === 0) {
            acc.push('')
            continue
          }
          if (indent < baseIndent) break
          acc.push(l.slice(baseIndent))
        }
        return acc.join('\n')
      } else {
        let val = rest.trim()
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1)
        }
        return val
      }
    }
  }
  return null
}

export function extractFilePath(toolBlock: ToolContentBlock): string | null {
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const input = toolBlock.input as Record<string, unknown>

  return (
    extractValueForKey(outputStr, 'file') ||
    (typeof input?.path === 'string' ? input.path : null) ||
    (typeof input?.file_path === 'string' ? input.file_path : null)
  )
}

export function extractDiff(toolBlock: ToolContentBlock): string | null {
  let hasSuccessfulOutput = false

  const outputRaw = toolBlock.outputRaw as unknown
  if (Array.isArray(outputRaw) && outputRaw[0]?.value) {
    const value = outputRaw[0].value as Record<string, unknown>
    if (hasErrorMessage(value)) return null
    if (isSuccessfulEditMessage(value.message)) hasSuccessfulOutput = true
    if (value.unifiedDiff) return value.unifiedDiff as string
    if (value.patch) return value.patch as string
  }
  if (typeof outputRaw === 'object' && outputRaw !== null) {
    const rawObj = outputRaw as Record<string, unknown>
    if (hasErrorMessage(rawObj)) return null
    if (isSuccessfulEditMessage(rawObj.message)) hasSuccessfulOutput = true
    if (rawObj.unifiedDiff) return rawObj.unifiedDiff as string
    if (rawObj.patch) return rawObj.patch as string
  }

  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const message = extractValueForKey(outputStr, 'message')
  const diffFromOutput =
    extractValueForKey(outputStr, 'unifiedDiff') ||
    extractValueForKey(outputStr, 'patch')

  if (hasFailedEditOutput({ outputStr, message, diffFromOutput })) {
    return null
  }
  if (isSuccessfulEditMessage(message)) {
    hasSuccessfulOutput = true
  }

  if (diffFromOutput) {
    return diffFromOutput
  }

  const canUseInputFallback =
    isProposedToolName(toolBlock.toolName) ||
    outputStr === '' ||
    hasSuccessfulOutput
  if (!canUseInputFallback) {
    return null
  }

  const input = toolBlock.input as Record<string, unknown>
  const baseToolName = getBaseToolName(toolBlock.toolName)

  if (baseToolName === 'str_replace' && Array.isArray(input?.replacements)) {
    const replacements = input.replacements as ReplacementInput[]
    if (replacements.length > 0) {
      return constructDiffFromReplacements(replacements)
    }
  }

  if (baseToolName === 'write_file' && typeof input?.content === 'string') {
    return constructDiffFromWriteFile(input.content)
  }

  if (input?.content !== undefined && typeof input.content === 'string') {
    return input.content
  }

  return null
}

function hasErrorMessage(value: Record<string, unknown>): boolean {
  return Boolean(value.errorMessage || (value.value as any)?.errorMessage)
}

function hasFailedEditOutput(params: {
  outputStr: string
  message: string | null
  diffFromOutput: string | null
}): boolean {
  const { outputStr, message, diffFromOutput } = params
  const trimmedOutput = outputStr.trim()
  if (!trimmedOutput) {
    return false
  }
  if (
    extractValueForKey(outputStr, 'errorMessage') ||
    isErrorOutput(outputStr)
  ) {
    return true
  }
  if (diffFromOutput || isSuccessfulEditMessage(message)) {
    return false
  }
  return !isSuccessfulEditMessage(trimmedOutput)
}

function isFailedEditToolBlock(toolBlock: ToolContentBlock): boolean {
  const outputRaw = toolBlock.outputRaw as unknown
  if (Array.isArray(outputRaw) && outputRaw[0]?.value) {
    const value = outputRaw[0].value as Record<string, unknown>
    if (hasErrorMessage(value)) return true
  }
  if (typeof outputRaw === 'object' && outputRaw !== null) {
    const rawObj = outputRaw as Record<string, unknown>
    if (hasErrorMessage(rawObj)) return true
  }

  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const message = extractValueForKey(outputStr, 'message')
  const diffFromOutput =
    extractValueForKey(outputStr, 'unifiedDiff') ||
    extractValueForKey(outputStr, 'patch')
  return hasFailedEditOutput({ outputStr, message, diffFromOutput })
}

function isSuccessfulEditMessage(message: unknown): boolean {
  if (typeof message !== 'string') {
    return false
  }

  return message
    .split('\n')
    .some((line) =>
      SUCCESSFUL_EDIT_MESSAGES.some((successMessage) =>
        line.trim().startsWith(successMessage),
      ),
    )
}

function isErrorOutput(output: string): boolean {
  const trimmedOutput = output.trim()
  return trimmedOutput.startsWith('Error:') || trimmedOutput.startsWith('Failed ')
}

type ReplacementInput = {
  oldString?: string
  newString?: string
  old?: string
  new?: string
}

function constructDiffFromReplacements(
  replacements: ReplacementInput[],
): string {
  const lines: string[] = []

  for (const replacement of replacements) {
    const oldString = replacement.oldString ?? replacement.old ?? ''
    const newString = replacement.newString ?? replacement.new ?? ''

    const oldLines = oldString.split('\n')
    for (const line of oldLines) {
      lines.push(`- ${line}`)
    }
    const newLines = newString.split('\n')
    for (const line of newLines) {
      lines.push(`+ ${line}`)
    }
    if (replacements.length > 1) {
      lines.push('')
    }
  }

  return lines.join('\n')
}

function constructDiffFromWriteFile(content: string): string {
  const lines = content.split('\n')
  return lines.map((line) => `+ ${line}`).join('\n')
}

export function isCreateFile(toolBlock: ToolContentBlock): boolean {
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const message = extractValueForKey(outputStr, 'message')
  return (
    typeof message === 'string' &&
    (message.startsWith('Created file successfully') ||
      message.startsWith('Created new file') ||
      message.startsWith('Proposed new file'))
  )
}

function hasToolResultOutput(toolBlock: ToolContentBlock): boolean {
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  return outputStr.length > 0 || toolBlock.outputRaw !== undefined
}

export function shouldShowEditDiff(toolBlock: ToolContentBlock): boolean {
  if (!extractDiff(toolBlock) || isCreateFile(toolBlock)) {
    return false
  }

  if (
    !isProposedToolName(toolBlock.toolName) &&
    !hasToolResultOutput(toolBlock)
  ) {
    return false
  }

  return true
}

export interface TimelineItem {
  type: 'commentary' | 'edit'
  content: string
  diff?: string
  isCreate?: boolean
}

export type FileChangeType = 'A' | 'M' | 'D' | 'R'

export interface DiffStats {
  linesAdded: number
  linesRemoved: number
  hunks: number
}

export interface FileStats {
  path: string
  changeType: FileChangeType
  stats: DiffStats
}

export function parseDiffStats(diff: string | undefined): DiffStats {
  if (!diff) return { linesAdded: 0, linesRemoved: 0, hunks: 0 }

  const lines = diff.split('\n')
  let linesAdded = 0
  let linesRemoved = 0
  let hunks = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      hunks++
    }
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded++
    }
    else if (line.startsWith('-') && !line.startsWith('---')) {
      linesRemoved++
    }
  }

  if (hunks === 0 && (linesAdded > 0 || linesRemoved > 0)) {
    hunks = 1
  }

  return { linesAdded, linesRemoved, hunks }
}

export function getFileChangeType(toolBlock: ToolContentBlock): FileChangeType {
  const baseToolName = getBaseToolName(toolBlock.toolName)
  if (baseToolName === 'write_file') {
    const isCreate = isCreateFile(toolBlock)
    return isCreate ? 'A' : 'M'
  }

  return 'M'
}

export function getFileStatsFromBlocks(
  blocks: ContentBlock[] | undefined,
): FileStats[] {
  if (!blocks || blocks.length === 0) return []

  const fileMap = new Map<string, FileStats>()

  for (const block of blocks) {
    if (
      block.type !== 'tool' ||
      !ALL_EDIT_TOOL_NAMES.includes(
        block.toolName as (typeof ALL_EDIT_TOOL_NAMES)[number],
      )
    ) {
      continue
    }
    if (isFailedEditToolBlock(block)) continue

    const filePath = extractFilePath(block)
    if (!filePath) continue

    const diff = extractDiff(block)
    const stats = parseDiffStats(diff ?? undefined)
    const changeType = getFileChangeType(block)

    const existing = fileMap.get(filePath)
    if (existing) {
      existing.stats.linesAdded += stats.linesAdded
      existing.stats.linesRemoved += stats.linesRemoved
      existing.stats.hunks += stats.hunks
    } else {
      fileMap.set(filePath, {
        path: filePath,
        changeType,
        stats,
      })
    }
  }

  return Array.from(fileMap.values())
}

export function buildActivityTimeline(
  blocks: ContentBlock[] | undefined,
): TimelineItem[] {
  if (!blocks || blocks.length === 0) return []

  const timeline: TimelineItem[] = []

  for (const block of blocks) {
    if (block.type === 'text' && block.textType !== 'reasoning') {
      const content = block.content.trim()
      if (content) {
        timeline.push({ type: 'commentary', content })
      }
    } else if (
      block.type === 'tool' &&
      ALL_EDIT_TOOL_NAMES.includes(
        block.toolName as (typeof ALL_EDIT_TOOL_NAMES)[number],
      )
    ) {
      if (isFailedEditToolBlock(block)) continue

      const filePath = extractFilePath(block)
      const diff = extractDiff(block)
      const isCreate = isCreateFile(block)

      timeline.push({
        type: 'edit',
        content: filePath || 'unknown file',
        diff: diff || undefined,
        isCreate,
      })
    }
  }

  return timeline
}

export function truncateWithEllipsis(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text
  if (maxWidth <= 3) return text.slice(0, maxWidth)
  return text.slice(0, maxWidth - 3) + '...'
}

export interface MultiPromptProgress {
  total: number
  completed: number
  failed: number
  isSelecting: boolean
  isSelectorComplete: boolean
}

export function getMultiPromptProgress(
  blocks: ContentBlock[] | undefined,
): MultiPromptProgress | null {
  if (!blocks || blocks.length === 0) return null

  const implementors = blocks.filter(
    (block): block is AgentContentBlock =>
      block.type === 'agent' && isImplementorAgent(block),
  )

  if (implementors.length === 0) return null

  const completed = implementors.filter((a) => a.status === 'complete').length
  const failed = implementors.filter(
    (a) => a.status === 'failed' || a.status === 'cancelled',
  ).length

  const selectorAgent = blocks.find(
    (block): block is AgentContentBlock =>
      block.type === 'agent' && block.agentType.includes('best-of-n-selector'),
  )
  const isSelecting = selectorAgent?.status === 'running'

  return {
    total: implementors.length,
    completed,
    failed,
    isSelecting,
    isSelectorComplete: selectorAgent?.status === 'complete',
  }
}

interface MultiPromptSetOutputData {
  implementationId?: string
  chosenStrategy?: string
  reason?: string
  suggestedImprovements?: string
  toolResults?: unknown[]
  error?: string
}

interface SetOutputInput {
  data?: MultiPromptSetOutputData
}

function hasSetOutputData(input: unknown): input is SetOutputInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'data' in input &&
    typeof (input as SetOutputInput).data === 'object'
  )
}

function extractSelectionReason(
  blocks: ContentBlock[] | undefined,
): string | null {
  if (!blocks || blocks.length === 0) return null

  const setOutputBlock = blocks.find(
    (block): block is ToolContentBlock =>
      block.type === 'tool' &&
      block.toolName === 'set_output' &&
      hasSetOutputData(block.input) &&
      typeof block.input.data?.reason === 'string',
  )

  if (!setOutputBlock || !hasSetOutputData(setOutputBlock.input)) {
    return null
  }

  return setOutputBlock.input.data?.reason ?? null
}

export function getMultiPromptPreview(
  blocks: ContentBlock[] | undefined,
  isAgentComplete?: boolean,
): string | null {
  const progress = getMultiPromptProgress(blocks)
  if (!progress) return null

  const { total, completed, failed, isSelecting, isSelectorComplete } = progress
  const finished = completed + failed

  if (isAgentComplete) {
    const reason = extractSelectionReason(blocks)
    if (reason) {
      const formattedReason = reason.charAt(0).toUpperCase() + reason.slice(1)
      const lines = formattedReason.split('\n')
      const truncatedReason =
        lines.length > 2
          ? lines.slice(0, 2).join('\n').trimEnd() + '...'
          : formattedReason
      return `${total} proposals evaluated\n${truncatedReason}`
    }
    return `${total} proposals evaluated`
  }

  if (isSelectorComplete) {
    return 'Applying selected changes...'
  }

  if (isSelecting) {
    return `${total} proposals complete • Selecting best...`
  }

  if (finished === total && total > 0) {
    if (failed > 0) {
      return `${completed}/${total} proposals complete (${failed} failed)`
    }
    return `${total} proposals complete`
  }

  if (finished > 0) {
    if (failed > 0) {
      return `${completed}/${total} complete, ${failed} failed...`
    }
    return `${completed}/${total} proposals complete...`
  }

  return `Generating ${total} proposals...`
}
