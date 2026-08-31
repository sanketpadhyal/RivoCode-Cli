import { env } from '@rivocode/common/env'

export const WEBSITE_URL = env.NEXT_PUBLIC_CODEBUFF_APP_URL
export const LOGIN_WEBSITE_URL = WEBSITE_URL

const LOGO_RIVOCODE = `
  ██████╗ ██╗██╗   ██╗ ██████╗  ██████╗ ██████╗ ██████╗ ███████╗
  ██╔══██╗██║██║   ██║██╔═══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
  ██████╔╝██║██║   ██║██║   ██║██║     ██║   ██║██║  ██║█████╗  
  ██╔══██╗██║╚██╗ ██╔╝██║   ██║██║     ██║   ██║██║  ██║██╔══╝  
  ██║  ██║██║ ╚████╔╝ ╚██████╔╝╚██████╗╚██████╔╝██████╔╝███████╗
  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
`

const LOGO_SMALL_RIVOCODE = `
  ██████╗  ██████╗
  ██╔══██╗██╔════╝
  ██████╔╝██║     
  ██╔══██╗██║     
  ██║  ██║╚██████╗
  ╚═╝  ╚═╝ ╚═════╝
`

export const LOGO = LOGO_RIVOCODE
export const LOGO_SMALL = LOGO_SMALL_RIVOCODE

export const SHADOW_CHARS = new Set([
  '╚',
  '═',
  '╝',
  '║',
  '╔',
  '╗',
  '╠',
  '╣',
  '╦',
  '╩',
  '╬',
])

export const DEFAULT_TERMINAL_HEIGHT = 24
export const MODAL_VERTICAL_MARGIN = 2
export const MAX_MODAL_BASE_HEIGHT = 22
export const WARNING_BANNER_HEIGHT = 3

export const SHEEN_WIDTH = 5
export const SHEEN_STEP = 2
export const SHEEN_INTERVAL_MS = 150
