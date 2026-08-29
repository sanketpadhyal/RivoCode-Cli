import { existsSync, statSync } from 'fs'
import path from 'path'

import { useCallback } from 'react'

import { getPathCompletion } from '../utils/path-completion'

export interface UsePathTabCompletionOptions {
  searchQuery: string
  setSearchQuery: (query: string) => void
  currentPath: string
  setCurrentPath: (path: string) => void
  expandPath: (inputPath: string) => string
}

export interface UsePathTabCompletionReturn {
  handleTabCompletion: () => boolean
}

export function usePathTabCompletion({
  searchQuery,
  setSearchQuery,
  currentPath,
  setCurrentPath,
  expandPath,
}: UsePathTabCompletionOptions): UsePathTabCompletionReturn {
  const handleTabCompletion = useCallback((): boolean => {
    if (searchQuery.startsWith('/') || searchQuery.startsWith('~')) {
      const completed = getPathCompletion(searchQuery)
      if (completed) {
        if (completed.endsWith('/')) {
          const dirPath = expandPath(completed.slice(0, -1))
          try {
            if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
              setCurrentPath(dirPath)
              setSearchQuery(completed)
              return true
            }
          } catch {
          }
        }
        setSearchQuery(completed)
      }
    } else if (searchQuery.length > 0) {
      const relativePath = path.join(currentPath, searchQuery)
      const completed = getPathCompletion(relativePath)
      if (completed) {
        if (completed.endsWith('/')) {
          try {
            const dirPath = completed.slice(0, -1)
            if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
              setCurrentPath(dirPath)
              setSearchQuery(completed)
              return true
            }
          } catch {
          }
        }
        if (completed.startsWith(currentPath + path.sep)) {
          setSearchQuery(completed.slice(currentPath.length + 1))
        } else {
          setSearchQuery(completed)
        }
      }
    }
    return true
  }, [searchQuery, setSearchQuery, currentPath, setCurrentPath, expandPath])

  return { handleTabCompletion }
}
