import { FREEBUFF_GLM_V53_FLASH_MODEL_ID } from '@rivocode/common/constants/freebuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FREEBUFF_GLM_V53_FLASH_MODEL_ID,
    isFreebuff: true,
  }),
  id: 'base3-free-glm-5-3-flash',
  displayName: 'Buffy on GLM 5.3 Flash',
}

export default definition
