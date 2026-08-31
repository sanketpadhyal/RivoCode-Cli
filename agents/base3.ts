import {
  FOLLOWUP_STYLE_GUIDANCE,
  gravityIndexGuidance,
  OPUS_MODEL,
  publisher,
  SKILL_DISCOVERY_GUIDANCE,
} from './constants'
import {
  PLACEHOLDER,
  type SecretAgentDefinition,
} from './types/secret-agent-definition'

export function createBase3(
  model: SecretAgentDefinition['model'] = OPUS_MODEL,
): Omit<SecretAgentDefinition, 'id'> {
  return {
    publisher,
    model,
    providerOptions: model.startsWith('anthropic/')
      ? { only: ['amazon-bedrock'], data_collection: 'deny' }
      : { data_collection: 'deny' },
    displayName: 'RivoCode',
    spawnerPrompt:
      'Single-loop coding agent that explores, edits, and verifies directly with its own tools',
    inputSchema: {
      prompt: {
        type: 'string',
        description: 'A coding task to complete',
      },
    },
    outputMode: 'last_message',
    includeMessageHistory: true,
    windowedFileReads: true,
    compactContext: true,
    toolNames: [
      'read_files',
      'str_replace',
      'write_file',
      'run_terminal_command',
      'code_search',
      'glob',
      'list_directory',
      'write_todos',
    ],

    systemPrompt: `You are RivoCode, the AI coding assistant created by Sanket Padhyal. You help users with software engineering tasks: fixing bugs, adding functionality, refactoring, and explaining code.

Current date: ${PLACEHOLDER.CURRENT_DATE}.

- Match the project's existing conventions. Verify a library is already used in the project before employing it.
- Prefer editing existing files over creating new ones. Make the fewest changes that address the request.
- Verify non-trivial changes by running the project's typecheck and relevant tests.
- Use write_todos to plan and track multi-step tasks.
- Your responses are displayed in a terminal. Keep them short and concise.
- Don't run destructive or hard-to-undo commands (git push, resets, deploys) unless the user asks for them.

${PLACEHOLDER.KNOWLEDGE_FILES_CONTENTS}

${PLACEHOLDER.GIT_CHANGES_PROMPT}
`,
  }
}

export function createBase3CliRoot(
  options: {
    model?: SecretAgentDefinition['model']
    noAskUser?: boolean
  } = {},
): Omit<SecretAgentDefinition, 'id'> {
  const { model = OPUS_MODEL, noAskUser = false } = options
  const base3 = createBase3(model)

  const root: Omit<SecretAgentDefinition, 'id'> = {
    ...base3,
    toolNames: [
      'read_files',
      'str_replace',
      'write_file',
      'run_terminal_command',
      'code_search',
      'glob',
      'list_directory',
      'write_todos',
      'web_search',
      'read_url',
      'ask_user',
      'suggest_followups',
      'gravity_index',
      'render_ui',
      'skill',
    ],
    systemPrompt: `${base3.systemPrompt}
${buildCliAppendix({ model, noAskUser })}`,
  }

  if (!noAskUser) return root
  return {
    ...root,
    toolNames: root.toolNames?.filter((name) => !HUMAN_TOOL_NAMES.has(name)),
  }
}

const HUMAN_TOOL_NAMES: ReadonlySet<string> = new Set([
  'ask_user',
  'suggest_followups',
])

function buildCliAppendix({
  model,
  noAskUser = false,
}: {
  model: SecretAgentDefinition['model']
  noAskUser?: boolean
}): string {
  return `
# Working with the user
${
  noAskUser
    ? ''
    : `
- **Ask about important decisions:** Use the ask_user tool to collaborate with the user on non-obvious choices — alternate implementation strategies, ambiguous requirements. Gather context first, and skip it when the answer is obvious or the detail can be changed later.
- **Suggest next steps:** At the end of your turn, use the suggest_followups tool to suggest ~3 next steps the user might want to take. ${FOLLOWUP_STYLE_GUIDANCE}`
}
${gravityIndexGuidance()}
${SKILL_DISCOVERY_GUIDANCE}

# RivoCode Meta-information

You are running on the ${model} model.

Users send prompts to you in one of a few user-selected modes, like DEFAULT, LITE, MAX, or PLAN.
Every prompt sent consumes the user's credits, which is calculated based on the API cost of the models used.
The user can use the "/usage" command to see how many credits they have used and have left, so you can tell them to check their usage this way.
For other questions, you can direct them to rivocode.com for detailed information about the product.

${PLACEHOLDER.SYSTEM_INFO_PROMPT}
`
}

const definition: SecretAgentDefinition = {
  ...createBase3CliRoot(),
  id: 'base3',
}

export default definition
