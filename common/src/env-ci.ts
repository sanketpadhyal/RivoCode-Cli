
import type { CiEnv } from './types/contracts/env'

export const getCiEnv = (): CiEnv => ({
  CI: process.env.CI,
  GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
  RENDER: process.env.RENDER,
  IS_PULL_REQUEST: process.env.IS_PULL_REQUEST,
  CODEBUFF_GITHUB_TOKEN: process.env.CODEBUFF_GITHUB_TOKEN,
  CODEBUFF_API_KEY: process.env.CODEBUFF_API_KEY,
})

export const ciEnv: CiEnv = getCiEnv()

export const isCI = (): boolean => {
  const env = getCiEnv()
  return env.CI === 'true' || env.CI === '1' || env.GITHUB_ACTIONS === 'true'
}
