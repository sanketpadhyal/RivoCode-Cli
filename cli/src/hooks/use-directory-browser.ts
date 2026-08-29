import { existsSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

import { useCallback, useMemo, useState } from 'react'

import { getDirectories, hasGitDirectory } from '../utils/directory-browser'

import type { DirectoryEntry } from '../utils/directory-browser'

export interface UseDirectoryBrowserOptions {
  initialPath?: string
}

export interface UseDirectoryBrowserReturn {
  currentPath: string
  setCurrentPath: (path: string) => void
  directories: DirectoryEntry[]
  isGitRepo: boolean
  expandPath: (inputPath: string) => string
  tryNavigateToPath: (inputPath: string) => boolean
  navigateToDirectory: (entry: DirectoryEntry) => void
}

export function useDirectoryBrowser({
  initialPath,
}: UseDirectoryBrowserOptions = {}): UseDirectoryBrowserReturn {
  const [currentPath, setCurrentPath] = useState(initialPath ?? os.homedir())

  const directories = useMemo(() => getDirectories(currentPath), [currentPath])

  const isGitRepo = useMemo(() => hasGitDirectory(currentPath), [currentPath])

  const expandPath = useCallback((inputPath: string): string => {
    if (inputPath.startsWith('~')) {
      return path.join(os.homedir(), inputPath.slice(1))
    }
    return inputPath
  }, [])

  const tryNavigateToPath = useCallback(
    (inputPath: string): boolean => {
      const expandedPath = expandPath(inputPath.trim())
      try {
        if (existsSync(expandedPath) && statSync(expandedPath).isDirectory()) {
          setCurrentPath(expandedPath)
          return true
        }
      } catch {
      }
      return false
    },
    [expandPath],
  )

  const navigateToDirectory = useCallback((entry: DirectoryEntry) => {
    setCurrentPath(entry.path)
  }, [])

  return {
    currentPath,
    setCurrentPath,
    directories,
    isGitRepo,
    expandPath,
    tryNavigateToPath,
    navigateToDirectory,
  }
}
