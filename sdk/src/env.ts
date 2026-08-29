
import { BYOK_OPENROUTER_ENV_VAR } from '@codebuff/common/constants/byok'
import { API_KEY_ENV_VAR } from '@codebuff/common/constants/paths'
import { getBaseEnv } from '@codebuff/common/env-process'

import type { SdkEnv } from './types/env'

export const getSdkEnv = (): SdkEnv => ({
  ...getBaseEnv(),

  CODEBUFF_RG_PATH: process.env.CODEBUFF_RG_PATH,
  CODEBUFF_WASM_DIR: process.env.CODEBUFF_WASM_DIR,

  VERBOSE: process.env.VERBOSE,
  OVERRIDE_TARGET: process.env.OVERRIDE_TARGET,
  OVERRIDE_PLATFORM: process.env.OVERRIDE_PLATFORM,
  OVERRIDE_ARCH: process.env.OVERRIDE_ARCH,
})

export const getCodebuffApiKeyFromEnv = (): string | undefined => {
  return process.env[API_KEY_ENV_VAR]
}

export const getRuntimeAppUrlFromEnv = (): string | undefined => {
  return (
    process.env['NEXT_PUBLIC_CODEBUFF_APP_URL'] ??
    process.env['CODEBUFF_APP_URL']
  )
}

export const getSystemProcessEnv = (): NodeJS.ProcessEnv => {
  return process.env
}

export const getByokOpenrouterApiKeyFromEnv = (): string | undefined => {
  return process.env[BYOK_OPENROUTER_ENV_VAR]
}
