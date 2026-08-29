export type ToolName =
  | 'add_message'
  | 'apply_patch'
  | 'ask_user'
  | 'code_search'
  | 'end_turn'
  | 'find_files'
  | 'glob'
  | 'gravity_index'
  | 'list_directory'
  | 'lookup_agent_info'
  | 'propose_str_replace'
  | 'propose_write_file'
  | 'read_docs'
  | 'read_files'
  | 'read_subtree'
  | 'read_url'
  | 'render_ui'
  | 'run_file_change_hooks'
  | 'run_terminal_command'
  | 'set_messages'
  | 'set_output'
  | 'skill'
  | 'spawn_agents'
  | 'str_replace'
  | 'suggest_followups'
  | 'task_completed'
  | 'think_deeply'
  | 'web_search'
  | 'write_file'
  | 'write_todos'

export interface ToolParamsMap {
  add_message: AddMessageParams
  apply_patch: ApplyPatchParams
  ask_user: AskUserParams
  code_search: CodeSearchParams
  end_turn: EndTurnParams
  find_files: FindFilesParams
  glob: GlobParams
  gravity_index: GravityIndexParams
  list_directory: ListDirectoryParams
  lookup_agent_info: LookupAgentInfoParams
  propose_str_replace: ProposeStrReplaceParams
  propose_write_file: ProposeWriteFileParams
  read_docs: ReadDocsParams
  read_files: ReadFilesParams
  read_subtree: ReadSubtreeParams
  read_url: ReadUrlParams
  render_ui: RenderUiParams
  run_file_change_hooks: RunFileChangeHooksParams
  run_terminal_command: RunTerminalCommandParams
  set_messages: SetMessagesParams
  set_output: SetOutputParams
  skill: SkillParams
  spawn_agents: SpawnAgentsParams
  str_replace: StrReplaceParams
  suggest_followups: SuggestFollowupsParams
  task_completed: TaskCompletedParams
  think_deeply: ThinkDeeplyParams
  web_search: WebSearchParams
  write_file: WriteFileParams
  write_todos: WriteTodosParams
}

export interface AddMessageParams {
  role: 'user' | 'assistant'
  content: string
}

export interface ApplyPatchParams {
  operation: {
    type: 'create_file' | 'update_file' | 'delete_file'
    path: string
    diff?: string
  }
}

export interface AskUserParams {
  questions: {
    question: string
    header?: string
    options: {
      label: string
      description?: string
    }[]
    multiSelect?: boolean
    validation?: {
      maxLength?: number
      minLength?: number
      pattern?: string
      patternError?: string
    }
  }[]
}

export interface CodeSearchParams {
  pattern: string
  flags?: string
  cwd?: string
  maxResults?: number
}

export interface EndTurnParams {}

export interface FindFilesParams {
  prompt: string
}

export interface GlobParams {
  pattern: string
  cwd?: string
}

export interface GravityIndexParams {
  action:
    | 'search'
    | 'browse'
    | 'list_categories'
    | 'get_service'
    | 'provision'
    | 'report_integration'
  query?: string
  search_id?: string
  context?: Record<string, any>
  category?: string
  q?: string
  slug?: string
  integrated_slug?: string
  user_consent?: true
}

export interface ListDirectoryParams {
  path: string
}

export interface LookupAgentInfoParams {
  agentId: string
}

export interface ProposeStrReplaceParams {
  path: string
  replacements: {
    oldString: string
    newString: string
    allowMultiple?: boolean
  }[]
}

export interface ProposeWriteFileParams {
  path: string
  instructions: string
  content: string
}

export interface ReadDocsParams {
  libraryTitle: string
  topic: string
  max_tokens?: number
}

export interface ReadFilesParams {
  paths: string[]
}

export interface ReadSubtreeParams {
  paths?: string[]
  maxTokens?: number
}

export interface ReadUrlParams {
  url: string
  max_chars?: number
}

export interface RenderUiParams {
  widget: {
    type: 'button'
    text: string
    link: string
    variant?: 'primary' | 'secondary'
  }
}

export interface RunFileChangeHooksParams {
  files: string[]
}

export interface RunTerminalCommandParams {
  command: string
  process_type?: 'SYNC' | 'BACKGROUND'
  cwd?: string
  timeout_seconds?: number
}

export interface SetMessagesParams {
  messages: any
}

export interface SetOutputParams {}

export interface SkillParams {
  name: string
}

export interface SpawnAgentsParams {
  agents: {
    agent_type: string
    prompt?: string
    params?: Record<string, any>
  }[]
}

export interface StrReplaceParams {
  path: string
  replacements: {
    oldString: string
    newString: string
    allowMultiple?: boolean
  }[]
}

export interface SuggestFollowupsParams {
  followups: {
    prompt: string
    label?: string
  }[]
}

export interface TaskCompletedParams {}

export interface ThinkDeeplyParams {
  thought: string
}

export interface WebSearchParams {
  query: string
  depth?: 'standard' | 'deep'
}

export interface WriteFileParams {
  path: string
  instructions: string
  content: string
}

export interface WriteTodosParams {
  todos: {
    task: string
    completed: boolean
  }[]
}

export type GetToolParams<T extends ToolName> = ToolParamsMap[T]
