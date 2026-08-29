
export type OnboardingQuestionId =
  | 'referral_source'
  | 'role'
  | 'proficiency'
  | 'intended_use'
  | 'subscriptions'

export type OnboardingOption = {
  id: string
  label: string
  exclusive?: boolean
}

export type OnboardingQuestion = {
  id: OnboardingQuestionId
  prompt: string
  options: OnboardingOption[]
  multi: boolean
  kind?: 'choice' | 'scale'
}

export const OTHER_OPTION_ID = 'other'

export const FREEBUFF_ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] = [
  {
    id: 'referral_source',
    prompt: 'Where did you hear about Freebuff?',
    options: [
      { id: 'tiktok', label: 'Instagram / TikTok' },
      { id: 'youtube', label: 'YouTube' },
      { id: 'x_twitter', label: 'X / Twitter' },
      { id: 'search', label: 'Google / AI search' },
      { id: 'friend', label: 'A friend' },
      { id: 'reddit', label: 'Reddit' },
      { id: 'github', label: 'GitHub' },
      { id: OTHER_OPTION_ID, label: 'Somewhere else' },
    ],
    multi: false,
  },
  {
    id: 'role',
    prompt: 'What best describes you?',
    options: [
      { id: 'professional_dev', label: 'Developer' },
      { id: 'founder', label: 'Founder' },
      { id: 'student', label: 'Student' },
      { id: 'hobbyist', label: 'Hobbyist' },
      { id: 'pm', label: 'Designer or PM' },
      { id: 'non_technical', label: 'Non-technical' },
      { id: OTHER_OPTION_ID, label: 'Something else' },
    ],
    multi: false,
  },
  {
    id: 'proficiency',
    prompt: 'How much do you code?',
    options: [
      { id: 'none', label: 'Not at all' },
      { id: 'beginner', label: 'Beginner' },
      { id: 'intermediate', label: 'Intermediate' },
      { id: 'advanced', label: 'Advanced' },
      { id: 'expert', label: 'Expert' },
    ],
    multi: false,
    kind: 'scale',
  },
  {
    id: 'intended_use',
    prompt: 'What will you build with Freebuff?',
    options: [
      { id: 'website', label: 'Websites and apps' },
      { id: 'work', label: 'Work projects' },
      { id: 'side_projects', label: 'Side projects' },
      { id: 'learning', label: 'Learning to code' },
      { id: 'automation', label: 'Scripts and automation' },
      { id: OTHER_OPTION_ID, label: 'Something else' },
    ],
    multi: true,
  },
  {
    id: 'subscriptions',
    prompt: 'Current subscriptions that you’ve had, cancelled or will cancel',
    options: [
      { id: 'none', label: 'None', exclusive: true },
      { id: 'claude_code', label: 'Claude Code' },
      { id: 'cursor', label: 'Cursor' },
      { id: 'opencode', label: 'opencode' },
      { id: 'copilot', label: 'GitHub Copilot' },
      { id: 'codex', label: 'Codex' },
      { id: 'gemini', label: 'Gemini' },
      { id: 'app_builder', label: 'Lovable / Replit' },
      { id: OTHER_OPTION_ID, label: 'Something else' },
    ],
    multi: true,
  },
] as const

export const ONBOARDING_LEGACY_OPTION_IDS: Partial<
  Record<OnboardingQuestionId, Record<string, string>>
> = {
  referral_source: { discord: OTHER_OPTION_ID, blog_news: OTHER_OPTION_ID },
  role: { data_ml: 'professional_dev', designer: 'pm' },
  intended_use: { prototyping: 'website', debugging: OTHER_OPTION_ID },
}

export const ONBOARDING_OTHER_TEXT_RULES: Partial<
  Record<OnboardingQuestionId, { optionId: string; pattern: RegExp }[]>
> = {
  referral_source: [
    { optionId: 'tiktok', pattern: /insta|\btiktok\b|\btik tok\b|\big\b/i },
    {
      optionId: 'search',
      pattern:
        /\bai\b|chat\s?gpt|\bgpt\b|claude|gemini|perplexity|copilot|grok|deepseek/i,
    },
  ],
}

export function classifyOnboardingOtherText(
  questionId: OnboardingQuestionId,
  text: string,
): string | null {
  const rules = ONBOARDING_OTHER_TEXT_RULES[questionId]
  if (!rules) return null
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.optionId
  }
  return null
}

export type OnboardingAnswer = {
  questionId: OnboardingQuestionId
  optionIds: string[]
  otherText?: string
}

export type OnboardingSubmission = {
  answers: OnboardingAnswer[]
}

export const ONBOARDING_OTHER_TEXT_MAX = 200

export type OnboardingValidationError = {
  questionId: OnboardingQuestionId | null
  message: string
}

export function validateOnboardingSubmission(
  submission: OnboardingSubmission,
  questions: readonly OnboardingQuestion[] = FREEBUFF_ONBOARDING_QUESTIONS,
): { ok: true; answers: OnboardingAnswer[] } | { ok: false; errors: OnboardingValidationError[] } {
  const errors: OnboardingValidationError[] = []
  const cleaned: OnboardingAnswer[] = []

  for (const question of questions) {
    const answer = submission.answers.find((a) => a.questionId === question.id)
    const optionIds = answer?.optionIds ?? []

    if (optionIds.length === 0) continue
    if (!question.multi && optionIds.length > 1) {
      errors.push({ questionId: question.id, message: 'Choose one option.' })
      continue
    }

    const valid = new Set(question.options.map((o) => o.id))
    const unknown = optionIds.filter((id) => !valid.has(id))
    if (unknown.length > 0) {
      errors.push({ questionId: question.id, message: 'Unrecognised option.' })
      continue
    }

    const exclusive = question.options.filter((o) => o.exclusive).map((o) => o.id)
    if (optionIds.length > 1 && optionIds.some((id) => exclusive.includes(id))) {
      errors.push({
        questionId: question.id,
        message: 'That answer cannot be combined with the others.',
      })
      continue
    }

    const wantsOther = optionIds.includes(OTHER_OPTION_ID)
    const otherText = answer?.otherText?.trim()
    if (wantsOther && !otherText) {
      errors.push({
        questionId: question.id,
        message: 'Tell us a little more.',
      })
      continue
    }

    cleaned.push({
      questionId: question.id,
      optionIds,
      ...(wantsOther && otherText
        ? { otherText: otherText.slice(0, ONBOARDING_OTHER_TEXT_MAX) }
        : {}),
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  if (cleaned.length === 0) {
    return {
      ok: false,
      errors: [{ questionId: null, message: 'Choose at least one answer.' }],
    }
  }
  return { ok: true, answers: cleaned }
}

export function isOnboardingComplete(
  answers: readonly OnboardingAnswer[] | null | undefined,
  questions: readonly OnboardingQuestion[] = FREEBUFF_ONBOARDING_QUESTIONS,
): boolean {
  if (!answers || answers.length === 0) return false
  const answered = new Set(
    answers.filter((a) => a.optionIds.length > 0).map((a) => a.questionId),
  )
  return questions.every((q) => answered.has(q.id))
}
