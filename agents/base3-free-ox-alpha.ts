import { FREEBUFF_OX_ALPHA_MODEL_ID } from '@rivocode/common/constants/freebuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FREEBUFF_OX_ALPHA_MODEL_ID,
    isFreebuff: true,
  }),
  id: 'base3-free-ox-alpha',
  displayName: 'Buffy on Ox Alpha',
}

export default definition
