import { buildArray } from '@rivocode/common/util/array'

import {
  getGitChangesPrompt,
  getProjectFileTreePrompt,
  getSystemInfoPrompt,
} from './prompts'
import { countTokens, countTokensJson } from '../util/token-counter'

import type { Logger } from '@rivocode/common/types/contracts/logger'
import type { ProjectFileContext } from '@rivocode/common/util/file'

export function getSearchSystemPrompt(params: {
  fileContext: ProjectFileContext
  messagesTokens: number
  logger: Logger
  options: {
    agentStepId: string
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    userId: string | undefined
  }
}): string {
  const { fileContext, messagesTokens, logger, options: _options } = params
  const _startTime = Date.now()

  const maxTokens = 500_000
  const maxFilesTokens = 100_000
  const miscTokens = 10_000
  const systemPromptTokenBudget = maxTokens - messagesTokens - miscTokens

  const gitChangesPrompt = getGitChangesPrompt(fileContext)
  const fileTreeTokenBudget =
    Math.floor(
      (systemPromptTokenBudget -
        maxFilesTokens -
        countTokens(gitChangesPrompt)) /
        20_000,
    ) * 20_000

  const projectFileTreePrompt = getProjectFileTreePrompt({
    fileContext,
    fileTreeTokenBudget,
    mode: 'search',
    logger,
  })

  const _t = Date.now()
  const truncationBudgets = [5_000, 20_000, 40_000, 100_000, 500_000]
  const _truncatedTrees = truncationBudgets.reduce(
    (acc, budget) => {
      acc[budget] = getProjectFileTreePrompt({
        fileContext,
        fileTreeTokenBudget: budget,
        mode: 'search',
        logger,
      })
      return acc
    },
    {} as Record<number, string>,
  )
  const _fileTreeTokens = countTokensJson(projectFileTreePrompt)

  const systemInfoPrompt = getSystemInfoPrompt(fileContext)
  const _systemInfoTokens = countTokens(systemInfoPrompt)

  const systemPrompt = buildArray([
    projectFileTreePrompt,
    systemInfoPrompt,
    gitChangesPrompt,
  ]).join('\n\n')

  return systemPrompt
}
