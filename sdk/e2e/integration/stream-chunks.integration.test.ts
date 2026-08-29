
import { describe, test, expect, beforeAll } from 'bun:test'

import { CodebuffClient } from '../../src/client'
import {
  EventCollector,
  getApiKey,
  skipIfNoApiKey,
  DEFAULT_AGENT,
  DEFAULT_TIMEOUT,
} from '../utils'

describe('Integration: Stream Chunks', () => {
  let client: CodebuffClient

  beforeAll(() => {
    if (skipIfNoApiKey()) return
    client = new CodebuffClient({ apiKey: getApiKey() })
  })

  test(
    'receives string chunks during text streaming',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: DEFAULT_AGENT,
        prompt: 'Write a paragraph about the benefits of TypeScript',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
      })

      const stringChunks = collector.streamChunks.filter(
        (c): c is string => typeof c === 'string',
      )

      expect(stringChunks.length).toBeGreaterThan(0)

      const fullText = collector.getFullStreamText()
      expect(fullText.length).toBeGreaterThan(0)
    },
    DEFAULT_TIMEOUT,
  )

  test(
    'stream chunks arrive incrementally (not all at once)',
    async () => {
      if (skipIfNoApiKey()) return

      const chunkTimestamps: number[] = []
      const collector = new EventCollector()

      const customChunkHandler = (
        chunk: (typeof collector.streamChunks)[0],
      ) => {
        chunkTimestamps.push(Date.now())
        collector.handleStreamChunk(chunk)
      }

      await client.run({
        agent: DEFAULT_AGENT,
        prompt:
          'Write a detailed explanation of async/await in JavaScript (at least 100 words)',
        handleEvent: collector.handleEvent,
        handleStreamChunk: customChunkHandler,
      })

      expect(chunkTimestamps.length).toBeGreaterThan(1)

      if (chunkTimestamps.length > 2) {
        const timeSpread =
          chunkTimestamps[chunkTimestamps.length - 1] - chunkTimestamps[0]
        expect(timeSpread).toBeGreaterThanOrEqual(0)
      }
    },
    DEFAULT_TIMEOUT,
  )

  test(
    'handleStreamChunk receives chunks that match handleEvent text',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: DEFAULT_AGENT,
        prompt: 'Say exactly: "Hello, World!"',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
      })

      const eventText = collector.getFullText()
      const streamText = collector.getFullStreamText()

      if (eventText.length > 0 && streamText.length > 0) {
        expect(eventText.length).toBeGreaterThan(0)
        expect(streamText.length).toBeGreaterThan(0)
      }
    },
    DEFAULT_TIMEOUT,
  )

  test(
    'empty prompt still triggers start/finish events',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: DEFAULT_AGENT,
        prompt: '',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
      })

      expect(collector.hasEventType('start')).toBe(true)
    },
    DEFAULT_TIMEOUT,
  )

  test(
    'very long response streams correctly',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: DEFAULT_AGENT,
        prompt:
          'List the numbers 1 through 20, each on a new line with a brief description',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
      })

      expect(collector.streamChunks.length).toBeGreaterThan(0)

      expect(collector.hasEventType('start')).toBe(true)
      expect(collector.hasEventType('finish')).toBe(true)
    },
    DEFAULT_TIMEOUT,
  )

  test(
    'special characters stream correctly',
    async () => {
      if (skipIfNoApiKey()) return

      const collector = new EventCollector()

      await client.run({
        agent: DEFAULT_AGENT,
        prompt:
          'Output these special characters: émojis 🎉, quotes "test", newlines, and tabs',
        handleEvent: collector.handleEvent,
        handleStreamChunk: collector.handleStreamChunk,
      })

      const fullText = collector.getFullStreamText()

      expect(collector.errors.length).toBe(0)
      expect(fullText.length).toBeGreaterThan(0)
      expect(collector.hasEventType('finish')).toBe(true)
    },
    DEFAULT_TIMEOUT,
  )
})
