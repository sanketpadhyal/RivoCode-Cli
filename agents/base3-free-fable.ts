import { FREEBUFF_FABLE_5_MODEL_ID } from '@codebuff/common/constants/freebuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FREEBUFF_FABLE_5_MODEL_ID,
    isFreebuff: true,
  }),
  id: 'base3-free-fable',
  displayName: 'Buffy on Claude Fable 5',
}

export default definition
