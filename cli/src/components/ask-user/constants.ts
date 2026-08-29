export const SYMBOLS = {
  SELECTED: '●',

  UNSELECTED: '○',

  COMPLETED: '✓',

  CURRENT: '●',

  CHECKBOX_CHECKED: '☑',

  CHECKBOX_UNCHECKED: '☐',
} as const

export type AskUserOption = string | { label: string; description?: string }

export const getOptionLabel = (option: AskUserOption): string => {
  return typeof option === 'string' ? option : option?.label ?? ''
}

export const CUSTOM_OPTION_INDEX: number = -1

export const KEYBOARD_HINTS = [
  '↑↓ navigate •',
  'Enter select',
] as const
