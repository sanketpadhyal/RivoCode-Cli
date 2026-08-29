import os from 'os'
import path from 'path'

import { env } from '@codebuff/common/env'

export const getConfigDir = (): string => {
  return path.join(
    os.homedir(),
    '.config',
    'manicode' +
      (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod'
        ? `-${env.NEXT_PUBLIC_CB_ENVIRONMENT}`
        : ''),
  )
}
