import path from 'path'

import { translateGitBashPath } from './windows-bash'

import type { WindowsShellPathDependencies } from './windows-bash'

export type ResolvedProjectPath = {
  fullPath: string
  relativePath: string
}

export type ResolvedFilePath = ResolvedProjectPath & {
  isWithinProject: boolean
}

function escapesProject(relativePath: string): boolean {
  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  )
}

export function resolveFilePathWithinProject(
  projectRoot: string,
  filePath: string,
  dependencies: WindowsShellPathDependencies = {},
): ResolvedProjectPath | null {
  const resolvedRoot = path.resolve(projectRoot)
  const nativeFilePath = translateGitBashPath(filePath, dependencies)
  const fullPath = path.isAbsolute(nativeFilePath)
    ? path.resolve(nativeFilePath)
    : path.resolve(resolvedRoot, nativeFilePath)
  const relativePath = path.relative(resolvedRoot, fullPath)

  if (relativePath === '' || escapesProject(relativePath)) {
    return null
  }

  return { fullPath, relativePath }
}

export function resolveFilePath(
  projectRoot: string,
  filePath: string,
  dependencies: WindowsShellPathDependencies = {},
): ResolvedFilePath {
  const resolvedRoot = path.resolve(projectRoot)
  const nativeFilePath = translateGitBashPath(filePath, dependencies)
  const fullPath = path.isAbsolute(nativeFilePath)
    ? path.resolve(nativeFilePath)
    : path.resolve(resolvedRoot, nativeFilePath)
  const relativePath = path.relative(resolvedRoot, fullPath)
  const isWithinProject = relativePath !== '' && !escapesProject(relativePath)
  const displayPath = isWithinProject ? relativePath : fullPath

  return { fullPath, relativePath: displayPath, isWithinProject }
}

export function getProjectPathLookupKeys(
  projectRoot: string,
  filePath: string,
  dependencies: WindowsShellPathDependencies = {},
): string[] {
  const resolvedPath = resolveFilePathWithinProject(
    projectRoot,
    filePath,
    dependencies,
  )
  const keys = resolvedPath
    ? [resolvedPath.relativePath, filePath]
    : [
        resolveFilePath(projectRoot, filePath, dependencies).relativePath,
        filePath,
      ]

  return [...new Set(keys)]
}
