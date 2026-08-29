
import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'my-custom-agent',
  displayName: 'My Custom Agent',

  model: 'anthropic/claude-haiku-4.5',
  spawnableAgents: ['codebuff/file-explorer@0.0.6'],

  toolNames: ['run_terminal_command', 'read_files', 'spawn_agents'],

  spawnerPrompt: 'Spawn when you need to review code changes in the git diff',

  instructionsPrompt: `Review the code changes and suggest improvements.
Execute the following steps:
1. Run git diff
2. Spawn a file explorer to find all relevant files
3. Read any relevant files
4. Review the changes and suggest improvements`,

}

export default definition
