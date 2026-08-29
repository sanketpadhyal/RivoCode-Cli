
import type {
  FreebuffIpPrivacySignal,
  FreebuffLimitedModeReason,
} from '../types/freebuff-session'

export const FREEBUFF_PAUSED_MODEL_NOTICE =
  "DeepSeek V4 Flash 07/31 is paused here after a steep price increase — pausing it is what keeps these sessions free for everyone. We're working to bring it back."

export const FREEBUFF_TIER_CHANGE_NOTICE =
  'Every model runs on your normal daily sessions — no per-model caps; your shared premium allowance still charges partial time, rounded up to a tenth. MiMo, DeepSeek V4 Flash and GLM 5.3 Flash are unmetered. —❤️ Freebuff Team'

const PRIVACY_SIGNAL_LABELS: Partial<Record<FreebuffIpPrivacySignal, string>> =
  {
    anonymous: 'anonymized network',
    proxy: 'proxy',
    relay: 'relay',
    res_proxy: 'residential proxy',
    tor: 'Tor',
    vpn: 'VPN',
    hosting: 'hosting network',
    service: 'privacy service',
  }

export function formatFreebuffPrivacySignalList(
  signals: readonly FreebuffIpPrivacySignal[] | null | undefined,
): string {
  const labels = Array.from(
    new Set(
      signals
        ?.map((signal) => PRIVACY_SIGNAL_LABELS[signal])
        .filter((label): label is string => Boolean(label)) ?? [],
    ),
  )

  if (labels.length === 0) {
    return 'VPN, Tor, proxy, relay, or anonymized network'
  }
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

export function formatFreebuffCountryName(countryCode: string): string {
  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ??
      countryCode
    )
  } catch {
    return countryCode
  }
}

export function getFreebuffModelAvailabilityNotice(
  reason: FreebuffLimitedModeReason | null | undefined,
): string {
  const generic = "Some models aren't available on this connection"
  if (!reason) return generic

  const countryCode =
    reason.countryCode && reason.countryCode !== 'UNKNOWN'
      ? reason.countryCode
      : null

  switch (reason.countryBlockReason) {
    case 'anonymous_network':
      return `Using a ${formatFreebuffPrivacySignalList(
        reason.ipPrivacySignals,
      )}? More models are available on a direct connection`
    case 'country_not_allowed':
      return `Some models aren't available in ${
        countryCode ? formatFreebuffCountryName(countryCode) : 'your region'
      } yet`
    case 'anonymized_or_unknown_country':
    case 'missing_client_ip':
    case 'unresolved_client_ip':
      return "We couldn't confirm your region, so we're showing models available everywhere"
    case 'ip_privacy_lookup_failed':
      return "We couldn't finish a network check, so we're showing models available everywhere"
    default:
      return generic
  }
}
