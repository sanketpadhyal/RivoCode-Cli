import { readdirSync, statSync } from 'fs'
import path from 'path'

export type DirectoryEntry = {
  name: string
  path: string
  isParent: boolean
  isGitRepo: boolean
}

export function getDirectories(dirPath: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = []

  const parentDir = path.dirname(dirPath)
  if (parentDir !== dirPath) {
    entries.push({
      name: '..',
      path: parentDir,
      isParent: true,
      isGitRepo: false,
    })
  }

  try {
    const items = readdirSync(dirPath)
    for (const item of items) {
      if (item.startsWith('.')) continue

      const fullPath = path.join(dirPath, item)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          entries.push({
            name: item,
            path: fullPath,
            isParent: false,
            isGitRepo: hasGitDirectory(fullPath),
          })
        }
      } catch {
      }
    }
  } catch {
  }

  const parentEntry = entries.find((e) => e.isParent)
  const childEntries = entries.filter((e) => !e.isParent)
  childEntries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

  return parentEntry ? [parentEntry, ...childEntries] : childEntries
}

export function hasGitDirectory(dirPath: string): boolean {
  try {
    const gitPath = path.join(dirPath, '.git')
    return statSync(gitPath).isDirectory()
  } catch {
    return false
  }
}
