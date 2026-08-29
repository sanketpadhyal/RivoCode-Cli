import { FREEBUFF_GPT_5_6_LUNA_MODEL_ID } from '@rivocode/common/constants/freebuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FREEBUFF_GPT_5_6_LUNA_MODEL_ID,
    isFreebuff: true,
  }),
  id: 'base3-free-luna',
  displayName: 'Buffy on GPT-5.6 Luna',
}

export default definition
