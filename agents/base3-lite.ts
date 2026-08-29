import { createBase3CliRoot } from './base3'
import { LITE_MODEL } from './constants'

const definition = {
  ...createBase3CliRoot({ model: LITE_MODEL }),
  id: 'base3-lite',
  displayName: 'Buffy Lite',
}

export default definition
