import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { FREEBUFF_ROOT_AGENT_IDS } from '../constants/free-agents'
import {
  detectForeignFreebuffClient,
  FREEBUFF_CUSTOM_TOOL_NAMES,
} from '../constants/foreign-client-signals'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..')

const SEARCH_ROOTS = [
  'agents',
  '.agents',
  'freebuff',
  'freebuff-desktop/src',
  'web/src',
  'common/src',
  'sdk/src',
  'cli/src',
]

const EXCLUDED: Array<{ path: string; mustContain: string; why: string }> = [
  {
    path: 'freebuff/e2e/agent/freebuff-tester.ts',
    mustContain: "model: 'anthropic/claude-sonnet-4.5'",
    why:
      'e2e harness pinned to a paid Anthropic model. The downgrade only runs ' +
      'on free-mode requests, and a free-mode request for a non-free model is ' +
      'rejected by isFreeModeAllowedAgentModel long before the detector. It ' +
      'also had 0 production requests over 30 days. If it ever moves to a ' +
      'free model this exclusion stops applying and the test says so.',
  },
]

const TOOL_NAMES_DECLARATION = /toolNames:\s*\[([^\]]*)\]/g
const QUOTED_NAME = /'([^']+)'|"([^"]+)"/g

const MINIMUM_DECLARATIONS = 25

type Declaration = { file: string; names: string[]; ids: string[] }

function collectSourceFiles(): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') {
        continue
      }
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (
        path.endsWith('.ts') &&
        !path.includes('__tests__') &&
        !path.endsWith('.test.ts')
      ) {
        files.push(path)
      }
    }
  }
  for (const root of SEARCH_ROOTS) walk(join(REPO_ROOT, root))
  return files
}

function collectDeclarations(): Declaration[] {
  const excluded = new Set(EXCLUDED.map((entry) => entry.path))
  const declarations: Declaration[] = []
  for (const file of collectSourceFiles()) {
    const relativePath = relative(REPO_ROOT, file)
    if (excluded.has(relativePath)) continue
    const source = readFileSync(file, 'utf8')
    const ids = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]!)
    for (const match of source.matchAll(TOOL_NAMES_DECLARATION)) {
      const names = [...match[1]!.matchAll(QUOTED_NAME)].map(
        (name) => name[1] ?? name[2]!,
      )
      declarations.push({ file: relativePath, names, ids })
    }
  }
  return declarations
}

const DECLARATIONS = collectDeclarations()

function asToolSchemas(names: string[]) {
  return names.map((name) => ({ type: 'function', function: { name } }))
}

describe('no shipped freebuff agent is flagged as a foreign client', () => {
  test('the scan actually found our agents', () => {
    expect(DECLARATIONS.length).toBeGreaterThanOrEqual(MINIMUM_DECLARATIONS)
  })

  test.each(DECLARATIONS.map((d): [string, Declaration] => [d.file, d]))(
    '%s',
    (_file, declaration) => {
      const verdict = detectForeignFreebuffClient({
        tools: asToolSchemas(declaration.names),
      })
      expect({
        file: declaration.file,
        names: declaration.names,
        signal: verdict.signal,
      }).toEqual({
        file: declaration.file,
        names: declaration.names,
        signal: null,
      })
    },
  )

  test.each([
    ['researcher-web', 'agents/researcher/researcher-web.ts'],
    ['desktop mission', 'freebuff-desktop/src/server/services/mission.ts'],
    ['glob-matcher', 'agents/file-explorer/glob-matcher.ts'],
  ])('still covers %s, which the scan must not silently drop', (_name, path) => {
    expect(DECLARATIONS.some((d) => d.file === path)).toBe(true)
  })

  test('every root agent we ship declares tools', () => {
    const roots = new Set<string>(FREEBUFF_ROOT_AGENT_IDS)
    const shippedRoots = DECLARATIONS.filter((d) =>
      d.ids.some((id) => roots.has(id)),
    )
    expect(shippedRoots.length).toBeGreaterThan(0)
    expect(
      shippedRoots
        .filter((d) => d.names.length === 0)
        .map((d) => `${d.file} (${d.ids.join(', ')})`),
    ).toEqual([])
  })

  test.each([...FREEBUFF_CUSTOM_TOOL_NAMES])(
    'custom tool %s clears on its own',
    (name) => {
      expect(
        detectForeignFreebuffClient({ tools: asToolSchemas([name]) }).signal,
      ).toBeNull()
    },
  )

  test('custom tools appended to a real toolset stay cleared', () => {
    expect(
      detectForeignFreebuffClient({
        tools: asToolSchemas([
          'spawn_agents',
          'gravity_index',
          'render_ui',
          'suggest_followups',
          'read_attached_image_abc123',
          'read_attached_doc_def456',
        ]),
      }).signal,
    ).toBeNull()
  })

  test.each(EXCLUDED)('exclusion of $path still holds', (entry) => {
    const source = readFileSync(join(REPO_ROOT, entry.path), 'utf8')
    expect(source).toContain(entry.mustContain)
  })
})
