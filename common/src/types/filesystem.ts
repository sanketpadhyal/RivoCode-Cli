import type fs from 'fs'

export type CodebuffFileSystem = Pick<
  typeof fs.promises,
  'mkdir' | 'readdir' | 'readFile' | 'stat' | 'unlink' | 'writeFile'
>
