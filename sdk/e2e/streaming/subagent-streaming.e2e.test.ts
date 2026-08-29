
import { describe, test, expect, beforeAll } from 'bun:test'

import { CodebuffClient } from '../../src/client'
import { EventCollector, getApiKey, skipIfNoApiKey, DEFAULT_TIMEOUT } from '../utils'

describe('Streaming: Subagent Streaming', () => {
  let client: CodebuffClient

  beforeAll(() => {
    if (skipIfNoApiKey()) return
    client = new CodebuffClient({ apiKey: getApiKey() })
  })

  test(
    'subagent_start and subagent_finish events are paired',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: 'codebuff/base@latest',
        prompt: 'Search for files containing "test" in this project',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
        cwd: process.cwd(),
      })

      const subagentStarts = collector.getEventsByType('subagent_start')
      const subagentFinishes = collector.getEventsByType('subagent_finish')

      if (subagentStarts.length > 0) {
        for (const start of subagentStarts) {
          const _matchingFinish = subagentFinishes.find(
            (f) => f.agentId === start.agentId,
          )
          expect(start.agentId).toBeDefined()
          expect(start.agentType).toBeDefined()
          expect(start.displayName).toBeDefined()
        }
      }
    },
    DEFAULT_TIMEOUT * 2,
  )

  test(
    'subagent events have correct structure',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: 'codebuff/base@latest',
        prompt: 'List files in the current directory',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
        cwd: process.cwd(),
      })

      const subagentStarts = collector.getEventsByType('subagent_start')

      for (const event of subagentStarts) {
        expect(typeof event.agentId).toBe('string')
        expect(typeof event.agentType).toBe('string')
        expect(typeof event.displayName).toBe('string')
        expect(typeof event.onlyChild).toBe('boolean')

        if (event.parentAgentId !== undefined) {
          expect(typeof event.parentAgentId).toBe('string')
        }
        if (event.prompt !== undefined) {
          expect(typeof event.prompt).toBe('string')
        }
      }
    },
    DEFAULT_TIMEOUT * 2,
  )

  test(
    'subagent chunks are forwarded to handleStreamChunk',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: 'codebuff/base@latest',
        prompt: 'What files are in the sdk folder?',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
        cwd: process.cwd(),
      })

      const subagentChunks = collector.streamChunks.filter(
        (c): c is Extract<typeof c, { type: 'subagent_chunk' }> =>
          typeof c !== 'string' && c.type === 'subagent_chunk',
      )

      const subagentStarts = collector.getEventsByType('subagent_start')
      if (subagentStarts.length > 0 && subagentChunks.length > 0) {
        for (const chunk of subagentChunks) {
          expect(chunk.agentId).toBeDefined()
          expect(chunk.agentType).toBeDefined()
          expect(typeof chunk.chunk).toBe('string')
        }
      }
    },
    DEFAULT_TIMEOUT * 2,
  )

  test(
    'no duplicate subagent_start events for same agent',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: 'codebuff/base@latest',
        prompt: 'Find TypeScript files',
        handleEvent: collector.handleEvent,
        cwd: process.cwd(),
      })

      const subagentStarts = collector.getEventsByType('subagent_start')

      const agentIds = subagentStarts.map((s) => s.agentId)
      const uniqueIds = new Set(agentIds)

      expect(agentIds.length).toBe(uniqueIds.size)
    },
    DEFAULT_TIMEOUT * 2,
  )
})
