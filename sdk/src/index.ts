import { setTreeSitterWasmPath as setCodeMapTreeSitterWasmPath } from '@rivocode/code-map/init-node'
import { setWasmDir as setCodeMapWasmDir } from '@rivocode/code-map/languages'
import { getFileTokenScores as getCodeMapFileTokenScores } from '@rivocode/code-map/parse'

export type * from '@rivocode/common/types/json'
export type * from '@rivocode/common/types/messages/codebuff-message'
export type * from '@rivocode/common/types/messages/data-content'
export type * from '@rivocode/common/types/print-mode'
export type {
  TextPart,
  ImagePart,
} from '@rivocode/common/types/messages/content-part'
export { run, STATE_SNAPSHOT_INTERRUPTION_MESSAGE } from './run'
export { getFiles } from './tools/read-files'
export type { FileFilter, FileFilterResult } from './tools/read-files'
export type {
  CodebuffClientOptions,
  RunOptions,
  MessageContent,
  TextContent,
  ImageContent,
} from './run'
export type { TraceWriter } from '@rivocode/common/types/contracts/trace'
export { buildUserMessageContent } from '@rivocode/agent-runtime/util/messages'
export type { AgentDefinition } from '@rivocode/common/templates/initial-agents-dir/types/agent-definition'
export type { ToolName } from '@rivocode/common/tools/constants'

export type {
  ClientToolCall,
  ClientToolName,
  CodebuffToolOutput,
} from '@rivocode/common/tools/list'
export * from './client'
export * from './custom-tool'
export * from './native/ripgrep'
export * from './run-state'
export { ToolHelpers } from './tools'
export * from './constants'

export { getUserInfoFromApiKey } from './impl/database'
export * from './credentials'
export { loadLocalAgents } from './agents/load-agents'
export { loadMCPConfig, loadMCPConfigSync } from './agents/load-mcp-config'
export { loadSkills, loadSkillsSync, parseSkillFileContent } from './skills/load-skills'
export { formatAvailableSkillsXml } from '@rivocode/common/util/skills'
export type { LoadSkillsOptions } from './skills/load-skills'
export type { SkillDefinition, SkillsMap } from '@rivocode/common/types/skill'
export type {
  LoadedAgents,
  LoadedAgentDefinition,
  LoadLocalAgentsResult,
  AgentValidationError,
} from './agents/load-agents'
export type {
  MCPFileConfig,
  LoadedMCPConfig,
} from './agents/load-mcp-config'

export { validateAgents } from './validate-agents'
export type { ValidationResult, ValidateAgentsOptions } from './validate-agents'

export { setFreeModeCapacityDeferralListener } from './impl/model-provider'
export type { FreeModeCapacityDeferral } from './impl/model-provider'

export {
  isRetryableStatusCode,
  getErrorStatusCode,
  sanitizeErrorMessage,
  RETRYABLE_STATUS_CODES,
  createHttpError,
  createAuthError,
  createForbiddenError,
  createPaymentRequiredError,
  createServerError,
  createNetworkError,
} from './error-utils'
export type { HttpError } from './error-utils'

export {
  MAX_RETRIES_PER_MESSAGE,
  RETRY_BACKOFF_BASE_DELAY_MS,
  RETRY_BACKOFF_MAX_DELAY_MS,
  RECONNECTION_MESSAGE_DURATION_MS,
  RECONNECTION_RETRY_DELAY_MS,
} from './retry-config'

export type { CodebuffFileSystem } from '@rivocode/common/types/filesystem'

export function getFileTokenScores(
  ...args: Parameters<typeof getCodeMapFileTokenScores>
): ReturnType<typeof getCodeMapFileTokenScores> {
  return getCodeMapFileTokenScores(...args)
}

export function setWasmDir(dir: string): void {
  setCodeMapWasmDir(dir)
}

export function setTreeSitterWasmPath(wasmPath: string): void {
  setCodeMapTreeSitterWasmPath(wasmPath)
}
export type { FileTokenData, TokenCallerMap } from '@rivocode/code-map'

export {
  getActiveTerminalCommandProcesses,
  runTerminalCommand,
} from './tools/run-terminal-command'
export type {
  ActiveTerminalCommandProcess,
  TerminalCommandBroker,
  TerminalCommandProcess,
  TerminalCommandSpawnRequest,
} from './tools/run-terminal-command'
export {
  promptAiSdk,
  promptAiSdkStream,
  promptAiSdkStructured,
} from './impl/llm'
