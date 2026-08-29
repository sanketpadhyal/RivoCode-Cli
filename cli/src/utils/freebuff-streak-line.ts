export {
  FREEBUFF_STREAK_WEEK,
  getFreebuffStreakBonusNote,
} from '@rivocode/common/util/freebuff-streak-line'
export type { FreebuffStreakLine } from '@rivocode/common/util/freebuff-streak-line'

import {
  FREEBUFF_STREAK_WEEK,
  getFreebuffStreakBonusNote,
  getFreebuffStreakLine as getSharedFreebuffStreakLine,
} from '@rivocode/common/util/freebuff-streak-line'

import type { FreebuffStreakLine } from '@rivocode/common/util/freebuff-streak-line'

const FREEBUFF_STREAK_BONUS_MIN_HEIGHT = 30

export const FREEBUFF_STREAK_LABEL_GAP = 2

export const FREEBUFF_STREAK_INLINE_GAP = 3

const TERMINAL_DOT_CHARS = { filled: '●', empty: '○' }

export function getFreebuffStreakLine(
  streak: number,
): FreebuffStreakLine | null {
  return getSharedFreebuffStreakLine(streak, TERMINAL_DOT_CHARS)
}

export function getFreebuffStreakInlineWidth(line: FreebuffStreakLine): number {
  return line.label.length + FREEBUFF_STREAK_LABEL_GAP + line.dots.length
}

const DAY_ONE_LINE = getFreebuffStreakLine(1)!

export function fitsFreebuffStreakOnHeadingRow(params: {
  line: FreebuffStreakLine | null
  headingWidth: number
  availableWidth: number
}): boolean {
  return (
    params.headingWidth +
      FREEBUFF_STREAK_INLINE_GAP +
      getFreebuffStreakInlineWidth(params.line ?? DAY_ONE_LINE) <=
    params.availableWidth
  )
}

export function getFreebuffStreakBonusNoteForLayout(params: {
  streak: number
  accessTier: 'full' | 'limited'
  terminalHeight: number
  availableWidth: number
}): string | null {
  if (params.streak < FREEBUFF_STREAK_WEEK) return null
  if (params.terminalHeight < FREEBUFF_STREAK_BONUS_MIN_HEIGHT) return null

  const note = getFreebuffStreakBonusNote(params)
  if (!note || note.length > params.availableWidth) return null

  return note
}
