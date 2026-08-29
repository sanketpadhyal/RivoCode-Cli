import { existsSync, readFileSync, readdirSync, statSync, watch } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

import { getCliEnv } from './env'

import type { MarkdownPalette } from './markdown-renderer'
import type { CliEnv } from '../types/env'
import type {
  ChatTheme,
  MarkdownHeadingLevel,
  MarkdownThemeOverrides,
  ThemeName,
} from '../types/theme-system'

let _truecolorSupport: boolean | null = null

export function supportsTruecolor(env: CliEnv = getCliEnv()): boolean {
  if (_truecolorSupport !== null) {
    return _truecolorSupport
  }

  const termProgram = env.TERM_PROGRAM?.toLowerCase() ?? ''

  if (termProgram === 'apple_terminal') {
    _truecolorSupport = false
    return false
  }

  const colorterm = env.COLORTERM?.toLowerCase()
  if (colorterm === 'truecolor' || colorterm === '24bit') {
    _truecolorSupport = true
    return true
  }

  const truecolorTerminals = [
    'iterm.app',
    'hyper',
    'wezterm',
    'alacritty',
    'kitty',
    'ghostty',
    'vscode',
  ]

  if (truecolorTerminals.some(t => termProgram.includes(t))) {
    _truecolorSupport = true
    return true
  }

  const term = env.TERM?.toLowerCase() ?? ''
  if (term.includes('truecolor') || term.includes('24bit')) {
    _truecolorSupport = true
    return true
  }

  if (term === 'xterm-kitty' || term === 'alacritty' || term.includes('ghostty')) {
    _truecolorSupport = true
    return true
  }

  _truecolorSupport = false
  return false
}

export function getLogoBlockColor(
  themeName: ThemeName,
  env: CliEnv = getCliEnv(),
): string {
  const isTruecolor = supportsTruecolor(env)
  if (themeName === 'dark') {
    return isTruecolor ? '#ffffff' : 'white'
  }
  return isTruecolor ? '#000000' : 'black'
}

export function getLogoAccentColor(
  themeName: ThemeName,
  env: CliEnv = getCliEnv(),
): string {
  const isTruecolor = supportsTruecolor(env)
  if (themeName === 'dark') {
    return isTruecolor ? '#9EFC62' : 'lime'
  }
  return isTruecolor ? '#65A83E' : 'green'
}

const IDE_THEME_INFERENCE = {
  dark: [
    'dark',
    'midnight',
    'night',
    'noir',
    'black',
    'charcoal',
    'dim',
    'dracula',
    'darcula',
    'moon',
    'nebula',
    'obsidian',
    'shadow',
    'storm',
    'monokai',
    'ayu mirage',
    'material darker',
    'tokyo',
    'abyss',
    'zed dark',
    'vs dark',
  ],
  light: [
    'light',
    'day',
    'dawn',
    'bright',
    'paper',
    'sun',
    'snow',
    'cloud',
    'white',
    'solarized light',
    'pastel',
    'cream',
    'zed light',
    'vs light',
  ],
} as const

const VS_CODE_PRODUCT_DIRS = [
  'Code',
  'Code - Insiders',
  'Code - OSS',
  'VSCodium',
  'VSCodium - Insiders',
  'Cursor',
] as const

const normalizeThemeName = (themeName: string): string =>
  themeName.trim().toLowerCase()

const inferThemeFromName = (themeName: string): ThemeName | null => {
  const normalized = normalizeThemeName(themeName)

  for (const hint of IDE_THEME_INFERENCE.dark) {
    if (normalized.includes(hint)) {
      return 'dark'
    }
  }

  for (const hint of IDE_THEME_INFERENCE.light) {
    if (normalized.includes(hint)) {
      return 'light'
    }
  }

  return null
}

const stripJsonStyleComments = (raw: string): string =>
  raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const safeReadFile = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

const collectExistingPaths = (candidates: string[]): string[] => {
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      if (existsSync(candidate)) {
        seen.add(candidate)
      }
    } catch {
    }
  }
  return [...seen]
}

const resolveVSCodeSettingsPaths = (
  env: CliEnv = getCliEnv(),
): string[] => {
  const settings: string[] = []
  const home = homedir()

  if (process.platform === 'darwin') {
    const base = join(home, 'Library', 'Application Support')
    for (const product of VS_CODE_PRODUCT_DIRS) {
      settings.push(join(base, product, 'User', 'settings.json'))
    }
  } else if (process.platform === 'win32') {
    const appData = env.APPDATA
    if (appData) {
      for (const product of VS_CODE_PRODUCT_DIRS) {
        settings.push(join(appData, product, 'User', 'settings.json'))
      }
    }
  } else {
    const configDir = env.XDG_CONFIG_HOME ?? join(home, '.config')
    for (const product of VS_CODE_PRODUCT_DIRS) {
      settings.push(join(configDir, product, 'User', 'settings.json'))
    }
  }

  return settings
}

const resolveJetBrainsLafPaths = (
  env: CliEnv = getCliEnv(),
): string[] => {
  const candidates: string[] = []

  if (env.IDE_CONFIG_DIR) {
    candidates.push(join(env.IDE_CONFIG_DIR, 'options', 'laf.xml'))
  }
  if (env.JB_IDE_CONFIG_DIR) {
    candidates.push(join(env.JB_IDE_CONFIG_DIR, 'options', 'laf.xml'))
  }

  const home = homedir()

  const baseDirs: string[] = []
  if (process.platform === 'darwin') {
    baseDirs.push(join(home, 'Library', 'Application Support', 'JetBrains'))
  } else if (process.platform === 'win32') {
    const appData = env.APPDATA
    if (appData) {
      baseDirs.push(join(appData, 'JetBrains'))
    }
  } else {
    baseDirs.push(join(home, '.config', 'JetBrains'))
    baseDirs.push(join(home, '.local', 'share', 'JetBrains'))
  }

  for (const base of baseDirs) {
    try {
      if (!existsSync(base)) continue
      const entries = readdirSync(base)
      for (const entry of entries) {
        const dirPath = join(base, entry)
        try {
          if (!statSync(dirPath).isDirectory()) continue
        } catch {
          continue
        }

        candidates.push(join(dirPath, 'options', 'laf.xml'))
      }
    } catch {
    }
  }

  return candidates
}

const resolveZedSettingsPaths = (
  env: CliEnv = getCliEnv(),
): string[] => {
  const home = homedir()
  const paths: string[] = []

  const configDirs = new Set<string>()

  const xdgConfig = env.XDG_CONFIG_HOME ?? join(home, '.config')
  configDirs.add(join(xdgConfig, 'zed'))
  configDirs.add(join(xdgConfig, 'dev.zed.Zed'))

  if (process.platform === 'darwin') {
    configDirs.add(join(home, 'Library', 'Application Support', 'Zed'))
    configDirs.add(join(home, 'Library', 'Application Support', 'dev.zed.Zed'))
  } else if (process.platform === 'win32') {
    const appData = env.APPDATA
    if (appData) {
      configDirs.add(join(appData, 'Zed'))
      configDirs.add(join(appData, 'dev.zed.Zed'))
    }
  } else {
    configDirs.add(join(home, '.config', 'zed'))
    configDirs.add(join(home, '.config', 'dev.zed.Zed'))
    configDirs.add(join(home, '.local', 'share', 'zed'))
    configDirs.add(join(home, '.local', 'share', 'dev.zed.Zed'))
  }

  const legacyConfig = join(home, '.zed')
  configDirs.add(legacyConfig)

  for (const dir of configDirs) {
    paths.push(join(dir, 'settings.json'))
  }

  return paths
}

const extractVSCodeTheme = (content: string): ThemeName | null => {
  const colorThemeMatch = content.match(
    /"workbench\.colorTheme"\s*:\s*"([^"]+)"/i,
  )
  if (colorThemeMatch) {
    const inferred = inferThemeFromName(colorThemeMatch[1])
    if (inferred) return inferred
  }

  const autoDetectMatch = content.match(
    /"window\.autoDetectColorScheme"\s*:\s*(true|false)/i,
  )
  const autoDetectEnabled = autoDetectMatch?.[1]?.toLowerCase() === 'true'

  if (autoDetectEnabled) {
    const preferredDarkMatch = content.match(
      /"workbench\.preferredDarkColorTheme"\s*:\s*"([^"]+)"/i,
    )
    if (preferredDarkMatch) {
      const inferred = inferThemeFromName(preferredDarkMatch[1])
      if (inferred) return inferred
    }

    const preferredLightMatch = content.match(
      /"workbench\.preferredLightColorTheme"\s*:\s*"([^"]+)"/i,
    )
    if (preferredLightMatch) {
      const inferred = inferThemeFromName(preferredLightMatch[1])
      if (inferred) return inferred
    }
  }

  return null
}

const extractJetBrainsTheme = (content: string): ThemeName | null => {
  const autodetectMatch = content.match(
    /<component[^>]+name="LafManager"[^>]+autodetect="(true|false)"/i,
  )
  if (autodetectMatch?.[1]?.toLowerCase() === 'true') {
    return null
  }

  const normalized = content.toLowerCase()
  if (normalized.includes('darcula') || normalized.includes('dark')) {
    return 'dark'
  }

  if (normalized.includes('light')) {
    return 'light'
  }

  return null
}

const isVSCodeFamilyTerminal = (
  env: CliEnv = getCliEnv(),
): boolean => {
  if (env.TERM_PROGRAM?.toLowerCase() === 'vscode') {
    return true
  }

  if (
    env.VSCODE_GIT_IPC_HANDLE ||
    env.VSCODE_PID ||
    env.VSCODE_CWD ||
    env.VSCODE_NLS_CONFIG ||
    env.CURSOR_PORT ||
    env.CURSOR
  ) {
    return true
  }

  return false
}

const isJetBrainsTerminal = (
  env: CliEnv = getCliEnv(),
): boolean => {
  if (env.TERMINAL_EMULATOR?.toLowerCase().includes('jetbrains')) {
    return true
  }

  if (
    env.JETBRAINS_REMOTE_RUN ||
    env.IDEA_INITIAL_DIRECTORY ||
    env.IDE_CONFIG_DIR ||
    env.JB_IDE_CONFIG_DIR
  ) {
    return true
  }

  return false
}

const isZedTerminal = (
  env: CliEnv = getCliEnv(),
): boolean => {
  const termProgram = env.TERM_PROGRAM?.toLowerCase()
  return termProgram === 'zed' || false
}

const detectVSCodeTheme = (
  env: CliEnv = getCliEnv(),
): ThemeName | null => {
  if (!isVSCodeFamilyTerminal(env)) {
    return null
  }

  const settingsPaths = collectExistingPaths(resolveVSCodeSettingsPaths(env))

  for (const settingsPath of settingsPaths) {
    const content = safeReadFile(settingsPath)
    if (!content) continue
    const theme = extractVSCodeTheme(content)
    if (theme) {
      return theme
    }

    const autoDetectMatch = content.match(
      /"window\.autoDetectColorScheme"\s*:\s*(true|false)/i,
    )
    if (autoDetectMatch?.[1]?.toLowerCase() === 'true') {
      return detectPlatformTheme()
    }
  }

  const themeKindEnv =
    env.VSCODE_THEME_KIND ?? env.VSCODE_COLOR_THEME_KIND
  if (themeKindEnv) {
    const normalized = themeKindEnv.trim().toLowerCase()
    if (normalized === 'dark' || normalized === 'hc') return 'dark'
    if (normalized === 'light') return 'light'
  }

  return null
}

const detectJetBrainsTheme = (
  env: CliEnv = getCliEnv(),
): ThemeName | null => {
  if (!isJetBrainsTerminal(env)) {
    return null
  }

  const lafPaths = collectExistingPaths(resolveJetBrainsLafPaths(env))

  for (const lafPath of lafPaths) {
    const content = safeReadFile(lafPath)
    if (!content) continue
    const theme = extractJetBrainsTheme(content)
    if (theme) {
      return theme
    }

    const autodetectMatch = content.match(
      /<component[^>]+name="LafManager"[^>]+autodetect="(true|false)"/i,
    )
    if (autodetectMatch?.[1]?.toLowerCase() === 'true') {
      return detectPlatformTheme()
    }
  }

  return null
}

const extractZedTheme = (content: string): ThemeName | null => {
  try {
    const sanitized = stripJsonStyleComments(content)
    const parsed = JSON.parse(sanitized) as Record<string, unknown>
    const candidates: unknown[] = []

    const themeSetting = parsed.theme
    if (typeof themeSetting === 'string') {
      candidates.push(themeSetting)
    } else if (themeSetting && typeof themeSetting === 'object') {
      const themeConfig = themeSetting as Record<string, unknown>
      const modeRaw = themeConfig.mode
      if (typeof modeRaw === 'string') {
        const mode = modeRaw.toLowerCase()
        if (mode === 'system') {
          return null
        }
        if (mode === 'dark' || mode === 'light') {
          candidates.push(mode)
          const modeTheme = themeConfig[mode]
          if (typeof modeTheme === 'string') {
            candidates.push(modeTheme)
          }
        }
      }

      const darkTheme = themeConfig.dark
      if (typeof darkTheme === 'string') {
        candidates.push(darkTheme)
      }

      const lightTheme = themeConfig.light
      if (typeof lightTheme === 'string') {
        candidates.push(lightTheme)
      }
    }

    const appearance = parsed.appearance
    if (appearance && typeof appearance === 'object') {
      const appearanceTheme = (appearance as Record<string, unknown>).theme
      if (typeof appearanceTheme === 'string') {
        candidates.push(appearanceTheme)
      }

      const preference = (appearance as Record<string, unknown>)
        .theme_preference
      if (typeof preference === 'string') {
        candidates.push(preference)
      }
    }

    const ui = parsed.ui
    if (ui && typeof ui === 'object') {
      const uiTheme = (ui as Record<string, unknown>).theme
      if (typeof uiTheme === 'string') {
        candidates.push(uiTheme)
      }
    }

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue

      const inferred = inferThemeFromName(candidate)
      if (inferred) {
        return inferred
      }
    }
  } catch {
  }

  return null
}

const detectZedTheme = (
  env: CliEnv = getCliEnv(),
): ThemeName | null => {
  if (!isZedTerminal(env)) {
    return null
  }

  const settingsPaths = collectExistingPaths(resolveZedSettingsPaths(env))
  for (const settingsPath of settingsPaths) {
    const content = safeReadFile(settingsPath)
    if (!content) continue

    const theme = extractZedTheme(content)
    if (theme) {
      return theme
    }

    try {
      const sanitized = stripJsonStyleComments(content)
      const parsed = JSON.parse(sanitized) as Record<string, unknown>
      const themeSetting = parsed.theme
      if (themeSetting && typeof themeSetting === 'object') {
        const themeConfig = themeSetting as Record<string, unknown>
        const modeRaw = themeConfig.mode
        if (typeof modeRaw === 'string' && modeRaw.toLowerCase() === 'system') {
          return detectPlatformTheme()
        }
      }
    } catch {
    }
  }

  return null
}

export const detectIDETheme = (
  env: CliEnv = getCliEnv(),
): ThemeName | null => {
  const theme = detectVSCodeTheme(env)
  if (theme) return theme

  const jbTheme = detectJetBrainsTheme(env)
  if (jbTheme) return jbTheme

  const zedTheme = detectZedTheme(env)
  if (zedTheme) return zedTheme

  return null
}

export const getIDEThemeConfigPaths = (
  env: CliEnv = getCliEnv(),
): string[] => {
  const paths = new Set<string>()
  for (const path of resolveVSCodeSettingsPaths(env)) {
    paths.add(path)
  }
  for (const path of resolveJetBrainsLafPaths(env)) {
    paths.add(path)
  }
  for (const path of resolveZedSettingsPaths(env)) {
    paths.add(path)
  }
  return [...paths]
}

type ChatThemeOverrides = Partial<Omit<ChatTheme, 'markdown'>> & {
  markdown?: MarkdownThemeOverrides
}

type ThemeOverrideConfig = Partial<Record<ThemeName, ChatThemeOverrides>> & {
  all?: ChatThemeOverrides
}

const mergeMarkdownOverrides = (
  base: MarkdownThemeOverrides | undefined,
  override: MarkdownThemeOverrides | undefined,
): MarkdownThemeOverrides | undefined => {
  if (!base && !override) return undefined
  if (!override)
    return base
      ? {
          ...base,
          headingFg: base.headingFg ? { ...base.headingFg } : undefined,
        }
      : undefined

  const mergedHeading = {
    ...(base?.headingFg ?? {}),
    ...(override.headingFg ?? {}),
  }

  return {
    ...(base ?? {}),
    ...override,
    headingFg:
      Object.keys(mergedHeading).length > 0
        ? (mergedHeading as Partial<Record<MarkdownHeadingLevel, string>>)
        : undefined,
  }
}

const mergeTheme = (
  base: ChatTheme,
  override?: ChatThemeOverrides,
): ChatTheme => {
  if (!override) {
    return {
      ...base,
      markdown: base.markdown
        ? {
            ...base.markdown,
            headingFg: base.markdown.headingFg
              ? { ...base.markdown.headingFg }
              : undefined,
          }
        : undefined,
    }
  }

  return {
    ...base,
    ...override,
    markdown: mergeMarkdownOverrides(base.markdown, override.markdown),
  }
}

export const parseThemeOverrides = (
  raw: string,
): Partial<Record<ThemeName, ChatThemeOverrides>> => {
  try {
    const parsed = JSON.parse(raw) as ThemeOverrideConfig
    if (!parsed || typeof parsed !== 'object') return {}

    const result: Partial<Record<ThemeName, ChatThemeOverrides>> = {}
    const common =
      typeof parsed.all === 'object' && parsed.all ? parsed.all : undefined

    for (const themeName of ['dark', 'light'] as ThemeName[]) {
      const specific =
        typeof parsed?.[themeName] === 'object' && parsed?.[themeName]
          ? parsed?.[themeName]
          : undefined

      const mergedOverrides =
        common || specific
          ? {
              ...(common ?? {}),
              ...(specific ?? {}),
              markdown: mergeMarkdownOverrides(
                common?.markdown,
                specific?.markdown,
              ),
            }
          : undefined

      if (mergedOverrides) {
        result[themeName] = mergedOverrides
      }
    }

    return result
  } catch {
    return {}
  }
}

const textDecoder = new TextDecoder()

const readSpawnOutput = (output: unknown): string => {
  if (!output) return ''
  if (typeof output === 'string') return output.trim()
  if (output instanceof Uint8Array) return textDecoder.decode(output).trim()
  return ''
}

const runSystemCommand = (command: string[]): string | null => {
  if (typeof Bun === 'undefined') return null
  if (command.length === 0) return null

  const [binary] = command
  if (!binary) return null

  const resolvedBinary =
    Bun.which(binary) ??
    (process.platform === 'win32' ? Bun.which(`${binary}.exe`) : null)
  if (!resolvedBinary) return null

  try {
    const result = Bun.spawnSync({
      cmd: [resolvedBinary, ...command.slice(1)],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (result.exitCode !== 0) return null
    return readSpawnOutput(result.stdout)
  } catch {
    return null
  }
}

export const detectTerminalOverrides = (): ThemeName | null => {
  return null
}

export function detectPlatformTheme(): ThemeName {
  if (typeof Bun !== 'undefined') {
    if (process.platform === 'darwin') {
      const value = runSystemCommand([
        'defaults',
        'read',
        '-g',
        'AppleInterfaceStyle',
      ])
      if (value?.toLowerCase() === 'dark') return 'dark'
      return 'light'
    }

    if (process.platform === 'linux') {
      const value = runSystemCommand([
        'gsettings',
        'get',
        'org.gnome.desktop.interface',
        'color-scheme',
      ])
      if (value?.toLowerCase().includes('dark')) return 'dark'
      if (value?.toLowerCase().includes('light')) return 'light'
    }
  }

  return 'dark'
}

const DEFAULT_CHAT_THEMES: Record<ThemeName, ChatTheme> = {
  dark: {
    name: 'dark',
    primary: '#9EFC62',
    secondary: '#a3aed0',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#FFA500',
    info: '#9EFC62',
    link: '#3B82F6',
    directory: '#9CA3AF',

    foreground: '#f1f5f9',
    background: 'transparent',
    muted: '#acb3bf',
    border: '#536175',
    surface: '#202327',
    surfaceHover: '#334155',

    aiLine: '#6b7280',
    userLine: '#9EFC62',

    agentToggleHeaderBg: '#f97316',
    agentToggleExpandedBg: '#1d4ed8',
    agentFocusedBg: '#334155',
    agentContentBg: '#000000',
    inputFg: '#f5f5f5',
    inputFocusedFg: '#ffffff',

    modeFastBg: '#f97316',
    modeFastText: '#f97316',
    modeMaxBg: '#dc2626',
    modeMaxText: '#dc2626',
    modePlanBg: '#1e40af',
    modePlanText: '#1e40af',

    imageCardBorder: '#6B7280',

    markdown: {
      codeBackground: '#374151',
      codeHeaderFg: '#5b647a',
      inlineCodeFg: '#FF8534',
      codeTextFg: '#f1f5f9',
      headingFg: {
        1: '#facc15',
        2: '#facc15',
        3: '#facc15',
        4: '#facc15',
        5: '#facc15',
        6: '#facc15',
      },
      listBulletFg: '#a3aed0',
      blockquoteBorderFg: '#334155',
      blockquoteTextFg: '#e2e8f0',
      dividerFg: '#283042',
      codeMonochrome: false,
    },
  },
  light: {
    name: 'light',
    primary: '#65A83E',
    secondary: '#6b7280',
    success: '#059669',
    error: '#ef4444',
    warning: '#F59E0B',
    info: '#65A83E',
    link: '#2563EB',
    directory: '#6B7280',

    foreground: '#111827',
    background: 'transparent',
    muted: '#6b7280',
    border: '#d1d5db',
    surface: '#f3f4f6',
    surfaceHover: '#e5e7eb',

    aiLine: '#6b7280',
    userLine: '#65A83E',

    agentToggleHeaderBg: '#ea580c',
    agentToggleExpandedBg: '#1d4ed8',
    agentFocusedBg: '#f3f4f6',
    agentContentBg: '#ffffff',
    inputFg: '#111827',
    inputFocusedFg: '#000000',

    modeFastBg: '#f97316',
    modeFastText: '#f97316',
    modeMaxBg: '#dc2626',
    modeMaxText: '#dc2626',
    modePlanBg: '#1e40af',
    modePlanText: '#1e40af',

    imageCardBorder: '#6B7280',

    markdown: {
      codeBackground: '#f3f4f6',
      codeHeaderFg: '#6b7280',
      inlineCodeFg: '#C45A00',
      codeTextFg: '#111827',
      headingFg: {
        1: '#dc2626',
        2: '#dc2626',
        3: '#dc2626',
        4: '#dc2626',
        5: '#dc2626',
        6: '#dc2626',
      },
      listBulletFg: '#6b7280',
      blockquoteBorderFg: '#d1d5db',
      blockquoteTextFg: '#374151',
      dividerFg: '#e5e7eb',
      codeMonochrome: false,
    },
  },
}

export const chatThemes = {
  dark: DEFAULT_CHAT_THEMES.dark,
  light: DEFAULT_CHAT_THEMES.light,
}

export const createMarkdownPalette = (theme: ChatTheme): MarkdownPalette => {
  const headingDefaults: Record<MarkdownHeadingLevel, string> = {
    1: theme.primary,
    2: theme.primary,
    3: theme.primary,
    4: theme.primary,
    5: theme.primary,
    6: theme.primary,
  }

  const overrides = theme.markdown?.headingFg ?? {}

  return {
    inlineCodeFg: theme.markdown?.inlineCodeFg ?? theme.foreground,
    codeBackground: theme.markdown?.codeBackground ?? theme.background,
    codeHeaderFg: theme.markdown?.codeHeaderFg ?? theme.secondary,
    headingFg: {
      ...headingDefaults,
      ...overrides,
    },
    listBulletFg: theme.markdown?.listBulletFg ?? theme.secondary,
    blockquoteBorderFg: theme.markdown?.blockquoteBorderFg ?? theme.secondary,
    blockquoteTextFg: theme.markdown?.blockquoteTextFg ?? theme.foreground,
    dividerFg: theme.markdown?.dividerFg ?? theme.secondary,
    codeTextFg: theme.markdown?.codeTextFg ?? theme.foreground,
    codeMonochrome: theme.markdown?.codeMonochrome ?? true,
    linkFg: theme.markdown?.linkFg ?? theme.link,
  }
}

export const mergeThemeOverrides = mergeTheme

export const cloneChatTheme = (input: ChatTheme): ChatTheme => ({
  ...input,
  markdown: input.markdown
    ? {
        ...input.markdown,
        headingFg: input.markdown.headingFg
          ? { ...input.markdown.headingFg }
          : undefined,
      }
    : undefined,
})

export const resolveThemeColor = (
  color?: string,
  fallback?: string,
): string | undefined => {
  if (typeof color === 'string') {
    const normalized = color.trim().toLowerCase()
    if (normalized.length > 0 && normalized !== 'default') {
      return color
    }
  }

  if (fallback !== undefined) {
    return resolveThemeColor(fallback)
  }

  return undefined
}

const FILE_WATCHER_DEBOUNCE_MS = 250

let themeStoreUpdater: ((name: ThemeName) => void) | null = null
let oscDetectedTheme: ThemeName | null = null
let pendingRecomputeTimer: NodeJS.Timeout | null = null
let themeResolver: (() => ThemeName) | null = null

export const getOscDetectedTheme = (): ThemeName | null => oscDetectedTheme
export const setOscDetectedTheme = (theme: ThemeName | null): void => {
  oscDetectedTheme = theme
}
export const setThemeResolver = (resolver: () => ThemeName) => {
  themeResolver = resolver
}

export const initializeThemeWatcher = (setter: (name: ThemeName) => void) => {
  themeStoreUpdater = setter
}

const recomputeSystemTheme = () => {
  const env = getCliEnv()
  const envPreference = env.OPEN_TUI_THEME ?? env.OPENTUI_THEME
  if (envPreference && envPreference.toLowerCase() !== 'opposite') {
    return
  }

  if (!themeResolver) {
    return
  }

  const newTheme = themeResolver()

  if (themeStoreUpdater) {
    themeStoreUpdater(newTheme)
  }
}

const debouncedRecomputeSystemTheme = () => {
  if (pendingRecomputeTimer) {
    clearTimeout(pendingRecomputeTimer)
  }
  pendingRecomputeTimer = setTimeout(() => {
    pendingRecomputeTimer = null
    recomputeSystemTheme()
  }, FILE_WATCHER_DEBOUNCE_MS)
}

let lastDetectedTheme: ThemeName | null = null
export function setLastDetectedTheme(theme: ThemeName) {
  lastDetectedTheme = theme
}
export function getLastDetectedTheme(): ThemeName | null {
  return lastDetectedTheme
}

export const setupFileWatchers = () => {
  const watchTargets: string[] = []
  const watchedDirs = new Set<string>()

  if (process.platform === 'darwin') {
    watchTargets.push(
      join(homedir(), 'Library/Preferences/.GlobalPreferences.plist'),
      join(homedir(), 'Library/Preferences/com.apple.Terminal.plist'),
    )
  }

  if (isVSCodeFamilyTerminal()) {
    watchTargets.push(...resolveVSCodeSettingsPaths())
  }
  if (isJetBrainsTerminal()) {
    watchTargets.push(...resolveJetBrainsLafPaths())
  }
  if (isZedTerminal()) {
    watchTargets.push(...resolveZedSettingsPaths())
  }

  for (const target of watchTargets) {
    if (existsSync(target)) {
      const parentDir = dirname(target)

      if (watchedDirs.has(parentDir)) continue
      watchedDirs.add(parentDir)

      try {
        const watcher = watch(
          parentDir,
          { persistent: false },
          (eventType, filename) => {
            if (filename && watchTargets.some((t) => t.endsWith(filename))) {
              debouncedRecomputeSystemTheme()
            }
          },
        )

        watcher.on('error', () => {
        })
      } catch {
      }
    }
  }
}

export function enableManualThemeRefresh() {
  process.on('SIGUSR2', () => {
    recomputeSystemTheme()
  })
}
