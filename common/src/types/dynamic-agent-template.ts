import { z } from 'zod/v4'

import { ALLOWED_MODEL_PREFIXES, models } from '../old-constants'
import { mcpConfigSchema } from './mcp'

import type { JSONSchema } from 'zod/v4/core'

const filteredModels = Object.values(models).filter((model) =>
  ALLOWED_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix)),
)

if (filteredModels.length === 0) {
  throw new Error('No valid models found with allowed prefixes')
}

export const JsonSchemaSchema: z.ZodType<
  JSONSchema.BaseSchema,
  JSONSchema.BaseSchema
> = z.lazy(() =>
  z.looseObject({
    type: z
      .enum([
        'object',
        'array',
        'string',
        'number',
        'boolean',
        'null',
        'integer',
      ])
      .optional(),
    description: z.string().optional(),
    properties: z
      .record(z.string(), JsonSchemaSchema.or(z.boolean()))
      .optional(),
    required: z.string().array().optional(),
    enum: z
      .union([z.string(), z.number(), z.boolean(), z.null()])
      .array()
      .optional(),
  }),
)
const JsonObjectSchemaSchema = z.intersection(
  JsonSchemaSchema,
  z.object({ type: z.literal('object') }),
)

const InputSchemaObjectSchema = z
  .looseObject({
    prompt: z
      .looseObject({
        type: z.literal('string'),
        description: z.string().optional(),
      })
      .optional(),
    params: JsonObjectSchemaSchema.optional(),
  })
  .optional()

const PromptFieldSchema = z.union([
  z.string(),
  z.object({ path: z.string() }),
])
export type PromptField = z.infer<typeof PromptFieldSchema>

const functionSchema = <T extends z.core.$ZodFunction>(schema: T) =>
  z.custom<Parameters<T['implement']>[0]>((fn: any) => schema.implement(fn))
const LoggerSchema = z.object({
  debug: z.function({
    input: [z.any(), z.string().optional()],
    output: z.void(),
  }),
  info: z.function({
    input: [z.any(), z.string().optional()],
    output: z.void(),
  }),
  warn: z.function({
    input: [z.any(), z.string().optional()],
    output: z.void(),
  }),
  error: z.function({
    input: [z.any(), z.string().optional()],
    output: z.void(),
  }),
})

const HandleStepsSchema = functionSchema(
  z.function({
    input: [
      z.object({
        agentState: z.object({
          agentId: z.string(),
          parentId: z.string(),
          messageHistory: z.array(z.any()),
        }),
        prompt: z.string().optional(),
        params: z.any().optional(),
      }),
      LoggerSchema.optional(),
    ],
    output: z.any(),
  }),
).optional()

export const DynamicAgentDefinitionSchema = z.object({
  id: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      'Agent ID must contain only lowercase letters, numbers, and hyphens',
    ),
  version: z.string().optional(),
  publisher: z.string().optional(),

  displayName: z.string(),
  model: z.string(),
  reasoningOptions: z
    .object({
      enabled: z.boolean().optional(),
      exclude: z.boolean().optional(),
    })
    .and(
      z.union([
        z.object({ max_tokens: z.number() }),
        z.object({
          effort: z.enum(['high', 'medium', 'low', 'minimal', 'none']),
        }),
      ]),
    )
    .optional(),
  providerOptions: z
    .object({
      order: z.array(z.string()).optional(),
      allow_fallbacks: z.boolean().optional(),
      require_parameters: z.boolean().optional(),
      data_collection: z.enum(['allow', 'deny']).optional(),
      only: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      quantizations: z
        .array(
          z.enum([
            'int4',
            'int8',
            'fp4',
            'fp6',
            'fp8',
            'fp16',
            'bf16',
            'fp32',
            'unknown',
          ]),
        )
        .optional(),
      sort: z.enum(['price', 'throughput', 'latency']).optional(),
      max_price: z
        .object({
          prompt: z.union([z.number(), z.string()]).optional(),
          completion: z.union([z.number(), z.string()]).optional(),
          image: z.union([z.number(), z.string()]).optional(),
          audio: z.union([z.number(), z.string()]).optional(),
          request: z.union([z.number(), z.string()]).optional(),
        })
        .optional(),
    })
    .optional(),

  mcpServers: z.record(z.string(), mcpConfigSchema).default(() => ({})),
  toolNames: z
    .string()
    .array()
    .optional()
    .default(() => []),
  spawnableAgents: z
    .array(z.string())
    .optional()
    .default(() => []),

  inputSchema: InputSchemaObjectSchema,
  includeMessageHistory: z.boolean().default(false),
  inheritParentSystemPrompt: z.boolean().default(false),
  windowedFileReads: z.boolean().optional(),
  compactContext: z
    .union([
      z.boolean(),
      z
        .object({
          cacheExpiryMs: z.number().nullish(),
          cacheExpiryMinTokens: z.number().nullish(),
        })
        .strict(),
    ])
    .optional(),
  outputMode: z
    .enum(['last_message', 'all_messages', 'structured_output'])
    .default('last_message'),
  outputSchema: JsonObjectSchemaSchema.optional(),

  spawnerPrompt: z.string().optional(),
  systemPrompt: z.string().optional(),
  instructionsPrompt: z.string().optional(),
  stepPrompt: z.string().optional(),

  handleSteps: z.union([z.string(), HandleStepsSchema]).optional(),
})
export type DynamicAgentDefinition = z.input<
  typeof DynamicAgentDefinitionSchema
>
export type DynamicAgentDefinitionParsed = z.infer<
  typeof DynamicAgentDefinitionSchema
>

export const DynamicAgentTemplateSchema = DynamicAgentDefinitionSchema.extend({
  systemPrompt: z.string(),
  instructionsPrompt: z.string(),
  stepPrompt: z.string(),
  handleSteps: z.string().optional(),
  handleStepsFn: z
    .custom<(...args: any[]) => any>((v) => typeof v === 'function')
    .optional(),
})
  .refine(
    (data) => {
      if (data.outputSchema && data.outputMode !== 'structured_output') {
        return false
      }
      return true
    },
    {
      message:
        "outputSchema requires outputMode to be explicitly set to 'structured_output'.",
      path: ['outputMode'],
    },
  )
  .refine(
    (data) => {
      if (
        data.spawnableAgents.length > 0 &&
        !data.toolNames.includes('spawn_agents') &&
        !data.toolNames.includes('spawn_agent_inline') &&
        !data.handleSteps &&
        !data.handleStepsFn
      ) {
        return false
      }
      return true
    },
    {
      message:
        "Non-empty spawnableAgents array requires the 'spawn_agents' tool. Add 'spawn_agents' to toolNames (or spawn programmatically via handleSteps) or remove spawnableAgents.",
      path: ['toolNames'],
    },
  )
  .refine(
    (data) => {
      if (
        data.inheritParentSystemPrompt &&
        data.systemPrompt &&
        data.systemPrompt.trim() !== ''
      ) {
        return false
      }
      return true
    },
    {
      message:
        'Cannot specify both systemPrompt and inheritParentSystemPrompt. When inheritParentSystemPrompt is true, systemPrompt must be empty.',
      path: ['systemPrompt'],
    },
  )
export type DynamicAgentTemplate = z.infer<typeof DynamicAgentTemplateSchema>
