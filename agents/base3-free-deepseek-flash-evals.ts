import { FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@rivocode/common/constants/freebuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    isFreebuff: true,
    noAskUser: true,
  }),
  id: 'base3-free-deepseek-flash-evals',
  displayName: 'Buffy on DeepSeek Flash (evals)',
}

export default definition
