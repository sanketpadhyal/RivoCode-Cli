import { existsSync } from 'fs'
import { join } from 'path'

const CLI_ROOT = join(import.meta.dir, '..')
const ARTIFACT = join(CLI_ROOT, 'src/agents/bundled-agents.generated.ts')

if (!existsSync(ARTIFACT)) {
  const result = Bun.spawnSync(
    ['bun', 'run', join(CLI_ROOT, 'scripts/prebuild-agents.ts')],
    { cwd: CLI_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (!result.success || !existsSync(ARTIFACT)) {
    throw new Error(
      'Failed to generate src/agents/bundled-agents.generated.ts. ' +
        'Run `bun run prebuild:agents` in cli/ to see why.\n' +
        result.stderr.toString(),
    )
  }
}
