import { describe, test, expect } from 'bun:test'

import { holdsLiveFreebuffSlot } from '../../utils/freebuff-session-api'

import type { FreebuffSessionResponse } from '../../types/freebuff-session'

const activeSession: FreebuffSessionResponse = {
  status: 'active',
  accessTier: 'full',
  instanceId: 'inst-1',
  model: 'deepseek/deepseek-v4',
  admittedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  remainingMs: 60_000,
}

describe('holdsLiveFreebuffSlot', () => {
  test('active session holds a slot', () => {
    expect(holdsLiveFreebuffSlot(activeSession)).toBe(true)
  })

  test('ended WITH instance id (grace window) still holds a slot', () => {
    expect(
      holdsLiveFreebuffSlot({ status: 'ended', instanceId: 'inst-1' }),
    ).toBe(true)
  })

  test('ended WITHOUT instance id (post-grace) does not hold a slot', () => {
    expect(holdsLiveFreebuffSlot({ status: 'ended' })).toBe(false)
  })

  test('null session does not hold a slot', () => {
    expect(holdsLiveFreebuffSlot(null)).toBe(false)
  })

  test('pre-join and terminal states do not hold a slot', () => {
    expect(holdsLiveFreebuffSlot({ status: 'none' })).toBe(false)
    expect(holdsLiveFreebuffSlot({ status: 'superseded' })).toBe(false)
    expect(
      holdsLiveFreebuffSlot({ status: 'takeover_prompt', model: 'm' }),
    ).toBe(false)
  })
})
