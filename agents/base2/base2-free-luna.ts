import {
  FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
} from '@rivocode/common/constants/freebuff-models'

import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
  }),
  id: 'base2-free-luna',
  displayName: 'Buffy the GPT-5.6 Luna Free Orchestrator',
  reasoningOptions: {
    enabled: true,
    effort: FREEBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
  },
}

export default definition
