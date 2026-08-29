import type { ToolName } from '@rivocode/sdk'

import { getCliEnv } from './env'

export const IS_FREEBUFF = getCliEnv().FREEBUFF_MODE === 'true'

export const END_SESSION_MESSAGE =
  'Ending session and returning to the model picker…'

export const HIDDEN_AGENT_IDS = ['context-pruner'] as const

export const COLLAPSED_BY_DEFAULT_TOOL_NAMES: readonly ToolName[] = [
  'set_output',
] as const

export const shouldCollapseToolByDefault = (toolName: string): boolean => {
  return COLLAPSED_BY_DEFAULT_TOOL_NAMES.includes(toolName as ToolName)
}

export const shouldHideAgent = (agentId: string): boolean => {
  return HIDDEN_AGENT_IDS.some((hiddenId) => agentId.includes(hiddenId))
}

export const COLLAPSED_BY_DEFAULT_AGENT_IDS = [
  'file-picker',
  'code-reviewer-selector',
  'thinker-selector',
  'best-of-n-selector',
  'basher',
  'code-searcher',
  'directory-lister',
  'glob-matcher',
  'researcher-web',
  'researcher-docs',
] as const

export const shouldCollapseByDefault = (agentType: string): boolean => {
  return COLLAPSED_BY_DEFAULT_AGENT_IDS.some((collapsedId) =>
    agentType.includes(collapsedId),
  )
}

export const PARENT_CHILD_COLLAPSE_RULES: Record<string, string[]> = {
  'code-reviewer-multi-prompt': ['code-reviewer'],
}

export const shouldCollapseForParent = (
  childAgentType: string,
  parentAgentType: string | undefined,
): boolean => {
  if (!parentAgentType) {
    return false
  }

  for (const [parentPattern, childPatterns] of Object.entries(
    PARENT_CHILD_COLLAPSE_RULES,
  )) {
    if (parentAgentType.includes(parentPattern)) {
      for (const childPattern of childPatterns) {
        if (childAgentType.includes(childPattern)) {
          return true
        }
      }
    }
  }

  return false
}

export const SIMPLE_TEXT_AGENT_IDS = [
  'best-of-n-selector',
  'best-of-n-selector-gemini',
  'best-of-n-selector2',
] as const

export const shouldRenderAsSimpleText = (agentType: string): boolean => {
  return SIMPLE_TEXT_AGENT_IDS.some((simpleTextId) =>
    agentType.includes(simpleTextId),
  )
}

export const MULTI_PROMPT_EDITOR_IDS = ['editor-multi-prompt'] as const

export const isMultiPromptEditor = (agentType: string): boolean => {
  return MULTI_PROMPT_EDITOR_IDS.some((id) => agentType.includes(id))
}

export const MAIN_AGENT_ID = 'main-agent'

export const CLI_HARNESS: 'base2' | 'base3' = 'base3'

const HARNESS_MODE_IDS = {
  base2: { DEFAULT: 'base2', LITE: 'base2-lite' },
  base3: { DEFAULT: 'base3', LITE: 'base3-lite' },
} as const

export const AGENT_MODE_TO_ID = {
  DEFAULT: HARNESS_MODE_IDS[CLI_HARNESS].DEFAULT,
  LITE: IS_FREEBUFF ? 'base2-free' : HARNESS_MODE_IDS[CLI_HARNESS].LITE,
  MAX: 'base2-max',
  PLAN: 'base2-plan',
} as const

export type AgentMode = keyof typeof AGENT_MODE_TO_ID
export const AGENT_MODES = Object.keys(AGENT_MODE_TO_ID) as AgentMode[]

export const AGENT_MODE_TO_COST_MODE = {
  DEFAULT: 'normal',
  LITE: IS_FREEBUFF ? 'free' : 'lite',
  MAX: 'max',
  PLAN: 'normal',
} as const satisfies Record<
  AgentMode,
  'free' | 'lite' | 'normal' | 'max' | 'experimental' | 'ask'
>
