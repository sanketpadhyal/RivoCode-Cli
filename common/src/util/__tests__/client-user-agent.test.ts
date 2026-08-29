import { describe, expect, it } from 'bun:test'

import {
  UNRECOGNIZED_CLIENT,
  clientUserAgentFields,
  normalizeClientUserAgent,
} from '../client-user-agent'

describe('normalizeClientUserAgent', () => {
  it('parses the official CLI agent', () => {
    expect(normalizeClientUserAgent('Freebuff-CLI/0.0.138')).toEqual({
      product: 'freebuff-cli',
      version: '0.0.138',
    })
    expect(normalizeClientUserAgent('Codebuff-CLI/1.0.685')).toEqual({
      product: 'codebuff-cli',
      version: '1.0.685',
    })
  })

  it('parses runtime and SDK agents a non-official client would send', () => {
    expect(normalizeClientUserAgent('Go-http-client/2.0')).toEqual({
      product: 'go-http-client',
      version: '2.0',
    })
    expect(normalizeClientUserAgent('Bun/1.3.11')).toEqual({
      product: 'bun',
      version: '1.3.11',
    })
    expect(
      normalizeClientUserAgent('ai-sdk/openai-compatible/1.0.25/codebuff'),
    ).toEqual({ product: 'ai-sdk' })
  })

  it('keeps only the leading product token, dropping platform detail', () => {
    const browser =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    expect(normalizeClientUserAgent(browser)).toEqual({
      product: 'mozilla',
      version: '5.0',
    })
  })

  it('returns undefined for an absent or blank header', () => {
    expect(normalizeClientUserAgent(undefined)).toBeUndefined()
    expect(normalizeClientUserAgent(null)).toBeUndefined()
    expect(normalizeClientUserAgent('   ')).toBeUndefined()
    expect(clientUserAgentFields(null)).toEqual({})
  })

  it('collapses an over-long product instead of truncating it', () => {
    expect(normalizeClientUserAgent('A'.repeat(200) + '/1.0')).toEqual({
      product: UNRECOGNIZED_CLIENT,
    })
    const atCap = 'a'.repeat(32)
    expect(normalizeClientUserAgent(`${atCap}/1.0`)).toEqual({
      product: atCap,
      version: '1.0',
    })
    expect(normalizeClientUserAgent(`${'a'.repeat(33)}/1.0`)).toEqual({
      product: UNRECOGNIZED_CLIENT,
    })
  })

  it('collapses junk to a single constant rather than minting a value', () => {
    expect(normalizeClientUserAgent('!!!@@@###')).toEqual({
      product: UNRECOGNIZED_CLIENT,
    })
    expect(normalizeClientUserAgent('***/1.0')).toEqual({
      product: UNRECOGNIZED_CLIENT,
    })
  })

  it('rejects an address-shaped product rather than mangling it', () => {
    expect(normalizeClientUserAgent('user@example.com/1.0')).toEqual({
      product: UNRECOGNIZED_CLIENT,
    })
    expect(
      normalizeClientUserAgent('MyBot/1.0 (+contact@example.com)'),
    ).toEqual({ product: 'mybot', version: '1.0' })
  })

  it('cannot inject fields into a log line', () => {
    expect(normalizeClientUserAgent('evil\nFAKE-FIELD: 1/1.0')).toEqual({
      product: 'evil',
    })
    expect(normalizeClientUserAgent('evil\r\ninjected/1.0')).toEqual({
      product: 'evil',
    })
    expect(normalizeClientUserAgent('{"json":"inject"}/1.0')).toEqual({
      product: 'jsoninject',
      version: '1.0',
    })
  })

  it('drops a version that does not look like a version', () => {
    expect(normalizeClientUserAgent('curl/not-a-version')).toEqual({
      product: 'curl',
    })
    expect(normalizeClientUserAgent('someclient')).toEqual({
      product: 'someclient',
    })
  })

  it('drops an over-long version rather than fabricating a truncated one', () => {
    expect(normalizeClientUserAgent('x/1' + '2'.repeat(100))).toEqual({
      product: 'x',
    })
    expect(normalizeClientUserAgent('x/1.0.0-beta+build.1')).toEqual({
      product: 'x',
    })
    expect(normalizeClientUserAgent('x/1234567890123456')).toEqual({
      product: 'x',
      version: '1234567890123456',
    })
  })

  it('omits the version key entirely when absent', () => {
    expect(clientUserAgentFields('someclient')).toEqual({
      client_ua_product: 'someclient',
    })
    expect(clientUserAgentFields('Freebuff-CLI/0.0.138')).toEqual({
      client_ua_product: 'freebuff-cli',
      client_ua_version: '0.0.138',
    })
  })
})
