import { getInitialSessionState } from '@rivocode/common/types/session-state'
import { getStubProjectFileContext } from '@rivocode/common/util/file'
import { describe, expect, it } from 'bun:test'

import { cloneSessionState } from '../run'

import type { SessionState } from '@rivocode/common/types/session-state'

function makeSession(): SessionState {
  const state = getInitialSessionState(getStubProjectFileContext())
  state.mainAgentState.messageHistory = [
    { role: 'user', content: [{ type: 'text', text: 'hello' }] } as any,
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'world' }],
    } as any,
  ]
  return state
}

describe('cloneSessionState', () => {
  it('returns a structurally-equal copy', () => {
    const source = makeSession()
    const clone = cloneSessionState(source)
    expect(clone).toEqual(source)
  })

  it('is a deep copy: mutating the clone does not affect the source', () => {
    const source = makeSession()
    const clone = cloneSessionState(source)

    clone.mainAgentState.messageHistory.push({
      role: 'user',
      content: [{ type: 'text', text: 'interrupted' }],
    } as any)
    ;(clone.mainAgentState.messageHistory[0] as any).content[0].text = 'changed'

    expect(source.mainAgentState.messageHistory).toHaveLength(2)
    expect(
      (source.mainAgentState.messageHistory[0] as any).content[0].text,
    ).toBe('hello')
  })

  it('deep-copies mainAgentState but shares fileContext by reference', () => {
    const source = makeSession()
    const clone = cloneSessionState(source)

    expect(clone.mainAgentState).not.toBe(source.mainAgentState)
    expect(clone.mainAgentState.messageHistory).not.toBe(
      source.mainAgentState.messageHistory,
    )
    expect(clone.fileContext).toBe(source.fileContext)
  })

  it('shares fileContext even when it holds a non-JSON-cloneable value', () => {
    const source = makeSession()
    ;(source.fileContext as any).customToolDefinitions = {
      mcpTool: { inputSchema: { parse: () => ({}), _def: {} } },
    }

    const clone = cloneSessionState(source)

    expect(clone.mainAgentState).not.toBe(source.mainAgentState)
    expect(clone.fileContext).toBe(source.fileContext)
    expect((clone.fileContext as any).customToolDefinitions.mcpTool).toBe(
      (source.fileContext as any).customToolDefinitions.mcpTool,
    )
  })

  it('clones message content with URL / Buffer instances without throwing', () => {
    const source = makeSession()
    source.mainAgentState.messageHistory.push({
      role: 'user',
      content: [
        { type: 'image', image: new URL('https://example.com/a.png') },
        { type: 'file', data: Buffer.from('hello'), mediaType: 'text/plain' },
      ],
    } as any)

    const clone = cloneSessionState(source)

    expect(clone.mainAgentState).not.toBe(source.mainAgentState)
    expect(JSON.stringify(clone.mainAgentState)).toBe(
      JSON.stringify(source.mainAgentState),
    )
  })

  it('falls back to a deep copy when JSON.stringify throws (circular ref)', () => {
    const source = makeSession()
    const circular: any = { self: null }
    circular.self = circular
    ;(source.mainAgentState as any).output = circular

    const clone = cloneSessionState(source)

    expect(clone.mainAgentState).not.toBe(source.mainAgentState)
    expect(clone.mainAgentState.messageHistory).not.toBe(
      source.mainAgentState.messageHistory,
    )
    clone.mainAgentState.messageHistory.push({
      role: 'user',
      content: [{ type: 'text', text: 'x' }],
    } as any)
    expect(source.mainAgentState.messageHistory).toHaveLength(2)
  })
})
