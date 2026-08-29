import { SKILLS_DIR_NAME, SKILL_FILE_NAME } from '@rivocode/common/constants/skills'
import {
  createSkillDefinition,
  SkillFrontmatterSchema,
  type SkillDefinition,
} from '@rivocode/common/types/skill'
import { isSkillModelInvocable } from '@rivocode/common/util/skills'
import { jsonToolResult } from '@rivocode/common/util/messages'
import fs from 'fs'
import path from 'path'
import os from 'os'
import matter from 'gray-matter'

import type { CodebuffToolHandlerFunction } from '../handler-function-type'
import type {
  CodebuffToolCall,
  CodebuffToolOutput,
} from '@rivocode/common/tools/list'
import type { ProjectFileContext } from '@rivocode/common/util/file'

async function loadSkillFromDisk(
  projectRoot: string,
  skillName: string,
  includeHomeSkills: boolean,
): Promise<SkillDefinition | null> {
  const home = os.homedir()
  const skillsDirs = [
    path.join(projectRoot, '.agents', SKILLS_DIR_NAME),
    path.join(projectRoot, '.claude', SKILLS_DIR_NAME),
    ...(includeHomeSkills
      ? [
          path.join(home, '.agents', SKILLS_DIR_NAME),
          path.join(home, '.claude', SKILLS_DIR_NAME),
        ]
      : []),
  ]

  for (const skillsDir of skillsDirs) {
    const skillDir = path.join(skillsDir, skillName)
    const skillFilePath = path.join(skillDir, SKILL_FILE_NAME)

    try {
      const stat = fs.statSync(skillDir)
      if (!stat.isDirectory()) continue

      fs.statSync(skillFilePath)

      const content = fs.readFileSync(skillFilePath, 'utf8')
      const parsed = matter(content)

      if (!parsed.data || Object.keys(parsed.data).length === 0) {
        continue
      }

      const result = SkillFrontmatterSchema.safeParse(parsed.data)
      if (!result.success) {
        continue
      }

      const frontmatter = result.data

      if (frontmatter.name !== skillName) {
        continue
      }

      return createSkillDefinition({
        frontmatter,
        content,
        filePath: skillFilePath,
      })
    } catch {
      continue
    }
  }

  return null
}

type ToolName = 'skill'

export const handleSkill = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: CodebuffToolCall<ToolName>
  fileContext: ProjectFileContext
}): Promise<{ output: CodebuffToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  const { name } = toolCall.input

  await previousToolCallFinished

  const skills = fileContext.skills ?? {}

  const diskSkill = fileContext.projectRoot
    ? await loadSkillFromDisk(
        fileContext.projectRoot,
        name,
        fileContext.includeHomeSkills === true,
      )
    : null

  const skill = diskSkill ?? skills[name]
  const isUnavailableToModel =
    skill !== undefined && !isSkillModelInvocable(skill)

  if (!skill || isUnavailableToModel) {
    const availableSkills = Object.values(skills)
      .filter(isSkillModelInvocable)
      .map((availableSkill) => availableSkill.name)
    const suggestion =
      availableSkills.length > 0
        ? ` Available skills: ${availableSkills.join(', ')}. You can also load skills created during this session by name.`
        : ' No skills are currently available. You can load skills created during this session by name.'

    const reason = isUnavailableToModel
      ? `Skill '${name}' can only be invoked by the user.`
      : `Skill '${name}' not found.`

    return {
      output: jsonToolResult({
        name,
        description: '',
        content: `Error: ${reason}${suggestion}`,
      }),
    }
  }

  const result: { name: string; description: string; content: string; license?: string } = {
    name: skill.name,
    description: skill.description,
    content: skill.content,
  }
  if (skill.license) {
    result.license = skill.license
  }

  return {
    output: jsonToolResult(result),
  }
}) satisfies CodebuffToolHandlerFunction<ToolName>
