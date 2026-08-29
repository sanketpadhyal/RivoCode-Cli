import type { CodebuffToolOutput } from '../../../common/src/tools/list'

export function runFileChangeHooks({
  files,
}: {
  files: string[]
}): Promise<CodebuffToolOutput<'run_file_change_hooks'>> {

  return Promise.resolve([
    {
      type: 'json',
      value: [
        {
          errorMessage:
            'No file change hooks were triggered for the specified files. File change hooks are not supported in the SDK environment.',
        },
      ],
    },
  ])
}
