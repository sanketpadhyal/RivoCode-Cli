import type { Message } from '../messages/codebuff-message'

export type TraceWriter = {
  recordStep: (params: {
    agentId: string
    agentType: string
    runId: string | undefined
    userInputId: string
    step: number
    system: string | undefined
    messages: Message[]
  }) => void
}
