import { describe, expect, test, beforeEach, afterAll } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
  getFreebuffModelDefaultEffort,
  getFreebuffModelEfforts,
} from '@rivocode/common/constants/freebuff-models'

import type { ReasoningEffort } from '@rivocode/common/constants/reasoning-effort'

const realHome = process.env.HOME
const tempHome = mkdtempSync(join(tmpdir(), 'freebuff-reasoning-'))
process.env.HOME = tempHome
afterAll(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  rmSync(tempHome, { recursive: true, force: true })
})

const { handleReasoningCommand } = await import('../../commands/reasoning')
const {
  getFreebuffReasoningEffortForModel,
  getEffectiveFreebuffReasoningEffort,
  getSelectedFreebuffReasoningEffort,
  useFreebuffModelStore,
} = await import('../../state/freebuff-model-store')
const { loadFreebuffReasoningEfforts } = await import('../../utils/settings')

const LADDERED = FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID
const NO_LADDER = FREEBUFF_MIMO_V25_MODEL_ID

describe('/reasoning', () => {
  beforeEach(() => {
    useFreebuffModelStore.setState({
      selectedModel: LADDERED,
      reasoningEffortByModel: {},
    })
    useFreebuffModelStore.getState().setReasoningEffort(LADDERED, undefined)
    useFreebuffModelStore.getState().setReasoningEffort(NO_LADDER, undefined)
  })

  test('the catalog still gives the model under test a ladder', () => {
    expect(getFreebuffModelEfforts(LADDERED)).toBeTruthy()
    expect(getFreebuffModelEfforts(NO_LADDER)).toBeNull()
  })

  test('with no argument it reports the model default and does not set one', () => {
    const { message } = handleReasoningCommand('')
    expect(message).toContain(getFreebuffModelDefaultEffort(LADDERED)!)
    expect(message).toContain('model default')
    expect(getSelectedFreebuffReasoningEffort()).toBeNull()
  })

  test('a valid rung is set, sent, and survives a reload', () => {
    handleReasoningCommand('max')
    expect(getSelectedFreebuffReasoningEffort()).toBe('max')
    expect(loadFreebuffReasoningEfforts()[LADDERED]).toBe('max')
  })

  test('an invalid rung changes nothing and names the ladder', () => {
    handleReasoningCommand('max')
    const { message } = handleReasoningCommand('gigantic')
    expect(getSelectedFreebuffReasoningEffort()).toBe('max')
    expect(message).toContain('low')
  })

  test('a rung the model does not offer is refused even though it is a real effort', () => {
    expect(getFreebuffModelEfforts(LADDERED)).not.toContain('xhigh')
    handleReasoningCommand('xhigh')
    expect(getSelectedFreebuffReasoningEffort()).toBeNull()
  })

  test('default/reset clears the override rather than storing the default', () => {
    handleReasoningCommand('low')
    handleReasoningCommand('default')
    expect(loadFreebuffReasoningEfforts()[LADDERED]).toBeUndefined()
    expect(getSelectedFreebuffReasoningEffort()).toBeNull()
    expect(getEffectiveFreebuffReasoningEffort(LADDERED)).toBe(
      getFreebuffModelDefaultEffort(LADDERED),
    )
  })

  test('a model with no ladder is told so and nothing is stored', () => {
    useFreebuffModelStore.setState({ selectedModel: NO_LADDER })
    const { message } = handleReasoningCommand('high')
    expect(message).toContain('no reasoning levels')
    expect(loadFreebuffReasoningEfforts()[NO_LADDER]).toBeUndefined()
  })

  test('overrides are per model, so switching model does not carry a rung across', () => {
    handleReasoningCommand('max')
    useFreebuffModelStore.setState({ selectedModel: NO_LADDER })
    expect(getSelectedFreebuffReasoningEffort()).toBeNull()
    useFreebuffModelStore.setState({ selectedModel: LADDERED })
    expect(getSelectedFreebuffReasoningEffort()).toBe('max')
  })

  test('a stored rung the model no longer offers is ignored, not clamped', () => {
    useFreebuffModelStore.setState({
      reasoningEffortByModel: { [LADDERED]: 'xhigh' as ReasoningEffort },
    })
    expect(getFreebuffReasoningEffortForModel(LADDERED)).toBeNull()
  })
})

describe('the CLI turn carries the chosen effort', () => {
  const source = readFileSync(
    join(import.meta.dir, '..', '..', 'hooks', 'use-send-message.ts'),
    'utf8',
  )

  test('it reaches extraCodebuffMetadata under the name the server reads', () => {
    const metadata = source.slice(source.indexOf('extraCodebuffMetadata:'))
    expect(metadata).toContain('freebuff_reasoning_effort')
    expect(metadata).toContain('freebuffReasoningEffort')
  })
})
