import { toolNames } from '../tools/constants'

export const FREEBUFF_DOWNGRADE_MODEL_ID = 'inclusionai/ling-3.0-tiny:free'

export const GENERIC_TOOL_NAMES: ReadonlySet<string> = new Set([
  'write_file',
  'web_search',
  'glob',
  'skill',
  'apply_patch',
])

export const FREEBUFF_CUSTOM_TOOL_NAMES = ['decide'] as const

export const FREEBUFF_SIGNATURE_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...(toolNames as readonly string[]).filter(
    (name) => !GENERIC_TOOL_NAMES.has(name),
  ),
  ...FREEBUFF_CUSTOM_TOOL_NAMES,
])

export type ForeignClientSignal =
  | 'foreign_toolset'
  | 'root_agent_no_tools'
  | 'sampling_params'

export type ForeignClientVerdict = {
  signal: ForeignClientSignal | null
  toolCount: number
  sampleToolNames: string[]
}

type InspectableRequest = {
  tools?: unknown
  temperature?: unknown
  top_p?: unknown
  max_tokens?: unknown
  max_completion_tokens?: unknown
}

const MAX_LOGGED_TOOL_NAME_LENGTH = 64

function readToolNames(tools: unknown): string[] {
  if (!Array.isArray(tools)) return []
  return tools
    .map((tool) =>
      typeof tool === 'object' && tool !== null
        ? (tool as { function?: { name?: unknown } }).function?.name
        : undefined,
    )
    .filter((name): name is string => typeof name === 'string')
}

export function detectForeignFreebuffClient(
  body: InspectableRequest,
  isRootAgent = false,
): ForeignClientVerdict {
  const offered = readToolNames(body.tools)
  const sampleToolNames = offered
    .slice(0, 8)
    .map((name) => name.slice(0, MAX_LOGGED_TOOL_NAME_LENGTH))

  if (offered.length > 0) {
    const hasSignatureTool = offered.some((name) =>
      FREEBUFF_SIGNATURE_TOOL_NAMES.has(name),
    )
    return {
      signal: hasSignatureTool ? null : 'foreign_toolset',
      toolCount: offered.length,
      sampleToolNames,
    }
  }

  if (isRootAgent) {
    return {
      signal: 'root_agent_no_tools',
      toolCount: 0,
      sampleToolNames,
    }
  }

  const setsSamplingParams =
    body.temperature != null ||
    body.top_p != null ||
    body.max_tokens != null ||
    body.max_completion_tokens != null
  return {
    signal: setsSamplingParams ? 'sampling_params' : null,
    toolCount: 0,
    sampleToolNames,
  }
}

export type ForeignClientDecision = ForeignClientVerdict & {
  signal: ForeignClientSignal
  downgradeTo: string | null
}

export function resolveForeignClientDowngrade(params: {
  body: InspectableRequest & { model?: unknown }
  isRootAgent?: boolean
}): ForeignClientDecision | null {
  const { body, isRootAgent = false } = params
  const verdict = detectForeignFreebuffClient(body, isRootAgent)
  if (!verdict.signal) return null

  return {
    ...verdict,
    signal: verdict.signal,
    downgradeTo:
      verdict.signal === 'foreign_toolset' &&
      body.model !== FREEBUFF_DOWNGRADE_MODEL_ID
        ? FREEBUFF_DOWNGRADE_MODEL_ID
        : null,
  }
}
