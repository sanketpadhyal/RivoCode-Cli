export type ThemeName = 'dark' | 'light'

export type MarkdownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type ThemeColor = string

export interface MarkdownThemeOverrides {
  codeBackground?: string
  codeHeaderFg?: string
  inlineCodeFg?: string
  codeTextFg?: string
  headingFg?: Partial<Record<MarkdownHeadingLevel, string>>
  listBulletFg?: string
  blockquoteBorderFg?: string
  blockquoteTextFg?: string
  dividerFg?: string
  codeMonochrome?: boolean
  linkFg?: string
}

export interface ChatTheme {
  name: ThemeName

  primary: string

  secondary: string

  success: string

  error: string

  warning: string

  info: string

  link: string

  directory: string

  foreground: ThemeColor

  background: string

  muted: ThemeColor

  border: string

  surface: string

  surfaceHover: string

  aiLine: string

  userLine: string

  agentToggleHeaderBg: string

  agentToggleExpandedBg: string

  agentFocusedBg: string

  agentContentBg: string
  inputFg: ThemeColor

  inputFocusedFg: ThemeColor

  modeFastBg: string

  modeFastText: string

  modeMaxBg: string

  modeMaxText: string

  modePlanBg: string

  modePlanText: string

  imageCardBorder: string

  markdown?: MarkdownThemeOverrides

  messageTextAttributes?: number
}
