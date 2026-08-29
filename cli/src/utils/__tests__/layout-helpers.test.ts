import { describe, expect, test } from 'bun:test'

import { computeSmartColumns } from '../layout-helpers'

describe('computeSmartColumns', () => {
  test('uses item count if less than max columns', () => {
    expect(computeSmartColumns(1, 3)).toBe(1)
    expect(computeSmartColumns(2, 3)).toBe(2)
    expect(computeSmartColumns(3, 3)).toBe(3)
  })

  test('uses max columns if divisible', () => {
    expect(computeSmartColumns(6, 3)).toBe(3)
    expect(computeSmartColumns(9, 3)).toBe(3)
    expect(computeSmartColumns(8, 4)).toBe(4)
  })

  test('handles 4 items on 3 column screen (2x2)', () => {
    expect(computeSmartColumns(4, 3)).toBe(2)
  })

  test('handles prime numbers by maximizing width', () => {
    expect(computeSmartColumns(5, 3)).toBe(3)
    expect(computeSmartColumns(7, 4)).toBe(4)
  })

  test('handles 4 items on 4 column screen', () => {
    expect(computeSmartColumns(4, 4)).toBe(4)
  })

  test('handles large counts', () => {
    expect(computeSmartColumns(10, 4)).toBe(2)
  })
})
