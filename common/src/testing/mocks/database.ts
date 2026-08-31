
import { mock, spyOn } from 'bun:test'

import type { Mock } from 'bun:test'

export interface MockInsertResult<T = unknown> {
  values: Mock<(data: T | T[]) => Promise<{ id: string }>>
  returning: Mock<() => Promise<T[]>>
  onConflictDoNothing: Mock<() => MockInsertResult<T>>
  onConflictDoUpdate: Mock<
    (config: { target: unknown; set: unknown }) => MockInsertResult<T>
  >
}

export interface MockUpdateResult<T = unknown> {
  set: Mock<(data: Partial<T>) => MockUpdateSetResult>
}

export interface MockUpdateSetResult {
  where: Mock<(condition: unknown) => Promise<void>>
  returning: Mock<() => Promise<unknown[]>>
}

export interface MockSelectResult<T = unknown> {
  from: Mock<(table: unknown) => MockSelectFromResult<T>>
}

export interface MockSelectFromResult<T = unknown> {
  where: Mock<(condition: unknown) => MockSelectWhereResult<T>>
  leftJoin: Mock<
    (table: unknown, condition: unknown) => MockSelectFromResult<T>
  >
  innerJoin: Mock<
    (table: unknown, condition: unknown) => MockSelectFromResult<T>
  >
  orderBy: Mock<(...columns: unknown[]) => MockSelectFromResult<T>>
  limit: Mock<(n: number) => MockSelectFromResult<T>>
  offset: Mock<(n: number) => MockSelectFromResult<T>>
  then: Mock<(resolve: (value: T[]) => void) => Promise<T[]>>
}

export interface MockSelectWhereResult<T = unknown> {
  then: Mock<(resolve: (value: T[]) => void) => Promise<T[]>>
  leftJoin: Mock<
    (table: unknown, condition: unknown) => MockSelectWhereResult<T>
  >
  innerJoin: Mock<
    (table: unknown, condition: unknown) => MockSelectWhereResult<T>
  >
  orderBy: Mock<(...columns: unknown[]) => MockSelectWhereResult<T>>
  limit: Mock<(n: number) => MockSelectWhereResult<T>>
  offset: Mock<(n: number) => MockSelectWhereResult<T>>
}

export interface MockDeleteResult {
  where: Mock<(condition: unknown) => Promise<void>>
}

export interface MockDbOperations {
  insert: Mock<(table: unknown) => MockInsertResult>
  update: Mock<(table: unknown) => MockUpdateResult>
  select: Mock<(columns?: unknown) => MockSelectResult>
  delete: Mock<(table: unknown) => MockDeleteResult>
  transaction: Mock<<T>(fn: (tx: MockDbOperations) => Promise<T>) => Promise<T>>
}

export interface CreateMockDbOptions {
  defaultSelectData?: unknown[]

  defaultInsertId?: string
}

export function createMockDbOperations(
  options: CreateMockDbOptions = {},
): MockDbOperations {
  const { defaultSelectData = [], defaultInsertId = 'mock-id' } = options

  const createMockSelectWhereResult = <T>(
    data: T[] = defaultSelectData as T[],
  ): MockSelectWhereResult<T> => {
    const result: MockSelectWhereResult<T> = {
      then: mock((resolve) => {
        resolve(data)
        return Promise.resolve(data)
      }),
      leftJoin: mock(() => result),
      innerJoin: mock(() => result),
      orderBy: mock(() => result),
      limit: mock(() => result),
      offset: mock(() => result),
    }
    return result
  }

  const createMockSelectFromResult = <T>(
    data: T[] = defaultSelectData as T[],
  ): MockSelectFromResult<T> => {
    const whereResult = createMockSelectWhereResult(data)
    const result: MockSelectFromResult<T> = {
      where: mock(() => whereResult),
      leftJoin: mock(() => result),
      innerJoin: mock(() => result),
      orderBy: mock(() => result),
      limit: mock(() => result),
      offset: mock(() => result),
      then: mock((resolve) => {
        resolve(data)
        return Promise.resolve(data)
      }),
    }
    return result
  }

  const createMockInsertResult = <T>(): MockInsertResult<T> => {
    const result: MockInsertResult<T> = {
      values: mock(() => Promise.resolve({ id: defaultInsertId })),
      returning: mock(() => Promise.resolve([])),
      onConflictDoNothing: mock(() => result),
      onConflictDoUpdate: mock(() => result),
    }
    return result
  }

  const createMockUpdateSetResult = (): MockUpdateSetResult => ({
    where: mock(() => Promise.resolve()),
    returning: mock(() => Promise.resolve([])),
  })

  const createMockUpdateResult = <T>(): MockUpdateResult<T> => ({
    set: mock(() => createMockUpdateSetResult()),
  })

  const createMockDeleteResult = (): MockDeleteResult => ({
    where: mock(() => Promise.resolve()),
  })

  const dbOps: MockDbOperations = {
    insert: mock(() => createMockInsertResult()),
    update: mock(() => createMockUpdateResult()),
    select: mock(() => ({
      from: mock(() => createMockSelectFromResult()),
    })),
    delete: mock(() => createMockDeleteResult()),
    transaction: mock(async (fn) => fn(dbOps)),
  }

  return dbOps
}

export interface DbSpies {
  insert: ReturnType<typeof spyOn>
  update: ReturnType<typeof spyOn>
  restore: () => void
  clear: () => void
}

export function setupDbSpies(
  db: { insert: unknown; update: unknown },
  options: CreateMockDbOptions = {},
): DbSpies {
  const { defaultInsertId = 'test-run-id' } = options

  const mockInsertResult = {
    values: mock(() => Promise.resolve({ id: defaultInsertId })),
  }

  const mockUpdateResult = {
    set: mock(() => ({
      where: mock(() => Promise.resolve()),
    })),
  }

  const spyableDb = db as { insert: () => unknown; update: () => unknown }
  const insertSpy = spyOn(spyableDb, 'insert').mockReturnValue(mockInsertResult)
  const updateSpy = spyOn(spyableDb, 'update').mockReturnValue(mockUpdateResult)

  return {
    insert: insertSpy,
    update: updateSpy,
    restore: () => {
      insertSpy.mockRestore()
      updateSpy.mockRestore()
    },
    clear: () => {
      insertSpy.mockClear()
      updateSpy.mockClear()
    },
  }
}

export function createMockQueryResult<T>(data: T[]): Promise<T[]> & {
  where: Mock<() => Promise<T[]>>
  orderBy: Mock<() => Promise<T[]>>
  limit: Mock<() => Promise<T[]>>
} {
  const promise = Promise.resolve(data) as Promise<T[]> & {
    where: Mock<() => Promise<T[]>>
    orderBy: Mock<() => Promise<T[]>>
    limit: Mock<() => Promise<T[]>>
  }

  promise.where = mock(() => promise)
  promise.orderBy = mock(() => promise)
  promise.limit = mock(() => promise)

  return promise
}
