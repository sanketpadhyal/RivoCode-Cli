import type { ChildProcess, SpawnOptions } from 'child_process'

export type CodebuffSpawn = (
  command: string,
  args?: readonly string[],
  options?: SpawnOptions,
) => ChildProcess
