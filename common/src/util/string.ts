import { sumBy } from 'lodash'

export const truncateString = (str: string, maxLength: number) => {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength) + '...'
}

export const truncateStringWithMessage = ({
  str,
  maxLength,
  message = 'TRUNCATED DUE TO LENGTH',
  remove = 'END',
}: {
  str: string
  maxLength: number
  message?: string
  remove?: 'END' | 'START' | 'MIDDLE'
}) => {
  if (str.length <= maxLength) {
    return str
  }

  if (remove === 'END') {
    const suffix = `\n[${message}...]`
    return str.slice(0, maxLength - suffix.length) + suffix
  }
  if (remove === 'START') {
    const prefix = `[...${message}]\n`
    return prefix + str.slice(str.length - maxLength + prefix.length)
  }

  const middle = `\n[...${message}...]\n`
  const length = Math.floor((maxLength - middle.length) / 2)
  return str.slice(0, length) + middle + str.slice(-length)
}

export const isWhitespace = (character: string) => /\s/.test(character)

export const randBoolFromStr = (str: string) => {
  return sumBy(str.split(''), (char) => char.charCodeAt(0)) % 2 === 0
}

const IRREGULAR_PLURALS: Record<string, string> = {
  person: 'people',
  child: 'children',
  man: 'men',
  woman: 'women',
  mouse: 'mice',
  index: 'indices',
  vertex: 'vertices',
  matrix: 'matrices',
  appendix: 'appendices',
  datum: 'data',
  medium: 'media',
  criterion: 'criteria',
  phenomenon: 'phenomena',
  stimulus: 'stimuli',
  radius: 'radii',
  focus: 'foci',
  cactus: 'cacti',
  nucleus: 'nuclei',
  syllabus: 'syllabi',
}

const UNCHANGING_PLURALS = new Set([
  'data',
  'metadata',
  'info',
  'feedback',
  'news',
  'series',
  'species',
  'chassis',
  'corps',
  'means',
])

const F_EXCEPTIONS = new Set([
  'roof',
  'proof',
  'chief',
  'brief',
  'belief',
  'cliff',
  'staff',
  'bluff',
  'spoof',
  'motif',
  'serif',
  'tariff',
  'plaintiff',
  'sheriff',
  'reef',
  'chef',
  'ref',
  'gif',
  'pdf',
])

const O_EXCEPTIONS = new Set([
  'photo',
  'video',
  'audio',
  'studio',
  'logo',
  'demo',
  'memo',
  'repo',
  'info',
  'typo',
  'intro',
  'outro',
  'combo',
  'promo',
  'proto',
  'retro',
  'macro',
  'micro',
  'nano',
  'auto',
  'euro',
  'pro',
  'disco',
  'duo',
  'trio',
  'solo',
  'piano',
  'casino',
  'ratio',
  'portfolio',
  'scenario',
  'studio',
  'folio',
  'manifesto',
  'motto',
  'dynamo',
  'limo',
  'albino',
  'espresso',
  'fiasco',
  'ghetto',
  'grotto',
  'inferno',
  'jumbo',
  'kimono',
  'libido',
  'lingo',
  'memento',
  'neutrino',
  'placebo',
  'silo',
  'stiletto',
  'tempo',
  'torso',
  'virtuoso',
  'volcano',
  'zero',
])

export const pluralize = (
  count: number,
  word: string,
  { includeCount = true }: { includeCount?: boolean } = {},
) => {
  let pluralWord: string
  const lowerWord = word.toLowerCase()

  if (count === 1) {
    pluralWord = word
  } else if (word === word.toUpperCase() && word.length > 1) {
    pluralWord = word + 's'
  } else if (IRREGULAR_PLURALS[lowerWord]) {
    pluralWord = IRREGULAR_PLURALS[lowerWord]
  } else if (UNCHANGING_PLURALS.has(lowerWord)) {
    pluralWord = word
  } else if (lowerWord.endsWith('ware')) {
    pluralWord = word
  } else if (lowerWord.endsWith('ics')) {
    pluralWord = word
  } else if (lowerWord.endsWith('sis')) {
    pluralWord = word.slice(0, -2) + 'es'
  } else if (lowerWord.endsWith('xis')) {
    pluralWord = word.slice(0, -2) + 'es'
  } else if (F_EXCEPTIONS.has(lowerWord)) {
    pluralWord = word + 's'
  } else if (word.endsWith('f')) {
    pluralWord = word.slice(0, -1) + 'ves'
  } else if (word.endsWith('fe')) {
    pluralWord = word.slice(0, -2) + 'ves'
  } else if (word.endsWith('y') && !word.match(/[aeiou]y$/)) {
    pluralWord = word.slice(0, -1) + 'ies'
  } else if (O_EXCEPTIONS.has(lowerWord)) {
    pluralWord = word + 's'
  } else if (word.match(/[cs]h$/) || word.match(/o$/)) {
    pluralWord = word + 'es'
  } else if (word.match(/[^z]z$/)) {
    pluralWord = word + 'zes'
  } else if (word.match(/[sxz]$/)) {
    pluralWord = word + 'es'
  } else {
    pluralWord = word + 's'
  }

  return includeCount ? `${count} ${pluralWord}` : pluralWord
}

export const capitalize = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export const snakeToTitleCase = (str: string): string => {
  return str
    .split('_')
    .map((word) => capitalize(word))
    .join(' ')
}

export const ensureUrlProtocol = (url: string): string => {
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://')
  ) {
    return url
  }

  if (url.startsWith('localhost') || url.match(/^127\.\d+\.\d+\.\d+/)) {
    return `http://${url}`
  }

  if (url.startsWith('/')) {
    return `file://${url}`
  }

  return `https://${url}`
}

export const safeReplace = (
  content: string,
  searchStr: string,
  replaceStr: string,
): string => {
  const escapedReplaceStr = replaceStr.replace(/\$/g, '$$$$')
  return content.replace(searchStr, escapedReplaceStr)
}

export function transformJsonInString<T = unknown>(
  content: string,
  field: string,
  transform: (json: T) => unknown,
  fallback: string,
): string {
  const pattern = new RegExp(`"${field}"\\s*:\\s*(\\{[^}]*?\\}|\\[[^\\]]*?\\])`)
  const match = content.match(pattern)

  if (!match) {
    return content
  }

  try {
    const json = JSON.parse(match[1])
    const transformed = transform(json)

    return content.replace(
      match[0],
      `"${field}":${JSON.stringify(transformed)}`,
    )
  } catch (error) {
    return content.replace(match[0], `"${field}":${fallback}`)
  }
}

export const generateCompactId = (prefix?: string): string => {
  const timestamp = (Date.now() & 0xffffffff) >>> 0
  const random = Math.floor(Math.random() * 0x100000000) >>> 0

  const high = timestamp
  const low = random

  const highHex = high.toString(16).padStart(8, '0')
  const lowHex = low.toString(16).padStart(8, '0')

  const combinedHex = highHex + lowHex

  const bytes = Buffer.from(combinedHex, 'hex')
  const str = bytes.toString('base64url').replace(/=/g, '')

  return prefix ? `${prefix}${str}` : str
}

export const stripNullChars = (str: string): string => {
  return str.replace(/\u0000/g, '')
}

const ansiColorsRegex = /\x1B\[[0-9;]*m/g
export function stripColors(str: string): string {
  return str.replace(ansiColorsRegex, '')
}

const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x1B]*\x1B\\?)/g
export function stripAnsi(str: string): string {
  return str.replace(ansiRegex, '')
}

export function includesMatch(
  array: (string | RegExp)[],
  value: string,
): boolean {
  return array.some((p) => {
    if (typeof p === 'string') {
      return p === value
    }
    return p.test(value)
  })
}

export function suffixPrefixOverlap(source: string, next: string): string {
  for (let len = next.length; len >= 0; len--) {
    const prefix = next.slice(0, len)
    if (source.endsWith(prefix)) {
      return prefix
    }
  }

  return ''
}

export const escapeString = (str: string) => {
  return JSON.stringify(str).slice(1, -1)
}
