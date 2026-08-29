import { describe, expect, test } from 'bun:test'

import {
  detectForeignFreebuffClient,
  FREEBUFF_DOWNGRADE_MODEL_ID,
  FREEBUFF_SIGNATURE_TOOL_NAMES,
  GENERIC_TOOL_NAMES,
  resolveForeignClientDowngrade,
} from '../constants/foreign-client-signals'
import { toolNames } from '../tools/constants'

function tools(...names: string[]) {
  return names.map((name) => ({ type: 'function', function: { name } }))
}

const FREEBUFF_TOOLSETS = [
  tools(
    'ask_user',
    'basher',
    'browser_use',
    'code_reviewer_deepseek_flash',
    'code_searcher',
    'context_pruner',
    'file_picker',
    'glob',
    'gravity_index',
    'list_directory',
    'read_files',
    'read_subtree',
  ),
  tools(
    'basher',
    'browser_check',
    'code_reviewer_deepseek_flash',
    'code_searcher',
    'context_pruner',
    'end_turn',
    'file_picker',
    'glob',
    'list_directory',
    'preview_click',
    'preview_evaluate',
  ),
  tools(
    'context_pruner',
    'gravity_index',
    'render_ui',
    'researcher_web',
    'spawn_agents',
    'suggest_followups',
    'thinker_gemini',
  ),
  tools('add_message', 'read_files', 'run_terminal_command', 'set_output'),
]

const FOREIGN_TOOLSETS: Array<[string, ReturnType<typeof tools>]> = [
  ['claude-code', tools('Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write')],
  [
    'opencode',
    tools(
      'ask',
      'bash',
      'edit',
      'eval',
      'glob',
      'grep',
      'hub',
      'read',
      'task',
      'todo',
      'web_search',
      'write',
    ),
  ],
  [
    'cline',
    tools(
      'list_files',
      'read_file',
      'replace_in_file',
      'search_files',
      'write_file',
    ),
  ],
  [
    'novel-farm',
    tools(
      'check_consistency',
      'commit_chapter',
      'draft_chapter',
      'edit_chapter',
      'novel_context',
      'plan_chapter',
      'read_chapter',
    ),
  ],
  [
    'pentest-harness',
    tools(
      'analyze_target_graph',
      'delegate_task',
      'edit_source_code',
      'execute_command',
      'install_tool',
      'python_execute',
      'read_file',
    ),
  ],
]

describe('detectForeignFreebuffClient', () => {
  test('the signature is every non-generic tool we define', () => {
    const known = new Set<string>(toolNames)
    for (const name of known) {
      expect(FREEBUFF_SIGNATURE_TOOL_NAMES.has(name)).toBe(
        !GENERIC_TOOL_NAMES.has(name),
      )
    }
    for (const name of GENERIC_TOOL_NAMES) {
      expect(known.has(name)).toBe(true)
    }
    expect(FREEBUFF_SIGNATURE_TOOL_NAMES.size).toBeGreaterThan(20)
  })

  test('clears real freebuff toolsets', () => {
    for (const toolset of FREEBUFF_TOOLSETS) {
      expect(detectForeignFreebuffClient({ tools: toolset }).signal).toBeNull()
    }
  })

  test.each(FOREIGN_TOOLSETS)('flags %s', (_name, toolset) => {
    expect(detectForeignFreebuffClient({ tools: toolset }).signal).toBe(
      'foreign_toolset',
    )
  })

  test('sharing a few generic names does not launder a foreign harness', () => {
    expect(
      detectForeignFreebuffClient({
        tools: tools('glob', 'web_search', 'bash', 'edit', 'write'),
      }).signal,
    ).toBe('foreign_toolset')
  })

  test('a toolset of only generic names is foreign', () => {
    expect(
      detectForeignFreebuffClient({ tools: tools('web_search') }).signal,
    ).toBe('foreign_toolset')
    expect(
      detectForeignFreebuffClient({ tools: tools('glob', 'web_search') }).signal,
    ).toBe('foreign_toolset')
  })

  test('our toolset wins over sampling params', () => {
    expect(
      detectForeignFreebuffClient({
        tools: tools('ask_user', 'read_files'),
        temperature: 0.3,
        max_tokens: 32000,
      }).signal,
    ).toBeNull()
  })

  test('flags sampling params only when no tools are offered', () => {
    expect(detectForeignFreebuffClient({ temperature: 0.7 }).signal).toBe(
      'sampling_params',
    )
    expect(detectForeignFreebuffClient({ top_p: 0.9 }).signal).toBe(
      'sampling_params',
    )
    expect(detectForeignFreebuffClient({ max_tokens: 4096 }).signal).toBe(
      'sampling_params',
    )
    expect(
      detectForeignFreebuffClient({ max_completion_tokens: 4096 }).signal,
    ).toBe('sampling_params')
  })

  test('clears a tool-free request that leaves sampling params unset', () => {
    expect(detectForeignFreebuffClient({}).signal).toBeNull()
    expect(detectForeignFreebuffClient({ tools: [] }).signal).toBeNull()
  })

  test('explicit nulls are not treated as set', () => {
    for (const body of [
      { temperature: null },
      { top_p: null },
      { max_tokens: null },
      { max_completion_tokens: null },
      { temperature: null, top_p: null, max_tokens: null },
    ]) {
      expect(detectForeignFreebuffClient(body as never).signal).toBeNull()
    }
    expect(
      detectForeignFreebuffClient({
        temperature: undefined,
        top_p: undefined,
        max_tokens: undefined,
      }).signal,
    ).toBeNull()
  })

  test('zero is a real choice and stays flagged', () => {
    expect(detectForeignFreebuffClient({ temperature: 0 }).signal).toBe(
      'sampling_params',
    )
    expect(detectForeignFreebuffClient({ top_p: 0 }).signal).toBe(
      'sampling_params',
    )
  })

  test('tolerates malformed tool entries without throwing', () => {
    for (const tools of [null, undefined, 'nope', [], [null], [{}], [{ function: {} }]]) {
      expect(() =>
        detectForeignFreebuffClient({ tools } as never),
      ).not.toThrow()
    }
    expect(detectForeignFreebuffClient({ tools: [{}] }).signal).toBeNull()
  })

  test('truncates caller-controlled tool names before they reach logs', () => {
    const verdict = detectForeignFreebuffClient({
      tools: [{ type: 'function', function: { name: 'x'.repeat(5000) } }],
    })
    expect(verdict.signal).toBe('foreign_toolset')
    expect(verdict.sampleToolNames[0]!.length).toBeLessThanOrEqual(64)
  })

  test('reports bounded evidence for the log line', () => {
    const verdict = detectForeignFreebuffClient({
      tools: tools('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
    })
    expect(verdict.toolCount).toBe(10)
    expect(verdict.sampleToolNames).toHaveLength(8)
  })

  test.each([
    ['researcher-web', ['web_search', 'read_url']],
    ['researcher-docs', ['read_docs']],
    ['freebuff-desktop-autorun', ['decide']],
    ['basher', ['run_terminal_command']],
    ['file-picker', ['spawn_agents']],
  ])('clears our own %s toolset', (_agent, names) => {
    expect(detectForeignFreebuffClient({ tools: tools(...names) }).signal).toBeNull()
  })

  test('borrowing one distinctive name clears an otherwise foreign toolset', () => {
    expect(
      detectForeignFreebuffClient({ tools: tools('read_files', 'Bash') }).signal,
    ).toBeNull()
  })

  test('a root agent offering no tools is a bare completion proxy', () => {
    expect(detectForeignFreebuffClient({}, true).signal).toBe(
      'root_agent_no_tools',
    )
    expect(detectForeignFreebuffClient({ temperature: 0.7 }, true).signal).toBe(
      'root_agent_no_tools',
    )
  })

  test('a root agent sending our tools is still ours', () => {
    expect(
      detectForeignFreebuffClient({ tools: tools('ask_user') }, true).signal,
    ).toBeNull()
    expect(
      detectForeignFreebuffClient({ tools: tools('Bash', 'Edit') }, true).signal,
    ).toBe('foreign_toolset')
  })

  test('a tool-free SUBagent is untouched', () => {
    expect(detectForeignFreebuffClient({}).signal).toBeNull()
    expect(detectForeignFreebuffClient({}, false).signal).toBeNull()
  })

  test('downgrade target is the free OpenRouter variant', () => {
    expect(FREEBUFF_DOWNGRADE_MODEL_ID).toBe('inclusionai/ling-3.0-tiny:free')
    expect(FREEBUFF_DOWNGRADE_MODEL_ID.endsWith(':free')).toBe(true)
  })
})

describe('resolveForeignClientDowngrade', () => {
  const foreign = { tools: tools('Bash', 'Edit') }
  const params = { max_completion_tokens: 977_725 }
  const ours = { tools: tools('ask_user', 'read_files') }

  test('always downgrades a foreign toolset', () => {
    expect(resolveForeignClientDowngrade({ body: foreign })!.downgradeTo).toBe(
      FREEBUFF_DOWNGRADE_MODEL_ID,
    )
  })

  test('reports but never acts on a tool-free root agent', () => {
    const d = resolveForeignClientDowngrade({ body: {}, isRootAgent: true })!
    expect(d.signal).toBe('root_agent_no_tools')
    expect(d.downgradeTo).toBeNull()
  })

  test('leaves a tool-free non-root request alone', () => {
    expect(resolveForeignClientDowngrade({ body: {} })).toBeNull()
  })

  test('reports but never acts on the sampling-param signal', () => {
    const decision = resolveForeignClientDowngrade({ body: params })!
    expect(decision.signal).toBe('sampling_params')
    expect(decision.downgradeTo).toBeNull()
  })

  test('a freebuff toolset is never reported', () => {
    expect(resolveForeignClientDowngrade({ body: ours })).toBeNull()
  })

  test('does not re-downgrade a request already on the downgrade model', () => {
    const decision = resolveForeignClientDowngrade({
      body: { ...foreign, model: FREEBUFF_DOWNGRADE_MODEL_ID },
    })!
    expect(decision.signal).toBe('foreign_toolset')
    expect(decision.downgradeTo).toBeNull()
  })
})
