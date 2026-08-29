import { describe, expect, test } from 'bun:test'

import {
  isAdTextSafe,
  sanitizeAdText,
  sanitizeAdUrl,
} from '../ad-creative-safety'

describe('sanitizeAdText', () => {
  test('strips colour, cursor, reset, and clipboard sequences', () => {
    expect(sanitizeAdText('\x1b[31mred\x1b[0m')).toBe('red')
    expect(sanitizeAdText('a\x1b[2Jb')).toBe('ab')
    expect(sanitizeAdText('a\x1bcb')).toBe('ab')
    expect(sanitizeAdText('buy\x1b]52;c;ZXZpbA==\x07 now')).toBe('buy now')
  })

  test('strips BEL- and ST-terminated C1 terminal commands whole', () => {
    expect(sanitizeAdText('buy\x9d52;c;ZXZpbA==\x07 now')).toBe('buy now')
    expect(sanitizeAdText('buy\x1b]52;c;ZXZpbA==\x1b\\ now')).toBe('buy now')
    expect(sanitizeAdText('buy\x90payload\x9c now')).toBe('buy now')
    expect(sanitizeAdText('buy\x9b31mred\x9b0m now')).toBe('buyred now')
  })

  test('normalizes carriage returns, tabs, and strips C0/C1 controls', () => {
    expect(sanitizeAdText('legit\rEVIL')).toBe('legit\nEVIL')
    expect(sanitizeAdText('a\tb')).toBe('a  b')
    expect(sanitizeAdText('a\x07b\x08c\x1fd')).toBe('abcd')
    expect(sanitizeAdText('a\x80b\x85c\x8dd')).toBe('abcd')
  })

  test('deletes bidi and the complete Unicode default-ignorable set', () => {
    const defaultIgnorables = [
      '\u00ad',
      '\u034f',
      '\u061c',
      '\u115f',
      '\u17b4',
      '\u180e',
      '\u200b',
      '\u202e',
      '\u2060',
      '\u206f',
      '\u3164',
      '\ufe0f',
      '\ufeff',
      '\uffa0',
      '\ufff0',
      '\ufffb',
      '\u{1bca0}',
      '\u{1d173}',
      '\u{e0041}',
      '\u{e0080}',
      '\u{e0100}',
      '\u{e0fff}',
    ]

    for (const character of defaultIgnorables) {
      expect(sanitizeAdText(`de${character}lete`)).toBe('delete')
    }
  })

  test('normalizes tabs, trims, and is idempotent', () => {
    const dirty = '  a\tb\n\x1b[1mc  '
    expect(sanitizeAdText(dirty)).toBe('a  b\nc')
    expect(sanitizeAdText(sanitizeAdText(dirty))).toBe(sanitizeAdText(dirty))
    expect(isAdTextSafe('plain text')).toBe(true)
    expect(isAdTextSafe('\x1b[31mred')).toBe(false)
  })
})

describe('sanitizeAdUrl', () => {
  test('accepts an absolute https destination', () => {
    expect(sanitizeAdUrl('https://example.com/a?b=1')).toBe(
      'https://example.com/a?b=1',
    )
  })

  test('rejects unsafe, relative, and escape-smuggled schemes', () => {
    expect(() => sanitizeAdUrl('javascript:alert(1)')).toThrow(/not allowed/)
    expect(() => sanitizeAdUrl('/relative')).toThrow(/absolute URL/)
    expect(() => sanitizeAdUrl('\x1b[0mjavascript:alert(1)')).toThrow(
      /not allowed/,
    )
  })
})
