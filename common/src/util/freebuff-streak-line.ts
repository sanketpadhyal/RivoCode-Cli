import { FREEBUFF_STREAK_REWARDS_ENABLED } from '../constants/freebuff-models'
import {
  getFreebuffStreakGlmWeeklyUnits,
  isFreebuffStreakGlmBonusActive,
} from './freebuff-streak'

export const FREEBUFF_STREAK_WEEK = 7

export interface FreebuffStreakLine {
  label: string
  dots: string
  progress: { filled: number; total: number; beyond: boolean }
}

export interface FreebuffStreakDotChars {
  filled: string
  empty: string
}

export function getFreebuffStreakLine(
  streak: number,
  chars: FreebuffStreakDotChars = { filled: '●', empty: '○' },
): FreebuffStreakLine | null {
  if (streak <= 0) return null

  const filled = Math.min(streak, FREEBUFF_STREAK_WEEK)
  const beyond = streak > FREEBUFF_STREAK_WEEK
  const dots =
    chars.filled.repeat(filled) +
    chars.empty.repeat(FREEBUFF_STREAK_WEEK - filled) +
    (beyond ? '+' : '')

  return {
    label: `${streak} day streak`,
    dots,
    progress: { filled, total: FREEBUFF_STREAK_WEEK, beyond },
  }
}

export function getFreebuffStreakBonusNote(params: {
  streak: number
  accessTier: 'full' | 'limited'
}): string | null {
  if (!FREEBUFF_STREAK_REWARDS_ENABLED) return null
  if (params.streak <= 0) return null
  const includesGlm =
    params.accessTier === 'full' && isFreebuffStreakGlmBonusActive()
  const glmDaily = Math.max(1, getFreebuffStreakGlmWeeklyUnits(params.streak))
  const perk = includesGlm
    ? `+1 bonus session every day + ${glmDaily} GLM 5.2 ${glmDaily === 1 ? 'session' : 'sessions'} each day`
    : '+1 bonus session every day'

  if (params.streak < FREEBUFF_STREAK_WEEK) {
    const remaining = FREEBUFF_STREAK_WEEK - params.streak
    return `🎁 ${remaining} more ${remaining === 1 ? 'day' : 'days'} to unlock ${perk}`
  }
  return `🎁 Streak perk: ${perk}`
}
