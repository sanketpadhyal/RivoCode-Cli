import {
  getFreebuffBase3RootAgentIdForModel,
  getFreebuffRootAgentIdForModel,
} from '@codebuff/common/constants/free-agents'

import { getSelectedFreebuffModel } from '../state/freebuff-model-store'
import {
  AGENT_MODE_TO_ID,
  CLI_HARNESS,
  IS_FREEBUFF,
  type AgentMode,
} from './constants'

export function getFreebuffCliAgentIdForModel(model: string): string {
  return CLI_HARNESS === 'base3'
    ? getFreebuffBase3RootAgentIdForModel(model)
    : getFreebuffRootAgentIdForModel(model)
}

export function getAgentIdForMode(agentMode: AgentMode): string {
  if (IS_FREEBUFF && agentMode === 'LITE') {
    return getFreebuffCliAgentIdForModel(getSelectedFreebuffModel())
  }

  return AGENT_MODE_TO_ID[agentMode]
}
