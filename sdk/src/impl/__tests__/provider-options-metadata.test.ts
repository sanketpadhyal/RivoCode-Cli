import { describe, expect, it } from 'bun:test'

import { getProviderOptions } from '../llm'

describe('getProviderOptions — codebuff_metadata', () => {
  const baseParams = {
    model: 'openrouter/anthropic/claude-sonnet-4-5',
    runId: 'run-1',
    clientSessionId: 'session-1',
  }

  it('includes run_id and client_id in codebuff_metadata', () => {
    const opts = getProviderOptions(baseParams)
    const meta = (opts.codebuff as any).codebuff_metadata
    expect(meta).toMatchObject({
      run_id: 'run-1',
      client_id: 'session-1',
    })
  })

  it('merges extraCodebuffMetadata into codebuff_metadata', () => {
    const opts = getProviderOptions({
      ...baseParams,
      extraCodebuffMetadata: { custom_instance_id: 'abc-123' },
    })
    const meta = (opts.codebuff as any).codebuff_metadata
    expect(meta).toMatchObject({
      run_id: 'run-1',
      client_id: 'session-1',
      custom_instance_id: 'abc-123',
    })
  })

  it('omits extra keys when extraCodebuffMetadata is undefined', () => {
    const opts = getProviderOptions(baseParams)
    const meta = (opts.codebuff as any).codebuff_metadata
    expect(Object.keys(meta)).toEqual(
      expect.arrayContaining(['run_id', 'client_id']),
    )
    expect(meta.custom_instance_id).toBeUndefined()
  })

  it('cost_mode passes through alongside extra metadata', () => {
    const opts = getProviderOptions({
      ...baseParams,
      costMode: 'free',
      extraCodebuffMetadata: { custom_instance_id: 'uuid-xyz' },
    })
    const meta = (opts.codebuff as any).codebuff_metadata
    expect(meta).toMatchObject({
      cost_mode: 'free',
      custom_instance_id: 'uuid-xyz',
    })
  })

  it('extraCodebuffMetadata does not overwrite reserved keys', () => {
    const opts = getProviderOptions({
      ...baseParams,
      costMode: 'free',
      extraCodebuffMetadata: {
        run_id: 'evil-override',
      },
    })
    const meta = (opts.codebuff as any).codebuff_metadata
    expect(meta.run_id).toBe('run-1')
  })
})
