import {
  FREEBUFF_DEFAULT_CONTEXT_WINDOW,
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_MODEL_CONTEXT_WINDOWS,
} from '@codebuff/common/constants/freebuff-models'
import { describe, test, expect } from 'bun:test'

import baseChat from '../base-chat'
import contextPruner from '../context-pruner'

import type { AgentState } from '../types/agent-definition'

function createMockAgentState(contextTokenCount: number): AgentState {
  return {
    agentId: 'test-agent',
    runId: 'test-run',
    parentId: undefined,
    messageHistory: [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
    ],
    output: undefined,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount,
  }
}

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function firstPrunerSpawn(model?: string) {
  const handleStepsString = baseChat.handleSteps!.toString()
  const isolatedFunction = new Function(`return (${handleStepsString})`)()
  const generator = isolatedFunction({
    agentState: createMockAgentState(100),
    logger: mockLogger,
    model,
  })
  return generator.next().value as {
    toolName: string
    input: { agent_type: string; params: { maxContextLength: number } }
    includeToolCall?: boolean
  }
}

function budgetFor(model?: string): number {
  return firstPrunerSpawn(model).input.params.maxContextLength
}

describe('base-chat context pruning', () => {
  test('defaults to the direct DeepSeek Flash model', () => {
    expect(baseChat.model).toBe(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
  })

  test('spawns context-pruner before the first step', () => {
    const spawn = firstPrunerSpawn('minimax/minimax-m3')

    expect(spawn.toolName).toBe('spawn_agent_inline')
    expect(spawn.input.agent_type).toBe('context-pruner')
    expect(spawn.includeToolCall).toBe(false)
  })

  test('declares context-pruner spawnable', () => {
    expect(baseChat.spawnableAgents).toContain('context-pruner')
  })

  test('handleSteps survives serialization (no out-of-scope references)', () => {
    expect(() => firstPrunerSpawn('minimax/minimax-m3')).not.toThrow()
    expect(baseChat.handleSteps!.toString()).toMatch(/^function\*\s*\(/)
  })

  test('keeps stepping until the runtime reports the turn is complete', () => {
    const handleStepsString = baseChat.handleSteps!.toString()
    const isolatedFunction = new Function(`return (${handleStepsString})`)()
    const generator = isolatedFunction({
      agentState: createMockAgentState(100),
      logger: mockLogger,
      model: 'minimax/minimax-m3',
    })

    expect(generator.next().value.input.agent_type).toBe('context-pruner')
    expect(generator.next({ stepsComplete: false }).value).toBe('STEP')
    expect(
      generator.next({ stepsComplete: false }).value.input.agent_type,
    ).toBe('context-pruner')
    expect(generator.next({ stepsComplete: false }).value).toBe('STEP')
    expect(generator.next({ stepsComplete: true }).done).toBe(true)
  })
})

describe('base-chat per-model context budget', () => {
  test('budgets each model well below its real context window', () => {
    for (const [model, window] of Object.entries(
      FREEBUFF_MODEL_CONTEXT_WINDOWS,
    )) {
      const budget = budgetFor(model)
      expect(budget).toBeLessThan(window * 0.5)
      expect(budget).toBeGreaterThan(window * 0.25)
    }
  })

  test('scales the budget with the window: unmapped (128k) < m3 (512k) < flash (1M)', () => {
    const unmapped = budgetFor('some/model-we-have-never-shipped')
    const m3 = budgetFor('minimax/minimax-m3')
    const flash = budgetFor('deepseek/deepseek-v4-flash')

    expect(unmapped).toBeLessThan(m3)
    expect(m3).toBeLessThan(flash)
  })

  test('falls back to the conservative default for an unknown model', () => {
    const unknown = budgetFor('some/model-we-have-never-shipped')
    const smallestKnown = Math.min(
      ...Object.values(FREEBUFF_MODEL_CONTEXT_WINDOWS),
    )

    expect(unknown).toBeLessThan(smallestKnown)
    expect(unknown).toBeLessThan(FREEBUFF_DEFAULT_CONTEXT_WINDOW)
  })

  test('falls back to the conservative default when the runtime omits the model', () => {
    expect(budgetFor(undefined)).toBe(
      budgetFor('some/model-we-have-never-shipped'),
    )
  })

  test('inline window table matches the shared catalog', () => {
    const budgetFraction =
      budgetFor('minimax/minimax-m3') /
      FREEBUFF_MODEL_CONTEXT_WINDOWS['minimax/minimax-m3']

    for (const [model, window] of Object.entries(
      FREEBUFF_MODEL_CONTEXT_WINDOWS,
    )) {
      expect(budgetFor(model) / window).toBeCloseTo(budgetFraction, 4)
    }

    expect(
      budgetFor('some/model-we-have-never-shipped') /
        FREEBUFF_DEFAULT_CONTEXT_WINDOW,
    ).toBeCloseTo(budgetFraction, 4)
  })

  test('budgets Luna 400k, not the 52k it got while missing from the table', () => {
    expect(budgetFor('openai/gpt-5.6-luna')).toBe(400_000)
    expect(budgetFor('openai/gpt-5.6-luna')).toBeGreaterThan(
      budgetFor('some/model-we-have-never-shipped'),
    )
  })
})

describe('base-chat budget vs. the thread that actually wedged', () => {
  const WEDGED_CHARS = 1_008_984
  const WEDGED_PROVIDER_TOKENS = 524_569

  const ESTIMATOR_CHARS_PER_TOKEN = [1.95, 2.11, 2.2, 3.33]

  test('prunes that thread no matter where in the estimator range it lands', () => {
    const budget = budgetFor('minimax/minimax-m3')

    for (const charsPerToken of ESTIMATOR_CHARS_PER_TOKEN) {
      const estimated = WEDGED_CHARS / charsPerToken
      expect(estimated).toBeGreaterThan(budget)
    }
  })

  test('leaves room for the provider undercount the estimator cannot see', () => {
    const budget = budgetFor('minimax/minimax-m3')
    const window = FREEBUFF_MODEL_CONTEXT_WINDOWS['minimax/minimax-m3']

    expect(budget * 2).toBeLessThanOrEqual(window)
    expect(WEDGED_PROVIDER_TOKENS).toBeGreaterThan(window)
  })
})

describe('base-chat model switch mid-thread', () => {
  const M3 = 'minimax/minimax-m3'
  const SMALL = 'some/model-we-have-never-shipped'

  test('the budget follows the selected model, not the thread', () => {
    const m3Budget = budgetFor(M3)
    const smallBudget = budgetFor(SMALL)
    const smallWindow = FREEBUFF_DEFAULT_CONTEXT_WINDOW

    expect(m3Budget * 2).toBeGreaterThan(smallWindow)
    expect(smallBudget).toBeLessThan(m3Budget)
    expect(smallBudget).toBeLessThan(smallWindow)
  })

  test('the pruner prunes when context exceeds the switched-to budget', () => {
    const kimiBudget = budgetFor(SMALL)
    const overKimiUnderM3 = kimiBudget + 50_000

    expect(overKimiUnderM3).toBeLessThan(budgetFor(M3))

    const prunerSteps = contextPruner.handleSteps!.toString()
    const isolatedPruner = new Function(`return (${prunerSteps})`)()
    const generator = isolatedPruner({
      agentState: createMockAgentState(overKimiUnderM3),
      logger: mockLogger,
      params: { maxContextLength: kimiBudget },
    })

    const yields: any[] = []
    let result = generator.next()
    while (!result.done) {
      yields.push(result.value)
      result = generator.next()
    }

    expect(yields.some((y) => y?.toolName === 'set_messages')).toBe(true)
  })
})

describe('base-chat pruning triggers', () => {
  test('does not re-summarize an idle chat tab on a prompt-cache miss', () => {
    const spawn = firstPrunerSpawn('minimax/minimax-m3')
    expect(spawn.input.params).toHaveProperty('cacheExpiryMs')
    expect((spawn.input.params as any).cacheExpiryMs).toBeGreaterThanOrEqual(
      60 * 60 * 1000,
    )
  })
})
