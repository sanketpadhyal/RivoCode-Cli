import { describe, expect, test } from 'bun:test'

import { SLASH_COMMANDS, getSlashCommandsWithSkills } from './slash-commands'

describe('slash commands', () => {
  test('returns standard slash commands', () => {
    const commands = getSlashCommandsWithSkills()
    expect(commands.find((c) => c.id === 'copy')).toBeDefined()
    expect(commands.find((c) => c.id === 'mode:default')).toBeDefined()
    expect(commands.find((c) => c.id === 'exit')).toBeDefined()
  })

  test('does not contain removed commands', () => {
    const ids = SLASH_COMMANDS.map((c) => c.id)
    expect(ids).not.toContain('help')
    expect(ids).not.toContain('feedback')
    expect(ids).not.toContain('interview')
    expect(ids).not.toContain('plan')
    expect(ids).not.toContain('review')
    expect(ids).not.toContain('queue')
    expect(ids).not.toContain('new')
    expect(ids).not.toContain('history')
    expect(ids).not.toContain('agent:gpt-5')
    expect(ids).not.toContain('theme:toggle')
  })
})

