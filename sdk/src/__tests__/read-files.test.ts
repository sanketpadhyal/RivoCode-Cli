import { FILE_READ_STATUS } from '@codebuff/common/old-constants'
import * as projectFileTree from '@codebuff/common/project-file-tree'
import { createNodeError } from '@codebuff/common/testing/errors'
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { getFiles } from '../tools/read-files'

import type { CodebuffFileSystem } from '@codebuff/common/types/filesystem'
import type { PathLike } from 'node:fs'

function createMockFs(config: {
  files?: Record<string, { content: string; size?: number }>
  errors?: Record<string, { code?: string; message?: string }>
}): CodebuffFileSystem {
  const { files = {}, errors = {} } = config

  return {
    readFile: async (filePath: PathLike) => {
      const pathStr = String(filePath)
      if (errors[pathStr]) {
        throw createNodeError(
          errors[pathStr].message || 'Unknown error',
          errors[pathStr].code || 'UNKNOWN',
        )
      }
      if (files[pathStr]) {
        return files[pathStr].content
      }
      throw createNodeError(
        `ENOENT: no such file or directory: ${pathStr}`,
        'ENOENT',
      )
    },
    stat: async (filePath: PathLike) => {
      const pathStr = String(filePath)
      if (errors[pathStr]) {
        throw createNodeError(
          errors[pathStr].message || 'Unknown error',
          errors[pathStr].code || 'UNKNOWN',
        )
      }
      if (files[pathStr]) {
        return {
          size: files[pathStr].size ?? files[pathStr].content.length,
          isDirectory: () => false,
          isFile: () => true,
          atimeMs: Date.now(),
          mtimeMs: Date.now(),
        }
      }
      throw createNodeError(
        `ENOENT: no such file or directory: ${pathStr}`,
        'ENOENT',
      )
    },
    readdir: async () => [],
    mkdir: async () => undefined,
    writeFile: async () => undefined,
  } as unknown as CodebuffFileSystem
}

describe('getFiles', () => {
  let isFileIgnoredSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    isFileIgnoredSpy = spyOn(
      projectFileTree,
      'isFileIgnored',
    ).mockResolvedValue(false)
  })

  afterEach(() => {
    mock.restore()
  })

  describe('reading normal files', () => {
    test('should return file content for a valid file', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'console.log("hello")' },
        },
      })

      const result = await getFiles({
        filePaths: ['src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/index.ts']).toBe('console.log("hello")')
    })

    test('should handle multiple files', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/a.ts': { content: 'file a' },
          '/project/src/b.ts': { content: 'file b' },
        },
      })

      const result = await getFiles({
        filePaths: ['src/a.ts', 'src/b.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/a.ts']).toBe('file a')
      expect(result['src/b.ts']).toBe('file b')
    })

    test('should skip empty file paths', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'content' },
        },
      })

      const result = await getFiles({
        filePaths: ['', 'src/index.ts', ''],
        cwd: '/project',
        fs: mockFs,
      })

      expect(Object.keys(result)).toEqual(['src/index.ts'])
      expect(result['src/index.ts']).toBe('content')
    })
  })

  describe('file not found', () => {
    test('should return DOES_NOT_EXIST for missing files', async () => {
      const mockFs = createMockFs({
        files: {},
      })

      const result = await getFiles({
        filePaths: ['nonexistent.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['nonexistent.ts']).toBe(FILE_READ_STATUS.DOES_NOT_EXIST)
    })
  })

  describe('file outside project', () => {
    test('should read absolute paths outside project', async () => {
      const mockFs = createMockFs({
        files: {
          '/etc/hosts': { content: '127.0.0.1 localhost' },
        },
      })

      const result = await getFiles({
        filePaths: ['/etc/hosts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/etc/hosts']).toBe('127.0.0.1 localhost')
    })

    test('should read relative paths that escape project', async () => {
      const mockFs = createMockFs({
        files: {
          '/outside/secret.txt': { content: 'secret' },
        },
      })

      const result = await getFiles({
        filePaths: ['../outside/secret.txt'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/outside/secret.txt']).toBe('secret')
    })

    test('should not apply project gitignore to files outside the project', async () => {
      const mockFs = createMockFs({
        files: {
          '/other/node_modules/pkg/index.js': { content: 'module.exports = 1' },
        },
      })

      const result = await getFiles({
        filePaths: ['/other/node_modules/pkg/index.js'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/other/node_modules/pkg/index.js']).toBe(
        'module.exports = 1',
      )
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })
  })

  describe('file too large', () => {
    test('should truncate files over 100k chars to first 100k chars with message', async () => {
      const largeContent = 'x'.repeat(100_001) + 'y'.repeat(1000)
      const mockFs = createMockFs({
        files: {
          '/project/large.bin': {
            content: largeContent,
            size: largeContent.length,
          },
        },
      })

      const result = await getFiles({
        filePaths: ['large.bin'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['large.bin']).toContain('x'.repeat(100_000))
      expect(result['large.bin']).not.toContain('y')
      expect(result['large.bin']).toContain('FILE_TOO_LARGE')
      expect(result['large.bin']).toContain('101,001 characters')
    })

    test('should read files at exactly 100k chars', async () => {
      const exactly100kContent = 'x'.repeat(100_000)
      const mockFs = createMockFs({
        files: {
          '/project/exactly100k.bin': {
            content: exactly100kContent,
            size: exactly100kContent.length,
          },
        },
      })

      const result = await getFiles({
        filePaths: ['exactly100k.bin'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['exactly100k.bin']).toBe(exactly100kContent)
      expect(result['exactly100k.bin']).not.toContain('FILE_TOO_LARGE')
    })

    test('should reject files over 10MB without reading them', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/huge.bin': {
            content: 'x',
            size: 15 * 1024 * 1024,
          },
        },
      })

      const result = await getFiles({
        filePaths: ['huge.bin'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['huge.bin']).toContain(FILE_READ_STATUS.TOO_LARGE)
      expect(result['huge.bin']).toContain('15.0MB')
    })

    test('should read files just under 100k chars', async () => {
      const justUnder100k = 'x'.repeat(99_000)
      const mockFs = createMockFs({
        files: {
          '/project/underlimit.bin': {
            content: justUnder100k,
            size: justUnder100k.length,
          },
        },
      })

      const result = await getFiles({
        filePaths: ['underlimit.bin'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['underlimit.bin']).toBe(justUnder100k)
      expect(result['underlimit.bin']).not.toContain('FILE_TOO_LARGE')
    })

    test('should cap combined file contents at 100k chars', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/a.txt': { content: 'a'.repeat(60_000) },
          '/project/b.txt': { content: 'a'.repeat(60_000) },
          '/project/c.txt': { content: 'UNIQUE_THIRD_FILE_CONTENT' },
        },
      })

      const result = await getFiles({
        filePaths: ['a.txt', 'b.txt', 'c.txt'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['a.txt']).toBe('a'.repeat(60_000))
      expect(result['b.txt']).toStartWith('a'.repeat(40_000))
      expect(result['b.txt']).not.toContain('a'.repeat(40_001))
      expect(result['b.txt']).toContain('combined read_files output')
      expect(result['c.txt']).not.toContain('UNIQUE_THIRD_FILE_CONTENT')
      expect(result['c.txt']).toContain('truncated after 0 characters')
    })

    test('should not spend the shared budget twice on path aliases', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/a.txt': { content: 'a'.repeat(60_000) },
          '/project/b.txt': { content: 'a'.repeat(40_000) },
        },
      })

      const result = await getFiles({
        filePaths: ['a.txt', './a.txt', 'b.txt'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['a.txt']).toBe('a'.repeat(60_000))
      expect(result['b.txt']).toBe('a'.repeat(40_000))
    })

    test('should return files with prototype-named paths', async () => {
      const mockFs = createMockFs({
        files: Object.fromEntries([
          ['/project/__proto__', { content: 'prototype file content' }],
        ]),
      })

      const result = await getFiles({
        filePaths: ['__proto__'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(Object.hasOwn(result, '__proto__')).toBe(true)
      expect(result['__proto__']).toBe('prototype file content')
    })

    test('should cap token-dense Unicode content before the character limit', async () => {
      const denseContent = '🧑‍💻🔥🚀⚠️'.repeat(5_000)
      const mockFs = createMockFs({
        files: {
          '/project/dense.txt': { content: denseContent },
        },
      })

      const result = await getFiles({
        filePaths: ['dense.txt'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['dense.txt']).not.toBe(denseContent)
      expect(result['dense.txt']).toContain('estimated-token per-file limit')
      expect(result['dense.txt']!.length).toBeLessThan(denseContent.length)
    })
  })

  describe('gitignore blocking', () => {
    test('should return IGNORED for gitignored files', async () => {
      isFileIgnoredSpy.mockResolvedValue(true)

      const mockFs = createMockFs({
        files: {
          '/project/node_modules/package/index.js': { content: 'module code' },
        },
      })

      const result = await getFiles({
        filePaths: ['node_modules/package/index.js'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['node_modules/package/index.js']).toBe(
        FILE_READ_STATUS.IGNORED,
      )
    })

    test('should call isFileIgnored with correct parameters', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'content' },
        },
      })

      await getFiles({
        filePaths: ['src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(isFileIgnoredSpy).toHaveBeenCalledWith({
        filePath: 'src/index.ts',
        projectRoot: '/project',
        fs: mockFs,
      })
    })

    test('should handle mix of ignored and non-ignored files', async () => {
      isFileIgnoredSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'main code' },
          '/project/node_modules/pkg/index.js': { content: 'dependency' },
        },
      })

      const result = await getFiles({
        filePaths: ['src/index.ts', 'node_modules/pkg/index.js'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/index.ts']).toBe('main code')
      expect(result['node_modules/pkg/index.js']).toBe(FILE_READ_STATUS.IGNORED)
    })
  })

  describe('default gitignore behavior', () => {
    test('should block gitignored files when no fileFilter is provided', async () => {
      isFileIgnoredSpy.mockResolvedValue(true)

      const mockFs = createMockFs({
        files: {
          '/project/node_modules/pkg/index.js': { content: 'module code' },
        },
      })

      const result = await getFiles({
        filePaths: ['node_modules/pkg/index.js'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['node_modules/pkg/index.js']).toBe(FILE_READ_STATUS.IGNORED)
      expect(isFileIgnoredSpy).toHaveBeenCalled()
    })

    test('should NOT check gitignore when fileFilter is provided (caller owns filtering)', async () => {
      isFileIgnoredSpy.mockResolvedValue(true)

      const mockFs = createMockFs({
        files: {
          '/project/node_modules/pkg/index.js': { content: 'module code' },
        },
      })

      const result = await getFiles({
        filePaths: ['node_modules/pkg/index.js'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow' }),
      })

      expect(result['node_modules/pkg/index.js']).toBe('module code')
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })
  })

  describe('file read errors', () => {
    test('should return ERROR for unexpected read errors', async () => {
      const mockFs = createMockFs({
        files: {},
        errors: {
          '/project/broken.ts': {
            code: 'EACCES',
            message: 'Permission denied',
          },
        },
      })

      const result = await getFiles({
        filePaths: ['broken.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['broken.ts']).toBe(FILE_READ_STATUS.ERROR)
    })
  })

  describe('path normalization', () => {
    test('should convert absolute paths within project to relative paths', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'content' },
        },
      })

      const result = await getFiles({
        filePaths: ['/project/src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/index.ts']).toBe('content')
    })

    test('should read absolute paths in sibling directories with matching prefixes', async () => {
      const mockFs = createMockFs({
        files: {
          '/project-other/src/index.ts': { content: 'outside' },
        },
      })

      const result = await getFiles({
        filePaths: ['/project-other/src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/project-other/src/index.ts']).toBe('outside')
    })
  })

  describe('fileFilter option', () => {
    test('always blocks env files and allows env templates', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.ENV': { content: 'SECRET=value' },
          '/project/.env': { content: 'DOT_SEGMENT_SECRET=value' },
          '/project/.env ': { content: 'TRAILING_SPACE_SECRET=value' },
          '/project/.env:$DATA': { content: 'ADS_SECRET=value' },
          '/project/.env.local': { content: 'LOCAL_SECRET=value' },
          '/project/.env.example': { content: 'API_KEY=example' },
          '/project/.ENV.SAMPLE': { content: 'API_KEY=sample' },
          '/outside/.ENV.PRODUCTION': { content: 'OUTSIDE_SECRET=value' },
        },
      })

      const result = await getFiles({
        filePaths: [
          '.ENV',
          '.env/./',
          '.env ',
          '.env:$DATA',
          '.env.local',
          '.env.example',
          '.ENV.SAMPLE',
          '/outside/.ENV.PRODUCTION',
        ],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['.ENV']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.env']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.env ']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.env:$DATA']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.env.local']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['/outside/.ENV.PRODUCTION']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.env.example']).toBe(
        `${FILE_READ_STATUS.TEMPLATE}\nAPI_KEY=example`,
      )
      expect(result['.ENV.SAMPLE']).toBe(
        `${FILE_READ_STATUS.TEMPLATE}\nAPI_KEY=sample`,
      )
      expect(isFileIgnoredSpy).toHaveBeenCalledTimes(2)
      expect(isFileIgnoredSpy).toHaveBeenCalledWith({
        filePath: '.env.example',
        projectRoot: '/project',
        fs: mockFs,
        allowEnvTemplate: true,
      })
      expect(isFileIgnoredSpy).toHaveBeenCalledWith({
        filePath: '.ENV.SAMPLE',
        projectRoot: '/project',
        fs: mockFs,
        allowEnvTemplate: true,
      })
    })

    test('keeps env templates subject to gitignore with a custom filter', async () => {
      isFileIgnoredSpy.mockResolvedValue(true)
      const mockFs = createMockFs({
        files: {
          '/project/.env.example': { content: 'REAL_SECRET=mistake' },
          '/project/.ENV.SAMPLE': { content: 'REAL_SECRET=mistake' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env.example', '.ENV.SAMPLE'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow' }),
      })

      expect(result['.env.example']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.ENV.SAMPLE']).toBe(FILE_READ_STATUS.IGNORED)
      expect(isFileIgnoredSpy).toHaveBeenCalledTimes(2)
    })

    test('keeps the built-in env policy independent of custom filters', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.env': { content: 'SECRET=value' },
          '/project/.env.example': { content: 'API_KEY=example' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env', '.env.example'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow' }),
      })

      expect(result['.env']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['.env.example']).toBe(
        `${FILE_READ_STATUS.TEMPLATE}\nAPI_KEY=example`,
      )
    })

    test('does not apply the read_files policy to internal edit reads', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.env': { content: 'SECRET=value' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env'],
        cwd: '/project',
        fs: mockFs,
        enforceEnvPolicy: false,
      })

      expect(result['.env']).toBe('SECRET=value')
    })

    test('should block files when filter returns blocked status', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.env': { content: 'SECRET=value' },
          '/project/src/index.ts': { content: 'normal file' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env', 'src/index.ts'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: (path) => {
          if (path === '.env') return { status: 'blocked' }
          return { status: 'allow' }
        },
      })

      expect(result['.env']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['src/index.ts']).toBe('normal file')
    })

    test('should mark template files with TEMPLATE prefix', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.env.example': { content: 'API_KEY=your_key_here' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env.example'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow-example' }),
      })

      expect(result['.env.example']).toBe(
        FILE_READ_STATUS.TEMPLATE + '\n' + 'API_KEY=your_key_here',
      )
    })

    test('should skip gitignore check for non-env allow-example files', async () => {
      isFileIgnoredSpy.mockResolvedValue(true)

      const mockFs = createMockFs({
        files: {
          '/project/config.example': { content: 'template content' },
        },
      })

      const result = await getFiles({
        filePaths: ['config.example'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow-example' }),
      })

      expect(result['config.example']).toBe(
        FILE_READ_STATUS.TEMPLATE + '\n' + 'template content',
      )
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })

    test('should run filter before gitignore check', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/secret.key': { content: 'private key' },
        },
      })

      const result = await getFiles({
        filePaths: ['secret.key'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'blocked' }),
      })

      expect(result['secret.key']).toBe(FILE_READ_STATUS.IGNORED)
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })

    test('should still enforce other checks for template files', async () => {
      const mockFs = createMockFs({
        files: {},
      })

      const result = await getFiles({
        filePaths: ['/etc/passwd', 'nonexistent.txt'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow-example' }),
      })

      expect(result['/etc/passwd']).toBe(FILE_READ_STATUS.DOES_NOT_EXIST)
      expect(result['nonexistent.txt']).toBe(FILE_READ_STATUS.DOES_NOT_EXIST)
    })
  })

  describe('windowed reads', () => {
    const bigFile = Array.from({ length: 3000 }, (_, i) => `line ${i + 1}`).join('\n')

    test('reads the whole file when no fileWindows map is given', async () => {
      const mockFs = createMockFs({
        files: { '/project/src/big.ts': { content: bigFile } },
      })

      const result = await getFiles({
        filePaths: ['src/big.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/big.ts']).toBe(bigFile)
    })

    test('caps a plain read at the per-file line limit when windowing is on', async () => {
      const mockFs = createMockFs({
        files: { '/project/src/big.ts': { content: bigFile } },
      })

      const result = await getFiles({
        filePaths: ['src/big.ts'],
        cwd: '/project',
        fs: mockFs,
        fileWindows: { 'src/big.ts': [{}] },
      })

      expect(result['src/big.ts']).toContain('showing lines 1-2000 of 3000')
      expect(result['src/big.ts']).not.toContain('line 2001\n')
    })

    test('returns only the requested window', async () => {
      const mockFs = createMockFs({
        files: { '/project/src/big.ts': { content: bigFile } },
      })

      const result = await getFiles({
        filePaths: ['src/big.ts'],
        cwd: '/project',
        fs: mockFs,
        fileWindows: { 'src/big.ts': [{ offset: 2500, limit: 10 }] },
      })

      expect(result['src/big.ts']).toContain('line 2500')
      expect(result['src/big.ts']).toContain('showing lines 2500-2509 of 3000')
      expect(result['src/big.ts']).not.toContain('line 100\n')
    })

    test('does not render the same file twice for duplicate whole-file entries', async () => {
      const mockFs = createMockFs({
        files: { '/project/src/small.ts': { content: 'alpha\nbeta\ngamma' } },
      })

      const result = await getFiles({
        filePaths: ['src/small.ts'],
        cwd: '/project',
        fs: mockFs,
        fileWindows: { 'src/small.ts': [{}] },
      })

      expect(result['src/small.ts']).toBe('alpha\nbeta\ngamma')
    })

    test('returns every requested window of the same file', async () => {
      const mockFs = createMockFs({
        files: { '/project/src/big.ts': { content: bigFile } },
      })

      const result = await getFiles({
        filePaths: ['src/big.ts'],
        cwd: '/project',
        fs: mockFs,
        fileWindows: {
          'src/big.ts': [
            { offset: 10, limit: 5 },
            { offset: 2500, limit: 5 },
          ],
        },
      })

      expect(result['src/big.ts']).toContain('showing lines 10-14 of 3000')
      expect(result['src/big.ts']).toContain('showing lines 2500-2504 of 3000')
    })
  })
})
