import { FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@codebuff/common/constants/freebuff-models'

import { createBase2 } from './base2/base2'

const definition = {
  ...createBase2('free', {
    model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    noAskUser: true,
  }),
  id: 'base2-free-deepseek-flash-evals',
  displayName: 'Buffy the DeepSeek Flash Evals Orchestrator',
}

export default definition
