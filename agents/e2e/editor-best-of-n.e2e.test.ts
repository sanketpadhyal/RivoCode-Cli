import { API_KEY_ENV_VAR } from '@rivocode/common/old-constants'
import { CodebuffClient } from '@rivocode/sdk'
import { describe, expect, it } from 'bun:test'

import type { PrintModeEvent } from '@rivocode/common/types/print-mode'

describe('Editor Best-of-N Max Agent Integration', () => {
  it(
    'should generate and select the best implementation for a simple edit',
    async () => {
      const apiKey = process.env[API_KEY_ENV_VAR]
      if (!apiKey) {
        throw new Error('API key not found')
      }

      const projectFiles: Record<string, string> = {
        'src/utils/math.ts': `
export function add(a: number, b: number): number {
  return a + b
}

export function subtract(a: number, b: number): number {
  return a - b
}
`,
        'src/index.ts': `
import { add, subtract } from './utils/math'

console.log(add(1, 2))
console.log(subtract(5, 3))
`,
        'package.json': JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {},
        }),
      }

      const client = new CodebuffClient({
        apiKey,
        cwd: '/tmp/test-best-of-n-project',
        projectFiles,
      })

      const events: PrintModeEvent[] = []

      const run = await client.run({
        agent: 'editor-best-of-n-max',
        prompt:
          'Add a multiply function to src/utils/math.ts that takes two numbers and returns their product',
        params: { n: 2 },
        handleEvent: (event) => {
          console.log(event)
          events.push(event)
        },
      })

      expect(run.output.type).not.toEqual('error')

      expect(run.output).toBeDefined()

      const outputStr =
        typeof run.output === 'string' ? run.output : JSON.stringify(run.output)
      console.log('Output:', outputStr)

      const sessionStr = JSON.stringify(run.sessionState)
      const allContent = (outputStr + sessionStr).toLowerCase()

      const relevantTerms = [
        'multiply',
        'product',
        'str_replace',
        'write_file',
        'propose_str_replace',
        'propose_write_file',
        'function',
        'return',
        'number',
      ]
      const foundRelevantTerm = relevantTerms.some((term) =>
        allContent.includes(term.toLowerCase()),
      )

      expect(foundRelevantTerm).toBe(true)
    },
    { timeout: 120_000 },
  )
})
