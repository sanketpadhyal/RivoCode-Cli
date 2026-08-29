import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({ noAskUser: true }),
  id: 'base3-evals',
  displayName: 'Buffy the Evals Agent',
}

export default definition
