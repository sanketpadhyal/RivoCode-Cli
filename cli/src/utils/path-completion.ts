import { existsSync, readdirSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

export function getPathCompletion(inputPath: string): string | null {
  if (!inputPath) return null

  let expandedPath = inputPath
  const homeDir = os.homedir()
  if (expandedPath.startsWith('~')) {
    expandedPath = path.join(homeDir, expandedPath.slice(1))
  }

  let parentDir: string
  let partial: string

  if (expandedPath.endsWith(path.sep)) {
    parentDir = expandedPath
    partial = ''
  } else {
    parentDir = path.dirname(expandedPath)
    partial = path.basename(expandedPath).toLowerCase()
  }

  try {
    if (!existsSync(parentDir) || !statSync(parentDir).isDirectory()) {
      return null
    }
  } catch {
    return null
  }

  try {
    const items = readdirSync(parentDir)
    const matches: string[] = []

    for (const item of items) {
      if (item.startsWith('.') && !partial.startsWith('.')) continue

      const fullPath = path.join(parentDir, item)
      try {
        if (!statSync(fullPath).isDirectory()) continue
      } catch {
        continue
      }

      if (item.toLowerCase().startsWith(partial)) {
        matches.push(item)
      }
    }

    if (matches.length === 0) return null

    if (matches.length === 1) {
      let completed = path.join(parentDir, matches[0]) + path.sep
      if (inputPath.startsWith('~') && completed.startsWith(homeDir)) {
        completed = '~' + completed.slice(homeDir.length)
      }
      return completed
    }

    const sortedMatches = matches.sort()
    const first = sortedMatches[0].toLowerCase()
    const last = sortedMatches[sortedMatches.length - 1].toLowerCase()
    let commonLength = partial.length

    while (
      commonLength < first.length &&
      first[commonLength] === last[commonLength]
    ) {
      commonLength++
    }

    if (commonLength > partial.length) {
      const commonPrefix = sortedMatches[0].slice(0, commonLength)
      let completed = path.join(parentDir, commonPrefix)
      if (inputPath.startsWith('~') && completed.startsWith(homeDir)) {
        completed = '~' + completed.slice(homeDir.length)
      }
      return completed
    }

    return null
  } catch {
    return null
  }
}
