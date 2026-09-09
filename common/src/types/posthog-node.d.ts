declare module 'posthog-node' {
  export class PostHog {
    constructor(apiKey: string, options?: any)
    capture(params: any): void
    identify(params: any): void
    alias(params: any): void
    captureException(error: any, distinctId?: string, properties?: any): void
    flush(): Promise<void>
    shutdown(): Promise<void>
  }
}
