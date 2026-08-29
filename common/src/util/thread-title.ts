
export const THREAD_TITLE_INPUT_MAX_CHARS = 2000

export const THREAD_TITLE_MAX_CHARS = 60

export const THREAD_TITLE_SYSTEM_PROMPT =
  'You generate short, clean titles for chat conversations. You output only the title.'

export const THREAD_TITLE_INSTRUCTIONS_PROMPT = `Write a concise title (3-6 words) summarizing the topic of the user's message.

Rules:
- Plain text only: no surrounding quotes, no trailing punctuation, no preamble or explanation.
- Write the title in the same language as the user's message.
- Capitalize it like a headline (when the language uses capitalization).
- Describe what the message is *about*, in general terms. Never copy sensitive personal data into the title — names, emails, phone numbers, addresses, API keys, passwords, or other secrets. Summarize the topic, not the private details.
- If the message is too vague to summarize, use its wording as the title instead of a generic placeholder.

Output only the title.`

export function sanitizeThreadTitle(raw: string): string | null {
  let title = raw.replace(/\s+/g, ' ').trim()
  title = title.replace(/^title:\s*/i, '').trim()
  title = title.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
  title = title.replace(/[.!?,;:]+$/g, '').trim()
  if (!title) return null
  return title.slice(0, THREAD_TITLE_MAX_CHARS)
}
