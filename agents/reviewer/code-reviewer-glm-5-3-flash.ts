import { FREEBUFF_GLM_V53_FLASH_MODEL_ID } from '@codebuff/common/constants/freebuff-models'

import { publisher } from '../constants'
import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import { createReviewer } from './code-reviewer'

const definition: SecretAgentDefinition = {
  id: 'code-reviewer-glm-5-3-flash',
  publisher,
  ...createReviewer(FREEBUFF_GLM_V53_FLASH_MODEL_ID),
}

export default definition
