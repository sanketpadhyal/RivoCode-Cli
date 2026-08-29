
const MAX_PRODUCT_LEN = 32
const MAX_VERSION_LEN = 16

export const UNRECOGNIZED_CLIENT = 'unrecognized'

const VERSION_RE = /^\d[0-9A-Za-z.+-]*$/

export type NormalizedClientUserAgent = {
  product: string
  version?: string
}

export function normalizeClientUserAgent(
  raw: string | null | undefined,
): NormalizedClientUserAgent | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const [firstToken = ''] = trimmed.split(/\s+/, 1)
  const slash = firstToken.indexOf('/')
  const rawProduct = slash === -1 ? firstToken : firstToken.slice(0, slash)
  const rawVersion = slash === -1 ? '' : firstToken.slice(slash + 1)

  if (rawProduct.includes('@')) return { product: UNRECOGNIZED_CLIENT }

  const product = rawProduct.toLowerCase().replace(/[^a-z0-9._-]/g, '')

  if (!product || product.length > MAX_PRODUCT_LEN) {
    return { product: UNRECOGNIZED_CLIENT }
  }

  if (rawVersion.length > MAX_VERSION_LEN || !VERSION_RE.test(rawVersion)) {
    return { product }
  }
  return { product, version: rawVersion }
}

export function clientUserAgentFields(raw: string | null | undefined): {
  client_ua_product?: string
  client_ua_version?: string
} {
  const normalized = normalizeClientUserAgent(raw)
  if (!normalized) return {}
  return {
    client_ua_product: normalized.product,
    ...(normalized.version ? { client_ua_version: normalized.version } : {}),
  }
}
