import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { getSdkEnv } from '../env'

import type { SdkEnv } from '../types/env'

const PLATFORM_DIRS: Record<string, string> = {
  'darwin-arm64': 'arm64-darwin',
  'darwin-x64': 'x64-darwin',
  'linux-arm64': 'arm64-linux',
  'linux-x64': 'x64-linux',
  'win32-arm64': 'arm64-win32',
  'win32-x64': 'x64-win32',
}

export function ripgrepPlatformDir(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const platformDir = PLATFORM_DIRS[`${platform}-${arch}`]
  if (!platformDir) throw new Error(`Unsupported platform: ${platform}-${arch}`)
  return platformDir
}

export function getBundledRgPath(
  importMetaUrl?: string,
  env: SdkEnv = getSdkEnv(),
): string {
  if (env.CODEBUFF_RG_PATH) {
    return env.CODEBUFF_RG_PATH
  }

  const platform = process.platform
  const arch = process.arch
  const platformDir = ripgrepPlatformDir(platform, arch)

  const binaryName = platform === 'win32' ? 'rg.exe' : 'rg'

  let vendorPath: string | undefined

  const metaUrl = importMetaUrl || import.meta.url

  if (metaUrl) {
    const currentFile = fileURLToPath(metaUrl)
    const currentDir = dirname(currentFile)

    const devPath = join(
      currentDir,
      '..',
      '..',
      'vendor',
      'ripgrep',
      platformDir,
      binaryName,
    )
    if (existsSync(devPath)) {
      vendorPath = devPath
    }

    const distPath = join(
      currentDir,
      'vendor',
      'ripgrep',
      platformDir,
      binaryName,
    )
    if (existsSync(distPath)) {
      vendorPath = distPath
    }
  }

  if (!vendorPath) {
    const dirname = new Function(
      `try { return __dirname; } catch (e) { return undefined; }`,
    )()

    if (typeof dirname !== 'undefined') {
      const cjsPath = join(
        dirname,
        '..',
        '..',
        'vendor',
        'ripgrep',
        platformDir,
        binaryName,
      )
      if (existsSync(cjsPath)) {
        vendorPath = cjsPath
      }
      const cjsPath2 = join(
        dirname,
        'vendor',
        'ripgrep',
        platformDir,
        binaryName,
      )
      if (existsSync(cjsPath2)) {
        vendorPath = cjsPath2
      }
    }
  }

  if (vendorPath && existsSync(vendorPath)) {
    return vendorPath
  }

  const distVendorPath = join(
    process.cwd(),
    'node_modules',
    '@codebuff',
    'sdk',
    'dist',
    'vendor',
    'ripgrep',
    platformDir,
    binaryName,
  )
  if (existsSync(distVendorPath)) {
    return distVendorPath
  }

  throw new Error(
    `Ripgrep binary not found for ${platform}-${arch}. ` +
      `Expected at: ${vendorPath} or ${distVendorPath}. ` +
      `Please run 'npm run fetch-ripgrep' or set CODEBUFF_RG_PATH environment variable.`,
  )
}
