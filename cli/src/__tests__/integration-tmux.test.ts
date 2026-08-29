import { spawn } from 'child_process'
import path from 'path'

import { describe, test, expect, beforeAll } from 'bun:test'
import stripAnsi from 'strip-ansi'

import {
  isTmuxAvailable,
  isSDKBuilt,
  sleep,
  ensureCliTestEnv,
  getDefaultCliEnv,
} from './test-utils'

const CLI_PATH = path.join(__dirname, '../index.tsx')
const TIMEOUT_MS = 15000

ensureCliTestEnv()

const tmuxAvailable = isTmuxAvailable()
const sdkBuilt = isSDKBuilt()

function tmux(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tmux', args, { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`tmux command failed: ${stderr}`))
      }
    })
  })
}

describe.skipIf(!tmuxAvailable || !sdkBuilt)(
  'CLI Integration Tests with tmux',
  () => {
    beforeAll(async () => {
      if (!tmuxAvailable) {
        console.log('\n⚠️  Skipping tmux tests - tmux not installed')
        console.log(
          '📦 Install with: brew install tmux (macOS) or sudo apt-get install tmux (Linux)\n',
        )
      }
      if (!sdkBuilt) {
        console.log('\n⚠️  Skipping tmux tests - SDK not built')
        console.log('🔨 Build SDK: cd sdk && bun run build\n')
      }
      if (tmuxAvailable && sdkBuilt) {
        const envVars = getDefaultCliEnv()
        const entries = Object.entries(envVars)
        await Promise.all(
          entries.map(([key, value]) =>
            tmux(['set-environment', '-g', key, value]).catch(() => {
            }),
          ),
        )
        await tmux(['set-environment', '-gu', 'FREEBUFF_MODE']).catch(() => {})
      }
    })

    test(
      'CLI starts and displays help output',
      async () => {
        const sessionName = 'codebuff-test-' + Date.now()

        try {
          await tmux([
            'new-session',
            '-d',
            '-s',
            sessionName,
            '-x',
            '120',
            '-y',
            '30',
            `bun run ${CLI_PATH} --help; sleep 2`,
          ])

          await sleep(800)

          let cleanOutput = ''
          for (let i = 0; i < 10; i += 1) {
            await sleep(300)
            const output = await tmux(['capture-pane', '-t', sessionName, '-p'])
            cleanOutput = stripAnsi(output)
            if (cleanOutput.includes('--agent')) {
              break
            }
          }

          expect(cleanOutput).toContain('--agent')
          expect(cleanOutput).toContain('Usage:')
        } finally {
          try {
            await tmux(['kill-session', '-t', sessionName])
          } catch {
          }
        }
      },
      TIMEOUT_MS,
    )

    test(
      'CLI accepts --agent flag',
      async () => {
        const sessionName = 'codebuff-test-' + Date.now()

        try {
          await tmux([
            'new-session',
            '-d',
            '-s',
            sessionName,
            '-x',
            '120',
            '-y',
            '30',
            `bun run ${CLI_PATH} --agent ask`,
          ])

          let output = ''
          for (let i = 0; i < 5; i += 1) {
            await sleep(200)
            output = await tmux(['capture-pane', '-t', sessionName, '-p'])
            if (output.length > 0) {
              break
            }
          }

          expect(output.length).toBeGreaterThan(0)
        } finally {
          try {
            await tmux(['kill-session', '-t', sessionName])
          } catch {
          }
        }
      },
      TIMEOUT_MS,
    )
  },
)

if (!tmuxAvailable) {
  describe('tmux Installation Required', () => {
    test.skip('Install tmux for interactive CLI tests', () => {
    })
  })
}

if (!sdkBuilt) {
  describe('SDK Build Required', () => {
    test.skip('Build SDK for integration tests: cd sdk && bun run build', () => {
    })
  })
}
