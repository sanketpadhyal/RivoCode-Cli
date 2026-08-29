import { describe, expect, test } from 'bun:test'

import {
  sanitizeThreadTitle,
  THREAD_TITLE_MAX_CHARS,
} from '../thread-title'

describe('sanitizeThreadTitle', () => {
  test('strips the label the model prepends despite being told not to', () => {
    expect(sanitizeThreadTitle('Title: Fix The Login Bug')).toBe(
      'Fix The Login Bug',
    )
    expect(sanitizeThreadTitle('TITLE:Fix The Login Bug')).toBe(
      'Fix The Login Bug',
    )
  })

  test('strips wrapping quotes, straight and smart', () => {
    expect(sanitizeThreadTitle('"Fix The Login Bug"')).toBe('Fix The Login Bug')
    expect(sanitizeThreadTitle('“Fix The Login Bug”')).toBe('Fix The Login Bug')
    expect(sanitizeThreadTitle("'Fix The Login Bug'")).toBe('Fix The Login Bug')
  })

  test('keeps quotes that are part of the title', () => {
    expect(sanitizeThreadTitle('Rename The "main" Branch')).toBe(
      'Rename The "main" Branch',
    )
  })

  test('drops trailing sentence punctuation but not internal punctuation', () => {
    expect(sanitizeThreadTitle('Fix the login bug.')).toBe('Fix the login bug')
    expect(sanitizeThreadTitle('Fix login, logout, and reset!!')).toBe(
      'Fix login, logout, and reset',
    )
  })

  test('a quoted sentence loses both the quotes and the period', () => {
    expect(sanitizeThreadTitle('"Fix the login bug."')).toBe('Fix the login bug')
  })

  test('collapses the multi-line preamble case into a single line', () => {
    expect(sanitizeThreadTitle('  Fix   The\nLogin\tBug  ')).toBe(
      'Fix The Login Bug',
    )
  })

  test('never exceeds the width the label is drawn at', () => {
    expect(sanitizeThreadTitle('A '.repeat(200))).toHaveLength(
      THREAD_TITLE_MAX_CHARS,
    )
  })

  test('returns null when nothing usable is left', () => {
    for (const raw of ['', '   ', '"..."', 'Title:', '!!!', '“”']) {
      expect(sanitizeThreadTitle(raw)).toBeNull()
    }
  })

  test('a non-latin title survives intact', () => {
    expect(sanitizeThreadTitle('«Исправить вход в систему».')).toBe(
      '«Исправить вход в систему»',
    )
  })
})
