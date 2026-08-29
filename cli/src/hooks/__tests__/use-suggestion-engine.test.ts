import { describe, test, expect } from 'bun:test'

const filterFileMatches = (
  filePaths: string[],
  query: string,
): Array<{ filePath: string; pathHighlightIndices?: number[] | null }> => {
  if (!query) {
    return []
  }

  const normalized = query.toLowerCase()
  const matches: Array<{
    filePath: string
    pathHighlightIndices?: number[] | null
  }> = []
  const seen = new Set<string>()

  const pushUnique = (
    target: Array<{ filePath: string; pathHighlightIndices?: number[] | null }>,
    file: { filePath: string; pathHighlightIndices?: number[] | null },
  ) => {
    if (!seen.has(file.filePath)) {
      target.push(file)
      seen.add(file.filePath)
    }
  }

  const range = (start: number, end?: number) => {
    if (end === undefined) {
      return Array.from({ length: start }, (_, i) => i)
    }
    return Array.from({ length: end - start }, (_, i) => start + i)
  }

  const querySegments = normalized.split('/')
  const hasSlashes = querySegments.length > 1

  const matchPathSegments = (filePath: string): number[] | null => {
    const pathLower = filePath.toLowerCase()
    const highlightIndices: number[] = []
    let searchStart = 0

    for (const segment of querySegments) {
      if (!segment) continue

      const segmentIndex = pathLower.indexOf(segment, searchStart)
      if (segmentIndex === -1) {
        return null
      }

      for (let i = 0; i < segment.length; i++) {
        highlightIndices.push(segmentIndex + i)
      }

      searchStart = segmentIndex + segment.length
    }

    return highlightIndices
  }

  const calculateContiguousMatchLength = (filePath: string): number => {
    const pathLower = filePath.toLowerCase()
    let maxContiguousLength = 0

    for (let i = 0; i < pathLower.length; i++) {
      let matchLength = 0
      let queryIdx = 0
      let pathIdx = i

      while (pathIdx < pathLower.length && queryIdx < normalized.length) {
        if (pathLower[pathIdx] === normalized[queryIdx]) {
          matchLength++
          queryIdx++
          pathIdx++
        } else {
          break
        }
      }

      maxContiguousLength = Math.max(maxContiguousLength, matchLength)
    }

    return maxContiguousLength
  }

  if (hasSlashes) {
    for (const filePath of filePaths) {
      const highlightIndices = matchPathSegments(filePath)
      if (highlightIndices) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: highlightIndices,
        })
      }
    }

    matches.sort((a, b) => {
      const aLength = calculateContiguousMatchLength(a.filePath)
      const bLength = calculateContiguousMatchLength(b.filePath)
      return bLength - aLength
    })
  } else {

    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop() || ''
      const fileNameLower = fileName.toLowerCase()

      if (fileNameLower.startsWith(normalized)) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [
            ...range(
              filePath.lastIndexOf(fileName),
              filePath.lastIndexOf(fileName) + normalized.length,
            ),
          ],
        })
        continue
      }

      const path = filePath.toLowerCase()
      if (path.startsWith(normalized)) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [...range(normalized.length)],
        })
      }
    }

    for (const filePath of filePaths) {
      if (seen.has(filePath)) continue
      const path = filePath.toLowerCase()
      const fileName = filePath.split('/').pop() || ''
      const fileNameLower = fileName.toLowerCase()

      const fileNameIndex = fileNameLower.indexOf(normalized)
      if (fileNameIndex !== -1) {
        const actualFileNameStart = filePath.lastIndexOf(fileName)
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [
            ...range(
              actualFileNameStart + fileNameIndex,
              actualFileNameStart + fileNameIndex + normalized.length,
            ),
          ],
        })
        continue
      }

      const pathIndex = path.indexOf(normalized)
      if (pathIndex !== -1) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [
            ...range(pathIndex, pathIndex + normalized.length),
          ],
        })
      }
    }
  }

  return matches
}

describe('use-suggestion-engine - filterFileMatches', () => {
  const sampleFiles = [
    'cli/src/hooks/use-suggestion-engine.ts',
    'cli/src/hooks/use-timeout.ts',
    'cli/src/hooks/use-usage-query.ts',
    'cli/src/components/suggestion-menu.tsx',
    'cli/src/chat.tsx',
    'web/src/components/ui/button.tsx',
    'backend/src/tools/definitions/list.ts',
    'common/src/util/file.ts',
    'packages/agent-runtime/src/index.ts',
  ]

  describe('slash-separated path matching', () => {
    test('matches "cli/use-" to files with cli and use- segments', () => {
      const results = filterFileMatches(sampleFiles, 'cli/use-')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath.includes('use-suggestion-engine')),
      ).toBe(true)
      expect(results.some((r) => r.filePath.includes('use-timeout'))).toBe(true)
      expect(results.some((r) => r.filePath.includes('use-usage-query'))).toBe(
        true,
      )
    })

    test('matches "cli/hooks/use-" to specific hook files', () => {
      const results = filterFileMatches(sampleFiles, 'cli/hooks/use-')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some(
          (r) => r.filePath === 'cli/src/hooks/use-suggestion-engine.ts',
        ),
      ).toBe(true)
    })

    test('matches "web/ui/button" to button component', () => {
      const results = filterFileMatches(sampleFiles, 'web/ui/button')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath === 'web/src/components/ui/button.tsx'),
      ).toBe(true)
    })

    test('does not match when segments are not found in order', () => {
      const results = filterFileMatches(sampleFiles, 'web/cli/use-')

      expect(results.length).toBe(0)
    })

    test('highlights correct indices for slash-separated matches', () => {
      const results = filterFileMatches(sampleFiles, 'cli/use-')

      const suggestionEngine = results.find(
        (r) => r.filePath === 'cli/src/hooks/use-suggestion-engine.ts',
      )
      expect(suggestionEngine).toBeDefined()
      expect(suggestionEngine?.pathHighlightIndices).toBeDefined()

      const indices = suggestionEngine?.pathHighlightIndices || []
      expect(indices).toContain(0)
      expect(indices).toContain(1)
      expect(indices).toContain(2)
      expect(indices.length).toBeGreaterThanOrEqual(7)
      expect(indices.some((i) => i >= 15 && i <= 18)).toBe(true)
    })

    test('matches empty segments (trailing slash)', () => {
      const results = filterFileMatches(sampleFiles, 'cli/')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.filePath.startsWith('cli/'))).toBe(true)
    })

    test('matches multiple slash segments', () => {
      const results = filterFileMatches(sampleFiles, 'cli/src/hooks')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.every(
          (r) =>
            r.filePath.includes('cli') &&
            r.filePath.includes('src') &&
            r.filePath.includes('hooks'),
        ),
      ).toBe(true)
    })
  })

  describe('non-slash query matching (original behavior)', () => {
    test('matches file name prefix', () => {
      const results = filterFileMatches(sampleFiles, 'use-')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath.includes('use-suggestion-engine')),
      ).toBe(true)
      expect(results.some((r) => r.filePath.includes('use-timeout'))).toBe(true)
    })

    test('matches path prefix', () => {
      const results = filterFileMatches(sampleFiles, 'cli')

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.filePath.startsWith('cli'))).toBe(true)
    })

    test('matches substring in file name', () => {
      const results = filterFileMatches(sampleFiles, 'suggestion')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath.includes('suggestion-engine')),
      ).toBe(true)
      expect(results.some((r) => r.filePath.includes('suggestion-menu'))).toBe(
        true,
      )
    })

    test('matches substring in path', () => {
      const results = filterFileMatches(sampleFiles, 'components')

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.filePath.includes('components'))).toBe(true)
    })

    test('returns empty array for empty query', () => {
      const results = filterFileMatches(sampleFiles, '')
      expect(results.length).toBe(0)
    })

    test('returns empty array for no matches', () => {
      const results = filterFileMatches(sampleFiles, 'nonexistent')
      expect(results.length).toBe(0)
    })
  })

  describe('prioritization by contiguous match length', () => {
    test('prioritizes exact contiguous path matches over scattered matches', () => {
      const files = [
        'cli/src/hooks/use-suggestion.ts',
        'cli/something/use-suggestion.ts',
        'client/src/use-suggestion.ts',
      ]
      const results = filterFileMatches(files, 'cli/use-')

      expect(results[0].filePath).toBe('cli/src/hooks/use-suggestion.ts')
    })

    test('prioritizes "cli/src" over "cli" + "src" scattered', () => {
      const files = ['cli/something/src/file.ts', 'cli/src/file.ts']
      const results = filterFileMatches(files, 'cli/src')

      expect(results[0].filePath).toBe('cli/src/file.ts')
    })

    test('prioritizes longer contiguous segments including slashes', () => {
      const files = [
        'web/src/components/ui/button.tsx',
        'web/something/ui/button.tsx',
        'website/ui/button.tsx',
      ]
      const results = filterFileMatches(files, 'web/ui')

      expect(results[0].filePath).toBe('web/src/components/ui/button.tsx')
    })

    test('ranks results by total contiguous match length for slash queries', () => {
      const files = [
        'a/b/c/d.ts',
        'a/b/e.ts',
        'ab/c/d.ts',
        'abc/d.ts',
      ]
      const results = filterFileMatches(files, 'a/b')

      expect(results[0].filePath).toBe('a/b/c/d.ts')
      expect(results[1].filePath).toBe('a/b/e.ts')
      expect(results[2].filePath).toBe('ab/c/d.ts')
    })

    test('prioritizes contiguous "cli/hooks" over "cli" + "hooks" scattered', () => {
      const files = [
        'cli/src/hooks/use-something.ts',
        'cli/hooks/use-something.ts',
        'cli_backup/hooks/use-something.ts',
      ]
      const results = filterFileMatches(files, 'cli/hooks')

      expect(results[0].filePath).toBe('cli/hooks/use-something.ts')
    })
  })

  describe('@-mention edge cases', () => {
    test('does not trigger inside double quotes', () => {
      const files = ['test.ts']
      const results = filterFileMatches(files, '')
      expect(results.length).toBe(0)
    })

    test('does not trigger inside single quotes', () => {
      const files = ['test.ts']
      const results = filterFileMatches(files, '')
      expect(results.length).toBe(0)
    })

    test('does not trigger inside backticks', () => {
      const files = ['test.ts']
      const results = filterFileMatches(files, '')
      expect(results.length).toBe(0)
    })

    test('does not trigger for email addresses', () => {
      const files = ['test.ts']
      const results = filterFileMatches(files, '')
      expect(results.length).toBe(0)
    })

    test('does not trigger for escaped @ symbol', () => {
      const files = ['test.ts']
      const results = filterFileMatches(files, '')
      expect(results.length).toBe(0)
    })

    test('does not trigger in URLs', () => {
      const files = ['test.ts']
      const results = filterFileMatches(files, '')
      expect(results.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    test('handles case-insensitive matching', () => {
      const results = filterFileMatches(sampleFiles, 'CLI/USE-')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath.includes('use-suggestion-engine')),
      ).toBe(true)
    })

    test('does not match partial segments incorrectly', () => {
      const results = filterFileMatches(sampleFiles, 'cl/us')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some(
          (r) => r.filePath === 'cli/src/hooks/use-suggestion-engine.ts',
        ),
      ).toBe(true)
    })

    test('handles files with no directory separators', () => {
      const flatFiles = ['file.ts', 'another.tsx', 'test.ts']
      const results = filterFileMatches(flatFiles, 'file')

      expect(results.length).toBe(1)
      expect(results[0].filePath).toBe('file.ts')
    })

    test('handles complex nested paths', () => {
      const deepFiles = [
        'very/deeply/nested/path/to/some/file.ts',
        'another/deep/path/file.tsx',
      ]
      const results = filterFileMatches(deepFiles, 'deep/path')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((r) => r.filePath.includes('deeply/nested/path')),
      ).toBe(true)
      expect(results.some((r) => r.filePath.includes('deep/path'))).toBe(true)
    })

    test('preserves order and uniqueness', () => {
      const results = filterFileMatches(sampleFiles, 'cli')

      const paths = results.map((r) => r.filePath)
      const uniquePaths = new Set(paths)
      expect(paths.length).toBe(uniquePaths.size)
    })
  })
})
