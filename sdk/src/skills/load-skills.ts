import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  SKILLS_DIR_NAME,
  SKILL_FILE_NAME,
  isValidSkillName,
} from '@codebuff/common/constants/skills'
import {
  type SkillDefinition,
  type SkillsMap,
} from '@codebuff/common/types/skill'
import { parseSkillFileContent } from '@codebuff/common/util/parse-skill'

export { formatAvailableSkillsXml } from '@codebuff/common/util/skills'

export { parseSkillFileContent } from '@codebuff/common/util/parse-skill'

function loadSkillFromFile(
  skillDir: string,
  skillFilePath: string,
  verbose: boolean,
): SkillDefinition | null {
  let content: string
  try {
    content = fs.readFileSync(skillFilePath, 'utf8')
  } catch {
    if (verbose) console.error(`Failed to read skill file: ${skillFilePath}`)
    return null
  }
  return parseSkillFileContent(content, {
    directoryName: path.basename(skillDir),
    filePath: skillFilePath,
    verbose,
  })
}

function discoverSkillsFromDirectory(
  skillsDir: string,
  verbose: boolean,
): SkillsMap {
  const skills: SkillsMap = {}

  let entries: string[]
  try {
    entries = fs.readdirSync(skillsDir)
  } catch {
    return skills
  }

  for (const entry of entries) {
    const skillDir = path.join(skillsDir, entry)

    try {
      const stat = fs.statSync(skillDir)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    if (!isValidSkillName(entry)) {
      if (verbose) {
        console.warn(`Skipping invalid skill directory name: ${entry}`)
      }
      continue
    }

    const skillFilePath = path.join(skillDir, SKILL_FILE_NAME)

    try {
      fs.statSync(skillFilePath)
    } catch {
      continue
    }

    const skill = loadSkillFromFile(skillDir, skillFilePath, verbose)
    if (skill) {
      skills[skill.name] = skill
    }
  }

  return skills
}

export function resolveSkillsDirs(options: {
  cwd: string
  skillsPath?: string
  homeDir?: string
}): string[] {
  const { cwd, skillsPath, homeDir } = options
  if (skillsPath) return [skillsPath]
  return [
    ...(homeDir
      ? [
          path.join(homeDir, '.claude', SKILLS_DIR_NAME),
          path.join(homeDir, '.agents', SKILLS_DIR_NAME),
        ]
      : []),
    path.join(cwd, '.claude', SKILLS_DIR_NAME),
    path.join(cwd, '.agents', SKILLS_DIR_NAME),
  ]
}

export type LoadSkillsOptions = {
  cwd?: string
  skillsPath?: string
  verbose?: boolean
  includeHomeSkills?: boolean
}

export function loadSkillsSync(options: LoadSkillsOptions = {}): SkillsMap {
  const {
    cwd = process.cwd(),
    skillsPath,
    verbose = false,
    includeHomeSkills = false,
  } = options

  const skills: SkillsMap = {}

  const skillsDirs = resolveSkillsDirs({
    cwd,
    skillsPath,
    homeDir: includeHomeSkills ? os.homedir() : undefined,
  })

  for (const skillsDir of skillsDirs) {
    const dirSkills = discoverSkillsFromDirectory(skillsDir, verbose)
    Object.assign(skills, dirSkills)
  }

  return skills
}

export async function loadSkills(
  options: LoadSkillsOptions = {},
): Promise<SkillsMap> {
  return loadSkillsSync(options)
}
