export type TopBannerType = 'homeDir' | 'gitRoot' | null

export type InputValue = {
  text: string
  cursorPosition: number
  lastEditDueToNav: boolean
}

export type AskUserQuestion = {
  question: string
  header?: string
  options:
    | string[]
    | Array<{
        label: string
        description?: string
      }>
  multiSelect?: boolean
  validation?: {
    maxLength?: number
    minLength?: number
    pattern?: string
    patternError?: string
  }
}

export type AnswerState = number | number[]

export type AskUserState = {
  toolCallId: string
  questions: AskUserQuestion[]
  selectedAnswers: AnswerState[]
  otherTexts: string[]
} | null

export type PendingImageStatus = 'processing' | 'ready' | 'error'

export type PendingImageAttachment = {
  kind: 'image'
  path: string
  filename: string
  status: PendingImageStatus
  size?: number
  width?: number
  height?: number
  note?: string
  processedImage?: {
    base64: string
    mediaType: string
  }
}

export type PendingTextAttachment = {
  kind: 'text'
  id: string
  content: string
  preview: string
  charCount: number
}

export type PendingFileAttachment = {
  kind: 'file'
  id: string
  path: string
  filename: string
  isDirectory: boolean
  content: string
  status: 'processing' | 'ready' | 'error'
  note?: string
}

export type PendingAttachment = PendingImageAttachment | PendingTextAttachment | PendingFileAttachment

export type PendingImage = PendingImageAttachment

export type TerminalSession = {
  id: string
  command: string
  cwd: string
  status: 'running' | 'completed' | 'failed'
  exitCode?: number | null
  startedAt: number
  endedAt?: number
  logs: string[]
  pid?: number
}

export type PendingBashMessage = {
  id: string
  command: string
  stdout: string
  stderr: string
  exitCode: number
  isRunning: boolean
  startTime?: number
  cwd?: string
  addedToHistory?: boolean
}

export type SuggestedFollowup = {
  prompt: string
  label?: string
}

export type SuggestedFollowupsState = {
  toolCallId: string
  followups: SuggestedFollowup[]
  clickedIndices: Set<number>
}

export type ClickedFollowupsMap = Map<string, Set<number>>
