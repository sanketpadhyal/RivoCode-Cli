import {
  FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL,
  hasFreebuffRootSystemPromptOpening,
} from '@rivocode/common/constants/free-agents'
import { SUPPORTED_FREEBUFF_MODELS } from '@rivocode/common/constants/freebuff-models'
import { describe, test, expect } from 'bun:test'

import base3, { createBase3, createBase3CliRoot } from '../base3'
import base3Evals from '../base3-evals'
import base3FreeDeepseek from '../base3-free-deepseek'
import base3FreeDeepseekFlash from '../base3-free-deepseek-flash'
import base3FreeDeepseekFlashEvals from '../base3-free-deepseek-flash-evals'
import base3FreeFable from '../base3-free-fable'
import base3FreeGlm from '../base3-free-glm'
import base3FreeGlmV53Flash from '../base3-free-glm-5-3-flash'
import base3FreeLuna from '../base3-free-luna'
import base3FreeMimo from '../base3-free-mimo'
import base3FreeMinimaxM3 from '../base3-free-minimax-m3'
import base3FreeOxAlpha from '../base3-free-ox-alpha'
import base3FreeSolarPro4 from '../base3-free-solar-pro4'
import base3Lite from '../base3-lite'

const CLI_ROOTS = [
  base3,
  base3Lite,
  base3Evals,
  base3FreeDeepseekFlashEvals,
  base3FreeDeepseek,
  base3FreeDeepseekFlash,
  base3FreeMinimaxM3,
  base3FreeMimo,
  base3FreeGlm,
  base3FreeGlmV53Flash,
  base3FreeLuna,
  base3FreeFable,
  base3FreeOxAlpha,
  base3FreeSolarPro4,
]

describe('base3 CLI roots', () => {
  test('keeps the efficiency flags the runtime reads', () => {
    expect(CLI_ROOTS.length).toBe(14)
    for (const agent of CLI_ROOTS) {
      expect(agent.windowedFileReads).toBe(true)
      expect(agent.compactContext).toBe(true)
      expect(agent.spawnableAgents ?? []).toEqual([])
      expect(agent.toolNames ?? []).not.toContain('spawn_agents')
      expect(agent.instructionsPrompt).toBeUndefined()
    }
  })

  test('declares no reasoning, leaving the catalog the single authority', () => {
    for (const agent of CLI_ROOTS) {
      expect(agent.reasoningOptions).toBeUndefined()
    }
  })

  test('opens with a prompt the free-mode gate accepts', () => {
    for (const agent of CLI_ROOTS) {
      expect(hasFreebuffRootSystemPromptOpening(agent.systemPrompt!)).toBe(true)
      expect(
        agent.systemPrompt!.match(/\{CODEBUFF_GIT_CHANGES_PROMPT\}/g),
      ).toHaveLength(1)
    }
  })

  test('every Freebuff root is pinned to the model its id is registered under', () => {
    const byId = new Map(CLI_ROOTS.map((a) => [a.id, a]))
    for (const [model, agentId] of Object.entries(
      FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL,
    )) {
      expect(byId.get(agentId)?.model).toBe(model)
    }
  })

  test('ships a root for every model the picker offers', () => {
    for (const model of SUPPORTED_FREEBUFF_MODELS) {
      const agentId = FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL[model.id]
      expect(agentId).toBeDefined()
      expect(CLI_ROOTS.some((a) => a.id === agentId)).toBe(true)
    }
  })

  test('leaves the bare harness alone, so Desktop does not inherit CLI tools', () => {
    expect(createBase3().toolNames).toEqual([
      'read_files',
      'str_replace',
      'write_file',
      'run_terminal_command',
      'code_search',
      'glob',
      'list_directory',
      'write_todos',
    ])
  })

  test('noAskUser drops the human tools from the prompt as well as the toolset', () => {
    const withUser = createBase3CliRoot()
    const withoutUser = createBase3CliRoot({ noAskUser: true })

    expect(withUser.toolNames).toContain('ask_user')
    expect(withUser.toolNames).toContain('suggest_followups')
    expect(withUser.systemPrompt).toContain('ask_user')

    expect(withoutUser.toolNames).not.toContain('ask_user')
    expect(withoutUser.toolNames).not.toContain('suggest_followups')
    expect(withoutUser.systemPrompt).not.toContain('ask_user')
    expect(withoutUser.systemPrompt).not.toContain('suggest_followups')

    expect(withoutUser.toolNames).toEqual(
      withUser.toolNames!.filter(
        (name) => name !== 'ask_user' && name !== 'suggest_followups',
      ),
    )
  })

  test('brands Freebuff roots as Freebuff, and Codebuff roots as Codebuff', () => {
    expect(base3FreeDeepseek.systemPrompt).toContain('Freebuff')
    expect(base3FreeDeepseek.systemPrompt).not.toContain('/usage')
    expect(base3.systemPrompt).toContain('/usage')
  })
})
