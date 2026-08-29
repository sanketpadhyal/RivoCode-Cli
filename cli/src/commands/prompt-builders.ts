
const PLAN_BASE_PROMPT =
  'Gather all the relevant context and then think carefully about how to implement the following:'
const REVIEW_BASE_PROMPT =
  'Please gather all relevant context and then carefully review:'

export function buildPlanPrompt(input: string): string {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return PLAN_BASE_PROMPT
  }
  return `${PLAN_BASE_PROMPT}\n\n${trimmedInput}`
}

export const INTERVIEW_BASE_PROMPT = 'Interview me to better understand my request and then create a spec file. First, gather any relevant context (read files, do research, etc.). Then, use several rounds of the ask_user tool to ask non-obvious clarifying questions — things you cannot easily infer from the codebase or my initial message. Ask about edge cases, preferences, constraints, and design decisions. All questions should be directed through the ask_user tool -- not written out as text. Keep coming up with new questions that get at unique aspects of the request. Aim for at least **3 rounds** with multiple questions each round. When satisfied, write a [INSERT_REQUEST_SHORT_NAME]-spec.md file with all the information you have gathered about the request. Aim for as much detail as possible. You should NOT make any code changes yet. Stop after creating the spec file. End by using the suggest_followups tool with ways to flesh out the spec file. Here is my request:'

export function buildInterviewPrompt(input: string): string {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return INTERVIEW_BASE_PROMPT
  }
  return `${INTERVIEW_BASE_PROMPT}\n\n${trimmedInput}`
}

type ReviewScope = 'conversation' | 'uncommitted' | 'branch' | 'custom'

function getReviewScopeText(scope: ReviewScope): string {
  switch (scope) {
    case 'conversation':
      return 'all changes made in this conversation'
    case 'uncommitted':
      return 'uncommitted changes'
    case 'branch':
      return 'this branch compared to main'
    case 'custom':
      return ''
  }
}

export function buildReviewPrompt(
  scope: ReviewScope,
  customInput?: string,
): string {
  const scopeText = getReviewScopeText(scope)

  if (scope === 'custom' && customInput?.trim()) {
    return `${REVIEW_BASE_PROMPT} ${customInput.trim()}`
  }

  if (scopeText) {
    return `${REVIEW_BASE_PROMPT} ${scopeText}`
  }

  return REVIEW_BASE_PROMPT
}

export function buildReviewPromptFromArgs(input: string): string {
  const trimmedInput = input.trim()
  return `${REVIEW_BASE_PROMPT} ${trimmedInput}`
}
