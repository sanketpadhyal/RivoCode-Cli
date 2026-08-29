import { FREEBUFF_WEB_URL_PROD } from '@rivocode/common/constants/hosts'
import { env, IS_DEV } from '@rivocode/common/env'

import { IS_FREEBUFF } from '../utils/constants'

export const WEBSITE_URL = env.NEXT_PUBLIC_CODEBUFF_APP_URL

const FREEBUFF_WEB_URL = IS_DEV
  ? 'http://localhost:3002'
  : (env.NEXT_PUBLIC_FREEBUFF_APP_URL ?? FREEBUFF_WEB_URL_PROD)
export const LOGIN_WEBSITE_URL = IS_FREEBUFF ? FREEBUFF_WEB_URL : WEBSITE_URL

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
