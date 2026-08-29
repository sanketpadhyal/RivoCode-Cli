import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

mock.module('@rivocode/common/env', () => ({
  IS_DEV: true,
}))

import { createTraceWriter } from '../trace-writer'
import { setProjectRoot, tryGetProjectRoot } from '../../project-files'

import type { Message } from '@rivocode/common/types/messages/codebuff-message'

let tempDir = ''

function tracePathFor(dir: string): string {
  return path.join(dir, 'debug', 'trace.jsonl')
}

function readTraceLines(): any[] {
  const tracePath = tracePathFor(tempDir)
  if (!fs.existsSync(tracePath)) return []
  return fs
    .readFileSync(tracePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

const userMessage = (text: string): Message => ({
  role: 'user',
  content: [{ type: 'text', text }],
})
const assistantMessage = (text: string): Message => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
})

const baseParams = {
  agentId: 'agent-1',
  agentType: 'base',
  runId: 'run-1',
  userInputId: 'input-1',
  system: undefined,
}

describe('createTraceWriter', () => {
  let originalProjectRoot: string | undefined

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebuff-trace-'))
    originalProjectRoot = tryGetProjectRoot()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    if (originalProjectRoot !== undefined) {
      setProjectRoot(originalProjectRoot)
    }
  })

  test('falls back to the real project-root-based path when no resolver is injected', () => {
    setProjectRoot(tempDir)
    const writer = createTraceWriter()!

    writer.recordStep({
      ...baseParams,
      step: 1,
      messages: [userMessage('hello')],
    })

    const lines = readTraceLines()
    expect(lines).toHaveLength(1)
    expect(lines[0].message.role).toBe('user')
  })

  test('writes each message exactly once across steps', () => {
    const writer = createTraceWriter(() => tracePathFor(tempDir))!
    const history = [userMessage('hello')]

    writer.recordStep({ ...baseParams, step: 1, messages: history })
    history.push(assistantMessage('hi there'))
    writer.recordStep({ ...baseParams, step: 1, messages: history })
    writer.recordStep({ ...baseParams, step: 2, messages: history })

    const lines = readTraceLines()
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.message.role)).toEqual(['user', 'assistant'])
    expect(lines.map((l) => l.index)).toEqual([0, 1])
  })

  test('records system prompt once and again only when it changes', () => {
    const writer = createTraceWriter(() => tracePathFor(tempDir))!

    writer.recordStep({
      ...baseParams,
      step: 1,
      system: 'be helpful',
      messages: [userMessage('hello')],
    })
    writer.recordStep({
      ...baseParams,
      step: 2,
      system: 'be helpful',
      messages: [userMessage('hello'), assistantMessage('hi')],
    })
    writer.recordStep({
      ...baseParams,
      step: 3,
      system: 'be terse',
      messages: [
        userMessage('hello'),
        assistantMessage('hi'),
        userMessage('more'),
      ],
    })

    const systemLines = readTraceLines().filter((l) => l.type === 'system')
    expect(systemLines.map((l) => l.system)).toEqual([
      'be helpful',
      'be terse',
    ])
  })

  test('detects history rewrites and re-dumps the new history', () => {
    const writer = createTraceWriter(() => tracePathFor(tempDir))!

    writer.recordStep({
      ...baseParams,
      step: 1,
      messages: [
        userMessage('a'),
        assistantMessage('b'),
        userMessage('c'),
      ],
    })
    writer.recordStep({
      ...baseParams,
      step: 2,
      messages: [userMessage('summary of earlier conversation')],
    })

    const lines = readTraceLines()
    const marker = lines.find((l) => l.type === 'history_rewritten')
    expect(marker).toBeDefined()
    expect(marker.previousMessageCount).toBe(3)
    expect(marker.messageCount).toBe(1)
    expect(lines.filter((l) => l.type === 'message')).toHaveLength(4)
  })

  test('tracks agents independently', () => {
    const writer = createTraceWriter(() => tracePathFor(tempDir))!

    writer.recordStep({
      ...baseParams,
      step: 1,
      messages: [userMessage('main')],
    })
    writer.recordStep({
      ...baseParams,
      agentId: 'agent-2',
      agentType: 'researcher',
      step: 1,
      messages: [userMessage('sub')],
    })

    const lines = readTraceLines()
    expect(lines.filter((l) => l.type === 'history_rewritten')).toHaveLength(0)
    expect(lines.map((l) => l.agentId)).toEqual(['agent-1', 'agent-2'])
  })

  test('writes base64 image data in full', () => {
    const base64 = 'a'.repeat(10_000)
    const writer = createTraceWriter(() => tracePathFor(tempDir))!

    writer.recordStep({
      ...baseParams,
      step: 1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'look at this' },
            { type: 'image', image: base64, mediaType: 'image/png' },
          ],
        } as Message,
      ],
    })

    const lines = readTraceLines()
    expect(lines).toHaveLength(1)
    expect(lines[0].message.content[1].image).toBe(base64)
  })
})
