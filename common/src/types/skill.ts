import { z } from 'zod/v4'

import {
  SKILL_NAME_MAX_LENGTH,
  SKILL_NAME_REGEX,
  SKILL_DESCRIPTION_MAX_LENGTH,
} from '../constants/skills'

export const SkillMetadataSchema = z.record(z.string(), z.unknown())

export const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(SKILL_NAME_MAX_LENGTH)
    .regex(
      SKILL_NAME_REGEX,
      'Name must be lowercase alphanumeric with single hyphen separators',
    ),
  description: z
    .string()
    .min(1)
    .transform((d) => d.slice(0, SKILL_DESCRIPTION_MAX_LENGTH)),
  license: z.string().optional(),
  'disable-model-invocation': z.boolean().optional(),
  metadata: SkillMetadataSchema.optional(),
})

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>

export const SkillDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  license: z.string().optional(),
  disableModelInvocation: z.boolean().optional(),
  metadata: SkillMetadataSchema.optional(),
  content: z.string(),
  filePath: z.string(),
})

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>

export function createSkillDefinition(params: {
  frontmatter: SkillFrontmatter
  content: string
  filePath: string
}): SkillDefinition {
  const { frontmatter, content, filePath } = params
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    license: frontmatter.license,
    disableModelInvocation: frontmatter['disable-model-invocation'],
    metadata: frontmatter.metadata,
    content,
    filePath,
  }
}

export type SkillsMap = Record<string, SkillDefinition>
