import {
  clearMockedModules,
  mockModule,
} from '@rivocode/common/testing/mock-modules'
import {
  createMockChildProcess,
  asCodeSearchResult,
  createRgJsonMatch,
  createRgJsonContext,
} from '@rivocode/common/testing/mocks'
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'

import { codeSearch } from '../tools/code-search'

import type { MockChildProcess } from '@rivocode/common/testing/mocks'

describe('codeSearch', () => {
  let mockSpawn: ReturnType<typeof mock>
  let mockProcess: MockChildProcess

  beforeEach(async () => {
    mockProcess = createMockChildProcess()
    mockSpawn = mock(() => mockProcess)
    await mockModule('child_process', () => ({
      spawn: mockSpawn,
    }))
  })

  afterEach(() => {
    mock.restore()
    clearMockedModules()
  })

  describe('basic search', () => {
    it('should parse standard ripgrep output without context flags', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
      })

      const output = [
        createRgJsonMatch('file1.ts', 1, 'import foo from "bar"'),
        createRgJsonMatch('file1.ts', 5, 'import { baz } from "qux"'),
        createRgJsonMatch('file2.ts', 10, 'import React from "react"'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('Found 3 matches')
      expect(value.stdout).toContain('file1.ts:')
      expect(value.stdout).toContain('  Line 1: import foo from "bar"')
      expect(value.stdout).toContain('file2.ts:')
    })
  })

  describe('context flags handling', () => {
    it('should correctly parse output with -A flag (after context)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import.*env',
        flags: '-A 2',
      })

      const output = [
        createRgJsonMatch('test.ts', 1, 'import { env } from "./config"'),
        createRgJsonContext('test.ts', 2, 'const apiUrl = env.API_URL'),
        createRgJsonContext('test.ts', 3, 'const apiKey = env.API_KEY'),
        createRgJsonMatch('other.ts', 5, 'import env from "process"'),
        createRgJsonContext('other.ts', 6, 'const nodeEnv = env.NODE_ENV'),
        createRgJsonContext('other.ts', 7, 'const port = env.PORT'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('Found 2 matches')

      expect(value.stdout).toContain('import { env } from "./config"')
      expect(value.stdout).toContain('import env from "process"')

      expect(value.stdout).toContain('const apiUrl = env.API_URL')
      expect(value.stdout).toContain('const apiKey = env.API_KEY')
      expect(value.stdout).toContain('const nodeEnv = env.NODE_ENV')
      expect(value.stdout).toContain('const port = env.PORT')
    })

    it('should correctly parse output with -B flag (before context)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'export',
        flags: '-B 2',
      })

      const output = [
        createRgJsonContext('app.ts', 1, 'import React from "react"'),
        createRgJsonContext('app.ts', 2, ''),
        createRgJsonMatch('app.ts', 3, 'export const main = () => {}'),
        createRgJsonContext(
          'utils.ts',
          8,
          'function validateInput(x: string) {',
        ),
        createRgJsonContext('utils.ts', 9, '  return x.length > 0'),
        createRgJsonMatch('utils.ts', 10, 'export function helper() {}'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('export const main = () => {}')
      expect(value.stdout).toContain('export function helper() {}')

      expect(value.stdout).toContain('import React from "react"')
      expect(value.stdout).toContain('function validateInput(x: string) {')
      expect(value.stdout).toContain('return x.length > 0')
    })

    it('should correctly parse output with -C flag (context before and after)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'TODO',
        flags: '-C 1',
      })

      const output = [
        createRgJsonContext('code.ts', 5, 'function processData() {'),
        createRgJsonMatch('code.ts', 6, '  // TODO: implement this'),
        createRgJsonContext('code.ts', 7, '  return null'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('TODO: implement this')

      expect(value.stdout).toContain('function processData() {')
      expect(value.stdout).toContain('return null')
    })

    it('should handle -A flag with multiple matches in same file', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-A 1',
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'import foo from "foo"'),
        createRgJsonContext('file.ts', 2, 'import bar from "bar"'),
        createRgJsonMatch('file.ts', 3, 'import baz from "baz"'),
        createRgJsonContext('file.ts', 4, ''),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('import foo from "foo"')
      expect(value.stdout).toContain('import baz from "baz"')

      expect(value.stdout).toContain('import bar from "bar"')
    })

    it('should handle -B flag at start of file', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-B 2',
      })

      const output = createRgJsonMatch('file.ts', 1, 'import foo from "foo"')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('import foo from "foo"')
    })

    it('should skip separator lines between result groups', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        flags: '-A 1',
      })

      const output = [
        createRgJsonMatch('file1.ts', 1, 'test line'),
        createRgJsonMatch('file2.ts', 5, 'another test'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).not.toContain('--')
    })
  })

  describe('edge cases with context lines', () => {
    it('should handle filenames with hyphens correctly', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-A 1',
      })

      const output = [
        createRgJsonMatch('my-file.ts', 1, 'import foo'),
        createRgJsonMatch('other-file.ts', 5, 'import bar'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('my-file.ts:')
      expect(value.stdout).toContain('import foo')
      expect(value.stdout).toContain('other-file.ts:')
      expect(value.stdout).toContain('import bar')
    })

    it('should handle filenames with multiple hyphens and underscores', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        flags: '-A 1',
      })

      const output = createRgJsonMatch(
        'my-complex_file-name.ts',
        10,
        'test content',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('my-complex_file-name.ts:')
      expect(value.stdout).toContain('test content')
    })

    it('should not accumulate entire file content (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import.*env',
        flags: '-A 2',
        maxOutputStringLength: 20000,
      })

      const output = [
        createRgJsonMatch('large-file.ts', 5, 'import { env } from "config"'),
        createRgJsonMatch('other.ts', 1, 'import env'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout!.length).toBeLessThan(2000)

      expect(value.stdout).toContain('large-file.ts:')
      expect(value.stdout).toContain('other.ts:')
    })
  })

  describe('result limiting with context lines', () => {
    it('should respect maxResults per file with context lines', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        flags: '-A 1',
        maxResults: 2,
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'test 1'),
        createRgJsonContext('file.ts', 2, 'context 1'),
        createRgJsonMatch('file.ts', 5, 'test 2'),
        createRgJsonContext('file.ts', 6, 'context 2'),
        createRgJsonMatch('file.ts', 10, 'test 3'),
        createRgJsonContext('file.ts', 11, 'context 3'),
        createRgJsonMatch('file.ts', 15, 'test 4'),
        createRgJsonContext('file.ts', 16, 'context 4'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      const testMatches = (value.stdout!.match(/test \d/g) || []).length
      expect(testMatches).toBeLessThanOrEqual(2)
      expect(value.stdout).toContain('Results limited')

      if (value.stdout!.includes('test 1')) {
        expect(value.stdout).toContain('context 1')
      }
      if (value.stdout!.includes('test 2')) {
        expect(value.stdout).toContain('context 2')
      }
    })

    it('should not report truncation when matches exactly equal maxResults', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        maxResults: 2,
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'test 1'),
        createRgJsonMatch('file.ts', 2, 'test 2'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('Found 2 matches')
      expect(value.stdout).not.toContain('Results limited')
    })

    it('should respect globalMaxResults with context lines', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        flags: '-A 1',
        globalMaxResults: 3,
      })

      const output = [
        createRgJsonMatch('file1.ts', 1, 'test 1'),
        createRgJsonContext('file1.ts', 2, 'context 1'),
        createRgJsonMatch('file1.ts', 5, 'test 2'),
        createRgJsonContext('file1.ts', 6, 'context 2'),
        createRgJsonMatch('file2.ts', 1, 'test 3'),
        createRgJsonContext('file2.ts', 2, 'context 3'),
        createRgJsonMatch('file2.ts', 5, 'test 4'),
        createRgJsonContext('file2.ts', 6, 'context 4'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      const matches = (value.stdout!.match(/test \d/g) || []).length
      expect(matches).toBeLessThanOrEqual(3)
      const hasLimitMessage =
        value.stdout!.includes('Global limit') ||
        value.stdout!.includes('Results limited')
      expect(hasLimitMessage).toBe(true)
    })

    it('should not count context lines toward maxResults limit', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'match',
        flags: '-A 2 -B 2',
        maxResults: 1,
      })

      const output = [
        createRgJsonContext('file.ts', 1, 'context before 1'),
        createRgJsonContext('file.ts', 2, 'context before 2'),
        createRgJsonMatch('file.ts', 3, 'match line'),
        createRgJsonContext('file.ts', 4, 'context after 1'),
        createRgJsonContext('file.ts', 5, 'context after 2'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('match line')

      expect(value.stdout).toContain('context before 1')
      expect(value.stdout).toContain('context before 2')
      expect(value.stdout).toContain('context after 1')
      expect(value.stdout).toContain('context after 2')
    })
  })

  describe('malformed output handling', () => {
    it('should skip lines without separator', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'valid line'),
        'malformed line without proper JSON',
        createRgJsonMatch('file.ts', 2, 'another valid line'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('valid line')
      expect(value.stdout).toContain('another valid line')
    })

    it('should handle empty output', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'nonexistent',
      })

      mockProcess.stdout.emit('data', Buffer.from(''))
      mockProcess.emit('close', 1)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toBe('Found 0 matches')
    })
  })

  describe('bug fixes validation', () => {
    it('should handle patterns starting with hyphen (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: '-foo',
      })

      const output = createRgJsonMatch('file.ts', 1, 'const x = -foo')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('file.ts:')
      expect(value.stdout).toContain('-foo')
    })

    it('should strip trailing newlines from line text (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
      })

      const output = JSON.stringify({
        type: 'match',
        data: {
          path: { text: 'file.ts' },
          lines: { text: 'import foo from "bar"\n' },
          line_number: 1,
        },
      })

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).not.toContain('\n\n\n')
      expect(value.stdout).toContain('import foo')
    })

    it('should process multiple JSON objects in remainder at close (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
      })

      const match1 = createRgJsonMatch('file1.ts', 1, 'test 1')
      const match2 = createRgJsonMatch('file2.ts', 2, 'test 2')
      const match3 = createRgJsonMatch('file3.ts', 3, 'test 3')

      const output = `${match1}\n${match2}\n${match3}`

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('file1.ts:')
      expect(value.stdout).toContain('file2.ts:')
      expect(value.stdout).toContain('file3.ts:')
    })

    it('should enforce output size limit during streaming (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        maxOutputStringLength: 200,
        globalMaxResults: 1000,
        maxResults: 1000,
      })

      const matches: string[] = []
      for (let i = 0; i < 20; i++) {
        matches.push(
          createRgJsonMatch(
            'file.ts',
            i,
            `test line ${i} with some content that is quite long to fill up the buffer quickly`,
          ),
        )
      }
      const output = matches.join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      const matchCount = (value.stdout!.match(/test line \d+/g) || []).length
      expect(matchCount).toBeLessThan(20)
      const hasTruncationMessage =
        value.stdout!.includes('truncated') ||
        value.stdout!.includes('limit reached') ||
        value.stdout!.includes('Output size limit')
      expect(hasTruncationMessage).toBe(true)
    })

    it('should handle non-UTF8 paths using path.bytes (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
      })

      const output = JSON.stringify({
        type: 'match',
        data: {
          path: { bytes: 'file-with-bytes.ts' },
          lines: { text: 'test content' },
          line_number: 1,
        },
      })

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('file-with-bytes.ts:')
      expect(value.stdout).toContain('test content')
    })
  })

  describe('glob pattern handling', () => {
    it('should handle -g flag with glob patterns like *.ts', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-g *.ts',
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'import foo from "bar"'),
        createRgJsonMatch('file.ts', 5, 'import { baz } from "qux"'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('file.ts:')

      expect(mockSpawn).toHaveBeenCalled()
      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('-g')
      expect(spawnArgs).toContain('*.ts')
    })

    it('should handle -g flag with multiple glob patterns', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-g *.ts -g *.tsx',
      })

      const output = createRgJsonMatch(
        'file.tsx',
        1,
        'import React from "react"',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('file.tsx:')

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      const gFlagIndices = spawnArgs
        .map((arg, i) => (arg === '-g' ? i : -1))
        .filter((i) => i !== -1)
      expect(gFlagIndices.length).toBe(2)
      expect(spawnArgs[gFlagIndices[0]! + 1]).toBe('*.ts')
      expect(spawnArgs[gFlagIndices[1]! + 1]).toBe('*.tsx')
    })

    it('should strip single quotes from glob pattern arguments (regression: spawn has no shell)', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'auth',
        flags: "-g 'authentication.knowledge.md'",
      })

      const output = createRgJsonMatch(
        'authentication.knowledge.md',
        5,
        'auth content',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('authentication.knowledge.md:')

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('authentication.knowledge.md')
      expect(spawnArgs).not.toContain("'authentication.knowledge.md'")
    })

    it('should strip double quotes from glob pattern arguments', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-g "*.ts"',
      })

      const output = createRgJsonMatch('file.ts', 1, 'import foo')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('file.ts:')

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('*.ts')
      expect(spawnArgs).not.toContain('"*.ts"')
    })

    it('should strip quotes from multiple glob patterns', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: "-g '*.ts' -g '*.tsx'",
      })

      const output = createRgJsonMatch('file.tsx', 1, 'import React')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      await searchPromise

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('*.ts')
      expect(spawnArgs).toContain('*.tsx')
      expect(spawnArgs).not.toContain("'*.ts'")
      expect(spawnArgs).not.toContain("'*.tsx'")
    })

    it('should not deduplicate flag-argument pairs', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'import',
        flags: '-g *.ts -i -g *.tsx',
      })

      const output = createRgJsonMatch(
        'file.tsx',
        1,
        'import React from "react"',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      const flagsSection = spawnArgs.slice(0, spawnArgs.indexOf('--'))
      expect(flagsSection).toContain('-g')
      expect(flagsSection).toContain('*.ts')
      expect(flagsSection).toContain('-i')
      expect(flagsSection).toContain('*.tsx')

      const gCount = flagsSection.filter((arg) => arg === '-g').length
      expect(gCount).toBe(2)
    })
  })

  describe('timeout handling', () => {
    it('should timeout after specified seconds', async () => {
      const slowMockProcess = createMockChildProcess()
      slowMockProcess.kill = mock(() => {
        slowMockProcess.killed = true
        return true
      })

      const slowMockSpawn = mock(() => slowMockProcess)
      await mockModule('child_process', () => ({
        spawn: slowMockSpawn,
      }))

      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        timeoutSeconds: 1,
      })

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.errorMessage).toBeDefined()
      expect(value.errorMessage).toContain('timed out')
    })
  })

  describe('cwd parameter handling', () => {
    it('should handle cwd: "." correctly', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        cwd: '.',
      })

      const output = createRgJsonMatch('file.ts', 1, 'test content')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const _result = await searchPromise
      const value = asCodeSearchResult(_result[0])

      expect(value.errorMessage).toBeUndefined()
      expect(value.stdout).toContain('file.ts:')
      expect(value.stdout).toContain('test content')

      expect(mockSpawn).toHaveBeenCalled()
      const spawnOptions = mockSpawn.mock.calls[0]![2] as { cwd: string }
      expect(spawnOptions.cwd).toBe('/test/project')
    })

    it('should handle cwd: "subdir" correctly', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        cwd: 'subdir',
      })

      const output = createRgJsonMatch('file.ts', 1, 'test content')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.errorMessage).toBeUndefined()
      expect(value.stdout).toContain('file.ts:')

      expect(mockSpawn).toHaveBeenCalled()
      const spawnOptions = mockSpawn.mock.calls[0]![2] as { cwd: string }
      expect(spawnOptions.cwd).toBe('/test/project/subdir')
    })

    it('should search cwd outside the project directory', async () => {
      const searchPromise = codeSearch({
        projectPath: '/test/project',
        pattern: 'test',
        cwd: '../outside',
      })

      const output = createRgJsonMatch('file.ts', 1, 'test content')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.errorMessage).toBeUndefined()
      expect(value.stdout).toContain('file.ts:')

      expect(mockSpawn).toHaveBeenCalled()
      const spawnOptions = mockSpawn.mock.calls[0]![2] as { cwd: string }
      expect(spawnOptions.cwd).toBe('/test/outside')
    })
  })
})
