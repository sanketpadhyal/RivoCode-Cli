import { loadSkills as sdkLoadSkills } from '@rivocode/sdk'

import { getProjectRoot } from '../project-files'
import { logger } from './logger'

import type { SkillDefinition, SkillsMap } from '@rivocode/common/types/skill'

let skillsCache: SkillsMap = {}

export async function initializeSkillRegistry(): Promise<void> {
  const cwd = getProjectRoot() || process.cwd()

  try {
    skillsCache = await sdkLoadSkills({
      cwd,
      verbose: false,
      includeHomeSkills: true,
    })
  } catch (error) {
    logger.warn({ error }, 'Failed to load skills')
    skillsCache = {}
  }
}

export function getLoadedSkills(): SkillsMap {
  return skillsCache
}

export function getSkillByName(name: string): SkillDefinition | undefined {
  return skillsCache[name]
}

export function getSkillCount(): number {
  return Object.keys(skillsCache).length
}

export function getLoadedSkillsMessage(): string | null {
  const skills = Object.values(skillsCache)

  if (skills.length === 0) {
    return null
  }

  const header = `Loaded ${skills.length} skill${skills.length === 1 ? '' : 's'}`
  const skillList = skills
    .map((skill) => `  - ${skill.name}: ${skill.description.slice(0, 60)}${skill.description.length > 60 ? '...' : ''}`)
    .join('\n')

  return `${header}\n${skillList}`
}

export function __resetSkillRegistryForTests(): void {
  skillsCache = {}
}
