import { Queue } from './arrays'
import { getCliEnv } from './env'
import { clamp } from './math'

import type { CliEnv } from '../types/env'
import type { ScrollAcceleration } from '@opentui/core'

const ENVIRONMENT_TYPE_VARS = [
  'TERM_PROGRAM',
  'TERMINAL_EMULATOR',
  'TERM',
  'EDITOR',
  'ZED_TERM',
  'ZED_SHELL',
] as const

const ENVIRONMENTS = ['zed', 'ghostty', 'vscode'] as const

type ScrollEnvironmentType = (typeof ENVIRONMENTS)[number] | 'default'

const ENV_MULTIPLIERS = {
  zed: 0.5,
  ghostty: 1,
  vscode: 1,
  default: 1,
} satisfies Record<ScrollEnvironmentType, number>

type ScrollEnvironment = {
  type: ScrollEnvironmentType
  multiplier: number
}

const resolveScrollEnvironment = (
  env: CliEnv = getCliEnv(),
): ScrollEnvironment => {
  let multiplier = parseFloat(env.CODEBUFF_SCROLL_MULTIPLIER ?? '')

  if (Number.isNaN(multiplier)) {
    multiplier = 1
  }

  for (const hintVar of ENVIRONMENT_TYPE_VARS) {
    const value = env[hintVar]
    for (const environment of ENVIRONMENTS) {
      if (value?.includes(environment)) {
        return { type: environment, multiplier }
      }
    }
  }

  return { type: 'default', multiplier }
}

type ConstantScrollAccelOptions = {
  multiplier?: number
}

export class ConstantScrollAccel implements ScrollAcceleration {
  private multiplier: number
  private buffer: number

  constructor(private opts: ConstantScrollAccelOptions = {}) {
    this.buffer = 0
    this.multiplier = opts.multiplier ?? 1
  }

  tick(): number {
    this.buffer += this.multiplier
    const rows =
      this.buffer > 0 ? Math.floor(this.buffer) : Math.ceil(this.buffer)
    this.buffer -= rows
    return rows
  }

  reset(): void {
    this.buffer = 0
  }
}

type LinearScrollAccelOptions = {
  multiplier?: number

  maxRows?: number

  rollingWindowMs?: number
}

export class LinearScrollAccel implements ScrollAcceleration {
  private rollingWindowMs: number
  private multiplier: number
  private maxRows: number
  private tickHistory: Queue<number>
  private buffer: number

  constructor(private opts: LinearScrollAccelOptions = {}) {
    this.rollingWindowMs = opts.rollingWindowMs ?? 100
    this.multiplier = opts.multiplier ?? 0.3
    this.maxRows = opts.maxRows ?? Infinity
    this.tickHistory = new Queue<number>(undefined, 100)
    this.buffer = 0
  }

  tick(now = Date.now()): number {
    this.tickHistory.enqueue(now)

    let oldestTick = this.tickHistory.peek() ?? now
    while (oldestTick < now - this.rollingWindowMs) {
      this.tickHistory.dequeue()
      oldestTick = this.tickHistory.peek() ?? now
    }

    this.buffer += clamp(
      this.tickHistory.length * this.multiplier,
      -this.maxRows,
      this.maxRows,
    )
    const rows = Math.floor(this.buffer)
    this.buffer -= rows
    return rows
  }

  reset(): void {
    this.tickHistory.clear()
    this.buffer = 0
  }
}

export const createChatScrollAcceleration = (): ScrollAcceleration => {
  const environment = resolveScrollEnvironment()

  return new ConstantScrollAccel({
    multiplier: ENV_MULTIPLIERS[environment.type] * environment.multiplier,
  })
}
