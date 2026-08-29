
export interface FreebuffUsageStreakSummary {
  current: number
  longest: number
  todayUsed: boolean
  lastUsageDate: string | null
}

export interface FreebuffRecentUsage {
  days: number
  messages: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  totalTokens: number
}

export interface FreebuffUsageSessionsByModel {
  model: string
  sessions: number
  units: number
}

export interface FreebuffUsageSummary {
  timeZone: string
  todayDateKey: string
  streak: FreebuffUsageStreakSummary
  activeDates: string[]
  windowDays: number
  allTimeActiveDays: number
  recent: FreebuffRecentUsage | null
  sessionsByModel: FreebuffUsageSessionsByModel[]
}
