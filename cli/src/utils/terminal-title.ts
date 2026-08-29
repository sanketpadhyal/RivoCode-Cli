
import { IS_FREEBUFF } from './constants'
import { getCliEnv } from './env'
import { writeTerminalControlSync } from './terminal-io'

const MAX_TITLE_LENGTH = 60
const TITLE_PREFIX = IS_FREEBUFF ? 'Freebuff: ' : 'Codebuff: '
const OSC_TERMINATOR = '\x07'

function isInTmux(env: ReturnType<typeof getCliEnv>): boolean {
  return Boolean(env.TMUX)
}

function isInScreen(env: ReturnType<typeof getCliEnv>): boolean {
  if (env.STY) return true
  const term = env.TERM ?? ''
  return term.startsWith('screen') && !isInTmux(env)
}

function buildTitleSequence(title: string, env: ReturnType<typeof getCliEnv>): string {
  const osc = `\x1b]0;${title}${OSC_TERMINATOR}`

  if (isInTmux(env)) {
    const escaped = osc.replace(/\x1b/g, '\x1b\x1b')
    return `\x1bPtmux;${escaped}\x1b\\`
  }

  if (isInScreen(env)) {
    return `\x1bP${osc}\x1b\\`
  }

  return osc
}

export function setTerminalTitle(title: string): void {
  const sanitized = title.replace(/[\x00-\x1f\x7f]/g, ' ').trim()
  if (!sanitized) return

  const maxInputLength = MAX_TITLE_LENGTH - TITLE_PREFIX.length
  const truncated =
    sanitized.length > maxInputLength
      ? sanitized.slice(0, maxInputLength - 1) + '…'
      : sanitized

  const fullTitle = `${TITLE_PREFIX}${truncated}`
  const env = getCliEnv()
  const sequence = buildTitleSequence(fullTitle, env)

  writeTerminalControlSync(sequence)
}

export function resetTerminalTitle(): void {
  const env = getCliEnv()
  const sequence = buildTitleSequence('', env)
  writeTerminalControlSync(sequence)
}
