import { z } from 'zod/v4'

export const BROWSER_DEFAULTS = {
  headless: true,
  debug: false,
  timeout: 15000,
  userDataDir: '_browser_profile',
  retryOptions: {
    maxRetries: 3,
    retryDelay: 1000,
    retryOnErrors: ['TimeoutError', 'TargetClosedError', 'DetachedFrameError'],
  },

  viewportWidth: 1280,
  viewportHeight: 720,

  waitUntil: 'networkidle0' as const,

  waitForNavigation: false,
  button: 'left' as const,

  delay: 100,

  fullPage: false,
  screenshotCompression: 'jpeg' as const,
  screenshotCompressionQuality: 25,
  compressScreenshotData: true,

  maxConsecutiveErrors: 3,
  totalErrorThreshold: 10,
} as const

export const LogSchema = z.object({
  type: z.enum(['error', 'warning', 'info', 'debug', 'verbose']),
  message: z.string(),
  timestamp: z.number(),
  location: z.string().optional(),
  stack: z.string().optional(),
  category: z.string().optional(),
  level: z.number().optional(),
  source: z.enum(['browser', 'tool']).default('tool'),
})

export type Log = z.infer<typeof LogSchema>

export const MetricsSchema = z.object({
  loadTime: z.number(),
  memoryUsage: z.number(),
  jsErrors: z.number(),
  networkErrors: z.number(),
  ttfb: z.number().optional(),
  lcp: z.number().optional(),
  fcp: z.number().optional(),
  domContentLoaded: z.number().optional(),
  sessionDuration: z.number().optional(),
})

export const NetworkEventSchema = z.object({
  url: z.string(),
  method: z.string(),
  status: z.number().optional(),
  errorText: z.string().optional(),
  timestamp: z.number(),
})

export const LogFilterSchema = z.object({
  types: z
    .array(z.enum(['error', 'warning', 'info', 'debug', 'verbose']))
    .optional(),
  minLevel: z.number().optional(),
  categories: z.array(z.string()).optional(),
})

export const RequiredRetryOptionsSchema = z.object({
  maxRetries: z.number(),
  retryDelay: z.number(),
  retryOnErrors: z.array(z.string()),
})

export const OptionalBrowserConfigSchema = z.object({
  timeout: z.number().optional(),
  retryOptions: z
    .object({
      maxRetries: z.number().optional(),
      retryDelay: z.number().optional(),
      retryOnErrors: z.array(z.string()).optional(),
    })
    .optional(),
  logFilter: LogFilterSchema.optional(),
  debug: z.boolean().optional(),
})

export const OptionalStartConfigSchema = z.object({
  maxConsecutiveErrors: z.number().optional(),
  totalErrorThreshold: z.number().optional(),
})

export type BrowserConfig = z.infer<typeof OptionalBrowserConfigSchema> &
  z.infer<typeof OptionalStartConfigSchema>

export const OptionalNavigateConfigSchema = z.object({
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0']).optional(),
})

export const OptionalClickConfigSchema = z.object({
  waitForNavigation: z.boolean().optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  visualVerify: z.boolean().optional(),
  visualThreshold: z.number().min(0).max(1).optional(),
})

export const OptionalTypeConfigSchema = z.object({
  delay: z.number().optional(),
})

export const OptionalScreenshotConfigSchema = z.object({
  fullPage: z.boolean().optional(),
  screenshotCompression: z.enum(['jpeg', 'png']).optional(),
  screenshotCompressionQuality: z.number().optional(),
  compressScreenshotData: z.boolean().optional(),
})

export const MAX_MESSAGE_SIZE = 10 * 1024 * 1024

export const BrowserResponseChunkSchema = z.object({
  id: z.string(),
  total: z.number(),
  index: z.number(),
  data: z.string(),
})

export const ImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.literal('image/jpeg'),
    data: z.string(),
  }),
})
export type ImageContent = z.infer<typeof ImageContentSchema>

export const BrowserResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  logs: z.array(LogSchema),
  logFilter: LogFilterSchema.optional(),
  networkEvents: z.array(NetworkEventSchema).optional(),
  metrics: MetricsSchema.optional(),
  screenshots: z
    .object({
      pre: ImageContentSchema.optional(),
      post: ImageContentSchema,
    })
    .optional(),
})

export const RequiredBrowserStartActionSchema = z.object({
  type: z.literal('start'),
  url: z.string().url(),
})

export const BrowserStartActionSchema = RequiredBrowserStartActionSchema.merge(
  OptionalBrowserConfigSchema,
).merge(OptionalStartConfigSchema)

export const RequiredBrowserNavigateActionSchema = z.object({
  type: z.literal('navigate'),
  url: z.string().url(),
})

export const BrowserNavigateActionSchema =
  RequiredBrowserNavigateActionSchema.merge(OptionalBrowserConfigSchema).merge(
    OptionalNavigateConfigSchema,
  )

const _RangeSchema = z.object({
  min: z.number(),
  max: z.number(),
})

export const RequiredBrowserClickActionSchema = z.object({
  type: z.literal('click'),
})

export const BrowserClickActionSchema = RequiredBrowserClickActionSchema.merge(
  OptionalBrowserConfigSchema,
).merge(OptionalClickConfigSchema)

export const RequiredBrowserTypeActionSchema = z.object({
  type: z.literal('type'),
  selector: z.string(),
  text: z.string(),
})

export const BrowserTypeActionSchema = RequiredBrowserTypeActionSchema.merge(
  OptionalBrowserConfigSchema,
).merge(OptionalTypeConfigSchema)

export const RequiredBrowserScrollActionSchema = z.object({
  type: z.literal('scroll'),
})

export const OptionalScrollConfigSchema = z.object({
  direction: z.enum(['up', 'down']).optional(),
})

export const BrowserScrollActionSchema =
  RequiredBrowserScrollActionSchema.merge(OptionalBrowserConfigSchema).merge(
    OptionalScrollConfigSchema,
  )

export const RequiredBrowserScreenshotActionSchema = z.object({
  type: z.literal('screenshot'),
})

export const BrowserScreenshotActionSchema =
  RequiredBrowserScreenshotActionSchema.merge(
    OptionalBrowserConfigSchema,
  ).merge(OptionalScreenshotConfigSchema)

export const RequiredBrowserStopActionSchema = z.object({
  type: z.literal('stop'),
})
export const BrowserStopActionSchema = RequiredBrowserStopActionSchema.merge(
  OptionalBrowserConfigSchema,
)

const BaseBrowserActionSchema = z.discriminatedUnion('type', [
  BrowserStartActionSchema,
  BrowserNavigateActionSchema,
  BrowserClickActionSchema,
  BrowserTypeActionSchema,
  BrowserScrollActionSchema,
  BrowserScreenshotActionSchema,
  BrowserStopActionSchema,
])

export const DiagnosticStepSchema = z.object({
  label: z.string().optional(),
  action: BaseBrowserActionSchema,
  expectedLogs: z.array(z.string()).optional(),
  noJsErrors: z.boolean().optional(),
  noNetworkErrors: z.boolean().optional(),
  customCondition: z.string().optional(),
})

export const BrowserDiagnoseActionSchema = z.object({
  type: z.literal('diagnose'),
  steps: z.array(DiagnosticStepSchema),
  automated: z.boolean().optional(),
  maxSteps: z.number().optional(),
  sessionTimeoutMs: z.number().optional(),
  ...OptionalBrowserConfigSchema.shape,
})

export const BrowserActionSchema = z.discriminatedUnion('type', [
  BrowserStartActionSchema,
  BrowserNavigateActionSchema,
  BrowserClickActionSchema,
  BrowserTypeActionSchema,
  BrowserScrollActionSchema,
  BrowserScreenshotActionSchema,
  BrowserStopActionSchema,
  BrowserDiagnoseActionSchema,
])

export function createBrowserActionXML(action: BrowserAction): string {
  const { type, ...attributes } = action
  const attrsString = Object.entries(attributes)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      const escaped = val.replace(/[<>&'"]/g, (char) => {
        switch (char) {
          case '<':
            return '&lt;'
          case '>':
            return '&gt;'
          case '&':
            return '&amp;'
          case '"':
            return '&quot;'
          case "'":
            return '&apos;'
          default:
            return char
        }
      })
      return `${k}="${escaped}"`
    })
    .join(' ')
  return `<browser_logs action="${type}" ${attrsString} />`
}

export function parseBrowserActionXML(xmlString: string): BrowserAction {
  if (!xmlString.includes('<browser_logs') || !xmlString.includes('/>')) {
    throw new Error('Invalid browser action XML: missing browser_logs tag')
  }

  const attrs: Record<string, string> = {}
  const attrPattern = /(\w+)="([^"]*)"/g
  let match

  while ((match = attrPattern.exec(xmlString)) !== null) {
    const [_, key, value] = match
    attrs[key] = value
  }

  if (!attrs.action) {
    throw new Error('Invalid browser action XML: missing action attribute')
  }

  const type = attrs.action
  delete attrs.action

  const parsedAttrs = Object.entries(attrs).reduce(
    (acc, [key, value]) => {
      try {
        if (value.startsWith('{') || value.startsWith('[')) {
          acc[key] = JSON.parse(value)
        }
        else if (value === 'true' || value === 'false') {
          acc[key] = value === 'true'
        }
        else if (!isNaN(Number(value))) {
          acc[key] = Number(value)
        }
        else {
          acc[key] = value
        }
      } catch {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, any>,
  )

  const action = { type, ...parsedAttrs } as BrowserAction
  return BrowserActionSchema.parse(action)
}

export type BrowserResponse = z.infer<typeof BrowserResponseSchema>
export type BrowserAction = z.infer<typeof BrowserActionSchema>

export function parseBrowserActionAttributes(
  attributes: Record<string, string>,
): BrowserAction {
  const { action, ...rest } = attributes
  return {
    type: action,
    ...Object.entries(rest).reduce((acc, [key, value]) => {
      if (value === 'true') return { ...acc, [key]: true }
      if (value === 'false') return { ...acc, [key]: false }
      if (!isNaN(Number(value))) return { ...acc, [key]: Number(value) }
      return { ...acc, [key]: value }
    }, {}),
  } as BrowserAction
}
