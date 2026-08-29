import { describe, expect, test } from 'bun:test'

import {
  getZonedDayBounds,
  getZonedWeekBounds,
  getZonedYmd,
} from '../zoned-time'

describe('getZonedDayBounds', () => {
  test('returns the current Pacific day bounds on a normal day', () => {
    const bounds = getZonedDayBounds(
      new Date('2026-04-17T16:00:00Z'),
      'America/Los_Angeles',
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-04-17T07:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-04-18T07:00:00.000Z')
  })

  test('handles the shorter spring-forward Pacific day', () => {
    const bounds = getZonedDayBounds(
      new Date('2026-03-08T09:00:00Z'),
      'America/Los_Angeles',
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-03-08T08:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-03-09T07:00:00.000Z')
  })

  test('handles the longer fall-back Pacific day', () => {
    const bounds = getZonedDayBounds(
      new Date('2026-11-01T09:00:00Z'),
      'America/Los_Angeles',
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-11-01T07:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-11-02T08:00:00.000Z')
  })
})

describe('getZonedWeekBounds', () => {
  test('returns Monday→Monday Pacific bounds for a mid-week day', () => {
    const bounds = getZonedWeekBounds(
      new Date('2026-04-17T16:00:00Z'),
      'America/Los_Angeles',
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-04-13T07:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-04-20T07:00:00.000Z')
  })

  test('groups Sunday into the week that started the prior Monday', () => {
    const bounds = getZonedWeekBounds(
      new Date('2026-04-19T18:00:00Z'),
      'America/Los_Angeles',
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-04-13T07:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-04-20T07:00:00.000Z')
  })

  test('handles the spring-forward week (start in PST, reset in PDT)', () => {
    const bounds = getZonedWeekBounds(
      new Date('2026-03-08T18:00:00Z'),
      'America/Los_Angeles',
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-03-02T08:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-03-09T07:00:00.000Z')
  })

  test('honors a Sunday week start when requested', () => {
    const bounds = getZonedWeekBounds(
      new Date('2026-04-17T16:00:00Z'),
      'America/Los_Angeles',
      0,
    )

    expect(bounds.startsAt.toISOString()).toBe('2026-04-12T07:00:00.000Z')
    expect(bounds.resetsAt.toISOString()).toBe('2026-04-19T07:00:00.000Z')
  })
})

describe('getZonedYmd', () => {
  test('reports the Pacific day, not the UTC one, after 5pm Pacific', () => {
    expect(
      getZonedYmd(new Date('2026-04-18T02:00:00Z'), 'America/Los_Angeles'),
    ).toBe('2026-04-17')
  })

  test('rolls over at Pacific midnight', () => {
    expect(
      getZonedYmd(new Date('2026-04-18T06:59:59Z'), 'America/Los_Angeles'),
    ).toBe('2026-04-17')
    expect(
      getZonedYmd(new Date('2026-04-18T07:00:00Z'), 'America/Los_Angeles'),
    ).toBe('2026-04-18')
  })

  test('is correct across a DST spring-forward boundary', () => {
    expect(
      getZonedYmd(new Date('2026-03-08T09:59:00Z'), 'America/Los_Angeles'),
    ).toBe('2026-03-08')
    expect(
      getZonedYmd(new Date('2026-03-08T10:01:00Z'), 'America/Los_Angeles'),
    ).toBe('2026-03-08')
  })

  test('zero-pads month and day so the string sorts lexicographically', () => {
    expect(getZonedYmd(new Date('2026-01-05T18:00:00Z'), 'UTC')).toBe(
      '2026-01-05',
    )
  })

  test('agrees with UTC when asked for UTC', () => {
    expect(getZonedYmd(new Date('2026-09-18T23:30:00Z'), 'UTC')).toBe(
      '2026-09-18',
    )
  })
})
