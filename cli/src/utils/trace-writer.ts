import { appendFileSync, mkdirSync } from 'fs'
import path, { dirname } from 'path'

import { IS_DEV } from '@rivocode/common/env'

import { getCliEnv } from './env'
import { getCurrentChatDir, getProjectRoot } from '../project-files'

import type { TraceWriter } from '@rivocode/common/types/contracts/trace'
import type { Message } from '@rivocode/common/types/messages/codebuff-message'

const TRACE_FILENAME = 'trace.jsonl'

type AgentTraceState = {
  writtenRoles: string[]
  system: string | undefined
}

export function isTraceEnabled(): boolean {
  if (IS_DEV) return true
  const flag = getCliEnv().CODEBUFF_TRACE
  return flag === '1' || flag === 'true' || flag === 'yes'
}

function getTraceFilePath(): string | null {
  try {
    return IS_DEV
      ? path.join(getProjectRoot(), 'debug', TRACE_FILENAME)
      : path.join(getCurrentChatDir(), TRACE_FILENAME)
  } catch {
    return null
  }
}

export function createTraceWriter(
  resolveTraceFilePath: () => string | null = getTraceFilePath,
): TraceWriter | undefined {
  if (!isTraceEnabled()) {
    return undefined
  }

  const agentStates = new Map<string, AgentTraceState>()
  let ensuredDir: string | undefined

  return {
    recordStep: ({
      agentId,
      agentType,
      runId,
      userInputId,
      step,
      system,
      messages,
    }) => {
      const state = agentStates.get(agentId) ?? {
        writtenRoles: [],
        system: undefined,
      }
      const base = { agentId, agentType, runId, userInputId, step }
      const timestamp = new Date().toISOString()
      const lines: string[] = []
      const appendLine = (record: Record<string, unknown>): void => {
        lines.push(JSON.stringify({ timestamp, ...record }))
      }

      const rewritten =
        messages.length < state.writtenRoles.length ||
        state.writtenRoles.some((role, i) => messages[i]?.role !== role)
      if (rewritten) {
        appendLine({
          ...base,
          type: 'history_rewritten',
          previousMessageCount: state.writtenRoles.length,
          messageCount: messages.length,
        })
        state.writtenRoles = []
      }

      if (system !== undefined && system !== state.system) {
        appendLine({ ...base, type: 'system', system })
        state.system = system
      }

      for (let i = state.writtenRoles.length; i < messages.length; i++) {
        const message = messages[i] as Message
        appendLine({
          ...base,
          type: 'message',
          index: i,
          message,
        })
      }

      state.writtenRoles = messages.map((m) => m.role)
      agentStates.set(agentId, state)

      if (lines.length === 0) return
      const filePath = resolveTraceFilePath()
      if (!filePath) return
      try {
        const dir = dirname(filePath)
        if (ensuredDir !== dir) {
          mkdirSync(dir, { recursive: true })
          ensuredDir = dir
        }
        appendFileSync(filePath, lines.join('\n') + '\n')
      } catch {
      }
    },
  }
}
