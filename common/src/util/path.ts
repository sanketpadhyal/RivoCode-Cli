import path from 'path'

export function isPathInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate)
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  )
}
