import { clientEnvSchema, clientProcessEnv } from './env-schema'

const parsedEnv = clientEnvSchema.safeParse(clientProcessEnv)
if (!parsedEnv.success) {
  console.error('Environment validation failed:', parsedEnv.error.issues)
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`)
}

export const env = parsedEnv.data

if (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
  console.log('Using environment:', env.NEXT_PUBLIC_CB_ENVIRONMENT)
}

export const IS_DEV = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'dev'
export const IS_TEST = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'test'
export const IS_PROD = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'prod'
export const IS_CI = process.env.CODEBUFF_GITHUB_ACTIONS === 'true'

export const DEBUG_ANALYTICS = false
