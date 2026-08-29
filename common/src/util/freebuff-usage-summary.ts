import { FREEBUFF_USAGE_MAP_DAYS } from '../constants/freebuff-models'

import {
  addDaysToDateKey,
  calculateFreebuffStreak,
  FREEBUFF_STREAK_TIME_ZONE,
} from './freebuff-streak'

import type {
  FreebuffRecentUsage,
  FreebuffUsageSessionsByModel,
  FreebuffUsageSummary,
} from '../types/freebuff-usage'

export function calculateLongestFreebuffStreak(
  dateKeys: readonly string[],
): number {
  const sorted = [...new Set(dateKeys)].sort()
  let longest = 0
  let run = 0
  let previous: string | null = null

  for (const dateKey of sorted) {
    run =
      previous !== null && addDaysToDateKey(previous, 1) === dateKey ? run + 1 : 1
    previous = dateKey
    if (run > longest) longest = run
  }

  return longest
}

export function buildFreebuffUsageSummary(params: {
  activeDates: readonly string[]
  todayDateKey: string
  recent?: FreebuffRecentUsage | null
  sessionsByModel?: readonly FreebuffUsageSessionsByModel[]
  windowDays?: number
  timeZone?: string
}): FreebuffUsageSummary {
  const windowDays = Math.max(1, params.windowDays ?? FREEBUFF_USAGE_MAP_DAYS)
  const todayDateKey = params.todayDateKey

  const allDates = [...new Set(params.activeDates)]
    .filter((date) => date <= todayDateKey)
    .sort()

  const windowStart = addDaysToDateKey(todayDateKey, -(windowDays - 1))
  const { streak, todayUsed, lastUsageDate } = calculateFreebuffStreak({
    usageDates: allDates,
    todayDateKey,
  })

  return {
    timeZone: params.timeZone ?? FREEBUFF_STREAK_TIME_ZONE,
    todayDateKey,
    streak: {
      current: streak,
      longest: calculateLongestFreebuffStreak(allDates),
      todayUsed,
      lastUsageDate,
    },
    activeDates: allDates.filter((date) => date >= windowStart),
    windowDays,
    allTimeActiveDays: allDates.length,
    recent: params.recent ?? null,
    sessionsByModel: [...(params.sessionsByModel ?? [])],
  }
}

export type FreebuffUsageCell =
  | { date: string; active: boolean }
  | null

export function buildFreebuffUsageGrid(params: {
  activeDates: readonly string[]
  todayDateKey: string
  windowDays: number
  todayWeekday: number
}): FreebuffUsageCell[] {
  const active = new Set(params.activeDates)
  const cells: FreebuffUsageCell[] = []

  const trailingPad = 6 - params.todayWeekday
  const start = addDaysToDateKey(params.todayDateKey, -(params.windowDays - 1))
  const leadingPad = (7 - ((params.windowDays + trailingPad) % 7)) % 7

  for (let index = 0; index < leadingPad; index++) cells.push(null)
  for (let index = 0; index < params.windowDays; index++) {
    const date = addDaysToDateKey(start, index)
    cells.push({ date, active: active.has(date) })
  }
  for (let index = 0; index < trailingPad; index++) cells.push(null)

  return cells
}
