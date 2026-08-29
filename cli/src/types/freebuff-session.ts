export type { FreebuffSessionServerResponse } from '@rivocode/common/types/freebuff-session'

import type { FreebuffSessionServerResponse } from '@rivocode/common/types/freebuff-session'

export type FreebuffSessionResponse =
  | FreebuffSessionServerResponse
  | {
      status: 'takeover_prompt'
      model: string
    }

export type FreebuffSessionStatus = FreebuffSessionResponse['status']
