export interface TokenCallerMap {
  [filePath: string]: {
    [token: string]: string[]
  }
}

export function renderReadFilesResult(
  files: { path: string; content: string }[],
  tokenCallers: TokenCallerMap,
) {
  return files.map((file) => {
    return {
      path: file.path,
      content: file.content,
      referencedBy: tokenCallers[file.path] ?? {},
    }
  })
}
