import { createTestBaseEnv } from '@rivocode/common/testing-env-process'

import type { SdkEnv } from '../types/env'

export const createTestSdkEnv = (
  overrides: Partial<SdkEnv> = {},
): SdkEnv => ({
  ...createTestBaseEnv(),

  CODEBUFF_RG_PATH: undefined,
  CODEBUFF_WASM_DIR: undefined,
  VERBOSE: undefined,
  OVERRIDE_TARGET: undefined,
  OVERRIDE_PLATFORM: undefined,
  OVERRIDE_ARCH: undefined,
  ...overrides,
})
