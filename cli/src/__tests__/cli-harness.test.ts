import { describe, expect, test } from 'bun:test'
import { FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@codebuff/common/constants/freebuff-models'

import {
  AGENT_MODE_TO_ID,
  AGENT_MODES,
  CLI_HARNESS,
  IS_FREEBUFF,
} from '../utils/constants'
import { getFreebuffCliAgentIdForModel } from '../utils/freebuff-agent-selection'

describe('CLI harness routing', () => {
  test('DEFAULT, LITE, and Freebuff turns run base3', () => {
    expect(CLI_HARNESS).toBe('base3')
    expect(AGENT_MODE_TO_ID.DEFAULT).toBe('base3')
    expect(AGENT_MODE_TO_ID.LITE).toBe(
      IS_FREEBUFF ? 'base2-free' : 'base3-lite',
    )
    expect(
      getFreebuffCliAgentIdForModel(FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
    ).toBe('base3-free-deepseek-flash')
  })

  test('MAX and PLAN never followed the harness switch', () => {
    expect(AGENT_MODE_TO_ID.MAX).toBe('base2-max')
    expect(AGENT_MODE_TO_ID.PLAN).toBe('base2-plan')
  })

  test('every mode still resolves to an agent id', () => {
    expect(AGENT_MODES).toEqual(['DEFAULT', 'LITE', 'MAX', 'PLAN'])
    for (const mode of AGENT_MODES) {
      expect(AGENT_MODE_TO_ID[mode]).toBeTruthy()
    }
  })
})
