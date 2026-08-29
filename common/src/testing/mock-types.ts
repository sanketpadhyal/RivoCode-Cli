
import { mock } from 'bun:test'

import type { Logger } from '../types/contracts/logger'

export interface MockUserInfo {
  id: string
}

export interface MockCreditResult {
  success: boolean
  value: { chargedToOrganization: boolean }
}

export interface MockStatResult {
  isDirectory: () => boolean
  isFile: () => boolean
}

export type MockLogger = {
  [K in keyof Logger]: ReturnType<typeof mock> & Logger[K]
}

export function createMockLogger(): MockLogger {
  return {
    info: mock(() => {}) as ReturnType<typeof mock> & Logger['info'],
    error: mock(() => {}) as ReturnType<typeof mock> & Logger['error'],
    warn: mock(() => {}) as ReturnType<typeof mock> & Logger['warn'],
    debug: mock(() => {}) as ReturnType<typeof mock> & Logger['debug'],
  }
}

export function createMockStatResult(options: {
  isDirectory?: boolean
  isFile?: boolean
}): MockStatResult {
  return {
    isDirectory: () => options.isDirectory ?? false,
    isFile: () => options.isFile ?? false,
  }
}

export function createMockCreditResult(
  options: {
    success?: boolean
    chargedToOrganization?: boolean
  } = {},
): MockCreditResult {
  return {
    success: options.success ?? true,
    value: { chargedToOrganization: options.chargedToOrganization ?? false },
  }
}
