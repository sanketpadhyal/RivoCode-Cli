import http from 'node:http'

import { isTransientNetworkError } from '@rivocode/common/util/error'
import { OpenAICompatibleChatLanguageModel } from '@rivocode/llm-providers/openai-compatible'
import { streamText } from 'ai'
import { describe, expect, it } from 'bun:test'

import { classifyThrownStreamRecovery } from '../stream-interruption'

const serveSse = async (body: string) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write(': connecting\n\n')
    setTimeout(() => {
      res.write(body)
      res.end()
    }, 10)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { server, port: (server.address() as { port: number }).port }
}

const consume = async (port: number) => {
  const result = streamText({
    model: new OpenAICompatibleChatLanguageModel('m', {
      provider: 'codebuff',
      url: () => `http://127.0.0.1:${port}/chat/completions`,
      headers: () => ({}),
    }),
    messages: [{ role: 'user', content: 'hi' }],
    maxRetries: 0,
  })
  let error: unknown
  try {
    for await (const part of result.stream) {
      if (part.type === 'error') error = (part as { error: unknown }).error
    }
  } catch (thrown) {
    error ??= thrown
  }
  await Promise.resolve(result.text).catch((thrown: unknown) => {
    error ??= thrown
  })
  return error
}

const withServer = async (body: string, assert: (error: unknown) => void) => {
  const { server, port } = await serveSse(body)
  try {
    assert(await consume(port))
  } finally {
    server.close()
  }
}

const errorChunk = (error: Record<string, unknown>) =>
  `data: ${JSON.stringify({ error })}\n\n`

describe('late failure delivered in band', () => {
  it('surfaces the message of an OpenAI-shaped error chunk', async () => {
    await withServer(
      errorChunk({
        message: 'Upstream provider error (429): Model is at capacity.',
        type: 'upstream_error',
      }),
      (error) => {
        expect(String(error)).toContain(
          'Upstream provider error (429): Model is at capacity.',
        )
        expect(isTransientNetworkError(error)).toBe(false)
        expect(
          classifyThrownStreamRecovery({ aborted: false, error }),
        ).toBeNull()
      },
    )
  })

  it('is why a bare connection cut is not good enough', () => {
    const cut = new Error(
      'The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()',
    )
    expect(isTransientNetworkError(cut)).toBe(true)
    expect(
      classifyThrownStreamRecovery({ aborted: false, error: cut }),
    ).not.toBeNull()
  })

  it('needs the object form — a bare string fails the response schema', async () => {
    await withServer(errorChunk('just a string' as never), (error) => {
      expect(String(error)).toContain('Type validation failed')
    })
  })
})
