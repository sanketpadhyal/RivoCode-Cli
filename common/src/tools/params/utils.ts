import z from 'zod/v4'

import {
  endsAgentStepParam,
  endToolTag,
  startToolTag,
  toolNameParam,
} from '../constants'

import type { JSONValue } from '../../types/json'
import type { ToolResultOutput } from '../../types/messages/content-part'

export function coerceToArray(val: unknown): unknown {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
    }
  }
  if (val != null) return [val]
  return val
}

export function coerceToObject(val: unknown): unknown {
  if (typeof val !== 'string') {
    return val
  }

  try {
    const parsed = JSON.parse(val)
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed
    }
  } catch {
  }

  return val
}

export function normalizeReplacementAliases(val: unknown): unknown {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    return val
  }

  const replacement = { ...(val as Record<string, unknown>) }
  for (const [target, aliases] of [
    ['oldString', ['old', 'old_str', 'old_string']],
    ['newString', ['new', 'new_str', 'new_string']],
  ] as const) {
    if (replacement[target] !== undefined) {
      continue
    }
    const alias = aliases.find((key) => typeof replacement[key] === 'string')
    if (alias) {
      replacement[target] = replacement[alias]
    }
  }
  return replacement
}

export function $getToolCallString<Input>(params: {
  toolName: string
  inputSchema: z.ZodType<any, Input> | null
  input: Input
  endsAgentStep: boolean
}): string {
  const { toolName, input, endsAgentStep } = params
  const obj: Record<string, any> = {
    [toolNameParam]: toolName,
    ...input,
  }
  if (endsAgentStep) {
    obj[endsAgentStepParam] = endsAgentStep satisfies true
  }
  return [startToolTag, JSON.stringify(obj, null, 2), endToolTag].join('')
}

export function $getNativeToolCallExampleString<Input>(params: {
  toolName: string
  inputSchema: z.ZodType<any, Input> | null
  input: Input
  endsAgentStep?: boolean
}): string {
  const { toolName, input } = params
  return [
    `<${toolName}_params_example>\n`,
    JSON.stringify(input, null, 2),
    `\n</${toolName}_params_example>`,
  ].join('')
}

export function jsonToolResultSchema<T extends JSONValue>(
  valueSchema: z.ZodType<T>,
) {
  return z.tuple([
    z.object({
      type: z.literal('json'),
      value: valueSchema,
    }) satisfies z.ZodType<ToolResultOutput>,
  ])
}

export function emptyToolResultSchema() {
  return z.tuple([])
}

export function textToolResultSchema() {
  return z.tuple([
    z.object({
      type: z.literal('json'),
      value: z.object({
        message: z.string(),
      }),
    }) satisfies z.ZodType<ToolResultOutput>,
  ])
}
