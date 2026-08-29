export type { FreebuffSessionServerResponse } from '@codebuff/common/types/freebuff-session'

import type { FreebuffSessionServerResponse } from '@codebuff/common/types/freebuff-session'

export type FreebuffSessionResponse =
  | FreebuffSessionServerResponse
  | {
      status: 'takeover_prompt'
      model: string
    }

export type FreebuffSessionStatus = FreebuffSessionResponse['status']
