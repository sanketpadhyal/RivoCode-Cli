import type { SkillDefinition, SkillsMap } from '../types/skill'

export function isSkillModelInvocable(skill: SkillDefinition): boolean {
  return skill.disableModelInvocation !== true
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatAvailableSkillsXml(skills: SkillsMap): string {
  const skillEntries = Object.values(skills).filter(isSkillModelInvocable)
  if (skillEntries.length === 0) {
    return ''
  }

  const skillsXml = skillEntries
    .map(
      (skill) =>
        `  <skill>\n    <name>${skill.name}</name>\n    <description>${escapeXml(skill.description)}</description>\n  </skill>`,
    )
    .join('\n')

  return `<available_skills>\n${skillsXml}\n</available_skills>`
}
