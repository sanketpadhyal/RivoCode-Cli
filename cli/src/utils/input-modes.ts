export type InputMode =
  | 'default'
  | 'bash'
  | 'homeDir'
  | 'plan'
  | 'review'
  | 'interview'
  | 'usage'
  | 'image'
  | 'help'
  | 'outOfCredits'
  | 'subscriptionLimit'

export type ThemeColorKey =
  | 'foreground'
  | 'background'
  | 'error'
  | 'warning'
  | 'success'
  | 'info'
  | 'muted'
  | 'imageCardBorder'
  | 'link'

export type InputModeConfig = {
  icon: string | null
  label: string | null
  color: ThemeColorKey
  placeholder: string
  widthAdjustment: number
  showAgentModeToggle: boolean
  disableSlashSuggestions: boolean
  blockKeyboardExit: boolean
}

export const INPUT_MODE_CONFIGS: Record<InputMode, InputModeConfig> = {
  default: {
    icon: null,
    label: null,
    color: 'foreground',
    placeholder: 'enter a coding task or / for commands',
    widthAdjustment: 0,
    showAgentModeToggle: true,
    disableSlashSuggestions: false,
    blockKeyboardExit: false,
  },
  bash: {
    icon: null,
    label: '!',
    color: 'info',
    placeholder: 'enter bash command...',
    widthAdjustment: 4,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: false,
  },
  homeDir: {
    icon: null,
    label: null,
    color: 'warning',
    placeholder: 'enter a coding task or / for commands',
    widthAdjustment: 0,
    showAgentModeToggle: true,
    disableSlashSuggestions: false,
    blockKeyboardExit: false,
  },
  interview: {
    icon: null,
    label: 'Interview',
    color: 'info',
    placeholder: 'describe a feature/bug or other request to be fleshed out...',
    widthAdjustment: 12,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: false,
  },
  plan: {
    icon: null,
    label: 'Plan',
    color: 'info',
    placeholder: 'describe what you want to plan...',
    widthAdjustment: 7,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: false,
  },
  review: {
    icon: null,
    label: 'Review',
    color: 'info',
    placeholder: 'describe what to review...',
    widthAdjustment: 9,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: false,
  },
  usage: {
    icon: null,
    label: null,
    color: 'foreground',
    placeholder: 'enter a coding task or / for commands',
    widthAdjustment: 0,
    showAgentModeToggle: true,
    disableSlashSuggestions: false,
    blockKeyboardExit: false,
  },
  image: {
    icon: '📎',
    label: null,
    color: 'imageCardBorder',
    placeholder: 'enter image path or Ctrl+V to paste',
    widthAdjustment: 3,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: false,
  },
  help: {
    icon: null,
    label: null,
    color: 'info',
    placeholder: 'enter a coding task or / for commands',
    widthAdjustment: 0,
    showAgentModeToggle: true,
    disableSlashSuggestions: false,
    blockKeyboardExit: false,
  },
  outOfCredits: {
    icon: null,
    label: null,
    color: 'warning',
    placeholder: '',
    widthAdjustment: 0,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: false,
  },
  subscriptionLimit: {
    icon: null,
    label: null,
    color: 'warning',
    placeholder: '',
    widthAdjustment: 0,
    showAgentModeToggle: false,
    disableSlashSuggestions: true,
    blockKeyboardExit: true,
  },
}

export function getInputModeConfig(mode: InputMode): InputModeConfig {
  return INPUT_MODE_CONFIGS[mode]
}
