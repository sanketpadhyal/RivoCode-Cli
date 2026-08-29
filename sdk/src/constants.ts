import { env, IS_DEV, IS_TEST, IS_PROD } from '@rivocode/common/env'

import { getRuntimeAppUrlFromEnv } from './env'

export { IS_DEV, IS_TEST, IS_PROD }

export const CODEBUFF_BINARY = 'codebuff'

const bundledWebsiteUrl = env.NEXT_PUBLIC_CODEBUFF_APP_URL

export function getWebsiteUrl(): string {
  return (getRuntimeAppUrlFromEnv() ?? bundledWebsiteUrl).replace(/\/$/, '')
}

export const WEBSITE_URL = bundledWebsiteUrl
