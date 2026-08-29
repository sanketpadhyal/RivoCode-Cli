
import { EventEmitter } from 'events'

import { mock } from 'bun:test'

import type { Mock } from 'bun:test'
import type { ChildProcess } from 'child_process'

export interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  pid: number
  killed: boolean
  kill: Mock<(signal?: string) => boolean>
}

export function createMockChildProcess(): MockChildProcess {
  const mockProcess = new EventEmitter() as MockChildProcess
  mockProcess.stdout = new EventEmitter()
  mockProcess.stderr = new EventEmitter()
  mockProcess.pid = Math.floor(Math.random() * 10000)
  mockProcess.killed = false
  mockProcess.kill = mock((signal?: string) => {
    mockProcess.killed = true
    mockProcess.emit('close', signal === 'SIGKILL' ? 137 : 0)
    return true
  })
  return mockProcess
}

export interface CodeSearchResult {
  stdout?: string
  stderr?: string
  message?: string
  errorMessage?: string
}

export function asCodeSearchResult(result: unknown): CodeSearchResult {
  if (
    result &&
    typeof result === 'object' &&
    'type' in result &&
    result.type === 'json' &&
    'value' in result
  ) {
    return result.value as CodeSearchResult
  }
  return {}
}

export function createMockSpawn(
  mockProcess: MockChildProcess,
): Mock<(command: string, args: string[], options?: object) => ChildProcess> {
  return mock(() => mockProcess as unknown as ChildProcess)
}

export function createRgJsonMatch(
  filePath: string,
  lineNumber: number,
  lineText: string,
): string {
  return JSON.stringify({
    type: 'match',
    data: {
      path: { text: filePath },
      lines: { text: lineText },
      line_number: lineNumber,
    },
  })
}

export function createRgJsonContext(
  filePath: string,
  lineNumber: number,
  lineText: string,
): string {
  return JSON.stringify({
    type: 'context',
    data: {
      path: { text: filePath },
      lines: { text: lineText },
      line_number: lineNumber,
    },
  })
}
