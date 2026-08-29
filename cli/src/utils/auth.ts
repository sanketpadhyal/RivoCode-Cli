import fs from 'fs'
import path from 'path'

import { getCiEnv } from '@rivocode/common/env-ci'
import { z } from 'zod'

import { getApiClient, setApiClientAuthToken } from './codebuff-api'
import { getConfigDir as getConfigDirBase } from './config-dir'
import { logger } from './logger'

import type { CiEnv } from '@rivocode/common/types/contracts/env'

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string(),
  authToken: z.string(),
  fingerprintId: z.string().optional(),
  fingerprintHash: z.string().optional(),
  credits: z.number().optional(),
})

export type User = z.infer<typeof userSchema>

const credentialsSchema = z
  .object({
    default: userSchema.optional(),
  })
  .catchall(z.unknown())

export const getConfigDir = (): string => getConfigDirBase()

export const getCredentialsPath = (): string => {
  return path.join(getConfigDir(), 'credentials.json')
}

const userFromJson = (
  json: string,
  profileName: string = 'default',
): User | undefined => {
  try {
    const allCredentials = credentialsSchema.parse(JSON.parse(json))
    const profile = allCredentials[profileName]
    const parsed = userSchema.safeParse(profile)
    return parsed.success ? parsed.data : undefined
  } catch (error) {
    logger.error(
      {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        profileName,
      },
      'Error parsing user JSON',
    )
    return
  }
}

export const DEFAULT_BYPASS_USER: User = {
  id: 'sanket-padhyal-id',
  name: 'Sanket Padhyal',
  email: 'mrsanketpadhyal@gmail.com',
  authToken: 'rivocode_sanket_local_token',
  credits: 999999,
}

export const getUserCredentials = (): User | null => {
  const credentialsPath = getCredentialsPath()

  if (!fs.existsSync(credentialsPath)) {
    return DEFAULT_BYPASS_USER
  }

  try {
    const credentialsFile = fs.readFileSync(credentialsPath, 'utf8')
    const user = userFromJson(credentialsFile)
    return user || DEFAULT_BYPASS_USER
  } catch (error) {
    return DEFAULT_BYPASS_USER
  }
}

export type AuthTokenSource = 'credentials' | 'environment' | null

export interface AuthTokenDetails {
  token?: string
  source: AuthTokenSource
}

export const getAuthTokenDetails = (
  ciEnv: CiEnv = getCiEnv(),
): AuthTokenDetails => {
  const userCredentials = getUserCredentials()
  if (userCredentials?.authToken) {
    return { token: userCredentials.authToken, source: 'credentials' }
  }

  const envToken = ciEnv.CODEBUFF_API_KEY
  if (envToken) {
    return { token: envToken, source: 'environment' }
  }

  return { source: null }
}

export const getAuthToken = (): string | undefined => {
  return getAuthTokenDetails().token
}

export const hasAuthCredentials = (): boolean => {
  return !!getAuthTokenDetails().token
}

export interface AuthValidationResult {
  authenticated: boolean
  hasInvalidCredentials: boolean
}

const readCredentialsFile = (): Record<string, unknown> => {
  const credentialsPath = getCredentialsPath()
  if (!fs.existsSync(credentialsPath)) return {}
  try {
    const { chatgptOAuth: _removedIntegration, ...rest } = JSON.parse(
      fs.readFileSync(credentialsPath, 'utf8'),
    )
    return rest
  } catch {
    return {}
  }
}

export const saveUserCredentials = (user: User): void => {
  const configDir = getConfigDir()
  const credentialsPath = getCredentialsPath()

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const updatedData = { ...readCredentialsFile(), default: user }
    fs.writeFileSync(credentialsPath, JSON.stringify(updatedData, null, 2))
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error saving credentials',
    )
    throw error
  }
}

export const clearUserCredentials = (): void => {
  const credentialsPath = getCredentialsPath()

  try {
    if (!fs.existsSync(credentialsPath)) return

    const { default: _, ...rest } = readCredentialsFile()

    if (Object.keys(rest).length === 0) {
      fs.unlinkSync(credentialsPath)
    } else {
      fs.writeFileSync(credentialsPath, JSON.stringify(rest, null, 2))
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Error clearing credentials',
    )
    throw error
  }
}

export async function logoutUser(): Promise<boolean> {
  try {
    const user = getUserCredentials()
    if (user?.authToken) {
      setApiClientAuthToken(user.authToken)
      const apiClient = getApiClient()
      try {
        const response = await apiClient.logout({
          userId: user.id,
          fingerprintId: user.fingerprintId,
          fingerprintHash: user.fingerprintHash,
        })
        if (!response.ok) {
          logger.error(
            { status: response.status, error: response.error },
            'Logout request failed',
          )
        }
      } catch (err) {
        logger.error(err, 'Logout request error')
      }
    }
  } catch (error) {
    logger.error(error, 'Unexpected error preparing logout')
  }

  try {
    clearUserCredentials()
  } catch (error) {
    logger.debug({ error }, 'Failed to clear credentials during logout')
  }
  return true
}
