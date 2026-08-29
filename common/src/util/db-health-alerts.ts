
export const WRAPAROUND_BUDGET = 2 ** 31
export const DEFAULT_WRAPAROUND_PCT = 0.5
export const DEFAULT_BACKEND_XMIN_XID = 1_000_000
export const DEFAULT_STUCK_BUILD_MINUTES = 30
export const DEFAULT_BUSY_BACKENDS = 4
export const DEFAULT_SAMPLE_SECONDS = 60

export interface WraparoundRow {
  xid_age: string | number
}
export interface BackendXminRow {
  oldest_xmin_age: string | number | null
  snapshot_holders: string | number
  visible_backends: string | number
  opaque_backends: string | number
}
export interface InvalidIndexRow {
  schema: string
  table_name: string
  index_name: string
  indisready: boolean
  build_phase: string | null
  build_seconds: string | number | null
}
export interface StatementSnapshotRow {
  queryid: string | null
  calls: string | number
  total_exec_time: string | number
  query: string
}
export interface BusyBackendRank {
  busy: number
  calls: number
  meanMs: number
  query: string
  queryid: string | null
}

export function buildWraparoundSql(): string {
  return `
    SELECT age(datfrozenxid)::bigint AS xid_age
    FROM pg_database
    WHERE datname = current_database()
  `
}

export function buildBackendXminSql(): string {
  return `
    SELECT
      max(age(backend_xmin))::bigint                              AS oldest_xmin_age,
      count(*) FILTER (WHERE backend_xmin IS NOT NULL)::bigint    AS snapshot_holders,
      count(*) FILTER (WHERE backend_type IS NOT NULL)::bigint    AS visible_backends,
      count(*) FILTER (WHERE backend_type IS NULL)::bigint        AS opaque_backends
    FROM pg_stat_activity
  `
}

export function buildInvalidIndexesSql(): string {
  return `
    SELECT
      n.nspname                                          AS schema,
      c.relname                                          AS table_name,
      i.relname                                          AS index_name,
      ix.indisready,
      p.phase                                            AS build_phase,
      extract(epoch FROM (now() - a.query_start))        AS build_seconds
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_progress_create_index p ON p.index_relid = ix.indexrelid
    LEFT JOIN pg_stat_activity a ON a.pid = p.pid
    WHERE ix.indisvalid = false
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY n.nspname, c.relname, i.relname
  `
}

export function buildStatementSnapshotSql(): string {
  return `
    SELECT
      s.queryid::text                           AS queryid,
      s.calls::bigint                           AS calls,
      s.total_exec_time::double precision       AS total_exec_time,
      left(regexp_replace(s.query, '\\s+', ' ', 'g'), 200) AS query
    FROM pg_stat_statements s
    JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
    WHERE s.queryid IS NOT NULL
    UNION ALL
    SELECT
      'opaque:' || s.userid::text,
      sum(s.calls)::bigint,
      sum(s.total_exec_time)::double precision,
      '<' || count(*)::text || ' statement(s) of role ' ||
        coalesce(
          (SELECT r.rolname FROM pg_roles r WHERE r.oid = s.userid),
          s.userid::text
        ) ||
        ', not readable as ' || current_user || '>'
    FROM pg_stat_statements s
    JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
    WHERE s.queryid IS NULL
    GROUP BY s.userid
  `
}

export function isOpaqueStatementBucket(queryid: string | null): boolean {
  return typeof queryid === 'string' && queryid.startsWith('opaque:')
}

export interface StatCoverageRow {
  role: string
  has_read_all_stats: boolean
  pgss_rows: string | number
  pgss_with_text: string | number
  activity_rows: string | number
  activity_visible: string | number
}

export interface StatCoverage {
  role: string
  activityBlind: boolean
  statementsBlind: boolean
  summary: string
}

export function buildActivityCoverageSql(): string {
  return `
    SELECT
      current_user::text                                                AS role,
      pg_has_role(current_user, 'pg_read_all_stats', 'USAGE')            AS has_read_all_stats,
      (SELECT count(*) FROM pg_stat_activity)::bigint                    AS activity_rows,
      (SELECT count(*) FROM pg_stat_activity WHERE backend_type IS NOT NULL)::bigint
                                                                        AS activity_visible
  `
}

export function buildStatementCoverageSql(): string {
  return `
    SELECT
      count(*)::bigint                                                   AS pgss_rows,
      count(*) FILTER (WHERE s.query <> '<insufficient privilege>')::bigint
                                                                        AS pgss_with_text
    FROM pg_stat_statements s
    JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
  `
}

export function evaluateStatCoverage(row: StatCoverageRow): StatCoverage {
  const statementRows = toNumber(row.pgss_rows) ?? 0
  const statementsWithText = toNumber(row.pgss_with_text) ?? 0
  const activityRows = toNumber(row.activity_rows) ?? 0
  const activityVisible = toNumber(row.activity_visible) ?? 0
  const statementsBlind = statementRows === 0
  const activityBlind = activityVisible === 0
  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0
  const summary = row.has_read_all_stats
    ? `role ${row.role} has pg_read_all_stats: full fleet visibility`
    : `role ${row.role} lacks pg_read_all_stats — ${statementsWithText}/${statementRows} ` +
      `statement identities readable (${pct(statementsWithText, statementRows)}%; the rest ` +
      `are ranked as per-role aggregate buckets), ${activityVisible}/${activityRows} ` +
      `backends readable (${pct(activityVisible, activityRows)}%). ` +
      `The grant needs Render support; it is not grantable by manicode_user.`
  return { role: row.role, activityBlind, statementsBlind, summary }
}

export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function evaluateWraparound(
  xidAge: number | null,
  pct = DEFAULT_WRAPAROUND_PCT,
): boolean {
  return xidAge !== null && xidAge >= WRAPAROUND_BUDGET * pct
}

export interface BackendXminVerdict {
  breach: boolean
  text: string
}

export function evaluateBackendXmin(
  row: BackendXminRow | null,
  threshold = DEFAULT_BACKEND_XMIN_XID,
): BackendXminVerdict {
  const oldestXminAge = toNumber(row?.oldest_xmin_age ?? null)
  const snapshotHolders = toNumber(row?.snapshot_holders ?? null) ?? 0
  const visibleBackends = toNumber(row?.visible_backends ?? null) ?? 0
  const opaqueBackends = toNumber(row?.opaque_backends ?? null) ?? 0
  const breach = oldestXminAge !== null && oldestXminAge >= threshold
  const blindSuffix =
    opaqueBackends > 0
      ? ` (${opaqueBackends} backend(s) opaque to this role and not covered)`
      : ''
  const text = breach
    ? `oldest held snapshot is ${oldestXminAge} transactions behind ` +
      `(threshold ${threshold}); it blocks vacuum and CREATE INDEX CONCURRENTLY${blindSuffix}`
    : `oldest held snapshot ${oldestXminAge ?? 0} xacts behind across ` +
      `${snapshotHolders} holder(s) of ${visibleBackends} readable backend(s)${blindSuffix}`
  return { breach, text }
}

export function evaluateInvalidIndexes(
  rows: InvalidIndexRow[],
  stuckMinutes = DEFAULT_STUCK_BUILD_MINUTES,
): { breach: boolean; offenders: string[] } {
  const offenders: string[] = []
  for (const row of rows) {
    const building = row.build_phase !== null
    const buildSeconds = toNumber(row.build_seconds)
    const stuck =
      building && buildSeconds !== null && buildSeconds >= stuckMinutes * 60
    if (!building || stuck) {
      const where = building
        ? `building ${Math.round((buildSeconds ?? 0) / 60)}m`
        : 'not building'
      offenders.push(
        `${row.schema}.${row.table_name}.${row.index_name} (${where}, indisready=${row.indisready})`,
      )
    }
  }
  return { breach: offenders.length > 0, offenders }
}

export function computeBusyBackendRank(
  before: StatementSnapshotRow[],
  after: StatementSnapshotRow[],
  wallSeconds: number,
): BusyBackendRank[] {
  if (wallSeconds <= 0) return []
  const beforeById = new Map(before.map((r) => [r.queryid, r]))
  const out: BusyBackendRank[] = []
  for (const nb of after) {
    const na = beforeById.get(nb.queryid)
    if (na === undefined && isOpaqueStatementBucket(nb.queryid)) continue
    const dc = Number(nb.calls) - Number(na?.calls ?? 0)
    const dt = Number(nb.total_exec_time) - Number(na?.total_exec_time ?? 0)
    if (dc <= 0 && dt <= 0) continue
    out.push({
      busy: dt / 1000 / wallSeconds,
      calls: dc,
      meanMs: dc > 0 ? dt / dc : 0,
      query: nb.query,
      queryid: nb.queryid,
    })
  }
  return out.sort((a, b) => b.busy - a.busy)
}

export function evaluateBusyBackendRank(
  rank: BusyBackendRank[],
  threshold = DEFAULT_BUSY_BACKENDS,
): { breach: boolean; top: BusyBackendRank | null } {
  const top = rank[0] ?? null
  return { breach: top !== null && top.busy >= threshold, top }
}
