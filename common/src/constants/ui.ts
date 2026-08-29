export const AuthState = {
  LOGGED_OUT: 'LOGGED_OUT',
  LOGGED_IN: 'LOGGED_IN',
} as const

export type AuthState = (typeof AuthState)[keyof typeof AuthState]

export const UserState = {
  LOGGED_OUT: 'LOGGED_OUT',
  GOOD_STANDING: 'GOOD_STANDING',
  ATTENTION_NEEDED: 'ATTENTION_NEEDED',
  CRITICAL: 'CRITICAL',
  DEPLETED: 'DEPLETED',
} as const

export type UserState = (typeof UserState)[keyof typeof UserState]

export function getUserState(isLoggedIn: boolean, credits: number): UserState {
  if (!isLoggedIn) return UserState.LOGGED_OUT

  if (credits >= 100) return UserState.GOOD_STANDING
  if (credits >= 20) return UserState.ATTENTION_NEEDED
  if (credits >= 1) return UserState.CRITICAL
  return UserState.DEPLETED
}
