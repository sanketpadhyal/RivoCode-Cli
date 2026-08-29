
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { getSystemProcessEnv } from '../env'

const EXCLUDED_PATH_PATTERNS = ['system32', 'windowsapps']

function gitRoots(env: NodeJS.ProcessEnv): string[] {
  const localAppData = env.LOCALAPPDATA
  const userProfile = env.USERPROFILE
  const programData = env.ProgramData ?? env.PROGRAMDATA
  const systemDrive = env.SystemDrive ?? env.SYSTEMDRIVE
  return [
    env.ProgramFiles,
    env.ProgramW6432,
    env['ProgramFiles(x86)'],
  ]
    .filter((root): root is string => !!root)
    .map((root) => path.join(root, 'Git'))
    .concat(
      [
        localAppData && path.join(localAppData, 'Programs', 'Git'),
        env.SCOOP && path.join(env.SCOOP, 'apps', 'git', 'current'),
        userProfile && path.join(userProfile, 'scoop', 'apps', 'git', 'current'),
        env.SCOOP_GLOBAL && path.join(env.SCOOP_GLOBAL, 'apps', 'git', 'current'),
        programData && path.join(programData, 'scoop', 'apps', 'git', 'current'),
        systemDrive && path.join(systemDrive, '\\', 'tools', 'git'),
        systemDrive && path.join(systemDrive, '\\', 'Git'),
      ].filter((root): root is string => !!root),
    )
}

function usablePathDirs(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH || env.Path || '')
    .split(path.delimiter)
    .filter(
      (dir) =>
        dir &&
        !EXCLUDED_PATH_PATTERNS.some((pattern) => dir.toLowerCase().includes(pattern)),
    )
}

export function windowsBashCandidates(env: NodeJS.ProcessEnv): string[] {
  const pathDirs = usablePathDirs(env)
  const candidates = [
    env.CODEBUFF_GIT_BASH_PATH,
    ...gitRoots(env).map((root) => path.join(root, 'bin', 'bash.exe')),
    ...pathDirs.flatMap((dir) => ['bash.exe', 'bash'].map((name) => path.join(dir, name))),
    ...pathDirs
      .filter((dir) => pathExists(path.join(dir, 'git.exe')))
      .flatMap((dir) => [
        path.join(path.dirname(dir), 'bin', 'bash.exe'),
        path.join(path.dirname(path.dirname(dir)), 'bin', 'bash.exe'),
      ]),
  ].filter((candidate): candidate is string => !!candidate)
  return [...new Set(candidates)]
}

export function pathExists(candidate: string): boolean {
  try {
    return fs.existsSync(candidate)
  } catch {
    return false
  }
}

const GIT_REGISTRY_VALUES: readonly (readonly [key: string, value: string])[] = [
  ['HKLM\\SOFTWARE\\GitForWindows', 'InstallPath'],
  ['HKCU\\SOFTWARE\\GitForWindows', 'InstallPath'],
  ['HKLM\\SOFTWARE\\WOW6432Node\\GitForWindows', 'InstallPath'],
  ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Git_is1', 'InstallLocation'],
  ['HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Git_is1', 'InstallLocation'],
]

export function parseRegistryPath(stdout: string, value: string): string | null {
  const match = new RegExp(`^\\s*${value}\\s+REG_[A-Z_]+\\s+(.+)$`, 'im').exec(stdout)
  return match?.[1]?.trim().replace(/[\\/]+$/, '') || null
}

let cachedGitRegistryRoot: string | null | undefined

function gitRootFromRegistry(): string | null {
  if (cachedGitRegistryRoot !== undefined) return cachedGitRegistryRoot
  cachedGitRegistryRoot = null
  if (process.platform !== 'win32') return null
  for (const [key, value] of GIT_REGISTRY_VALUES) {
    try {
      const probe = spawnSync('reg', ['query', key, '/v', value], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5_000,
      })
      const root = probe.stdout ? parseRegistryPath(probe.stdout, value) : null
      if (root) {
        cachedGitRegistryRoot = root
        return root
      }
    } catch {
    }
  }
  return null
}

export function resetGitRegistryCache(): void {
  cachedGitRegistryRoot = undefined
}

export function findWindowsBash(
  env: NodeJS.ProcessEnv,
  registryRoot?: () => string | null,
): string | null {
  const found = windowsBashCandidates(env).find(pathExists)
  if (found) return found
  const read =
    registryRoot ?? (env === getSystemProcessEnv() ? gitRootFromRegistry : () => null)
  const root = read()
  const candidate = root ? path.join(root, 'bin', 'bash.exe') : null
  return candidate && pathExists(candidate) ? candidate : null
}

type CygpathSpawnResult = {
  status: number | null
  stdout: string
}

export type WindowsShellPathDependencies = {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  findBash?: (env: NodeJS.ProcessEnv) => string | null
  spawnCygpath?: (cygpath: string, filePath: string) => CygpathSpawnResult
  pathExists?: (candidate: string) => boolean
}

export function isGitBashAbsolutePath(filePath: string): boolean {
  return /^\/(?!\/)/.test(filePath)
}

function spawnCygpath(cygpath: string, filePath: string): CygpathSpawnResult {
  return spawnSync(cygpath, ['-w', '--', filePath], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5_000,
  })
}

function findCygpath(
  bash: string,
  exists: (candidate: string) => boolean,
): string | null {
  const candidates = [
    path.join(path.dirname(path.dirname(bash)), 'usr', 'bin', 'cygpath.exe'),
    path.join(path.dirname(bash), 'cygpath.exe'),
  ]
  return candidates.find(exists) ?? null
}

function runCygpath(
  spawn: (cygpath: string, filePath: string) => CygpathSpawnResult,
  cygpath: string,
  filePath: string,
): string | null {
  try {
    const result = spawn(cygpath, filePath)
    if (result.status !== 0) return null
    return result.stdout.trim().split(/\r?\n/).pop()?.trim() || null
  } catch {
    return null
  }
}

const MSYS_DRIVE_PATTERN = /^\/([a-z])\//i

const translatedPathCache = new Map<string, string>()

export function resetTranslationCache(): void {
  translatedPathCache.clear()
}

export function translateGitBashPath(
  filePath: string,
  dependencies: WindowsShellPathDependencies = {},
): string {
  const platform = dependencies.platform ?? process.platform
  if (platform !== 'win32' || !isGitBashAbsolutePath(filePath)) return filePath

  if (MSYS_DRIVE_PATTERN.test(filePath)) {
    return `${filePath.charAt(1).toUpperCase()}:\\${filePath.slice(3).replace(/\//g, '\\')}`
  }

  const cached = translatedPathCache.get(filePath)
  if (cached !== undefined) return cached

  const env = dependencies.env ?? getSystemProcessEnv()
  const bash = (dependencies.findBash ?? findWindowsBash)(env)
  if (!bash) return filePath

  const cygpath = findCygpath(bash, dependencies.pathExists ?? pathExists)
  if (!cygpath) return filePath

  const translated = runCygpath(
    dependencies.spawnCygpath ?? spawnCygpath,
    cygpath,
    filePath,
  )
  if (translated === null) return filePath
  translatedPathCache.set(filePath, translated)
  return translated
}

export function createWindowsBashNotFoundError(): Error {
  return new Error(
    `Bash is required but was not found on this Windows system.

Install Git for Windows, which includes it: https://git-scm.com/download/win
Or, from a terminal: winget install --id Git.Git --exact --source winget

If you already have Git installed somewhere unusual and we did not find it, point
us at it directly by setting CODEBUFF_GIT_BASH_PATH to its bash.exe. Example:
   set CODEBUFF_GIT_BASH_PATH=C:\\path\\to\\Git\\bin\\bash.exe`,
  )
}
