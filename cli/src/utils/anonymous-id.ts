import fs from 'fs'
import path from 'path'

import { generateAnonymousId } from '@rivocode/common/analytics-core'

import { getConfigDir } from './config-dir'

const ANONYMOUS_ID_FILE = 'analytics-id.json'

let cachedAnonymousId: string | undefined

const getAnonymousIdPath = (): string =>
  path.join(getConfigDir(), ANONYMOUS_ID_FILE)

function readPersistedAnonymousId(): string | undefined {
  try {
    const raw = fs.readFileSync(getAnonymousIdPath(), 'utf8')
    const parsed = JSON.parse(raw) as { anonymousId?: unknown }
    if (typeof parsed.anonymousId === 'string' && parsed.anonymousId.trim()) {
      return parsed.anonymousId
    }
  } catch {
  }
  return undefined
}

function persistAnonymousId(anonymousId: string): void {
  try {
    const configDir = getConfigDir()
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    fs.writeFileSync(
      getAnonymousIdPath(),
      JSON.stringify({ anonymousId }, null, 2),
    )
  } catch {
  }
}

export function getOrCreatePersistentAnonymousId(): string {
  if (cachedAnonymousId) {
    return cachedAnonymousId
  }

  const existing = readPersistedAnonymousId()
  if (existing) {
    cachedAnonymousId = existing
    return existing
  }

  const minted = generateAnonymousId()
  persistAnonymousId(minted)
  cachedAnonymousId = minted
  return minted
}

export function resetAnonymousIdCache(): void {
  cachedAnonymousId = undefined
}
