import fs from 'fs'
import path from 'path'

import { getConfigDir } from './auth'
import { logger } from './logger'

const getTrustedWorkspacesPath = (): string => {
  return path.join(getConfigDir(), 'trusted-workspaces.json')
}

export function getTrustedWorkspaces(): string[] {
  const filePath = getTrustedWorkspacesPath()
  if (!fs.existsSync(filePath)) {
    return []
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      return parsed.map((p) => path.resolve(p))
    }
    return []
  } catch (error) {
    logger.error(error, 'Failed to read trusted-workspaces.json')
    return []
  }
}

export function isWorkspaceTrusted(dirPath: string): boolean {
  if (!dirPath) return false
  const resolved = path.resolve(dirPath)
  const trustedList = getTrustedWorkspaces()
  return trustedList.some((trusted) => resolved === trusted || resolved.startsWith(trusted + path.sep))
}

export function trustWorkspace(dirPath: string): void {
  if (!dirPath) return
  const resolved = path.resolve(dirPath)
  const configDir = getConfigDir()
  const filePath = getTrustedWorkspacesPath()

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const current = getTrustedWorkspaces()
    if (!current.includes(resolved)) {
      current.push(resolved)
      fs.writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8')
    }
  } catch (error) {
    logger.error(error, 'Failed to save trusted workspace')
  }
}

export function revokeWorkspaceTrust(dirPath: string): void {
  if (!dirPath) return
  const resolved = path.resolve(dirPath)
  const filePath = getTrustedWorkspacesPath()

  try {
    const current = getTrustedWorkspaces()
    const updated = current.filter((p) => p !== resolved)
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8')
  } catch (error) {
    logger.error(error, 'Failed to revoke workspace trust')
  }
}
