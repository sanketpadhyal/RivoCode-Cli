export const publisher = 'codebuff'

export const FOLLOWUP_STYLE_GUIDANCE =
  'Keep each one short and goal-oriented: name the outcome, not the steps to reach it, so whoever picks it up is free to choose the approach. Each suggestion is clicked out of context, so name its target.'

export const SKILL_DISCOVERY_GUIDANCE =
  "- **Discover and install skills:** Skills are reusable, self-contained instructions for accomplishing a task. Beyond the skills already listed for the `skill` tool, you can find and install community skills from the command line: `npx skills find <query>` to search, `npx skills add <owner/repo> --list` to preview a repo's skills, and `npx skills add <owner/repo> --skill <name> --yes` to install one into `.agents/skills/`. After installing, load it by name with the `skill` tool. These community skills are not vetted, so confirm with the user which skill(s) to install before running `npx skills add`."

export const gravityIndexGuidance = (deeperResearch = '') =>
  `- **Research services before recommending them:** Whenever the user needs to choose or integrate a third-party developer service (database, auth, payments, hosting, email, cache, monitoring, analytics, AI, storage, CMS, search, etc.), use the gravity_index tool to discover, compare, and get install guidance for options${deeperResearch}. Don't recommend or integrate a service from memory alone.`

export const OPUS_MODEL = 'anthropic/claude-opus-5'

export const LITE_MODEL = 'openai/gpt-5.6-luna'
