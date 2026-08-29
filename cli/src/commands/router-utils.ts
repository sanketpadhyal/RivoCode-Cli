import { SLASHLESS_COMMAND_IDS } from '../data/slash-commands'

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/')
}

export function parseCommand(input: string): string {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    return ''
  }
  const normalized = trimmed.slice(1)
  const firstWord = normalized.split(/\s+/)[0] || ''
  return firstWord.toLowerCase()
}

export type ParsedCommandInput = {
  command: string
  args: string
  implicitCommand: boolean
}

export function parseCommandInput(input: string): ParsedCommandInput | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) {
    const command = parseCommand(trimmed)
    if (!command) return null
    const args = trimmed.slice(1 + command.length).trim()
    return { command, args, implicitCommand: false }
  }

  if (/\s/.test(trimmed)) {
    return null
  }

  const normalized = trimmed.toLowerCase()
  if (!SLASHLESS_COMMAND_IDS.has(normalized)) {
    return null
  }

  return { command: normalized, args: '', implicitCommand: true }
}
