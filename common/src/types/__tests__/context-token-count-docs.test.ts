import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..')

const SOURCES = [
  join(REPO_ROOT, 'common', 'src', 'types', 'session-state.ts'),
  join(REPO_ROOT, 'agents', 'types', 'agent-definition.ts'),
  join(REPO_ROOT, '.agents', 'types', 'agent-definition.ts'),
].filter((path) => existsSync(path))

function contextTokenCountDoc(source: string): string {
  const field = source.indexOf('contextTokenCount: number')
  expect(field).toBeGreaterThan(-1)
  const open = source.lastIndexOf('/**', field)
  expect(open).toBeGreaterThan(-1)
  return source.slice(open, field)
}

describe('the contextTokenCount docstrings', () => {
  test('there is more than one of them, and they all publish', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(2)
  })

  for (const path of SOURCES) {
    const doc = contextTokenCountDoc(readFileSync(path, 'utf8'))
    const where = path.slice(REPO_ROOT.length + 1)

    test(`${where} does not promise a provider's number`, () => {
      expect(doc, where).not.toContain('/api/v1/token-count')
      expect(doc.toLowerCase(), where).not.toContain(
        'token count from the anthropic api',
      )
    })

    test(`${where} says what it actually is`, () => {
      expect(doc, where).toContain('GPT-4o')
      expect(doc.toLowerCase(), where).toContain('estimate')
      expect(doc.toLowerCase(), where).toContain('locally')
    })

    test(`${where} reads as a sentence`, () => {
      expect(doc, where).not.toContain('their own biases it low')
      expect(doc, where).toMatch(/own tokenizers?\b/)
    })
  }
})
