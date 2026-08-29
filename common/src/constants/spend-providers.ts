
export const SPEND_PROVIDER_IDS = [
  'canopywave',
  'cheaper-inference',
  'crof',
  'deepseek',
  'fireworks',
  'infron',
  'luminal',
  'fusioncode',
  'merge',
  'meta',
  'minimax',
  'moonshot',
  'novita',
  'openai',
  'opencode-zen',
  'openrouter',
  'runinfra',
  'siliconflow',
  'xiaomi',
] as const

export type SpendProviderId = (typeof SPEND_PROVIDER_IDS)[number]

export const UNATTRIBUTED_PROVIDER = '(unattributed)'

const PROVIDER_ID_SET: ReadonlySet<string> = new Set(SPEND_PROVIDER_IDS)

export function isSpendProviderId(v: unknown): v is SpendProviderId {
  return typeof v === 'string' && PROVIDER_ID_SET.has(v)
}

export function toSpendProvider(
  v: string | null | undefined,
): SpendProviderId | typeof UNATTRIBUTED_PROVIDER {
  return isSpendProviderId(v) ? v : UNATTRIBUTED_PROVIDER
}

const PROVIDER_LABELS: Partial<Record<SpendProviderId, string>> = {
  'cheaper-inference': 'Cheaper Inference',
  merge: 'Merge Gateway',
  crof: 'CrofAI',
  deepseek: 'DeepSeek',
  luminal: 'Luminal',
  openai: 'OpenAI',
  'opencode-zen': 'OpenCode Zen',
  openrouter: 'OpenRouter',
  runinfra: 'RunInfra',
  siliconflow: 'SiliconFlow',
  novita: 'Novita',
  minimax: 'MiniMax',
  canopywave: 'CanopyWave',
  xiaomi: 'Xiaomi',
}

export function spendProviderLabel(id: string): string {
  if (id === UNATTRIBUTED_PROVIDER) return 'Unattributed'
  return isSpendProviderId(id) ? (PROVIDER_LABELS[id] ?? id) : id
}

export const UNKNOWN_VENDOR = '(unknown)'

export function modelVendor(model: string): string {
  const slash = model.indexOf('/')
  if (slash <= 0) return UNKNOWN_VENDOR
  return model.slice(0, slash)
}
