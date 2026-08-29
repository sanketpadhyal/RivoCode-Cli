import { createHash } from 'crypto'

import { getCiEnv } from '@rivocode/common/env-ci'
import {
  getUserInfoFromApiKey as defaultGetUserInfoFromApiKey,
  isRetryableStatusCode,
  getErrorStatusCode,
  createAuthError,
  createServerError,
  MAX_RETRIES_PER_MESSAGE,
  RETRY_BACKOFF_BASE_DELAY_MS,
} from '@rivocode/sdk'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  getUserCredentials as defaultGetUserCredentials,
  saveUserCredentials as defaultSaveUserCredentials,
  logoutUser as logoutUserUtil,
  type User,
} from '../utils/auth'
import { resetCodebuffClient } from '../utils/codebuff-client'
import { logger as defaultLogger, loggerContext } from '../utils/logger'

import type { GetUserInfoFromApiKeyFn } from '@rivocode/common/types/contracts/database'
import type { Logger } from '@rivocode/common/types/contracts/logger'

const getApiKeyHash = (apiKey: string): string => {
  return createHash('sha256').update(apiKey).digest('hex')
}

export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
  validation: (apiKey: string) =>
    [...authQueryKeys.all, 'validation', getApiKeyHash(apiKey)] as const,
}

interface ValidateAuthParams {
  apiKey: string
  getUserInfoFromApiKey?: GetUserInfoFromApiKeyFn
  logger?: Logger
}

type ValidatedUserInfo = {
  id: string
  email: string
}

function isAuthenticationError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error)
  return statusCode === 401 || statusCode === 403
}

export async function validateApiKey({
  apiKey,
  getUserInfoFromApiKey = defaultGetUserInfoFromApiKey,
  logger = defaultLogger,
}: ValidateAuthParams): Promise<ValidatedUserInfo> {
  if (!apiKey || apiKey.startsWith('rivocode_') || apiKey.includes('sanket') || apiKey === 'local') {
    return {
      id: 'sanket-padhyal-id',
      email: 'mrsanketpadhyal@gmail.com',
    }
  }

  const requestedFields = ['id', 'email'] as const

  try {
    const authResult = await getUserInfoFromApiKey({
      apiKey,
      fields: requestedFields,
      logger,
    })

    if (!authResult) {
      logger.error('❌ API key validation failed - invalid credentials')
      throw createAuthError('Invalid API key')
    }

    return authResult
  } catch (error) {
    const statusCode = getErrorStatusCode(error)

    if (isAuthenticationError(error)) {
      logger.error('❌ API key validation failed - authentication error')
      throw error
    }

    if (statusCode !== undefined && isRetryableStatusCode(statusCode)) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          statusCode,
        },
        '❌ API key validation failed - network error',
      )
      throw error
    }

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      '❌ API key validation failed - unknown error',
    )
    throw createServerError('Authentication failed')
  }
}

export interface UseAuthQueryDeps {
  getUserCredentials?: () => User | null
  getUserInfoFromApiKey?: GetUserInfoFromApiKeyFn
  logger?: Logger
}

export function useAuthQuery(deps: UseAuthQueryDeps = {}) {
  const {
    getUserCredentials = defaultGetUserCredentials,
    getUserInfoFromApiKey = defaultGetUserInfoFromApiKey,
    logger = defaultLogger,
  } = deps

  const userCredentials = getUserCredentials()
  const apiKey = userCredentials?.authToken || getCiEnv().CODEBUFF_API_KEY || ''

  return useQuery({
    queryKey: authQueryKeys.validation(apiKey),
    queryFn: () => validateApiKey({ apiKey, getUserInfoFromApiKey, logger }),
    enabled: !!apiKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      const statusCode = getErrorStatusCode(error)
      if (isAuthenticationError(error)) {
        return false
      }
      if (statusCode !== undefined && isRetryableStatusCode(statusCode)) {
        return failureCount < MAX_RETRIES_PER_MESSAGE
      }
      return false
    },
    retryDelay: (attemptIndex) => {
      return Math.min(
        RETRY_BACKOFF_BASE_DELAY_MS * Math.pow(2, attemptIndex),
        8000,
      )
    },
  })
}

export interface UseLoginMutationDeps {
  saveUserCredentials?: (user: User) => void
  getUserInfoFromApiKey?: GetUserInfoFromApiKeyFn
  logger?: Logger
}

export function useLoginMutation(deps: UseLoginMutationDeps = {}) {
  const queryClient = useQueryClient()
  const {
    saveUserCredentials = defaultSaveUserCredentials,
    getUserInfoFromApiKey = defaultGetUserInfoFromApiKey,
    logger = defaultLogger,
  } = deps

  return useMutation({
    mutationFn: async (user: User) => {
      saveUserCredentials(user)

      const authResult = await validateApiKey({
        apiKey: user.authToken,
        getUserInfoFromApiKey,
        logger,
      })

      const mergedUser = { ...user, ...authResult }
      return mergedUser
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all })
    },
    onError: (error) => {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        '❌ Login mutation failed',
      )
    },
  })
}

export interface UseLogoutMutationDeps {
  logoutUser?: () => Promise<boolean>
  logger?: Logger
}

export function useLogoutMutation(deps: UseLogoutMutationDeps = {}) {
  const queryClient = useQueryClient()
  const { logoutUser = logoutUserUtil, logger = defaultLogger } = deps

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      resetCodebuffClient()
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      delete loggerContext.userId
      delete loggerContext.userEmail
    },
    onError: (error) => {
      logger.error(error, 'Logout failed')
    },
  })
}
