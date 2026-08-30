// Ads completely disabled — RivoCode is a clean local-first CLI with zero ads.

export type AdProvider = 'gravity' | 'carbon' | 'zeroclick' | 'first_party'
export type AdSurface = 'waiting_room' | 'cli_chat'

export type AdResponse = {
  adText: string
  title: string
  cta: string
  url: string
  favicon: string
  clickUrl: string
  impUrl: string
  placementId?: string
  provider?: AdProvider
  impressionIds?: string[]
  credits?: number
}

export type GravityAdState = {
  ads: AdResponse[]
  responseAds: Record<string, AdResponse>
  requestResponseAds: (messageId: string) => void
  recordClick: (ad: AdResponse) => void
  recordImpression: (ad: AdResponse) => void
  currentAd: AdResponse | null
  pendingAd: AdResponse | null
  showAd: boolean
  isLoadingAd: boolean
  error: string | null
  onAdImpression: () => void
  onAdDismiss: () => void
}

export function isAnswerMessage(_m: unknown): boolean {
  return false
}

export function isInlineAdEligibleAnswer(_m: unknown): boolean {
  return false
}

export function claimAdImpression(
  _ad: AdResponse | null,
  _messageId: string,
): AdResponse | null {
  return null
}

export function dispatchFirstPartyViewAcknowledgement(_params: unknown): void {}

export const useGravityAd = (_options?: unknown): GravityAdState => {
  return {
    ads: [],
    responseAds: {},
    requestResponseAds: () => {},
    recordClick: () => {},
    recordImpression: () => {},
    currentAd: null,
    pendingAd: null,
    showAd: false,
    isLoadingAd: false,
    error: null,
    onAdImpression: () => {},
    onAdDismiss: () => {},
  }
}
