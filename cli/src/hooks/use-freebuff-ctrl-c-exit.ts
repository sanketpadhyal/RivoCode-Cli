import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { exitCliCleanly } from '../utils/exit-cleanly'

import type { KeyEvent } from '@opentui/core'

export function useFreebuffCtrlCExit(): void {
  useKeyboard(
    useCallback((key: KeyEvent) => {
      if (key.ctrl && key.name === 'c') {
        key.preventDefault?.()
        void exitCliCleanly()
      }
    }, []),
  )
}
