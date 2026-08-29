import fs from 'fs'
import os from 'os'

import open from 'open'
import { isWsl, powerShellPathFromWsl } from 'wsl-utils'

import { getCliEnv } from './env'
import { logger } from './logger'

export async function safeOpen(url: string): Promise<boolean> {
  if (isWsl) {
    const powershellPath = await powerShellPathFromWsl()
    if (!fs.existsSync(powershellPath)) {
      logger.warn(
        { powershellPath },
        'WSL detected but powershell.exe is not accessible (Windows interop disabled?). Skipping browser open.',
      )
      return false
    }
  } else if (os.platform() === 'linux') {
    const env = getCliEnv()
    const hasDisplay = Boolean(env.DISPLAY || env.WAYLAND_DISPLAY)
    if (!hasDisplay) {
      logger.warn(
        'No display server detected (DISPLAY / WAYLAND_DISPLAY unset). Skipping browser open.',
      )
      return false
    }
  }

  try {
    const subprocess = await open(url)
    subprocess.once('error', (err) => {
      logger.error(err, 'Failed to open browser')
    })
    return true
  } catch (err) {
    logger.error(err, 'Failed to open browser')
    return false
  }
}
