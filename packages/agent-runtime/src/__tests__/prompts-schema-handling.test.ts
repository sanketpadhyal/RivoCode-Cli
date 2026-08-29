import { TEST_AGENT_RUNTIME_IMPL } from '@rivocode/common/testing/impl/agent-runtime'
import { describe, test, expect, mock } from 'bun:test'
import { convertJsonSchemaToZod } from 'zod-from-json-schema'
import { z } from 'zod/v4'

import {
  buildAgentToolInputSchema,
  buildAgentToolSet,
} from '../templates/prompts'
import { tryTransformAgentToolCall } from '../tools/tool-executor'
import { handleLookupAgentInfo } from '../tools/handlers/tool/lookup-agent-info'
import {
  ensureZodSchema,
  buildToolDescription,
  getToolSet,
} from '../tools/prompts'

import type { AgentTemplate } from '../templates/types'

const createMockLogger = () => ({
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
})

describe('Schema handling error recovery', () => {
  describe('ensureJsonSchemaCompatible in templates/prompts.ts', () => {
    test('handles schema that cannot be converted to JSON Schema', async () => {
      const problematicSchema = z.function()

      const agentTemplate: AgentTemplate = {
        id: 'test-agent',
        displayName: 'Test Agent',
        spawnerPrompt: 'Test spawner prompt',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string().describe('A test prompt'),
          params: problematicSchema as unknown as z.ZodType<
            Record<string, unknown> | undefined
          >,
        },
        outputMode: 'last_message',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const toolSet = await buildAgentToolSet({
        spawnableAgents: ['test-agent'],
        agentTemplates: { 'test-agent': agentTemplate },
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(toolSet['test_agent']).toBeDefined()
      expect(toolSet['test-agent']).toBeUndefined()
    })

    test('buildAgentToolInputSchema handles valid schemas', () => {
      const agentTemplate: AgentTemplate = {
        id: 'valid-agent',
        displayName: 'Valid Agent',
        spawnerPrompt: 'Valid spawner prompt',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string().describe('A valid prompt'),
          params: z.object({ foo: z.string() }),
        },
        outputMode: 'last_message',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const inputSchema = buildAgentToolInputSchema(agentTemplate)

      expect(() => z.toJSONSchema(inputSchema, { io: 'input' })).not.toThrow()
    })

    test('buildAgentToolInputSchema handles empty inputSchema', () => {
      const agentTemplate: AgentTemplate = {
        id: 'empty-schema-agent',
        displayName: 'Empty Schema Agent',
        spawnerPrompt: 'Empty schema spawner prompt',
        model: 'gpt-4o-mini',
        inputSchema: {},
        outputMode: 'last_message',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const inputSchema = buildAgentToolInputSchema(agentTemplate)

      expect(() => z.toJSONSchema(inputSchema, { io: 'input' })).not.toThrow()
    })
  })

  describe('direct subagent tool names', () => {
    test('uses underscored tool aliases while preserving hyphenated agent IDs', () => {
      const transformed = tryTransformAgentToolCall({
        toolName: 'file_picker',
        input: { prompt: 'Find relevant files' },
        spawnableAgents: ['codebuff/file-picker@1.0.0'],
      })

      expect(transformed).toEqual({
        toolName: 'spawn_agents',
        input: {
          agents: [
            {
              agent_type: 'codebuff/file-picker@1.0.0',
              prompt: 'Find relevant files',
            },
          ],
        },
      })
    })
  })

  describe('ensureJsonSchemaCompatible in tools/prompts.ts', () => {
    test('buildToolDescription handles problematic schemas gracefully', () => {
      const problematicSchema = z.promise(z.string())

      const description = buildToolDescription({
        toolName: 'test_tool',
        schema: problematicSchema as unknown as z.ZodType,
        description: 'A test tool',
        endsAgentStep: false,
      })

      expect(description).toContain('test_tool')
      expect(description).toContain('A test tool')
      expect(description).toContain('Params:')
    })

    test('buildToolDescription uses fallback for schemas that fail toJSONSchema', () => {
      const problematicSchema = z.function()

      const description = buildToolDescription({
        toolName: 'fallback_test',
        schema: problematicSchema as unknown as z.ZodType,
        description: 'Testing fallback behavior',
        endsAgentStep: false,
      })

      expect(description).toContain('### fallback_test')
      expect(description).toContain('Testing fallback behavior')
      expect(description).toContain('Params: None')
    })

    test('buildToolDescription handles valid schemas', () => {
      const validSchema = z.object({
        path: z.string().describe('File path'),
        content: z.string().describe('File content'),
      })

      const description = buildToolDescription({
        toolName: 'write_file',
        schema: validSchema,
        description: 'Write a file',
        endsAgentStep: false,
      })

      expect(description).toContain('write_file')
      expect(description).toContain('Write a file')
      expect(description).toContain('path')
      expect(description).toContain('content')
    })

    test('buildToolDescription preserves MCP params when schema is represented as allOf', () => {
      const mcpSchema = convertJsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      })

      const description = buildToolDescription({
        toolName: 'greet__greet',
        schema: mcpSchema,
        description: 'Call greet',
        endsAgentStep: true,
      })

      expect(description).toContain('greet__greet')
      expect(description).toContain('Params: {')
      expect(description).toContain('allOf')
      expect(description).toContain('name')
      expect(description).not.toContain('Params: None')
    })

    test('getToolSet handles custom tools with problematic schemas', async () => {
      const customToolDefs = {
        problematic_tool: {
          description: 'A problematic tool',
          inputSchema: z.function() as unknown as z.ZodType,
          endsAgentStep: true,
        },
      }

      const toolSet = await getToolSet({
        toolNames: [],
        windowedFileReads: false,
        additionalToolDefinitions: async () => customToolDefs,
        agentTools: {},
        skills: {},
      })

      expect(toolSet['problematic_tool']).toBeDefined()
    })

    test('ensureZodSchema converts JSON Schema to Zod schema', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const zodSchema = ensureZodSchema(jsonSchema)

      const result = zodSchema.safeParse({ name: 'test', age: 25 })
      expect(result.success).toBe(true)
    })

    test('ensureZodSchema returns Zod schema unchanged', () => {
      const zodSchema = z.object({
        name: z.string(),
      })

      const result = ensureZodSchema(zodSchema)

      expect(result).toBe(zodSchema)
    })
  })

  describe('toJSONSchema error handling in lookup-agent-info.ts', () => {
    test('handles schemas that cannot be converted to JSON Schema', async () => {
      const agentTemplate: AgentTemplate = {
        id: 'problematic-output-agent',
        displayName: 'Problematic Output Agent',
        spawnerPrompt: 'Test',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string(),
        },
        outputMode: 'structured_output',
        outputSchema: z.function() as unknown as z.ZodType,
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const localAgentTemplates = {
        'problematic-output-agent': agentTemplate,
      }

      const result = await handleLookupAgentInfo({
        toolCall: {
          toolCallId: 'test-call',
          toolName: 'lookup_agent_info',
          input: { agentId: 'problematic-output-agent' },
        },
        previousToolCallFinished: Promise.resolve(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        localAgentTemplates,
        logger: createMockLogger(),
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result.output).toBeDefined()

      const outputValue = result.output[0]
      expect(outputValue.type).toBe('json')
      if (outputValue.type === 'json') {
        const parsed = outputValue.value as {
          found: boolean
          agent?: { outputSchema?: unknown }
        }
        expect(parsed.found).toBe(true)
        expect(parsed.agent?.outputSchema).toEqual({
          type: 'object',
          description: 'Schema unavailable',
        })
      }
    })

    test('handles valid schemas correctly', async () => {
      const agentTemplate: AgentTemplate = {
        id: 'valid-output-agent',
        displayName: 'Valid Output Agent',
        spawnerPrompt: 'Test',
        model: 'gpt-4o-mini',
        inputSchema: {
          prompt: z.string().describe('User prompt'),
          params: z.object({
            verbose: z.boolean().optional(),
          }),
        },
        outputMode: 'structured_output',
        outputSchema: z.object({
          result: z.string(),
          success: z.boolean(),
        }),
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: ['read_files'],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      }

      const localAgentTemplates = {
        'valid-output-agent': agentTemplate,
      }

      const result = await handleLookupAgentInfo({
        toolCall: {
          toolCallId: 'test-call',
          toolName: 'lookup_agent_info',
          input: { agentId: 'valid-output-agent' },
        },
        previousToolCallFinished: Promise.resolve(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        localAgentTemplates,
        logger: createMockLogger(),
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      const outputValue = result.output[0]
      expect(outputValue.type).toBe('json')
      if (outputValue.type === 'json') {
        const parsed = outputValue.value as {
          found: boolean
          agent?: {
            outputSchema?: {
              type?: string
              properties?: Record<string, unknown>
            }
            inputSchema?: { prompt?: unknown; params?: unknown }
          }
        }
        expect(parsed.found).toBe(true)
        expect(parsed.agent?.outputSchema?.type).toBe('object')
        expect(parsed.agent?.outputSchema?.properties).toHaveProperty('result')
        expect(parsed.agent?.outputSchema?.properties).toHaveProperty('success')
        expect(parsed.agent?.inputSchema?.prompt).toBeDefined()
        expect(parsed.agent?.inputSchema?.params).toBeDefined()
      }
    })

    test('returns not found for non-existent agent', async () => {
      const result = await handleLookupAgentInfo({
        toolCall: {
          toolCallId: 'test-call',
          toolName: 'lookup_agent_info',
          input: { agentId: 'non-existent-agent' },
        },
        previousToolCallFinished: Promise.resolve(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        localAgentTemplates: {},
        logger: createMockLogger(),
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      const outputValue = result.output[0]
      expect(outputValue.type).toBe('json')
      if (outputValue.type === 'json') {
        const parsed = outputValue.value as { found: boolean; error?: string }
        expect(parsed.found).toBe(false)
        expect(parsed.error).toContain('not found')
      }
    })
  })

  describe('Schema with endsAgentStep parameter', () => {
    test('toJsonSchemaSafe handles problematic schema with endsAgentStep', () => {
      const problematicSchema = z.promise(z.string())

      const description = buildToolDescription({
        toolName: 'async_tool',
        schema: problematicSchema as unknown as z.ZodType,
        description: 'An async tool',
        endsAgentStep: true,
      })

      expect(description).toContain('async_tool')
      expect(description).toContain('An async tool')
    })
  })
})
