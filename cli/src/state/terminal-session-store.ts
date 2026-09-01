import { useChatStore } from './chat-store'
import type { TerminalSession } from '../types/store'

export type { TerminalSession }

export const useTerminalSessionStore = {
  getState: () => {
    const s = useChatStore.getState()
    return {
      sessions: s.terminalSessions,
      activeSessionId: s.activeTerminalSessionId,
      showTerminalLogs: s.showTerminalLogs,
      addSession: s.addTerminalSession,
      appendLog: s.appendTerminalLog,
      finishSession: s.finishTerminalSession,
      openTerminalLogs: s.openTerminalLogs,
      closeTerminalLogs: s.closeTerminalLogs,
      killSession: s.killTerminalSession,
      clearSessions: s.clearTerminalSessions,
      setActiveSessionId: s.setActiveTerminalSessionId,
    }
  },
}
