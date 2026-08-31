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
    id: 'help',
    label: 'help',
    description: 'Display keyboard shortcuts and tips',
    aliases: ['h', '?'],
    implicitCommand: true,
  },
  {
    id: 'diagnostics',
    label: 'diagnostics',
    description: 'Show local CLI resource usage and terminal tool process IDs',
    aliases: ['diag', 'processes'],
  },
  {
    id: 'ads:enable',
    label: 'ads:enable',
    description: 'Enable contextual ads',
  },
  {
    id: 'ads:disable',
    label: 'ads:disable',
    description: 'Disable contextual ads',
  },
  {
    id: 'init',
    label: 'init',
    description: 'Create a starter knowledge.md file',
    implicitCommand: true,
  },
  {
    id: 'usage',
    label: 'usage',
    description: 'View credits and subscription quota',
    aliases: ['credits'],
  },
  {
    id: 'subscribe',
    label: 'subscribe',
    description: 'Subscribe to get more usage',
    aliases: ['strong', 'sub', 'buy-credits'],
  },
  {
    id: 'interview',
    label: 'interview',
    description: 'AI asks a series of questions to flesh out request into a spec',
  },
  {
    id: 'plan',
    label: 'plan',
    description: 'Create a plan for how to implement a request',
  },
  {
    id: 'review',
    label: 'review',
    description: 'Review code changes',
  },
  {
    id: 'queue',
    label: 'queue',
    description: 'Edit, reorder, or delete the messages waiting to be sent',
    aliases: ['queued'],
  },
  {
    id: 'new',
    label: 'new',
    description: 'Clear the conversation history and start a new chat',
    aliases: ['n', 'clear', 'c', 'reset'],
    implicitCommand: true,
  },
  {
    id: 'history',
    label: 'history',
    description: 'Browse and resume past conversations',
    aliases: ['chats'],
  },
  {
    id: 'copy',
    label: 'copy',
    description: 'Copy the full conversation (messages + tool results) to the clipboard',
    aliases: ['copy-chat', 'export'],
  },
  {
    id: 'agent:gpt-5',
    label: 'agent:gpt-5',
    description: 'Spawn the GPT-5 agent to help solve complex problems',
    insertText: '@GPT-5 Agent ',
  },
  {
    id: 'feedback',
    label: 'feedback',
    description: 'Share general feedback about RivoCode',
  },
  {
    id: 'bash',
    label: 'bash',
    description: 'Enter bash mode ("!" at beginning enters bash mode)',
    aliases: ['!'],
  },
  {
    id: 'image',
    label: 'image',
    description: 'Attach an image file (or Ctrl+V to paste from clipboard)',
    aliases: ['img', 'attach'],
  },
  ...MODE_COMMANDS,
  {
    id: 'theme:toggle',
    label: 'theme:toggle',
    description: 'Toggle between light and dark mode',
  },
  {
    id: 'logout',
    label: 'logout',
    description: 'Sign out of your session',
    aliases: ['signout'],
    implicitCommand: true,
  },
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

const SKILL_MENU_DESCRIPTION_MAX_LENGTH = 50

function truncateDescription(description: string): string {
  if (description.length <= SKILL_MENU_DESCRIPTION_MAX_LENGTH) {
    return description
  }
  return description.slice(0, SKILL_MENU_DESCRIPTION_MAX_LENGTH - 1) + '…'
}

export function getSlashCommandsWithSkills(skills: SkillsMap): SlashCommand[] {
  const skillCommands: SlashCommand[] = Object.values(skills).map((skill) => ({
    id: `skill:${skill.name}`,
    label: `skill:${skill.name}`,
    description: truncateDescription(skill.description),
    insertText: `/skill:${skill.name} `,
  }))

  const commands = [...SLASH_COMMANDS, ...skillCommands]

  return commands
}
