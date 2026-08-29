import { useEffect } from 'react'

import { logger } from '../utils/logger'
import { getTerminalProtocolController } from '../utils/terminal-protocol-controller'

export interface UseTerminalFocusOptions {
  onFocusChange: (focused: boolean) => void
  onSupportDetected?: () => void
}

export function useTerminalFocus({
  onFocusChange,
  onSupportDetected,
}: UseTerminalFocusOptions): void {
  useEffect(() => {
    const controller = getTerminalProtocolController()
    if (!controller) {
      logger.debug({}, 'Terminal protocol controller is not installed')
      return
    }

    return controller.subscribeToFocus({ onFocusChange, onSupportDetected })
  }, [onFocusChange, onSupportDetected])
}
