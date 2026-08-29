
import type { ClientEnv } from '../../env-schema'

export type { ClientEnv } from '../../env-schema'

export type BaseCiEnv = {
  CI?: string
  GITHUB_ACTIONS?: string
  RENDER?: string
  IS_PULL_REQUEST?: string
}

export type BaseEnv = {
  SHELL?: string
  COMSPEC?: string

  HOME?: string
  USERPROFILE?: string
  APPDATA?: string
  XDG_CONFIG_HOME?: string

  TERM?: string
  TERM_PROGRAM?: string
  TERM_BACKGROUND?: string
  TERMINAL_EMULATOR?: string
  COLORFGBG?: string

  NODE_ENV?: string
  NODE_PATH?: string
  PATH?: string
}

export type CiEnv = BaseCiEnv & {
  CODEBUFF_GITHUB_TOKEN?: string
  CODEBUFF_API_KEY?: string
  EVAL_RESULTS_EMAIL?: string
}

export type ProcessEnv = BaseEnv & {
  KITTY_WINDOW_ID?: string
  SIXEL_SUPPORT?: string
  ZED_NODE_ENV?: string

  VSCODE_THEME_KIND?: string
  VSCODE_COLOR_THEME_KIND?: string
  VSCODE_GIT_IPC_HANDLE?: string
  VSCODE_PID?: string
  VSCODE_CWD?: string
  VSCODE_NLS_CONFIG?: string

  CURSOR_PORT?: string
  CURSOR?: string

  JETBRAINS_REMOTE_RUN?: string
  IDEA_INITIAL_DIRECTORY?: string
  IDE_CONFIG_DIR?: string
  JB_IDE_CONFIG_DIR?: string

  VISUAL?: string
  EDITOR?: string
  CODEBUFF_CLI_EDITOR?: string
  CODEBUFF_EDITOR?: string

  OPEN_TUI_THEME?: string
  OPENTUI_THEME?: string

  CODEBUFF_IS_BINARY?: string
  CODEBUFF_CLI_VERSION?: string
  CODEBUFF_CLI_TARGET?: string
  CODEBUFF_RG_PATH?: string
  CODEBUFF_WASM_DIR?: string

  VERBOSE?: string
  OVERRIDE_TARGET?: string
  OVERRIDE_PLATFORM?: string
  OVERRIDE_ARCH?: string
}

export type GetClientEnvFn = () => ClientEnv

export type GetBaseEnvFn = () => BaseEnv

export type GetProcessEnvFn = () => ProcessEnv

export type GetBaseCiEnvFn = () => BaseCiEnv

export type GetCiEnvFn = () => CiEnv

export type BaseEnvDeps = {
  clientEnv: ClientEnv
  env: BaseEnv
}

export type EnvDeps = {
  clientEnv: ClientEnv
  processEnv: ProcessEnv
}

export type FullEnvDeps = {
  clientEnv: ClientEnv
  processEnv: ProcessEnv
  ciEnv: CiEnv
}
