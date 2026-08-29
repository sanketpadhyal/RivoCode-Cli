export const PROVIDER_ROUTE_IDS = [
  'fireworks/deployment',
  'fireworks/serverless',
  'minimax/official',
  'xiaomi/official',
  'openrouter/novita/fp8',
  'mimo/openrouter',
  'infron/makora',
  'glm/crof',
  'glm/infron',
  'glm-5-3-flash/crof',
  'glm-5-3-flash/fallback',
  'deepseek/openrouter',
  'deepseek/crof',
  'deepseek/cheaper-inference',
  'deepseek/luminal',
  'deepseek/fusioncode',
  'deepseek/runinfra',
  'deepseek/official',
  'luna/fallback',
  'luna/primary',
] as const

export type ProviderRouteId = (typeof PROVIDER_ROUTE_IDS)[number]

export const DEEPSEEK_FUSIONCODE_PROVIDER_ROUTE =
  'deepseek/fusioncode' satisfies ProviderRouteId

export const LUNA_FALLBACK_PROVIDER_ROUTE =
  'luna/fallback' satisfies ProviderRouteId

export const LUNA_PRIMARY_PROVIDER_ROUTE =
  'luna/primary' satisfies ProviderRouteId

export const LUNA_FALLBACK_UPSTREAM = 'cheaper-inference' as const

export const FIREWORKS_DEPLOYMENT_PROVIDER_ROUTE =
  'fireworks/deployment' satisfies ProviderRouteId
export const FIREWORKS_SERVERLESS_PROVIDER_ROUTE =
  'fireworks/serverless' satisfies ProviderRouteId
export const MINIMAX_OFFICIAL_PROVIDER_ROUTE =
  'minimax/official' satisfies ProviderRouteId
export const MIMO_OPENROUTER_PROVIDER_ROUTE =
  'mimo/openrouter' satisfies ProviderRouteId
export const MIMO_XIAOMI_PROVIDER_ROUTE =
  'xiaomi/official' satisfies ProviderRouteId
export const MIMO_OPENROUTER_UPSTREAM_ORDER = [
  'xiaomi/fp8',
  'novita/fp8',
] as const

export function mimoOpenRouterProvider(): Record<string, unknown> {
  return {
    order: [...MIMO_OPENROUTER_UPSTREAM_ORDER],
    allow_fallbacks: false,
  }
}
export const MIMO_NOVITA_PROVIDER_ROUTE =
  'openrouter/novita/fp8' satisfies ProviderRouteId
export const GLM_CROF_PROVIDER_ROUTE = 'glm/crof' satisfies ProviderRouteId
export const GLM_INFRON_PROVIDER_ROUTE = 'glm/infron' satisfies ProviderRouteId
export const GLM_V53_FLASH_OPENROUTER_UPSTREAM_ORDER = [
  'novita/fp8',
  'z-ai/fp8',
  'gmicloud/fp8',
] as const

export const GLM_V53_FLASH_CROF_PROVIDER_ROUTE =
  'glm-5-3-flash/crof' satisfies ProviderRouteId
export const GLM_V53_FLASH_FALLBACK_PROVIDER_ROUTE =
  'glm-5-3-flash/fallback' satisfies ProviderRouteId
export const DEEPSEEK_CROF_PROVIDER_ROUTE =
  'deepseek/crof' satisfies ProviderRouteId
export const DEEPSEEK_LUMINAL_PROVIDER_ROUTE =
  'deepseek/luminal' satisfies ProviderRouteId
export const DEEPSEEK_OFFICIAL_PROVIDER_ROUTE =
  'deepseek/official' satisfies ProviderRouteId
export const DEEPSEEK_CHEAPER_INFERENCE_PROVIDER_ROUTE =
  'deepseek/cheaper-inference' satisfies ProviderRouteId
export const DEEPSEEK_INFRON_MAKORA_PROVIDER_ROUTE =
  'infron/makora' satisfies ProviderRouteId
export const DEEPSEEK_RUNINFRA_PROVIDER_ROUTE =
  'deepseek/runinfra' satisfies ProviderRouteId
export const DEEPSEEK_OPENROUTER_PROVIDER_ROUTE =
  'deepseek/openrouter' satisfies ProviderRouteId
export const DEEPSEEK_OPENROUTER_UPSTREAM_ORDER = [
  'streamlake/fp8',
  'baidu/fp8',
  'gmicloud/fp8',
] as const

export const DEEPSEEK_OPENROUTER_MAX_TOKENS = 384_000

export function deepseekOpenRouterProvider(): Record<string, unknown> {
  return {
    order: [...DEEPSEEK_OPENROUTER_UPSTREAM_ORDER],
    allow_fallbacks: false,
  }
}
