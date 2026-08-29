import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, test } from 'bun:test'

import { TERMINAL_RESET_SEQUENCES } from '../utils/terminal-reset-sequences'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..')

const WRAPPER_PATHS = ['cli/release-core/launcher.js']

function sequenceSourceLiterals(): string[] {
  return TERMINAL_RESET_SEQUENCES.split('\x1b')
    .filter(Boolean)
    .map((rest) => `'\\x1b${rest}'`)
}

describe('terminal reset sequence copies stay in sync', () => {
  for (const wrapperPath of WRAPPER_PATHS) {
    test(wrapperPath, () => {
      const source = readFileSync(join(REPO_ROOT, wrapperPath), 'utf8')
      for (const literal of sequenceSourceLiterals()) {
        expect(source).toContain(literal)
      }
    })
  }
})
