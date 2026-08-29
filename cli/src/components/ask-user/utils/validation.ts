
export interface ValidationResult {
  isValid: boolean
  error?: string
}

export interface QuestionValidation {
  maxLength?: number
  minLength?: number
  pattern?: string
  patternError?: string
}

export function validateOtherText(
  text: string,
  validation?: QuestionValidation,
  maxLength: number = 500
): ValidationResult {
  if (text.length > maxLength) {
    return {
      isValid: false,
      error: `Max ${maxLength} characters`,
    }
  }

  if (validation) {
    if (validation.maxLength && text.length > validation.maxLength) {
      return {
        isValid: false,
        error: `Max ${validation.maxLength} characters`,
      }
    }

    if (validation.minLength && text.length < validation.minLength) {
      return {
        isValid: false,
        error: `Min ${validation.minLength} characters`,
      }
    }

    if (validation.pattern && text.length > 0) {
      const regex = new RegExp(validation.pattern)
      if (!regex.test(text)) {
        return {
          isValid: false,
          error: validation.patternError || 'Invalid format',
        }
      }
    }
  }

  return { isValid: true }
}

export function isTextEmpty(text: string | undefined): boolean {
  return !text || !text.trim()
}

export function sanitizeTextInput(text: string): string {
  return text
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
