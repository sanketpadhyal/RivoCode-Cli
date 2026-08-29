import { describe, expect, test } from 'bun:test'

import { fetchImpreziaChatAd } from '../imprezia-client'

import type { Logger } from '../../types/contracts/logger'

const SANDBOX_KEY = 'api_pub_sandbox_abc123'
const PROD_KEY = 'api_pub_prod_abc123'

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const ad = {
  creative: {
    brandName: 'Imprezia',
    title: 'Developers. Earn money with your AI app.',
    description: 'Run ads like this, and get paid.',
    cta: 'Sponsored',
  },
  clickUrl: 'https://go-sandbox.imprezia.ai/go/tok',
  impression: {
    impressionUuid: 'uuid-1',
    beaconToken: { token: 't', issuedAt: 1, kid: 'k' },
    servedAt: '2026-08-22T23:47:09.005Z',
    publisherId: 'pub-1',
  },
}

const request = {
  request: 'how do i cache api responses?',
  response: 'use a Map with a TTL, or Redis across processes.',
  sessionId: 's1',
  timestamp: '2026-08-22T23:35:00.000Z',
  sourceUrl: 'https://freebuff.com/chat',
  surface: 'chat' as const,
  platformString: 'browser',
  deviceContext: {
    deviceType: 'desktop' as const,
    viewportWidth: 1280,
    viewportHeight: 800,
  },
}

const call = (opts: {
  apiKey: string
  testMode: boolean
  allowSandbox?: boolean
}) => {
  let upstreamCalls = 0
  const fetch = (async () => {
    upstreamCalls += 1
    return new Response(JSON.stringify({ requestId: 'req_1', ad }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch

  return fetchImpreziaChatAd({
    ...opts,
    request,
    userAgent: 'UA',
    logger,
    fetch,
  }).then((result) => ({ result, upstreamCalls }))
}

describe('sandbox creatives in production', () => {
  test('are refused, without even calling upstream', async () => {
    const { result, upstreamCalls } = await call({
      apiKey: SANDBOX_KEY,
      testMode: false,
    })
    expect(result).toBeNull()
    expect(upstreamCalls).toBe(0)
  })

  test('are served to a session that asked for this network', async () => {
    const { result } = await call({
      apiKey: SANDBOX_KEY,
      testMode: false,
      allowSandbox: true,
    })
    expect(result?.ad?.creative.brandName).toBe('Imprezia')
  })

  test('the opt-in is irrelevant to a production key', async () => {
    for (const allowSandbox of [undefined, true]) {
      const { result } = await call({
        apiKey: PROD_KEY,
        testMode: false,
        allowSandbox,
      })
      expect(result?.ad).toBeTruthy()
    }
  })

  test('announce the refusal once per process, not once per request', async () => {
    const levels: string[] = []
    const counting: Logger = {
      debug: () => levels.push('debug'),
      info: () => levels.push('info'),
      warn: () => levels.push('warn'),
      error: () => levels.push('error'),
    }
    const fetch = (async () =>
      new Response(JSON.stringify({ requestId: 'req_1', ad }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof globalThis.fetch

    for (let i = 0; i < 5; i += 1) {
      await fetchImpreziaChatAd({
        apiKey: SANDBOX_KEY,
        testMode: false,
        request,
        userAgent: 'UA',
        logger: counting,
        fetch,
      })
    }

    expect(levels.filter((l) => l === 'error').length).toBeLessThanOrEqual(1)
    expect(levels.length).toBe(5)
    expect(levels.filter((l) => l === 'debug').length).toBeGreaterThanOrEqual(4)
  })
})

describe('a response that arrives but does not parse', () => {
  test('is reported as a contract mismatch, not swallowed as a dead request', async () => {
    const errors: string[] = []
    const result = await fetchImpreziaChatAd({
      apiKey: PROD_KEY,
      request,
      userAgent: 'ua',
      testMode: false,
      logger: {
        ...logger,
        error: (...a: unknown[]) => errors.push(String(a[1] ?? a[0])),
      },
      fetch: (async () =>
        new Response('not json', {
          status: 200,
        })) as unknown as typeof globalThis.fetch,
    })
    expect(result).toBeNull()
    expect(errors.join('|')).toContain('did not match the expected shape')
  })
})
