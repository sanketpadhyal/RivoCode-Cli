import { initializeThemeStore } from '../hooks/use-theme'
import { setProjectRoot } from '../project-files'
import { initTimestampFormatter } from '../utils/helpers'
import { enableManualThemeRefresh } from '../utils/theme-system'
import { initAnalytics } from '../utils/analytics'
import { getFingerprintId } from '../utils/fingerprint'
import { initializeDirenv } from './init-direnv'

export async function initializeApp(params: { cwd?: string }): Promise<void> {
  if (params.cwd) {
    process.chdir(params.cwd)
  }
  const baseCwd = process.cwd()
  setProjectRoot(baseCwd)

  try {
    initAnalytics()
  } catch (error) {
    console.debug('Failed to initialize analytics:', error)
  }

  initializeDirenv()

  initializeThemeStore()
  enableManualThemeRefresh()
  initTimestampFormatter()

  void getFingerprintId()
}
