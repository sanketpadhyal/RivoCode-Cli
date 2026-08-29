import z from 'zod/v4'

export const CLIENT_ENV_PREFIX = 'NEXT_PUBLIC_'

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CB_ENVIRONMENT: z.enum(['dev', 'test', 'prod']).default('dev'),
  NEXT_PUBLIC_CODEBUFF_APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_FREEBUFF_APP_URL: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().default('mrsanketpadhyal@gmail.com'),
  NEXT_PUBLIC_POSTHOG_API_KEY: z.string().default('ph_dummy'),
  NEXT_PUBLIC_POSTHOG_HOST_URL: z.string().default('https://app.posthog.com'),
  NEXT_PUBLIC_GRAVITY_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_dummy'),
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: z.string().default('https://billing.stripe.com'),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: z.string().optional(),
  NEXT_PUBLIC_WEB_PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_RECAPTCHA_V2_SIZE: z.enum(['checkbox', 'invisible']).optional(),
  NEXT_PUBLIC_HUMANBEHAVIOR_API_KEY: z.string().optional(),
} satisfies Record<`${typeof CLIENT_ENV_PREFIX}${string}`, any>)
export const clientEnvVars = clientEnvSchema.keyof().options
export type ClientEnvVar = (typeof clientEnvVars)[number]
export type ClientInput = {
  [K in (typeof clientEnvVars)[number]]: string | undefined
}
export type ClientEnv = z.infer<typeof clientEnvSchema>

export const clientProcessEnv: ClientInput = {
  NEXT_PUBLIC_CB_ENVIRONMENT: process.env.NEXT_PUBLIC_CB_ENVIRONMENT,
  NEXT_PUBLIC_CODEBUFF_APP_URL: process.env.NEXT_PUBLIC_CODEBUFF_APP_URL,
  NEXT_PUBLIC_FREEBUFF_APP_URL: process.env.NEXT_PUBLIC_FREEBUFF_APP_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
  NEXT_PUBLIC_POSTHOG_HOST_URL: process.env.NEXT_PUBLIC_POSTHOG_HOST_URL,
  NEXT_PUBLIC_GRAVITY_PIXEL_ID: process.env.NEXT_PUBLIC_GRAVITY_PIXEL_ID,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID,
  NEXT_PUBLIC_WEB_PORT: process.env.NEXT_PUBLIC_WEB_PORT,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY:
    process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY,
  NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY:
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY,
  NEXT_PUBLIC_RECAPTCHA_V2_SIZE: process.env.NEXT_PUBLIC_RECAPTCHA_V2_SIZE,
  NEXT_PUBLIC_HUMANBEHAVIOR_API_KEY:
    process.env.NEXT_PUBLIC_HUMANBEHAVIOR_API_KEY,
}
