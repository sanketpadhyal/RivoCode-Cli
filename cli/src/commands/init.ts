import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { AnalyticsEvent } from '@rivocode/common/constants/analytics-events'
import { KNOWLEDGE_FILE_NAMES } from '@rivocode/common/constants/knowledge'

import { getProjectRoot } from '../project-files'
import { trackEvent } from '../utils/analytics'
import { getSystemMessage } from '../utils/message-history'

import type { PostUserMessageFn } from '../types/contracts/send-message'

const brandName = 'RivoCode'

const INITIAL_KNOWLEDGE_FILE = `# Project knowledge

This file gives ${brandName} context about your project: goals, commands, conventions, and gotchas.

## Quickstart
- Setup:
- Dev:
- Test:

## Architecture
- Key directories:
- Data flow:

## Conventions
- Formatting/linting:
- Patterns to follow:
- Things to avoid:
`

function loadTemplateSource(fileName: string): string {
  try {
    const templatePath = fileURLToPath(
      new URL(`../../../common/src/templates/initial-agents-dir/types/${fileName}`, import.meta.url),
    )
    if (existsSync(templatePath)) {
      return readFileSync(templatePath, 'utf8')
    }
  } catch {}
  return ''
}

const COMMON_TYPE_FILES = [
  {
    fileName: 'agent-definition.ts',
    get source() {
      return loadTemplateSource('agent-definition.ts')
    },
  },
  {
    fileName: 'tools.ts',
    get source() {
      return loadTemplateSource('tools.ts')
    },
  },
  {
    fileName: 'util-types.ts',
    get source() {
      return loadTemplateSource('util-types.ts')
    },
  },
]

export function handleInitializationFlowLocally(): {
  postUserMessage: PostUserMessageFn
} {
  const projectRoot = getProjectRoot()
  const knowledgePath = path.join(projectRoot, KNOWLEDGE_FILE_NAMES[0])
  const messages: string[] = []

  if (existsSync(knowledgePath)) {
    messages.push(`📋 \`${KNOWLEDGE_FILE_NAMES[0]}\` already exists.`)
  } else {
    writeFileSync(knowledgePath, INITIAL_KNOWLEDGE_FILE)
    messages.push(`✅ Created \`${KNOWLEDGE_FILE_NAMES[0]}\``)

    trackEvent(AnalyticsEvent.KNOWLEDGE_FILE_UPDATED, {
      action: 'created',
      fileName: KNOWLEDGE_FILE_NAMES[0],
      fileSizeBytes: Buffer.byteLength(INITIAL_KNOWLEDGE_FILE, 'utf8'),
    })
  }

  const agentsDir = path.join(projectRoot, '.agents')
  const agentsTypesDir = path.join(agentsDir, 'types')

  if (existsSync(agentsDir)) {
    messages.push('📋 `.agents/` already exists.')
  } else {
    mkdirSync(agentsDir, { recursive: true })
    messages.push('✅ Created `.agents/`')
  }

  if (existsSync(agentsTypesDir)) {
    messages.push('📋 `.agents/types/` already exists.')
  } else {
    mkdirSync(agentsTypesDir, { recursive: true })
    messages.push('✅ Created `.agents/types/`')
  }

  for (const { fileName, source } of COMMON_TYPE_FILES) {
    const targetPath = path.join(agentsTypesDir, fileName)
    if (existsSync(targetPath)) {
      messages.push(`📋 \`.agents/types/${fileName}\` already exists.`)
      continue
    }

    try {
      if (!source || source.trim().length === 0) {
        throw new Error('Source content is empty')
      }
      writeFileSync(targetPath, source)
      messages.push(`✅ Copied \`.agents/types/${fileName}\``)
    } catch (error) {
      messages.push(
        `⚠️ Failed to copy \`.agents/types/${fileName}\`: ${
          error instanceof Error ? error.message : String(error ?? 'Unknown')
        }`,
      )
    }
  }

  const postUserMessage: PostUserMessageFn = (prev) => [
    ...prev,
    ...messages.map((message) => getSystemMessage(message)),
  ]
  return { postUserMessage }
}
