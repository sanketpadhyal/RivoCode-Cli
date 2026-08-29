import os from 'os'
import path from 'path'

import { getCliEnv } from './env'
import { getProjectRoot } from '../project-files'

import type { CliEnv } from '../types/env'

export function formatCwd(cwd: string | undefined, env?: CliEnv): string {
  if (!cwd) return ''
  const resolvedEnv = env ?? getCliEnv()
  const homeDir = resolvedEnv.HOME || resolvedEnv.USERPROFILE || os.homedir()
  if (homeDir && cwd.startsWith(homeDir)) {
    return '~' + cwd.slice(homeDir.length)
  }
  return cwd
}

export function getRelativePath(filePath: string): string {
  if (!filePath.startsWith('/')) return filePath

  const projectRoot = getProjectRoot()
  if (!projectRoot) return filePath

  return path.relative(projectRoot, filePath)
}
