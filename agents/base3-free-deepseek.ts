import { FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID } from '@rivocode/common/constants/freebuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
    isFreebuff: true,
  }),
  id: 'base3-free-deepseek',
  displayName: 'Buffy on DeepSeek',
}

export default definition
