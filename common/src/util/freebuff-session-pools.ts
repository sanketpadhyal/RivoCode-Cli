
import type { FreebuffSessionRateLimit } from '../types/freebuff-session'

export interface FreebuffSectionQuotas {
  header: FreebuffSessionRateLimit | undefined
  perModel: Record<string, FreebuffSessionRateLimit>
}

export function getFreebuffSectionQuotas(
  models: readonly string[],
  quotas: Record<string, FreebuffSessionRateLimit> | undefined,
): FreebuffSectionQuotas {
  if (!quotas) return { header: undefined, perModel: {} }

  const rows = models
    .map((model) => quotas[model])
    .filter((quota): quota is FreebuffSessionRateLimit => Boolean(quota))
  if (rows.length === 0) return { header: undefined, perModel: {} }

  const poolOf = (quota: FreebuffSessionRateLimit) => quota.pool ?? ''

  const counts = new Map<string, number>()
  for (const quota of rows) {
    counts.set(poolOf(quota), (counts.get(poolOf(quota)) ?? 0) + 1)
  }

  let headerPool = poolOf(rows[0]!)
  for (const quota of rows) {
    if ((counts.get(poolOf(quota)) ?? 0) > (counts.get(headerPool) ?? 0)) {
      headerPool = poolOf(quota)
    }
  }

  const header = rows.find((quota) => poolOf(quota) === headerPool)
  const perModel: Record<string, FreebuffSessionRateLimit> = {}
  for (const quota of rows) {
    if (poolOf(quota) !== headerPool) perModel[quota.model] = quota
  }
  return { header, perModel }
}

export function formatFreebuffRowQuota(
  quota: FreebuffSessionRateLimit,
): string {
  const used = Math.min(quota.recentCount, quota.limit)
  const count = `${used} of ${quota.limit} ${quota.countsAdmissions ? 'starts' : 'used'}`
  return quota.poolLabel ? `${quota.poolLabel}: ${count}` : count
}
