
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {
  findWindowsBash,
  isGitBashAbsolutePath,
  parseRegistryPath,
  resetTranslationCache,
  translateGitBashPath,
  windowsBashCandidates,
} from '../tools/windows-bash'

let root: string

function installGitAt(rel: string): string {
  const gitRoot = path.join(root, rel)
  fs.mkdirSync(path.join(gitRoot, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(gitRoot, 'bin', 'bash.exe'), '')
  return gitRoot
}

function touch(dir: string, name: string): string {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), '')
  return path.join(dir, name)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'winbash-'))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('findWindowsBash', () => {
  it('prefers an explicit CODEBUFF_GIT_BASH_PATH over everything else', () => {
    const override = touch(path.join(root, 'custom'), 'bash.exe')
    const programFiles = installGitAt('ProgramFiles')
    expect(
      findWindowsBash({ CODEBUFF_GIT_BASH_PATH: override, ProgramFiles: programFiles }),
    ).toBe(override)
  })

  it('ignores a CODEBUFF_GIT_BASH_PATH left pointing at a bash that is gone', () => {
    const gitRoot = installGitAt('Git')
    expect(
      findWindowsBash({
        CODEBUFF_GIT_BASH_PATH: path.join(root, 'deleted', 'bash.exe'),
        ProgramFiles: root,
      }),
    ).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
  })

  it('finds a per-user install under %LOCALAPPDATA%\\Programs\\Git', () => {
    const gitRoot = installGitAt(path.join('AppData', 'Local', 'Programs', 'Git'))
    const found = findWindowsBash({ LOCALAPPDATA: path.join(root, 'AppData', 'Local') })
    expect(found).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
  })

  it('finds a scoop install', () => {
    const gitRoot = installGitAt(path.join('scoop', 'apps', 'git', 'current'))
    expect(findWindowsBash({ USERPROFILE: root })).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
  })

  it('honors a ProgramFiles that is not on C:', () => {
    const gitRoot = installGitAt('Git')
    expect(findWindowsBash({ ProgramFiles: root })).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
  })

  it('finds bash beside a git.exe that is on PATH', () => {
    const gitRoot = installGitAt(path.join('elsewhere', 'Git'))
    const cmdDir = path.join(gitRoot, 'cmd')
    touch(cmdDir, 'git.exe')
    expect(findWindowsBash({ PATH: cmdDir })).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
  })

  it('walks two levels up from a mingw64 git.exe', () => {
    const gitRoot = installGitAt(path.join('elsewhere', 'Git'))
    const mingw = path.join(gitRoot, 'mingw64', 'bin')
    touch(mingw, 'git.exe')
    expect(findWindowsBash({ PATH: mingw })).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
  })

  it('finds bash directly on PATH', () => {
    const dir = path.join(root, 'tools')
    const bash = touch(dir, 'bash.exe')
    expect(findWindowsBash({ PATH: dir })).toBe(bash)
  })

  it('never accepts the WSL or Store stubs', () => {
    const system32 = path.join(root, 'Windows', 'System32')
    const store = path.join(root, 'AppData', 'Local', 'Microsoft', 'WindowsApps')
    touch(system32, 'bash.exe')
    touch(store, 'bash.exe')
    expect(
      findWindowsBash({ PATH: [system32, store].join(path.delimiter) }, () => null),
    ).toBeNull()
  })

  it('answers only from the environment it is given', () => {
    const real = installGitAt('Git')
    expect(findWindowsBash({ ProgramFiles: path.join(root, 'empty') }, () => null)).toBeNull()
    expect(findWindowsBash({ ProgramFiles: root }, () => null)).toBe(
      path.join(real, 'bin', 'bash.exe'),
    )
  })

  it('looks for drive-root installs on the drive Windows actually lives on', () => {
    const candidates = windowsBashCandidates({ SystemDrive: 'D:' })
    expect(candidates).toContain(path.join('D:', '\\', 'Git', 'bin', 'bash.exe'))
    expect(candidates.some((c) => c.startsWith('C:'))).toBe(false)
  })

  it('answers null when the machine genuinely has no bash', () => {
    expect(findWindowsBash({ PATH: path.join(root, 'empty') }, () => null)).toBeNull()
  })

  it('never returns a candidate twice', () => {
    const dir = path.join(root, 'tools')
    const candidates = windowsBashCandidates({
      PATH: [dir, dir].join(path.delimiter),
      ProgramFiles: 'C:\\Program Files',
    })
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it('falls back to the install directory the registry records', () => {
    const gitRoot = installGitAt(path.join('Dev Tools', 'Git'))
    expect(findWindowsBash({ PATH: '' }, () => gitRoot)).toBe(
      path.join(gitRoot, 'bin', 'bash.exe'),
    )
  })

  it('never consults the registry when the filesystem already answered', () => {
    const gitRoot = installGitAt('Git')
    let asked = 0
    const found = findWindowsBash({ ProgramFiles: root }, () => (asked++, null))
    expect(found).toBe(path.join(gitRoot, 'bin', 'bash.exe'))
    expect(asked).toBe(0)
  })

  it('verifies the registry path rather than trusting it', () => {
    expect(findWindowsBash({ PATH: '' }, () => path.join(root, 'uninstalled'))).toBeNull()
  })

  it('consults the registry only alongside the environment it describes', () => {
    let asked = 0
    const reader = () => (asked++, null)
    findWindowsBash({ PATH: '' }, reader)
    expect(asked).toBe(1)
    expect(findWindowsBash({ PATH: path.join(root, 'nowhere') })).toBeNull()
  })

  it('answers null when the registry knows nothing either', () => {
    expect(findWindowsBash({ PATH: '' }, () => null)).toBeNull()
  })

  it('survives an unreadable candidate path', () => {
    const dir = path.join(root, 'tools')
    const bash = touch(dir, 'bash.exe')
    expect(findWindowsBash({ PATH: ['\0bogus', dir].join(path.delimiter) })).toBe(bash)
  })
})

describe('parseRegistryPath', () => {
  it('reads a path containing spaces', () => {
    const out =
      '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\GitForWindows\r\n    InstallPath    REG_SZ    C:\\Dev Tools\\Git\r\n\r\n'
    expect(parseRegistryPath(out, 'InstallPath')).toBe('C:\\Dev Tools\\Git')
  })

  it('tolerates tab separators and strips a trailing slash', () => {
    expect(parseRegistryPath('\tInstallPath\tREG_SZ\tC:\\Git\\', 'InstallPath')).toBe('C:\\Git')
  })

  it('reads the uninstall entry’s differently named value', () => {
    expect(parseRegistryPath('  InstallLocation  REG_SZ  C:\\Git', 'InstallLocation')).toBe('C:\\Git')
  })

  it('answers null for a missing key, an error, or an empty value', () => {
    expect(
      parseRegistryPath('ERROR: The system was unable to find the specified registry key', 'InstallPath'),
    ).toBeNull()
    expect(parseRegistryPath('', 'InstallPath')).toBeNull()
    expect(parseRegistryPath('    InstallPath    REG_SZ    ', 'InstallPath')).toBeNull()
  })
})

describe('Git Bash path translation', () => {
  beforeEach(() => {
    resetTranslationCache()
  })

  it('recognizes MSYS absolute paths without claiming native UNC paths', () => {
    expect(isGitBashAbsolutePath('/tmp/file.txt')).toBe(true)
    expect(isGitBashAbsolutePath('/c/Users/Alice/file.txt')).toBe(true)
    expect(isGitBashAbsolutePath('//server/share/file.txt')).toBe(false)
    expect(isGitBashAbsolutePath('C:\\tmp\\file.txt')).toBe(false)
    expect(isGitBashAbsolutePath('src/file.txt')).toBe(false)
  })

  it('translates a drive-letter MSYS path without any lookup or spawn', () => {
    const neverFindBash = () => {
      throw new Error('must not look for bash')
    }
    expect(
      translateGitBashPath('/c/Users/me/repo/src/a.ts', {
        platform: 'win32',
        env: {},
        findBash: neverFindBash,
      }),
    ).toBe('C:\\Users\\me\\repo\\src\\a.ts')
    expect(
      translateGitBashPath('/D/work/file.txt', {
        platform: 'win32',
        env: {},
        findBash: neverFindBash,
      }),
    ).toBe('D:\\work\\file.txt')
  })

  it('spawns the cygpath.exe derived from the found bash, directly', () => {
    const bash = path.join(installGitAt('Git'), 'bin', 'bash.exe')
    const cygpath = touch(path.join(root, 'Git', 'usr', 'bin'), 'cygpath.exe')
    const calls: [string, string][] = []

    expect(
      translateGitBashPath('/tmp/file.txt', {
        platform: 'win32',
        env: {},
        findBash: () => bash,
        spawnCygpath: (cygpath, filePath) => {
          calls.push([cygpath, filePath])
          return {
            status: 0,
            stdout: 'C:\\Users\\Alice\\AppData\\Local\\Temp\\file.txt\n',
          }
        },
      }),
    ).toBe('C:\\Users\\Alice\\AppData\\Local\\Temp\\file.txt')
    expect(calls).toEqual([[cygpath, '/tmp/file.txt']])
  })

  it('spawns the cygpath.exe sitting beside a usr\\bin bash', () => {
    const bash = touch(path.join(root, 'Git', 'usr', 'bin'), 'bash.exe')
    const cygpath = touch(path.join(root, 'Git', 'usr', 'bin'), 'cygpath.exe')
    const calls: [string, string][] = []

    expect(
      translateGitBashPath('/tmp/sibling.txt', {
        platform: 'win32',
        env: {},
        findBash: () => bash,
        spawnCygpath: (cygpath, filePath) => {
          calls.push([cygpath, filePath])
          return { status: 0, stdout: 'C:\\Temp\\sibling.txt\n' }
        },
      }),
    ).toBe('C:\\Temp\\sibling.txt')
    expect(calls).toEqual([[cygpath, '/tmp/sibling.txt']])
  })

  it('skips the spawn and keeps the original path when no cygpath.exe exists', () => {
    const bash = touch(path.join(root, 'Git', 'bin'), 'bash.exe')
    let spawns = 0

    expect(
      translateGitBashPath('/tmp/no-cygpath.txt', {
        platform: 'win32',
        env: {},
        findBash: () => bash,
        spawnCygpath: () => {
          spawns++
          return { status: 0, stdout: 'C:\\Temp\\no-cygpath.txt\n' }
        },
      }),
    ).toBe('/tmp/no-cygpath.txt')
    expect(spawns).toBe(0)
  })

  it('reads only the last stdout line, so leading banner output is ignored', () => {
    expect(
      translateGitBashPath('/tmp/banner.txt', {
        platform: 'win32',
        env: {},
        findBash: () => path.join(root, 'Git', 'bin', 'bash.exe'),
        pathExists: () => true,
        spawnCygpath: () => ({
          status: 0,
          stdout:
            'conda environment activated\nNow using node v22.1.0\nC:\\Temp\\banner.txt\r\n',
        }),
      }),
    ).toBe('C:\\Temp\\banner.txt')
  })

  it('falls back to the original path on a non-zero exit even when stdout is non-empty', () => {
    expect(
      translateGitBashPath('/tmp/exit-code.txt', {
        platform: 'win32',
        env: {},
        findBash: () => path.join(root, 'Git', 'bin', 'bash.exe'),
        pathExists: () => true,
        spawnCygpath: () => ({
          status: 1,
          stdout: 'C:\\Temp\\exit-code.txt\n',
        }),
      }),
    ).toBe('/tmp/exit-code.txt')
  })

  it('spawns once per path and answers repeats from the cache', () => {
    let spawns = 0
    const dependencies = {
      platform: 'win32' as NodeJS.Platform,
      env: {},
      findBash: () => path.join(root, 'Git', 'bin', 'bash.exe'),
      pathExists: () => true,
      spawnCygpath: () => {
        spawns++
        return { status: 0, stdout: 'C:\\Temp\\repeat.txt\n' }
      },
    }
    expect(translateGitBashPath('/tmp/repeat.txt', dependencies)).toBe(
      'C:\\Temp\\repeat.txt',
    )
    expect(translateGitBashPath('/tmp/repeat.txt', dependencies)).toBe(
      'C:\\Temp\\repeat.txt',
    )
    expect(spawns).toBe(1)
  })

  it('leaves paths unchanged when translation does not apply or is unavailable', () => {
    const neverFindBash = () => {
      throw new Error('must not look for bash')
    }
    expect(
      translateGitBashPath('/tmp/file.txt', {
        platform: 'darwin',
        findBash: neverFindBash,
      }),
    ).toBe('/tmp/file.txt')
    expect(
      translateGitBashPath('C:\\tmp\\file.txt', {
        platform: 'win32',
        findBash: neverFindBash,
      }),
    ).toBe('C:\\tmp\\file.txt')
    expect(
      translateGitBashPath('/tmp/file.txt', {
        platform: 'win32',
        env: {},
        findBash: () => path.join(root, 'Git', 'bin', 'bash.exe'),
        pathExists: () => true,
        spawnCygpath: () => ({ status: 0, stdout: '' }),
      }),
    ).toBe('/tmp/file.txt')
  })
})
