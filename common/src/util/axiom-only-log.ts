import { AnalyticsEvent } from '../constants/analytics-events'
import { PLACEMENT_SLOTS } from '../constants/freebuff-placements'
import {
  FIRST_PARTY_VIEW_ACK_CLIENT_FAMILIES,
  FIRST_PARTY_VIEW_ACK_MAX_DURATION_MS,
  FIRST_PARTY_VIEW_ACK_OUTCOMES,
  type FirstPartyViewAckClientFamily,
  type FirstPartyViewAckObservation,
  type FirstPartyViewAckOutcome,
} from '../ads/first-party-view-ack'

export {
  FIRST_PARTY_VIEW_ACK_CLIENT_FAMILIES,
  FIRST_PARTY_VIEW_ACK_OUTCOMES,
  type FirstPartyViewAckClientFamily,
  type FirstPartyViewAckOutcome,
}

export const CONTEXT_PRUNING_COMPLETED_EVENT =
  'context_pruning.completed' as const

export const STREAM_RECOVERY_EVENT = 'stream_recovery' as const
export const ADS_FETCH_COMPLETED_EVENT = AnalyticsEvent.ADS_FETCH_COMPLETED
export const ADS_FIRST_PARTY_DECISION_EVENT =
  AnalyticsEvent.ADS_FIRST_PARTY_DECISION
export const ADS_FIRST_PARTY_SETTLEMENT_EVENT =
  AnalyticsEvent.ADS_FIRST_PARTY_SETTLEMENT
export const ADS_FIRST_PARTY_VIEW_ACK_EVENT =
  AnalyticsEvent.ADS_FIRST_PARTY_VIEW_ACK
export const ADS_FIRST_PARTY_CLICK_RECORDED_EVENT =
  'ads.first_party_click_recorded' as const
export const ADS_FIRST_PARTY_IMPRESSION_RECORDED_EVENT =
  'ads.first_party_impression_recorded' as const
export const ADS_EXTERNAL_CONVERSION_POSTBACK_EVENT =
  'ads.external_conversion_postback' as const
export const ADS_IMPREZIA_FETCH_COMPLETED_EVENT =
  'ads.imprezia_fetch_completed' as const

type AxiomOnlyFieldType = 'string' | 'number' | 'boolean'
type AxiomOnlyFieldSchema = Record<string, AxiomOnlyFieldType>

const CONTEXT_PRUNING_FIELDS = {
  agent_run_id: 'string',
  parent_agent_run_id: 'string',
  client_session_id: 'string',
  client_request_id: 'string',
  trigger_reason: 'string',
  context_token_count: 'number',
  max_context_length: 'number',
  cache_gap_ms: 'number',
  cache_expiry_ms: 'number',
  previous_summary_entry_count: 'number',
  user_budget: 'number',
  user_entry_count: 'number',
  dropped_user_entry_count: 'number',
  assistant_tool_budget: 'number',
  assistant_tool_entry_count: 'number',
  dropped_assistant_tool_entry_count: 'number',
  summary_estimated_tokens: 'number',
  mid_turn: 'boolean',
  live_user_prompt_found: 'boolean',
  live_user_prompt_text_preserved: 'boolean',
  newest_entry_forced: 'boolean',
} as const satisfies AxiomOnlyFieldSchema

const STREAM_RECOVERY_FIELDS = {
  metric: 'string',
  source: 'string',
  model: 'string',
  agentId: 'string',
  runId: 'string',
  userInputId: 'string',
  finishReason: 'string',
  hasYieldedContent: 'boolean',
  consecutive: 'number',
} as const satisfies AxiomOnlyFieldSchema

const ADS_FETCH_COMPLETED_FIELDS = {
  outcome: 'string',
  requested_provider: 'string',
  served_provider: 'string',
  attempted_provider_chain: 'string',
  experiment_arm: 'string',
  first_party_route: 'string',
  first_party_primary_percent: 'number',
  first_party_backfill_enabled: 'boolean',
  first_party_billing_mode: 'string',
  external_settlement_enabled: 'boolean',
  first_party_primary_cohort: 'string',
  first_party_primary_cohort_percent: 'number',
  first_party_served_cohort: 'string',
  first_party_entrypoint: 'string',
  gravity_outcome: 'string',
  selection_reason: 'string',
  ad_count: 'number',
  surface: 'string',
  placement_id: 'string',
  duration_ms: 'number',
  client_ua_product: 'string',
  client_ua_version: 'string',
  yield_shadow_sampled: 'boolean',
  yield_shadow_policy_version: 'string',
  yield_shadow_scope: 'string',
  yield_shadow_exclusion_reason: 'string',
  yield_shadow_current_provider: 'string',
  yield_shadow_recommended_provider: 'string',
  yield_shadow_disagrees: 'boolean',
  yield_shadow_first_party_state: 'string',
  yield_shadow_first_party_value_bucket: 'string',
  yield_shadow_gravity_state: 'string',
  yield_shadow_gravity_value_bucket: 'string',
  yield_shadow_imprezia_state: 'string',
  yield_shadow_imprezia_value_bucket: 'string',
  yield_actual_attempt_chain: 'string',
  yield_requested_placement_count_bucket: 'string',
  yield_returned_ad_count_bucket: 'string',
  yield_live_mode: 'string',
  yield_live_activated: 'boolean',
  yield_live_reason: 'string',
  yield_live_arm: 'string',
  yield_live_policy_version: 'string',
  yield_live_estimate_version: 'string',
  yield_live_effective_treatment_bps: 'number',
  yield_live_planned_chain: 'string',
  yield_live_evidence_reservation_status: 'string',
  yield_live_evidence_status: 'string',
} as const satisfies AxiomOnlyFieldSchema

const ADS_IMPREZIA_FETCH_COMPLETED_FIELDS = {
  outcome: 'string',
  selection_reason: 'string',
  experiment_arm: 'string',
  surface: 'string',
  ad_count: 'number',
  duration_ms: 'number',
  test_mode: 'boolean',
  failure_class: 'string',
} as const satisfies AxiomOnlyFieldSchema

const ADS_IMPREZIA_FETCH_OUTCOMES = [
  'fill',
  'no_fill',
  'timeout',
  'provider_error',
  'not_configured',
  'not_eligible',
] as const
const ADS_IMPREZIA_SELECTION_REASONS = ['primary', 'fallback'] as const
const ADS_IMPREZIA_EXPERIMENT_ARMS = [
  'imprezia_forced',
  'imprezia_first',
  'control',
] as const
const ADS_IMPREZIA_BROWSER_SURFACES = [
  'freebuff_web_chat',
  'chat_assistant',
] as const
const ADS_IMPREZIA_FAILURE_CLASSES = [
  'missing_api_key',
  'missing_user_agent',
  'invalid_source_url',
  'provider_timeout',
  'provider_failure',
  'client_exception',
] as const
const ADS_IMPREZIA_MAX_DURATION_MS = 60_000

function sanitizeImpreziaFetchCompletedFields(
  record: Record<string, unknown>,
): AxiomOnlyLogEvent['data'] | null {
  const data = sanitizeAllowlistedFields(
    record,
    ADS_IMPREZIA_FETCH_COMPLETED_FIELDS,
  )
  const outcome = data.outcome
  const selectionReason = data.selection_reason
  const experimentArm = data.experiment_arm
  const surface = data.surface
  const adCount = data.ad_count
  const durationMs = data.duration_ms
  const testMode = data.test_mode
  const failureClass = data.failure_class

  if (
    !ADS_IMPREZIA_FETCH_OUTCOMES.includes(
      outcome as (typeof ADS_IMPREZIA_FETCH_OUTCOMES)[number],
    ) ||
    !ADS_IMPREZIA_SELECTION_REASONS.includes(
      selectionReason as (typeof ADS_IMPREZIA_SELECTION_REASONS)[number],
    ) ||
    !ADS_IMPREZIA_EXPERIMENT_ARMS.includes(
      experimentArm as (typeof ADS_IMPREZIA_EXPERIMENT_ARMS)[number],
    ) ||
    !ADS_IMPREZIA_BROWSER_SURFACES.includes(
      surface as (typeof ADS_IMPREZIA_BROWSER_SURFACES)[number],
    ) ||
    (adCount !== 0 && adCount !== 1) ||
    (outcome === 'fill' ? adCount !== 1 : adCount !== 0) ||
    typeof durationMs !== 'number' ||
    durationMs < 0 ||
    durationMs > ADS_IMPREZIA_MAX_DURATION_MS ||
    typeof testMode !== 'boolean' ||
    (failureClass !== undefined &&
      !ADS_IMPREZIA_FAILURE_CLASSES.includes(
        failureClass as (typeof ADS_IMPREZIA_FAILURE_CLASSES)[number],
      ))
  ) {
    return null
  }
  return data
}

const ADS_FIRST_PARTY_DECISION_FIELDS = {
  outcome: 'string',
  primary_allocation_invalid: 'boolean',
  no_fill_reason: 'string',
  selection_reason: 'string',
  ad_count: 'number',
  placement_count: 'number',
  candidate_count: 'number',
  candidate_load_ms: 'number',
  frequency_status: 'string',
  frequency_unavailable_cause: 'string',
  frequency_reservation_ms: 'number',
  duration_ms: 'number',
} as const satisfies AxiomOnlyFieldSchema

const ADS_FIRST_PARTY_SETTLEMENT_FIELDS = {
  billing_model: 'string',
  settlement_status: 'string',
  absorbed_reason: 'string',
  amount_cents: 'number',
  balance_cents: 'number',
  duration_ms: 'number',
} as const satisfies AxiomOnlyFieldSchema

const ADS_FIRST_PARTY_TRACKING_FIELDS = {
  provider: 'string',
  surface: 'string',
  placement_id: 'string',
  already_clicked: 'boolean',
  impression_recorded: 'boolean',
  pixel_count: 'number',
} as const satisfies AxiomOnlyFieldSchema

export type FirstPartyViewAckTelemetry = FirstPartyViewAckObservation

const FIRST_PARTY_VIEW_ACK_FIELDS = [
  'surface',
  'placement_id',
  'outcome',
  'attempt',
  'duration_ms',
  'client_family',
] as const

const FIRST_PARTY_VIEW_ACK_PLACEMENTS = new Map<string, string>(
  PLACEMENT_SLOTS.map((slot) => [slot.id, slot.surface]),
)

export function createFirstPartyViewAckTelemetry(
  input: unknown,
): FirstPartyViewAckTelemetry | null {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }
  const record = input as Record<string, unknown>
  const keys = Object.keys(record)
  if (
    keys.length !== FIRST_PARTY_VIEW_ACK_FIELDS.length ||
    keys.some(
      (key) =>
        !FIRST_PARTY_VIEW_ACK_FIELDS.includes(
          key as (typeof FIRST_PARTY_VIEW_ACK_FIELDS)[number],
        ),
    )
  ) {
    return null
  }

  const surface = record.surface
  const placementId = record.placement_id
  const outcome = record.outcome
  const attempt = record.attempt
  const durationMs = record.duration_ms
  const clientFamily = record.client_family
  if (
    typeof surface !== 'string' ||
    typeof placementId !== 'string' ||
    FIRST_PARTY_VIEW_ACK_PLACEMENTS.get(placementId) !== surface ||
    !FIRST_PARTY_VIEW_ACK_OUTCOMES.includes(
      outcome as FirstPartyViewAckOutcome,
    ) ||
    typeof attempt !== 'number' ||
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > 3 ||
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    durationMs > FIRST_PARTY_VIEW_ACK_MAX_DURATION_MS ||
    !FIRST_PARTY_VIEW_ACK_CLIENT_FAMILIES.includes(
      clientFamily as FirstPartyViewAckClientFamily,
    )
  ) {
    return null
  }
  return {
    surface,
    placement_id: placementId,
    outcome: outcome as FirstPartyViewAckOutcome,
    attempt: attempt as 1 | 2 | 3,
    duration_ms: durationMs,
    client_family: clientFamily as FirstPartyViewAckClientFamily,
  }
}

const ADS_EXTERNAL_CONVERSION_POSTBACK_FIELDS = {
  channel: 'string',
  outcome: 'string',
  rejection_reason: 'string',
  event_type: 'string',
  traffic_class: 'string',
  primary_allocation_cohort: 'string',
  settlement_status: 'string',
  charged_cents: 'number',
  duration_ms: 'number',
} as const satisfies AxiomOnlyFieldSchema

export type AxiomOnlyLogEvent = {
  event:
    | typeof CONTEXT_PRUNING_COMPLETED_EVENT
    | typeof STREAM_RECOVERY_EVENT
    | typeof ADS_FETCH_COMPLETED_EVENT
    | typeof ADS_FIRST_PARTY_DECISION_EVENT
    | typeof ADS_FIRST_PARTY_SETTLEMENT_EVENT
    | typeof ADS_FIRST_PARTY_VIEW_ACK_EVENT
    | typeof ADS_FIRST_PARTY_CLICK_RECORDED_EVENT
    | typeof ADS_FIRST_PARTY_IMPRESSION_RECORDED_EVENT
    | typeof ADS_EXTERNAL_CONVERSION_POSTBACK_EVENT
    | typeof ADS_IMPREZIA_FETCH_COMPLETED_EVENT
  data: Record<string, string | number | boolean>
}

function sanitizeAllowlistedFields(
  record: Record<string, unknown>,
  fields: AxiomOnlyFieldSchema,
): AxiomOnlyLogEvent['data'] {
  const sanitized: AxiomOnlyLogEvent['data'] = {}
  for (const [key, expectedType] of Object.entries(fields)) {
    const value = record[key]
    if (typeof value !== expectedType) continue
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 200)
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value
    } else if (typeof value === 'boolean') {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function getAxiomOnlyLogEvent(
  data: unknown,
  event?: string | null,
): AxiomOnlyLogEvent | null {
  const record =
    data != null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const eventName =
    typeof record.axiomEvent === 'string' ? record.axiomEvent : event

  if (eventName === CONTEXT_PRUNING_COMPLETED_EVENT) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(record, CONTEXT_PRUNING_FIELDS),
    }
  }
  if (eventName === STREAM_RECOVERY_EVENT) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(record, STREAM_RECOVERY_FIELDS),
    }
  }
  if (eventName === ADS_FETCH_COMPLETED_EVENT) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(record, ADS_FETCH_COMPLETED_FIELDS),
    }
  }
  if (eventName === ADS_IMPREZIA_FETCH_COMPLETED_EVENT) {
    const data = sanitizeImpreziaFetchCompletedFields(record)
    return data ? { event: eventName, data } : null
  }
  if (eventName === ADS_FIRST_PARTY_DECISION_EVENT) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(record, ADS_FIRST_PARTY_DECISION_FIELDS),
    }
  }
  if (eventName === ADS_FIRST_PARTY_SETTLEMENT_EVENT) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(
        record,
        ADS_FIRST_PARTY_SETTLEMENT_FIELDS,
      ),
    }
  }
  if (eventName === ADS_FIRST_PARTY_VIEW_ACK_EVENT) {
    const { axiomEvent: _axiomEvent, ...payload } = record
    const telemetry = createFirstPartyViewAckTelemetry(payload)
    return telemetry ? { event: eventName, data: { ...telemetry } } : null
  }
  if (
    eventName === ADS_FIRST_PARTY_CLICK_RECORDED_EVENT ||
    eventName === ADS_FIRST_PARTY_IMPRESSION_RECORDED_EVENT
  ) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(record, ADS_FIRST_PARTY_TRACKING_FIELDS),
    }
  }
  if (eventName === ADS_EXTERNAL_CONVERSION_POSTBACK_EVENT) {
    return {
      event: eventName,
      data: sanitizeAllowlistedFields(
        record,
        ADS_EXTERNAL_CONVERSION_POSTBACK_FIELDS,
      ),
    }
  }
  return null
}
