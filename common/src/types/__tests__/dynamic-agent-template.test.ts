import type { AgentDefinition } from '../../templates/initial-agents-dir/types/agent-definition'
import type { publishedTools } from '../../tools/constants'
import type { DynamicAgentDefinition } from '../dynamic-agent-template'

type DynamicAgentDefinitionHandleSteps = Omit<
  DynamicAgentDefinition,
  'handleSteps' | 'toolNames'
> & {
  handleSteps?: AgentDefinition['handleSteps']
  toolNames?: (typeof publishedTools | (string & {}))[number][]
}
const _typecheck1: DynamicAgentDefinitionHandleSteps = {} as AgentDefinition
const _typecheck2: AgentDefinition = {} as DynamicAgentDefinitionHandleSteps
const _keyTypecheck1: keyof AgentDefinition =
  {} as keyof DynamicAgentDefinitionHandleSteps
const _keyTypecheck2: keyof DynamicAgentDefinitionHandleSteps =
  {} as keyof AgentDefinition
