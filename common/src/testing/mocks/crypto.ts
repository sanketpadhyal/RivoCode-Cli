
import { spyOn } from 'bun:test'

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export interface SetupCryptoMocksOptions {
  prefix?: string

  sequential?: boolean

  uuids?: UUID[]
}

export interface CryptoMockSpies {
  randomUUID: ReturnType<typeof spyOn>
  restore: () => void
  clear: () => void
  getCallCount: () => number
}

export function createMockUuid(prefix: string, index?: number): UUID {
  const indexStr =
    index !== undefined ? String(index).padStart(12, '0') : '000000000000'
  return `${prefix}-0000-0000-0000-${indexStr}` as UUID
}

export function setupCryptoMocks(
  options: SetupCryptoMocksOptions = {},
): CryptoMockSpies {
  const { prefix = 'mock-uuid', sequential = false, uuids = [] } = options

  let callCount = 0

  const randomUUIDSpy = spyOn(crypto, 'randomUUID').mockImplementation(() => {
    const currentIndex = callCount
    callCount++

    if (currentIndex < uuids.length) {
      return uuids[currentIndex]
    }

    if (sequential) {
      return createMockUuid(prefix, currentIndex)
    }

    return createMockUuid(prefix)
  })

  return {
    randomUUID: randomUUIDSpy,
    restore: () => {
      randomUUIDSpy.mockRestore()
    },
    clear: () => {
      callCount = 0
      randomUUIDSpy.mockClear()
    },
    getCallCount: () => callCount,
  }
}

export function setupSequentialCryptoMocks(uuids: UUID[]): CryptoMockSpies {
  return setupCryptoMocks({ uuids, sequential: true })
}

export const TEST_UUIDS = {
  USER: 'test-user-0000-0000-000000000001' as UUID,
  SESSION: 'test-sess-0000-0000-000000000001' as UUID,
  RUN: 'test-run0-0000-0000-000000000001' as UUID,
  STEP: 'test-step-0000-0000-000000000001' as UUID,
  MESSAGE: 'test-msg0-0000-0000-000000000001' as UUID,
  AGENT: 'test-agnt-0000-0000-000000000001' as UUID,
} as const

export function createUuidGenerator(prefix: string): () => UUID {
  let index = 0
  return () => {
    const uuid = createMockUuid(prefix, index)
    index++
    return uuid
  }
}
