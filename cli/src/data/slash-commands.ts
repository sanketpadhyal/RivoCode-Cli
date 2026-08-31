import { AGENT_MODES } from '../utils/constants'

import type { SkillsMap } from '@rivocode/common/types/skill'

export interface SlashCommand {
  id: string
  label: string
  description: string
  aliases?: string[]
  implicitCommand?: boolean
  insertText?: string
}

const MODE_COMMANDS: SlashCommand[] = AGENT_MODES.map((mode) => ({
  id: `mode:${mode.toLowerCase()}`,
  label: `mode:${mode.toLowerCase()}`,
  description: `Switch to ${mode} mode`,
  aliases: [`model:${mode.toLowerCase()}`],
}))

const ALL_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'copy',
    label: 'copy',
    description: 'Copy the full conversation (messages + tool results) to the clipboard',
    aliases: ['copy-chat', 'export'],
  },
  ...MODE_COMMANDS,
  {
    id: 'exit',
    label: 'exit',
    description: 'Quit the CLI',
    aliases: ['quit', 'q'],
    implicitCommand: true,
  },
]

export const SLASH_COMMANDS = ALL_SLASH_COMMANDS

export const SLASHLESS_COMMAND_IDS = new Set(
  SLASH_COMMANDS.filter((cmd) => cmd.implicitCommand).map((cmd) =>
    cmd.id.toLowerCase(),
  ),
)

export function getSlashCommandsWithSkills(_skills?: SkillsMap): SlashCommand[] {
  return SLASH_COMMANDS
}
