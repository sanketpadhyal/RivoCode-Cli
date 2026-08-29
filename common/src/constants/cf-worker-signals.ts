
export const CF_WORKER_HEADER = 'cf-worker'

export const CF_RAY_HEADER = 'cf-ray'

export type CfWorkerMode = 'off' | 'observe' | 'block' | 'ban'

export type CfWorkerVerdict =
  | { detected: false; reason: 'no_header' | 'not_edge_verified' | 'allowlisted' }
  | { detected: true; zone: string }

export type CfWorkerDetectInput = {
  cfWorkerHeader: string | null | undefined
  cfRayHeader: string | null | undefined
  allowedZones: ReadonlySet<string>
}

export function detectCfWorker(input: CfWorkerDetectInput): CfWorkerVerdict {
  const raw = input.cfWorkerHeader?.trim()
  if (!raw) return { detected: false, reason: 'no_header' }

  if (!input.cfRayHeader?.trim()) {
    return { detected: false, reason: 'not_edge_verified' }
  }

  const zone = raw.toLowerCase()
  if (input.allowedZones.has(zone)) {
    return { detected: false, reason: 'allowlisted' }
  }

  return { detected: true, zone }
}

export type CfWorkerEvidence = {
  zone: string
  cfRay: string | null
  clientId: string | null
  userAgent: string | null
  model: string | null
  agentId: string | null
  endpoint: string
  detectedAt: string
}

export function parseAllowedWorkerZones(
  raw: string | null | undefined,
): ReadonlySet<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((zone) => zone.trim().toLowerCase())
      .filter((zone) => zone.length > 0),
  )
}

export function looksLikeProxyClientId(clientId: string | null | undefined): boolean {
  return typeof clientId === 'string' && /^wf-[a-z0-9]{8}$/.test(clientId)
}
