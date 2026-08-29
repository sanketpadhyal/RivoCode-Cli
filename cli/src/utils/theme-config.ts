
import type { ChatTheme } from '../types/theme-system'

export interface ThemePlugin {
  name: string
  apply: (
    theme: ChatTheme,
    mode: 'dark' | 'light',
  ) => Partial<ChatTheme>
}

export interface ThemeConfig {
  customColors?: Partial<ChatTheme>
  plugins?: ThemePlugin[]
}

export const defaultThemeConfig: ThemeConfig = {
  customColors: {},
  plugins: [],
}

export let themeConfig: ThemeConfig = defaultThemeConfig

export const setThemeConfig = (config: Partial<ThemeConfig>): void => {
  themeConfig = {
    ...defaultThemeConfig,
    ...config,
    plugins: [...(defaultThemeConfig.plugins ?? []), ...(config.plugins ?? [])],
  }
}

export const registerThemePlugin = (plugin: ThemePlugin): void => {
  if (!themeConfig.plugins) {
    themeConfig.plugins = []
  }
  if (themeConfig.plugins.some((p) => p.name === plugin.name)) {
    console.warn(`Theme plugin "${plugin.name}" is already registered`)
    return
  }
  themeConfig.plugins.push(plugin)
}

const resolveThemeColors = (theme: ChatTheme, mode: 'dark' | 'light'): void => {
  const defaultFallback = mode === 'dark' ? '#ffffff' : '#000000'

  const resolve = (value: string, fallback: string = defaultFallback): string => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'default' || normalized.length === 0) {
        return fallback
      }
      return value
    }
    return fallback
  }

  theme.foreground = resolve(theme.foreground)
  theme.muted = resolve(theme.muted)
  theme.inputFg = resolve(theme.inputFg)
  theme.inputFocusedFg = resolve(theme.inputFocusedFg)
}

export const buildTheme = (
  baseTheme: ChatTheme,
  mode: 'dark' | 'light',
  customColors?: Partial<ChatTheme>,
  plugins?: ThemePlugin[],
): ChatTheme => {
  const theme = { ...baseTheme }

  if (customColors) {
    Object.assign(theme, customColors)
  }

  if (plugins) {
    for (const plugin of plugins) {
      const pluginOverrides = plugin.apply(theme, mode)
      Object.assign(theme, pluginOverrides)
    }
  }

  resolveThemeColors(theme, mode)
  theme.name = mode

  return theme
}
