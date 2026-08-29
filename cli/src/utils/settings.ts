import fs from 'fs'
import path from 'path'

import {
  FREEBUFF_MODELS,
  getFreebuffModelEfforts,
  isFreebuffModelId,
  migrateSupersededFreebuffModelPreference,
} from '@rivocode/common/constants/freebuff-models'
import { isReasoningEffort } from '@rivocode/common/constants/reasoning-effort'

import { getConfigDir } from './auth'
import { AGENT_MODES } from './constants'
import { logger } from './logger'

import type { AgentMode } from './constants'
import type { ReasoningEffort } from '@rivocode/common/constants/reasoning-effort'

const DEFAULT_SETTINGS: Settings = {
  mode: 'DEFAULT' as const,
  adsEnabled: true,
}

export interface Settings {
  mode?: AgentMode
  adsEnabled?: boolean
  freebuffModel?: string
  freebuffReasoningEfforts?: Record<string, ReasoningEffort>
  alwaysUseALaCarte?: boolean
  fallbackToALaCarte?: boolean
  hasSubmittedFirstPrompt?: boolean
}

export const getSettingsPath = (): string => {
  return path.join(getConfigDir(), 'settings.json')
}

const ensureConfigDirExists = (): void => {
  const configDir = getConfigDir()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
}

export const loadSettings = (): Settings => {
  const settingsPath = getSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    ensureConfigDirExists()
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2))
    return DEFAULT_SETTINGS
  }

  try {
    const settingsFile = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(settingsFile)
    return validateSettings(parsed)
  } catch (error) {
    logger.debug(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error reading settings',
    )
    return {}
  }
}

const validateSettings = (parsed: unknown): Settings => {
  if (typeof parsed !== 'object' || parsed === null) {
    return {}
  }

  const settings: Settings = {}
  const obj = parsed as Record<string, unknown>

  if (typeof obj.mode === 'string') {
    const normalized = obj.mode === 'FREE' ? 'LITE' : obj.mode
    if (AGENT_MODES.includes(normalized as AgentMode)) {
      settings.mode = normalized as AgentMode
    }
  }

  if (typeof obj.adsEnabled === 'boolean') {
    settings.adsEnabled = obj.adsEnabled
  }

  if (
    typeof obj.freebuffModel === 'string' &&
    isFreebuffModelId(obj.freebuffModel)
  ) {
    settings.freebuffModel = obj.freebuffModel
  }

  const replacement = migrateSupersededFreebuffModelPreference(
    settings.freebuffModel,
    FREEBUFF_MODELS.map((model) => model.id),
  )
  if (replacement) settings.freebuffModel = replacement

  if (obj.freebuffReasoningEfforts && typeof obj.freebuffReasoningEfforts === 'object') {
    const efforts: Record<string, ReasoningEffort> = {}
    for (const [modelId, effort] of Object.entries(
      obj.freebuffReasoningEfforts as Record<string, unknown>,
    )) {
      if (!isReasoningEffort(effort)) continue
      if (!getFreebuffModelEfforts(modelId)?.includes(effort)) continue
      efforts[modelId] = effort
    }
    if (Object.keys(efforts).length > 0) {
      settings.freebuffReasoningEfforts = efforts
    }
  }

  if (typeof obj.alwaysUseALaCarte === 'boolean') {
    settings.alwaysUseALaCarte = obj.alwaysUseALaCarte
  }

  if (typeof obj.fallbackToALaCarte === 'boolean') {
    settings.fallbackToALaCarte = obj.fallbackToALaCarte
  }

  if (typeof obj.hasSubmittedFirstPrompt === 'boolean') {
    settings.hasSubmittedFirstPrompt = obj.hasSubmittedFirstPrompt
  }

  return settings
}

export const saveSettings = (newSettings: Partial<Settings>): void => {
  const settingsPath = getSettingsPath()

  try {
    ensureConfigDirExists()

    const existingSettings = loadSettings()
    const mergedSettings = { ...existingSettings, ...newSettings }

    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2))
  } catch (error) {
    logger.debug(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error saving settings',
    )
  }
}

export const loadModePreference = (): AgentMode => {
  const settings = loadSettings()
  return settings.mode ?? 'DEFAULT'
}

export const saveModePreference = (mode: AgentMode): void => {
  saveSettings({ mode })
}

export const loadFreebuffModelPreference = (): string | undefined => {
  return loadSettings().freebuffModel
}

export const saveFreebuffModelPreference = (model: string): void => {
  if (!isFreebuffModelId(model)) return
  saveSettings({ freebuffModel: model })
}

export const loadFreebuffReasoningEfforts = (): Record<
  string,
  ReasoningEffort
> => {
  return loadSettings().freebuffReasoningEfforts ?? {}
}

export const saveFreebuffReasoningEffort = (
  model: string,
  effort: ReasoningEffort | undefined,
): void => {
  const existing = loadSettings().freebuffReasoningEfforts ?? {}
  const next = { ...existing }
  if (effort === undefined) {
    delete next[model]
  } else {
    next[model] = effort
  }
  saveSettings({ freebuffReasoningEfforts: next })
}

export const hasSubmittedFirstPrompt = (): boolean => {
  return loadSettings().hasSubmittedFirstPrompt === true
}

export const markFirstPromptSubmitted = (): void => {
  if (loadSettings().hasSubmittedFirstPrompt === true) return
  saveSettings({ hasSubmittedFirstPrompt: true })
}
