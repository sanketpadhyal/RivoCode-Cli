
import { existsSync, readFileSync } from 'fs'
import { dirname, isAbsolute, join, resolve } from 'path'

const candidates = (
  [process.argv[0], process.execPath] as Array<string | undefined>
)
  .filter((p): p is string => typeof p === 'string' && p.length > 0)
  .map((p) => (isAbsolute(p) ? p : resolve(p)))
  .map((p) => join(dirname(p), 'tree-sitter.wasm'))

const siblingPath = candidates.find((p) => existsSync(p))

if (process.argv.includes('--smoke-tree-sitter')) {
  console.error(
    `[pre-init diag] argv[0]=${process.argv[0]}\n` +
      `[pre-init diag] execPath=${process.execPath}\n` +
      `[pre-init diag] candidates=${JSON.stringify(candidates)}\n` +
      `[pre-init diag] resolved siblingPath=${siblingPath ?? '<none>'}\n`,
  )
}

if (siblingPath) {
  process.env.CODEBUFF_TREE_SITTER_WASM_PATH = siblingPath

  ;(
    globalThis as { __CODEBUFF_TREE_SITTER_WASM_PATH__?: string }
  ).__CODEBUFF_TREE_SITTER_WASM_PATH__ = siblingPath

  try {
    const buf = readFileSync(siblingPath)
    ;(
      globalThis as { __CODEBUFF_TREE_SITTER_WASM_BINARY__?: Uint8Array }
    ).__CODEBUFF_TREE_SITTER_WASM_BINARY__ = new Uint8Array(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength,
    )
  } catch (err) {
    console.error(
      '[tree-sitter pre-init] readFileSync failed for sibling wasm at',
      siblingPath,
      '—',
      err instanceof Error ? err.message : String(err),
    )
  }
}
