
export const SKILLS_DIR_NAME = 'skills'

export const SKILL_FILE_NAME = 'SKILL.md'

export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const SKILL_NAME_MAX_LENGTH = 64

export const SKILL_DESCRIPTION_MAX_LENGTH = 1024

export function isValidSkillName(name: string): boolean {
  if (!name || name.length > SKILL_NAME_MAX_LENGTH) {
    return false
  }
  return SKILL_NAME_REGEX.test(name)
}

export function isValidSkillDescription(description: string): boolean {
  return (
    typeof description === 'string' &&
    description.length >= 1 &&
    description.length <= SKILL_DESCRIPTION_MAX_LENGTH
  )
}
