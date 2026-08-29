import type {
  AgentDefinition,
  AgentStepContext,
  ToolCall,
} from '../types/agent-definition'

const definition: AgentDefinition = {
  id: 'git-committer',
  displayName: 'Intermediate Git Committer',
  model: 'anthropic/claude-4-sonnet-20250522',
  toolNames: ['read_files', 'run_terminal_command', 'add_message', 'end_turn'],

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What changes to commit',
    },
  },

  spawnerPrompt:
    'Spawn when you need to commit code changes to git with an appropriate commit message',

  systemPrompt:
    'You are an expert software developer. Your job is to create a git commit with a really good commit message.',

  instructionsPrompt:
    'Follow the steps to create a good commit: analyze changes with git diff and git log, read relevant files for context, stage appropriate files, analyze changes, and create a commit with proper formatting.',

  handleSteps: function* ({ agentState, prompt, params }: AgentStepContext) {
    yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'git diff',
        process_type: 'SYNC',
        timeout_seconds: 30,
      },
    } satisfies ToolCall

    yield {
      toolName: 'run_terminal_command',
      input: {
        command: 'git log --oneline -10',
        process_type: 'SYNC',
        timeout_seconds: 30,
      },
    } satisfies ToolCall

    yield {
      toolName: 'add_message',
      input: {
        role: 'assistant',
        content:
          "I've analyzed the git diff and recent commit history. Now I'll read any relevant files to better understand the context of these changes.",
      },
      includeToolCall: false,
    } satisfies ToolCall

    yield 'STEP'

    yield {
      toolName: 'add_message',
      input: {
        role: 'assistant',
        content:
          "Now I'll analyze the changes and create a commit with a good commit message.",
      },
      includeToolCall: false,
    } satisfies ToolCall

    yield 'STEP_ALL'
  },
}

export default definition
