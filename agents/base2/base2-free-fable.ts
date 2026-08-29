import { FREEBUFF_FABLE_5_MODEL_ID } from '@codebuff/common/constants/freebuff-models'

import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FREEBUFF_FABLE_5_MODEL_ID,
  }),
  id: 'base2-free-fable',
  displayName: 'Buffy the Claude Fable 5 Free Orchestrator',
}

export default definition
