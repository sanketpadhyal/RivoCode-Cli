import { spawn } from 'child_process'
import path from 'path'

import { expect, test } from 'bun:test'

import { ensureCliTestEnv } from './test-utils'

ensureCliTestEnv()

const LAUNCHER_FIXTURE = path.join(
  import.meta.dir,
  'helpers',
  'launcher-disconnect-fixture.cjs',
)
const RENDERER_FIXTURE = path.join(
  import.meta.dir,
  'helpers',
  'renderer-cleanup-fixture.tsx',
)

const OUTPUT_DRAIN_MS = 750

test('the CLI exits cleanly when its package launcher disappears', async () => {
  const result = await new Promise<{
    code: number | null
    signal: NodeJS.Signals | null
    output: string
  }>((resolve, reject) => {
    const child = spawn(
      'node',
      [LAUNCHER_FIXTURE, 'observe', RENDERER_FIXTURE],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let output = ''
    let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined
    let openStreams = 2
    let settled = false
    let drain: ReturnType<typeof setTimeout> | undefined

    const settle = () => {
      if (settled || !exit) return
      settled = true
      if (drain) clearTimeout(drain)
      resolve({ ...exit, output })
    }
    const onStreamEnd = () => {
      openStreams -= 1
      if (openStreams === 0) settle()
    }

    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.stdout.once('end', onStreamEnd)
    child.stderr.once('end', onStreamEnd)
    child.once('error', reject)

    child.once('exit', (code, signal) => {
      exit = { code, signal }
      if (openStreams === 0) {
        settle()
        return
      }
      drain = setTimeout(settle, OUTPUT_DRAIN_MS)
    })
  })

  if (result.code !== 0) {
    console.error(
      result.output ||
        '(fixture exited without any captured output — it writes its diagnostic ' +
          'immediately before process.exit, which can truncate a piped write)',
    )
  }
  expect(result.code).toBe(0)
  expect(result.signal).toBeNull()
  expect(result.output).toContain('CLEAN_EXIT_VISIBLE')
  expect(result.output).toContain('CLI_EXITED_AFTER_LAUNCHER')
  expect(result.output).not.toContain('CLI survived after its launcher exited')
}, 30_000)
