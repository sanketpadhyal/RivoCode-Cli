import { parseAgentId } from '../util/agent-id-parsing'

import {
  FREEBUFF_GEMINI_PRO_AGENT_IDS,
  FREEBUFF_GEMINI_THINKER_AGENT_ID,
} from './freebuff-gemini-thinker'
import {
  FALLBACK_FREEBUFF_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_FABLE_5_MODEL_ID,
  FREEBUFF_GEMINI_PRO_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_FLASH_MAX_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MAX_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MAX_MODEL_ID,
  FREEBUFF_KIMI_K3_ECO_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID,
  FREEBUFF_MINIMAX_M3_MODEL_ID,
  FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
  FREEBUFF_OX_ALPHA_MODEL_ID,
  FREEBUFF_SOLAR_PRO_4_MODEL_ID,
  LIMITED_FREEBUFF_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
} from './freebuff-models'
import {
  GEMINI_3_1_FLASH_LITE_MODEL_ID,
  GEMINI_3_5_FLASH_LITE_MODEL_ID,
} from './gemini'

import type { CostMode } from './model-config'

export const FREE_COST_MODE = 'free' as const

export const FREEBUFF_DESKTOP_THREAD_AGENT_ID = 'freebuff-desktop-thread'

export const FREEBUFF_DESKTOP_AUTORUN_AGENT_ID = 'freebuff-desktop-autorun'

export const FREEBUFF_DESKTOP_THREAD_V3_SUFFIX = 'v3'

export function getFreebuffDesktopThreadAgentId(
  executionMode: 'local' | 'worktree',
  agentGeneration: 'base2' | 'base3' = 'base2',
): string {
  const base = `${FREEBUFF_DESKTOP_THREAD_AGENT_ID}-${executionMode}`
  return agentGeneration === 'base3'
    ? `${base}-${FREEBUFF_DESKTOP_THREAD_V3_SUFFIX}`
    : base
}

export const FREEBUFF_DESKTOP_THREAD_AGENT_IDS = [
  FREEBUFF_DESKTOP_THREAD_AGENT_ID,
  getFreebuffDesktopThreadAgentId('local'),
  getFreebuffDesktopThreadAgentId('worktree'),
  getFreebuffDesktopThreadAgentId('local', 'base3'),
  getFreebuffDesktopThreadAgentId('worktree', 'base3'),
] as const

export const FREEBUFF_WEB_BASE3_AGENT_ID_BY_MODEL: Record<string, string> = {
  [FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]: 'base3-free-deepseek',
  [FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]: 'base3-free-deepseek-flash',
  [FREEBUFF_MIMO_V25_MODEL_ID]: 'base3-free-mimo',
  [FREEBUFF_MINIMAX_M3_MODEL_ID]: 'base3-free-minimax-m3',
  [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: 'base3-free-luna',
  [FREEBUFF_GLM_V52_MODEL_ID]: 'base3-free-glm',
  [FREEBUFF_GLM_V53_FLASH_MODEL_ID]: 'base3-free-glm-5-3-flash',
  [FREEBUFF_KIMI_K3_ECO_MODEL_ID]: 'base3-free-kimi-k3-eco',
  [FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID]: 'base3-free-luna-es',
  [FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID]: 'base3-free-muse-spark',
  [FREEBUFF_OX_ALPHA_MODEL_ID]: 'base3-free-ox-alpha',
  [FREEBUFF_SOLAR_PRO_4_MODEL_ID]: 'base3-free-solar-pro4',
}

export const FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL: Record<string, string> = {
  [FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]: 'base3-free-deepseek',
  [FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]: 'base3-free-deepseek-flash',
  [FREEBUFF_MIMO_V25_MODEL_ID]: 'base3-free-mimo',
  [FREEBUFF_MINIMAX_M3_MODEL_ID]: 'base3-free-minimax-m3',
  [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: 'base3-free-luna',
  [FREEBUFF_GLM_V52_MODEL_ID]: 'base3-free-glm',
  [FREEBUFF_GLM_V53_FLASH_MODEL_ID]: 'base3-free-glm-5-3-flash',
  [FREEBUFF_FABLE_5_MODEL_ID]: 'base3-free-fable',
  [FREEBUFF_OX_ALPHA_MODEL_ID]: 'base3-free-ox-alpha',
  [FREEBUFF_SOLAR_PRO_4_MODEL_ID]: 'base3-free-solar-pro4',
}

export const FREEBUFF_BASE3_AGENT_IDS: ReadonlySet<string> = new Set([
  ...Object.values(FREEBUFF_WEB_BASE3_AGENT_ID_BY_MODEL),
  ...Object.values(FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL),
])

export const CLOUD_PLANNER_AGENT_ID = 'base2-free-cloud-planner'
export const CLOUD_PLANNER_MODEL_ID = FALLBACK_FREEBUFF_MODEL_ID
export const CLOUD_PLANNER_LIMITED_AGENT_ID = 'base2-free-cloud-planner-limited'
export const CLOUD_PLANNER_LIMITED_MODEL_ID = LIMITED_FREEBUFF_MODEL_ID

export const CLOUD_BUILD_MODEL_ID = FALLBACK_FREEBUFF_MODEL_ID

export function cloudPlannerModelForAccessTier(
  accessTier: string | null | undefined,
): string {
  return accessTier === 'limited'
    ? CLOUD_PLANNER_LIMITED_MODEL_ID
    : CLOUD_PLANNER_MODEL_ID
}

export function cloudBuildModelForAccessTier(
  accessTier: string | null | undefined,
): string {
  return accessTier === 'limited'
    ? CLOUD_PLANNER_LIMITED_MODEL_ID
    : CLOUD_BUILD_MODEL_ID
}

const CLOUD_BUILD_MODEL_IDS: ReadonlySet<string> = new Set([
  CLOUD_BUILD_MODEL_ID,
  FALLBACK_FREEBUFF_MODEL_ID,
  cloudBuildModelForAccessTier('limited'),
])

export function isCloudBuildModelId(model: string | null | undefined): boolean {
  return !!model && CLOUD_BUILD_MODEL_IDS.has(model)
}

export function resolveCloudBuildModel(
  requested: string | null | undefined,
): string {
  return isCloudBuildModelId(requested)
    ? (requested as string)
    : CLOUD_BUILD_MODEL_ID
}

export function cloudPlannerAgentIdForModel(
  model: string | null | undefined,
): string {
  if (CLOUD_PLANNER_MODEL_ID === CLOUD_PLANNER_LIMITED_MODEL_ID) {
    return CLOUD_PLANNER_AGENT_ID
  }
  return model === CLOUD_PLANNER_LIMITED_MODEL_ID
    ? CLOUD_PLANNER_LIMITED_AGENT_ID
    : CLOUD_PLANNER_AGENT_ID
}

export const FREEBUFF_ROOT_AGENT_IDS = [
  'base2-free',
  'base2-free-deepseek',
  'base2-free-deepseek-flash',
  'base2-free-mimo',
  'base2-free-minimax-m3',
  'base2-free-luna',
  'base2-free-solar-pro4',
  'base2-free-glm',
  'base2-free-glm-5-3-flash',
  'base2-free-kimi-k3-eco',
  'base2-free-luna-es',
  'base2-free-deepseek-pro-max',
  'base2-free-deepseek-flash-max',
  'base2-free-luna-max',
  'base2-free-muse-spark',
  'base2-free-ox-alpha',
  'base2-free-fable',
  'base2-free-cloud-planner',
  'base2-free-cloud-planner-limited',
  'base3-free-deepseek',
  'base3-free-deepseek-flash',
  'base3-free-mimo',
  'base3-free-minimax-m3',
  'base3-free-luna',
  'base3-free-solar-pro4',
  'base3-free-glm',
  'base3-free-glm-5-3-flash',
  'base3-free-kimi-k3-eco',
  'base3-free-luna-es',
  'base3-free-muse-spark',
  'base3-free-ox-alpha',
  'base3-free-fable',
  ...FREEBUFF_DESKTOP_THREAD_AGENT_IDS,
  FREEBUFF_DESKTOP_AUTORUN_AGENT_ID,
] as const
const FREEBUFF_ROOT_AGENT_ID_SET: ReadonlySet<string> = new Set(
  FREEBUFF_ROOT_AGENT_IDS,
)

export const FREEBUFF_ROOT_AGENT_ID_BY_MODEL: Record<string, string> = {
  [FREEBUFF_MIMO_V25_MODEL_ID]: 'base2-free-mimo',
  [FREEBUFF_MINIMAX_M3_MODEL_ID]: 'base2-free-minimax-m3',
  [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: 'base2-free-luna',
  [FREEBUFF_SOLAR_PRO_4_MODEL_ID]: 'base2-free-solar-pro4',
  [FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]: 'base2-free-deepseek',
  [FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]: 'base2-free-deepseek-flash',
  [FREEBUFF_GLM_V52_MODEL_ID]: 'base2-free-glm',
  [FREEBUFF_GLM_V53_FLASH_MODEL_ID]: 'base2-free-glm-5-3-flash',
  [FREEBUFF_KIMI_K3_ECO_MODEL_ID]: 'base2-free-kimi-k3-eco',
  [FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID]: 'base2-free-luna-es',
  [FREEBUFF_FABLE_5_MODEL_ID]: 'base2-free-fable',
  [FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID]: 'base2-free-muse-spark',
  [FREEBUFF_OX_ALPHA_MODEL_ID]: 'base2-free-ox-alpha',
}

export const FREEBUFF_REVIEWER_AGENT_ID_BY_MODEL: Record<string, string> = {
  [FREEBUFF_MIMO_V25_MODEL_ID]: 'code-reviewer-mimo',
  [FREEBUFF_MINIMAX_M3_MODEL_ID]: 'code-reviewer-minimax-m3',
  [FREEBUFF_GPT_5_6_LUNA_MODEL_ID]: 'code-reviewer-luna',
  [FREEBUFF_SOLAR_PRO_4_MODEL_ID]: 'code-reviewer-solar-pro4',
  [FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]: 'code-reviewer-deepseek',
  [FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]: 'code-reviewer-deepseek-flash',
  [FREEBUFF_GLM_V52_MODEL_ID]: 'code-reviewer-glm',
  [FREEBUFF_GLM_V53_FLASH_MODEL_ID]: 'code-reviewer-glm-5-3-flash',
  [FREEBUFF_FABLE_5_MODEL_ID]: 'code-reviewer-fable',
  [FREEBUFF_OX_ALPHA_MODEL_ID]: 'code-reviewer-ox-alpha',
}

const FREEBUFF_DESKTOP_MODELS = new Set([
  FREEBUFF_MINIMAX_M3_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_SOLAR_PRO_4_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_GLM_V53_FLASH_MODEL_ID,
  FREEBUFF_OX_ALPHA_MODEL_ID,
])

const GEMINI_HELPER_MODELS = new Set([
  GEMINI_3_5_FLASH_LITE_MODEL_ID,
  GEMINI_3_1_FLASH_LITE_MODEL_ID,
])

export function getFreebuffRootAgentIdForModel(model: string): string {
  return FREEBUFF_ROOT_AGENT_ID_BY_MODEL[model] ?? 'base2-free'
}

export function getFreebuffBase3RootAgentIdForModel(model: string): string {
  return (
    FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL[model] ??
    getFreebuffRootAgentIdForModel(model)
  )
}

export const FREE_MODE_AGENT_MODELS: Record<string, Set<string>> = {
  'base2-free': new Set([
    FREEBUFF_MINIMAX_M3_MODEL_ID,
    FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
    FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    FREEBUFF_MIMO_V25_MODEL_ID,
  ]),
  'base2-free-deepseek': new Set([FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]),
  'base2-free-deepseek-flash': new Set([FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]),
  'base2-free-mimo': new Set([FREEBUFF_MIMO_V25_MODEL_ID]),
  'base2-free-minimax-m3': new Set([FREEBUFF_MINIMAX_M3_MODEL_ID]),
  'base2-free-luna': new Set([FREEBUFF_GPT_5_6_LUNA_MODEL_ID]),
  'base2-free-solar-pro4': new Set([FREEBUFF_SOLAR_PRO_4_MODEL_ID]),
  'base2-free-glm': new Set([FREEBUFF_GLM_V52_MODEL_ID]),
  'base2-free-glm-5-3-flash': new Set([FREEBUFF_GLM_V53_FLASH_MODEL_ID]),
  'base2-free-kimi-k3-eco': new Set([FREEBUFF_KIMI_K3_ECO_MODEL_ID]),
  'base2-free-luna-es': new Set([FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID]),
  'base3-free-luna-es': new Set([FREEBUFF_GPT_5_6_LUNA_ES_MODEL_ID]),
  'base2-free-deepseek-pro-max': new Set([
    FREEBUFF_DEEPSEEK_V4_PRO_MAX_MODEL_ID,
  ]),
  'base2-free-deepseek-flash-max': new Set([
    FREEBUFF_DEEPSEEK_V4_FLASH_MAX_MODEL_ID,
  ]),
  'base2-free-luna-max': new Set([FREEBUFF_GPT_5_6_LUNA_MAX_MODEL_ID]),
  'base2-free-muse-spark': new Set([
    FREEBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
  ]),
  'base2-free-ox-alpha': new Set([FREEBUFF_OX_ALPHA_MODEL_ID]),
  'base2-free-fable': new Set([FREEBUFF_FABLE_5_MODEL_ID]),
  'base2-free-cloud-planner': new Set([CLOUD_PLANNER_MODEL_ID]),
  'base2-free-cloud-planner-limited': new Set([LIMITED_FREEBUFF_MODEL_ID]),

  ...Object.fromEntries(
    [
      ...Object.entries(FREEBUFF_WEB_BASE3_AGENT_ID_BY_MODEL),
      ...Object.entries(FREEBUFF_CLI_BASE3_AGENT_ID_BY_MODEL),
    ].map(([model, agentId]) => [agentId, new Set([model])]),
  ),

  [FREEBUFF_DESKTOP_THREAD_AGENT_ID]: FREEBUFF_DESKTOP_MODELS,
  [getFreebuffDesktopThreadAgentId('local')]: FREEBUFF_DESKTOP_MODELS,
  [getFreebuffDesktopThreadAgentId('worktree')]: FREEBUFF_DESKTOP_MODELS,
  [getFreebuffDesktopThreadAgentId('local', 'base3')]: FREEBUFF_DESKTOP_MODELS,
  [getFreebuffDesktopThreadAgentId('worktree', 'base3')]:
    FREEBUFF_DESKTOP_MODELS,
  [FREEBUFF_DESKTOP_AUTORUN_AGENT_ID]: FREEBUFF_DESKTOP_MODELS,

  'file-picker': new Set(['google/gemini-2.5-flash-lite']),
  'file-picker-max': GEMINI_HELPER_MODELS,
  'file-lister': GEMINI_HELPER_MODELS,

  'researcher-web': GEMINI_HELPER_MODELS,
  'researcher-docs': GEMINI_HELPER_MODELS,

  'browser-use': GEMINI_HELPER_MODELS,

  basher: GEMINI_HELPER_MODELS,
  'tmux-cli': new Set([FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]),

  'code-reviewer-minimax-m3': new Set([FREEBUFF_MINIMAX_M3_MODEL_ID]),
  'code-reviewer-luna': new Set([FREEBUFF_GPT_5_6_LUNA_MODEL_ID]),
  'code-reviewer-solar-pro4': new Set([FREEBUFF_SOLAR_PRO_4_MODEL_ID]),
  'code-reviewer-ox-alpha': new Set([FREEBUFF_OX_ALPHA_MODEL_ID]),
  'code-reviewer-deepseek': new Set([FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID]),
  'code-reviewer-deepseek-flash': new Set([
    FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  ]),
  'code-reviewer-mimo': new Set([FREEBUFF_MIMO_V25_MODEL_ID]),
  'code-reviewer-glm': new Set([FREEBUFF_GLM_V52_MODEL_ID]),
  'code-reviewer-glm-5-3-flash': new Set([FREEBUFF_GLM_V53_FLASH_MODEL_ID]),
  'code-reviewer-fable': new Set([FREEBUFF_FABLE_5_MODEL_ID]),
  'code-reviewer-lite': new Set([
    FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
    FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    FREEBUFF_MIMO_V25_MODEL_ID,
  ]),

  [FREEBUFF_GEMINI_THINKER_AGENT_ID]: new Set([FREEBUFF_GEMINI_PRO_MODEL_ID]),
}

export const FREE_TIER_AGENTS = new Set([
  'file-picker',
  'file-picker-max',
  'file-lister',
  'researcher-web',
  'researcher-docs',
])

export function isFreeMode(costMode: CostMode | string | undefined): boolean {
  return costMode === FREE_COST_MODE
}

export function isFreebuffRootAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'codebuff') return false
  return FREEBUFF_ROOT_AGENT_ID_SET.has(agentId)
}

export const FREEBUFF_ROOT_SYSTEM_PROMPT_OPENINGS = [
  'You are Buffy, the strategic coding assistant.',
  'You are Buffy, the coding agent behind Codebuff.',
  'You are Buffy, the Freebuff Cloud project planner.',
  'You are Buffy, the auto-run agent behind Freebuff Desktop.',
  'You are Buffy, a strategic assistant that orchestrates complex coding tasks through specialized sub-agents.',
] as const

export function hasFreebuffRootSystemPromptOpening(text: string): boolean {
  const trimmed = text.trimStart()
  return FREEBUFF_ROOT_SYSTEM_PROMPT_OPENINGS.some((opening) =>
    trimmed.startsWith(opening),
  )
}

export function isFreebuffGeminiThinkerAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'codebuff') return false
  return agentId === FREEBUFF_GEMINI_THINKER_AGENT_ID
}

export function isFreebuffGeminiProAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'codebuff') return false
  return FREEBUFF_GEMINI_PRO_AGENT_IDS.has(agentId)
}

export function isFreeModeAllowedAgentModel(
  fullAgentId: string,
  model: string,
): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)

  if (!agentId) return false

  if (publisherId && publisherId !== 'codebuff') return false

  const allowedModels = FREE_MODE_AGENT_MODELS[agentId]
  if (!allowedModels) return false

  if (allowedModels.size === 0) return false

  if (allowedModels.has(model)) return true

  for (const allowed of allowedModels) {
    const prefix = allowed + '-'
    if (model.startsWith(prefix)) {
      const suffix = model.slice(prefix.length)
      if (/^\d{6,8}(?:$|[-:])/.test(suffix)) return true
    }
  }

  return false
}

export function isLimitedTierSubstitutedModel(
  fullAgentId: string,
  model: string,
): boolean {
  if (
    model !== LIMITED_FREEBUFF_MODEL_ID &&
    model !== FALLBACK_FREEBUFF_MODEL_ID
  ) {
    return false
  }

  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'codebuff') return false

  const allowedModels = FREE_MODE_AGENT_MODELS[agentId]
  return !!allowedModels && allowedModels.size > 0
}

export function isFreeAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)

  if (!agentId) return false

  if (!FREE_TIER_AGENTS.has(agentId)) return false

  if (publisherId && publisherId !== 'codebuff') return false

  return true
}
