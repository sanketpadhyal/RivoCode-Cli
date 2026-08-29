import {
  createSkillDefinition,
  SkillFrontmatterSchema,
  type SkillDefinition,
} from '../types/skill'
import matter from 'gray-matter'

export function parseSkillFileContent(
  content: string,
  options: { directoryName: string; filePath: string; verbose?: boolean },
): SkillDefinition | null {
  const { directoryName, filePath, verbose = false } = options

  const parsed = parseFrontmatter(content)
  if (!parsed) {
    if (verbose) {
      console.error(`Invalid frontmatter in skill file: ${filePath}`)
    }
    return null
  }

  const result = SkillFrontmatterSchema.safeParse(parsed.frontmatter)
  if (!result.success) {
    if (verbose) {
      console.error(
        `Invalid skill frontmatter in ${filePath}: ${result.error.message}`,
      )
    }
    return null
  }

  const frontmatter = result.data

  if (frontmatter.name !== directoryName) {
    if (verbose) {
      console.error(
        `Skill name '${frontmatter.name}' does not match directory name '${directoryName}' in ${filePath}`,
      )
    }
    return null
  }

  return createSkillDefinition({ frontmatter, content, filePath })
}

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} | null {
  try {
    const parsed = matter(content)
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      return null
    }
    return {
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content,
    }
  } catch {
    return null
  }
}
