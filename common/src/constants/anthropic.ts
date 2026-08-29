
const OPENROUTER_TO_ANTHROPIC_MODEL_MAP: Record<string, string> = {
  'anthropic/claude-3.5-haiku-20241022': 'claude-3-5-haiku-20241022',
  'anthropic/claude-3.5-haiku': 'claude-3-5-haiku-20241022',
  'anthropic/claude-3-5-haiku': 'claude-3-5-haiku-20241022',
  'anthropic/claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
  'anthropic/claude-3-haiku': 'claude-3-haiku-20240307',

  'anthropic/claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'anthropic/claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'anthropic/claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
  'anthropic/claude-3-5-sonnet-20240620': 'claude-3-5-sonnet-20240620',
  'anthropic/claude-3-sonnet': 'claude-3-sonnet-20240229',

  'anthropic/claude-3-opus': 'claude-3-opus-20240229',
  'anthropic/claude-3-opus-20240229': 'claude-3-opus-20240229',

  'anthropic/claude-haiku-4.5': 'claude-haiku-4-5-20251001',
  'anthropic/claude-haiku-4': 'claude-haiku-4-20250514',

  'anthropic/claude-sonnet-4.6': 'claude-sonnet-4-6',
  'anthropic/claude-sonnet-4.5': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-4-sonnet-20250522': 'claude-sonnet-4-20250514',
  'anthropic/claude-4-sonnet': 'claude-sonnet-4-20250514',

  'anthropic/claude-fable-5': 'claude-fable-5',
  'anthropic/claude-opus-5': 'claude-opus-5',

  'anthropic/claude-opus-4.8': 'claude-opus-4-8',
  'anthropic/claude-opus-4.7': 'claude-opus-4-7',
  'anthropic/claude-opus-4.6': 'claude-opus-4-6',
  'anthropic/claude-opus-4.5': 'claude-opus-4-5-20251101',
  'anthropic/claude-opus-4.1': 'claude-opus-4-1-20250805',
  'anthropic/claude-opus-4': 'claude-opus-4-1-20250805',
}

export function isClaudeModel(model: string): boolean {
  return model.startsWith('anthropic/') || model.startsWith('claude-')
}

export function toAnthropicModelId(openrouterModel: string): string {
  if (!openrouterModel.includes('/')) {
    return openrouterModel
  }

  if (!openrouterModel.startsWith('anthropic/')) {
    throw new Error(
      `Cannot convert non-Anthropic model to Anthropic model ID: ${openrouterModel}`,
    )
  }

  return (
    OPENROUTER_TO_ANTHROPIC_MODEL_MAP[openrouterModel] ??
    openrouterModel.replace('anthropic/', '')
  )
}
