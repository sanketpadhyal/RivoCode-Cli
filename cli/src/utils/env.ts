
import { getBaseEnv } from '@rivocode/common/env-process'

import type { CliEnv } from '../types/env'

export const getCliEnv = (): CliEnv => ({
  ...getBaseEnv(),

  SystemRoot: process.env.SystemRoot,

  DISPLAY: process.env.DISPLAY,
  WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY,

  TERM: process.env.TERM,
  TMUX: process.env.TMUX,
  STY: process.env.STY,

  SSH_CLIENT: process.env.SSH_CLIENT,
  SSH_TTY: process.env.SSH_TTY,
  SSH_CONNECTION: process.env.SSH_CONNECTION,
  CODESPACES: process.env.CODESPACES,

  KITTY_WINDOW_ID: process.env.KITTY_WINDOW_ID,
  SIXEL_SUPPORT: process.env.SIXEL_SUPPORT,
  ZED_NODE_ENV: process.env.ZED_NODE_ENV,
  ZED_TERM: process.env.ZED_TERM,
  ZED_SHELL: process.env.ZED_SHELL,
  COLORTERM: process.env.COLORTERM,

  VSCODE_THEME_KIND: process.env.VSCODE_THEME_KIND,
  VSCODE_COLOR_THEME_KIND: process.env.VSCODE_COLOR_THEME_KIND,
  VSCODE_GIT_IPC_HANDLE: process.env.VSCODE_GIT_IPC_HANDLE,
  VSCODE_PID: process.env.VSCODE_PID,
  VSCODE_CWD: process.env.VSCODE_CWD,
  VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG,

  CURSOR_PORT: process.env.CURSOR_PORT,
  CURSOR: process.env.CURSOR,

  JETBRAINS_REMOTE_RUN: process.env.JETBRAINS_REMOTE_RUN,
  IDEA_INITIAL_DIRECTORY: process.env.IDEA_INITIAL_DIRECTORY,
  IDE_CONFIG_DIR: process.env.IDE_CONFIG_DIR,
  JB_IDE_CONFIG_DIR: process.env.JB_IDE_CONFIG_DIR,

  VISUAL: process.env.VISUAL,
  EDITOR: process.env.EDITOR,
  CODEBUFF_CLI_EDITOR: process.env.CODEBUFF_CLI_EDITOR,
  CODEBUFF_EDITOR: process.env.CODEBUFF_EDITOR,

  OPEN_TUI_THEME: process.env.OPEN_TUI_THEME,
  OPENTUI_THEME: process.env.OPENTUI_THEME,

  CODEBUFF_IS_BINARY: process.env.CODEBUFF_IS_BINARY,
  CODEBUFF_CLI_VERSION: process.env.CODEBUFF_CLI_VERSION,
  CODEBUFF_CLI_TARGET: process.env.CODEBUFF_CLI_TARGET,
  CODEBUFF_RG_PATH: process.env.CODEBUFF_RG_PATH,
  CODEBUFF_SCROLL_MULTIPLIER: process.env.CODEBUFF_SCROLL_MULTIPLIER,
  CODEBUFF_PERF_TEST: process.env.CODEBUFF_PERF_TEST,
  CODEBUFF_TRACE: process.env.CODEBUFF_TRACE,
  CODEBUFF_LAUNCHER_PID: process.env.CODEBUFF_LAUNCHER_PID,
  CODEBUFF_SHIP_LOGS: process.env.CODEBUFF_SHIP_LOGS,
  CODEBUFF_NO_TERMINAL_WATCHDOG: process.env.CODEBUFF_NO_TERMINAL_WATCHDOG,
})

export const getSystemProcessEnv = (): NodeJS.ProcessEnv => process.env
