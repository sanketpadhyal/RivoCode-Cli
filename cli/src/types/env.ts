
import type { BaseEnv, ClientEnv } from '@rivocode/common/types/contracts/env'

export type CliEnv = BaseEnv & {
  SystemRoot?: string

  TERM?: string
  TMUX?: string
  STY?: string

  SSH_CLIENT?: string
  SSH_TTY?: string
  SSH_CONNECTION?: string
  CODESPACES?: string

  DISPLAY?: string
  WAYLAND_DISPLAY?: string

  KITTY_WINDOW_ID?: string
  SIXEL_SUPPORT?: string
  ZED_NODE_ENV?: string
  ZED_TERM?: string
  ZED_SHELL?: string
  COLORTERM?: string

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
  CODEBUFF_SCROLL_MULTIPLIER?: string
  CODEBUFF_PERF_TEST?: string
  CODEBUFF_TRACE?: string
  CODEBUFF_LAUNCHER_PID?: string
  CODEBUFF_SHIP_LOGS?: string
  CODEBUFF_NO_TERMINAL_WATCHDOG?: string
}

export type CliEnvDeps = {
  clientEnv: ClientEnv
  env: CliEnv
}

export type GetCliEnvFn = () => CliEnv
