import { spawn } from 'child_process'
import path from 'path'

import { describe, test, expect, beforeAll } from 'bun:test'

import {
  isTmuxAvailable,
  isSDKBuilt,
  sleep,
  ensureCliTestEnv,
  getDefaultCliEnv,
  parseRerenderLogs,
  analyzeRerenders,
  clearCliDebugLog,
} from './test-utils'

const CLI_PATH = path.join(__dirname, '../index.tsx')
const DEBUG_LOG_PATH = path.join(__dirname, '../../../debug/cli.jsonl')
const TIMEOUT_MS = 45000
const tmuxAvailable = isTmuxAvailable()
const sdkBuilt = isSDKBuilt()

ensureCliTestEnv()

const RERENDER_THRESHOLDS = {
  maxTotalRerenders: 20,

  maxRerenderPerMessage: 12,

  forbiddenChangedProps: [
    'onOpenFeedback',
    'onToggleCollapsed',
    'onBuildFast',
    'onBuildMax',
    'onBuildLite',
    'onCloseFeedback',
  ],

  maxStreamingAgentChanges: 5,
}

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

async function sendCliInput(sessionName: string, text: string): Promise<void> {
  await tmux([
    'send-keys',
    '-t',
    sessionName,
    '-l',
    `\x1b[200~${text}\x1b[201~`,
  ])
}

describe.skipIf(!tmuxAvailable || !sdkBuilt)(
  'Re-render Performance Tests',
  () => {
    beforeAll(async () => {
      if (!tmuxAvailable) {
        console.log('\n⚠️  Skipping re-render perf tests - tmux not installed')
        console.log(
          '📦 Install with: brew install tmux (macOS) or sudo apt-get install tmux (Linux)\n',
        )
      }
      if (!sdkBuilt) {
        console.log('\n⚠️  Skipping re-render perf tests - SDK not built')
        console.log('🔨 Build SDK: cd sdk && bun run build\n')
      }
      if (tmuxAvailable && sdkBuilt) {
        const envVars = getDefaultCliEnv()
        const entries = Object.entries(envVars)
        await Promise.all(
          entries.map(([key, value]) =>
            tmux(['set-environment', '-g', key, value]),
          ),
        )
        await tmux(['set-environment', '-g', 'CODEBUFF_PERF_TEST', 'true'])
      }
    })

    test(
      'MessageBlock re-renders stay within acceptable limits',
      async () => {
        const sessionName = 'codebuff-perf-test-' + Date.now()

        clearCliDebugLog(DEBUG_LOG_PATH)

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
            `CODEBUFF_PERF_TEST=true bun run ${CLI_PATH}`,
          ])

          await sleep(5000)

          await sendCliInput(sessionName, 'what is 2+2')
          await tmux(['send-keys', '-t', sessionName, 'Enter'])

          await sleep(15000)

          const entries = parseRerenderLogs(DEBUG_LOG_PATH)
          const analysis = analyzeRerenders(entries)

          console.log('\n📊 Re-render Analysis:')
          console.log(`   Total re-renders: ${analysis.totalRerenders}`)
          console.log(`   Max per message: ${analysis.maxRerenderPerMessage}`)
          console.log(
            `   Messages tracked: ${analysis.rerendersByMessage.size}`,
          )
          if (analysis.propChangeFrequency.size > 0) {
            console.log('   Prop change frequency:')
            for (const [prop, count] of analysis.propChangeFrequency) {
              console.log(`     - ${prop}: ${count}`)
            }
          }

          expect(analysis.totalRerenders).toBeLessThanOrEqual(
            RERENDER_THRESHOLDS.maxTotalRerenders,
          )

          expect(analysis.maxRerenderPerMessage).toBeLessThanOrEqual(
            RERENDER_THRESHOLDS.maxRerenderPerMessage,
          )

          for (const forbiddenProp of RERENDER_THRESHOLDS.forbiddenChangedProps) {
            const count = analysis.propChangeFrequency.get(forbiddenProp) || 0
            if (count > 0) {
              console.log(
                `\n❌ Forbidden prop '${forbiddenProp}' changed ${count} times - callback not memoized!`,
              )
            }
            expect(count).toBe(0)
          }

          const streamingAgentChanges =
            analysis.propChangeFrequency.get('streamingAgents') || 0
          expect(streamingAgentChanges).toBeLessThanOrEqual(
            RERENDER_THRESHOLDS.maxStreamingAgentChanges,
          )

          console.log('\n✅ Re-render performance within acceptable limits')
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
      'Forbidden callback props are properly memoized',
      async () => {
        const sessionName = 'codebuff-memo-test-' + Date.now()

        clearCliDebugLog(DEBUG_LOG_PATH)

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
            `CODEBUFF_PERF_TEST=true bun run ${CLI_PATH}`,
          ])

          await sleep(5000)

          await sendCliInput(sessionName, 'hi')
          await tmux(['send-keys', '-t', sessionName, 'Enter'])
          await sleep(8000)

          const entries = parseRerenderLogs(DEBUG_LOG_PATH)
          const analysis = analyzeRerenders(entries)

          const forbiddenPropsFound: string[] = []
          for (const prop of RERENDER_THRESHOLDS.forbiddenChangedProps) {
            const count = analysis.propChangeFrequency.get(prop) || 0
            if (count > 0) {
              forbiddenPropsFound.push(`${prop} (${count}x)`)
            }
          }

          if (forbiddenPropsFound.length > 0) {
            console.log(
              `\n❌ Unmemoized callbacks detected: ${forbiddenPropsFound.join(', ')}`,
            )
          }

          expect(forbiddenPropsFound).toHaveLength(0)
        } finally {
          try {
            await tmux(['kill-session', '-t', sessionName])
          } catch {}
        }
      },
      TIMEOUT_MS,
    )
  },
)

if (!tmuxAvailable) {
  describe('Re-render Performance - tmux Required', () => {
    test.skip('Install tmux for performance tests', () => {})
  })
}

if (!sdkBuilt) {
  describe('Re-render Performance - SDK Required', () => {
    test.skip('Build SDK: cd sdk && bun run build', () => {})
  })
}
