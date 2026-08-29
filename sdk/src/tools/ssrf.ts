import dns from 'node:dns'
import net from 'node:net'
import { promisify } from 'node:util'

import ipaddr from 'ipaddr.js'

export type HostLookup = (hostname: string) => Promise<string[]>

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

const lookupAsync = promisify(dns.lookup)

const defaultLookup: HostLookup = async (hostname) => {
  const results = await lookupAsync(hostname, { all: true, verbatim: true })
  return results.map((result) => result.address)
}

export function isBlockedAddress(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6
  try {
    addr = ipaddr.parse(ip)
  } catch {
    return true
  }

  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6
    if (v6.isIPv4MappedAddress()) {
      addr = v6.toIPv4Address()
    }
  }

  return addr.range() !== 'unicast'
}

function unwrapHost(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1)
  }
  return hostname
}

export async function assertUrlAllowed(
  url: URL,
  opts: { lookupHost?: HostLookup; resolveDns?: boolean } = {},
): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('Only http:// and https:// URLs are supported')
  }

  const host = unwrapHost(url.hostname)

  if (net.isIP(host) !== 0) {
    if (isBlockedAddress(host)) {
      throw new SsrfError(
        `Refusing to fetch private or reserved address: ${host}`,
      )
    }
    return
  }

  if (opts.resolveDns === false) {
    return
  }

  const lookupHost = opts.lookupHost ?? defaultLookup
  let addresses: string[]
  try {
    addresses = await lookupHost(host)
  } catch (error) {
    throw new SsrfError(
      `Could not resolve host "${host}": ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    )
  }

  if (addresses.length === 0) {
    throw new SsrfError(`Could not resolve host "${host}"`)
  }

  for (const ip of addresses) {
    if (isBlockedAddress(ip)) {
      throw new SsrfError(
        `Host "${host}" resolves to a private or reserved address (${ip})`,
      )
    }
  }
}
