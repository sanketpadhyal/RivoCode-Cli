
import type {
  BaseEnv,
  ClientEnv,
} from '@rivocode/common/types/contracts/env'

export type SdkEnv = BaseEnv & {
  CODEBUFF_RG_PATH?: string
  CODEBUFF_WASM_DIR?: string

  VERBOSE?: string
  OVERRIDE_TARGET?: string
  OVERRIDE_PLATFORM?: string
  OVERRIDE_ARCH?: string
}

export type SdkEnvDeps = {
  clientEnv: ClientEnv
  env: SdkEnv
}

export type GetSdkEnvFn = () => SdkEnv
