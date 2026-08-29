
import { getCliEnv } from './env'

import type { CliEnv } from '../types/env'

export type TerminalImageProtocol = 'iterm2' | 'kitty' | 'sixel' | 'none'

let cachedProtocol: TerminalImageProtocol | null = null

export function detectTerminalImageSupport(
  env: CliEnv = getCliEnv(),
): TerminalImageProtocol {
  if (cachedProtocol !== null) {
    return cachedProtocol
  }

  if (env.TERM_PROGRAM === 'iTerm.app') {
    cachedProtocol = 'iterm2'
    return cachedProtocol
  }

  if (
    env.TERM === 'xterm-kitty' ||
    env.KITTY_WINDOW_ID !== undefined
  ) {
    cachedProtocol = 'kitty'
    return cachedProtocol
  }

  if (
    env.TERM?.includes('sixel') ||
    env.SIXEL_SUPPORT === 'true'
  ) {
    cachedProtocol = 'sixel'
    return cachedProtocol
  }

  cachedProtocol = 'none'
  return cachedProtocol
}

export function supportsInlineImages(): boolean {
  return detectTerminalImageSupport() !== 'none'
}

function generateITerm2ImageSequence(
  base64Data: string,
  options: {
    width?: number | string
    height?: number | string
    preserveAspectRatio?: boolean
    inline?: boolean
    name?: string
  } = {},
): string {
  const {
    width = 'auto',
    height = 'auto',
    preserveAspectRatio = true,
    inline = true,
    name,
  } = options

  const params: string[] = []

  if (inline) {
    params.push('inline=1')
  }

  if (width !== 'auto') {
    params.push(`width=${width}`)
  }

  if (height !== 'auto') {
    params.push(`height=${height}`)
  }

  if (!preserveAspectRatio) {
    params.push('preserveAspectRatio=0')
  }

  if (name) {
    params.push(`name=${Buffer.from(name).toString('base64')}`)
  }

  params.push(`size=${base64Data.length}`)

  const paramString = params.join(';')

  return `\x1b]1337;File=${paramString}:${base64Data}\x07`
}

function generateKittyImageSequence(
  base64Data: string,
  options: {
    width?: number
    height?: number
    id?: number
  } = {},
): string {
  const { width, height, id } = options

  const kvPairs: string[] = [
    'a=T',
    'f=100',
    't=d',
  ]

  if (width) {
    kvPairs.push(`c=${width}`)
  }

  if (height) {
    kvPairs.push(`r=${height}`)
  }

  if (id) {
    kvPairs.push(`i=${id}`)
  }

  const controlData = kvPairs.join(',')

  const CHUNK_SIZE = 4096

  if (base64Data.length <= CHUNK_SIZE) {
    return `\x1b_G${controlData};${base64Data}\x1b\\`
  }

  const chunks: string[] = []
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    const chunk = base64Data.slice(i, i + CHUNK_SIZE)
    const isLast = i + CHUNK_SIZE >= base64Data.length
    const chunkControl = isLast ? controlData : `${controlData},m=1`
    chunks.push(`\x1b_G${chunkControl};${chunk}\x1b\\`)
  }

  return chunks.join('')
}

export function renderInlineImage(
  base64Data: string,
  options: {
    width?: number
    height?: number
    filename?: string
  } = {},
): string | null {
  const protocol = detectTerminalImageSupport()

  switch (protocol) {
    case 'iterm2':
      return generateITerm2ImageSequence(base64Data, {
        width: options.width,
        height: options.height,
        name: options.filename,
      })

    case 'kitty':
      return generateKittyImageSequence(base64Data, {
        width: options.width,
        height: options.height,
      })

    case 'sixel':
      return null

    case 'none':
    default:
      return null
  }
}

export function getImageSupportDescription(): string {
  const protocol = detectTerminalImageSupport()

  switch (protocol) {
    case 'iterm2':
      return 'iTerm2 inline images'
    case 'kitty':
      return 'Kitty graphics protocol'
    case 'sixel':
      return 'Sixel graphics'
    case 'none':
      return 'No inline image support'
  }
}
