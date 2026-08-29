import { AnalyticsEvent } from '@codebuff/common/constants/analytics-events'
import { cyan, green, red, yellow, bold } from 'picocolors'

import { LOGIN_WEBSITE_URL } from './constants'
import { generateLoginUrl, pollLoginStatus } from './login-flow'
import {
  flushAnalytics,
  identifyUser,
  trackEvent,
} from '../utils/analytics'
import { saveUserCredentials } from '../utils/auth'
import { IS_FREEBUFF } from '../utils/constants'
import { getFingerprintId } from '../utils/fingerprint'
import { logger } from '../utils/logger'

import type { User } from '../utils/auth'

export async function runPlainLogin(): Promise<void> {
  const fingerprintId = await getFingerprintId()

  console.log()
  console.log(bold(IS_FREEBUFF ? 'Freebuff Login' : 'Codebuff Login'))
  console.log()
  console.log('Generating login URL...')

  let loginData
  try {
    loginData = await generateLoginUrl(
      { logger, trackEvent },
      { baseUrl: LOGIN_WEBSITE_URL, fingerprintId, via: 'plain_command' },
    )
  } catch (error) {
    console.error(
      red(
        `Failed to generate login URL: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    )
    process.exit(1)
  }

  console.log()
  console.log('Open this URL in your browser to log in:')
  console.log()
  console.log(cyan(loginData.loginUrl))
  console.log()
  console.log(yellow('Please open the URL above manually to complete login.'))
  console.log()
  console.log('Waiting for login...')

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  const result = await pollLoginStatus(
    { sleep, logger, trackEvent },
    {
      baseUrl: LOGIN_WEBSITE_URL,
      fingerprintId,
      fingerprintHash: loginData.fingerprintHash,
      expiresAt: loginData.expiresAt,
      via: 'plain_command',
    },
  )

  if (result.status === 'success') {
    const user = result.user as User
    saveUserCredentials(user)

    if (user.id) {
      identifyUser(user.id, { email: user.email, freebuff: IS_FREEBUFF })
      trackEvent(AnalyticsEvent.LOGIN, {
        userId: user.id,
        via: 'plain_command',
        hasEmail: Boolean(user.email),
        hasName: Boolean(user.name),
      })
      await flushAnalytics()
    }

    console.log()
    console.log(green(`✓ Logged in as ${user.name} (${user.email})`))
    console.log()
    const cliName = IS_FREEBUFF ? 'freebuff' : 'codebuff'
    console.log('You can now run ' + cyan(cliName) + ' to start.')
    process.exit(0)
  } else if (result.status === 'timeout') {
    console.error(red('Login timed out. Please try again.'))
    process.exit(1)
  } else {
    console.error(red('Login was aborted.'))
    process.exit(1)
  }
}
