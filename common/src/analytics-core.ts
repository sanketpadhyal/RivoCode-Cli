import { PostHog } from 'posthog-node'

import { createExceptionBeforeSend } from './util/exception-budget'

export interface AnalyticsClient {
  capture: (params: {
    distinctId: string
    event: string
    properties?: Record<string, any>
  }) => void
  flush: () => Promise<void>
}

export interface AnalyticsClientWithIdentify extends AnalyticsClient {
  identify: (params: {
    distinctId: string
    properties?: Record<string, any>
  }) => void
  alias: (data: { distinctId: string; alias: string }) => void
  captureException: (
    error: any,
    distinctId: string,
    properties?: Record<string, any>,
  ) => void
}

export type AnalyticsEnvName = 'dev' | 'test' | 'prod'

export interface AnalyticsConfig {
  envName: AnalyticsEnvName
  posthogApiKey: string
  posthogHostUrl: string
}

export interface PostHogClientOptions {
  host: string
  flushAt?: number
  flushInterval?: number
  enableExceptionAutocapture?: boolean
}

export function createPostHogClient(
  apiKey: string,
  options: PostHogClientOptions,
): AnalyticsClientWithIdentify {
  return new PostHog(apiKey, {
    ...options,
    before_send: createExceptionBeforeSend(),
  }) as AnalyticsClientWithIdentify
}

export function generateAnonymousId(): string {
  return `anon_${crypto.randomUUID()}`
}
