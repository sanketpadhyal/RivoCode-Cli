const AD_CHROME_VERSION = '151.0.0.0'

const AD_USER_AGENTS: Record<string, string> = {
  darwin: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${AD_CHROME_VERSION} Safari/537.36`,
  win32: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${AD_CHROME_VERSION} Safari/537.36`,
  linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${AD_CHROME_VERSION} Safari/537.36`,
}

export function getAdUserAgent(platform: string = process.platform): string {
  const platformKey =
    platform === 'macos'
      ? 'darwin'
      : platform === 'windows'
        ? 'win32'
        : platform
  return AD_USER_AGENTS[platformKey] ?? AD_USER_AGENTS.linux
}

export function isBrowserLikeAdUserAgent(
  candidate: string | undefined | null,
): boolean {
  return typeof candidate === 'string' && /^Mozilla\//i.test(candidate.trim())
}

export function resolveAdProviderUserAgent(params: {
  submitted?: string | null
  requestHeader?: string | null
  os?: string
}): string {
  const { submitted, requestHeader, os } = params
  const candidate = submitted?.trim() || requestHeader?.trim()
  return isBrowserLikeAdUserAgent(candidate)
    ? (candidate as string)
    : getAdUserAgent(os)
}
