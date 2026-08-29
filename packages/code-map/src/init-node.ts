import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { Parser } from 'web-tree-sitter'

const TREE_SITTER_WASM_ENV_VAR = 'CODEBUFF_TREE_SITTER_WASM_PATH'
const WASM_BINARY_GLOBAL_KEY = '__CODEBUFF_TREE_SITTER_WASM_BINARY__'

const WEB_TREE_SITTER_VERSION = '0.25.10'

const WASM_DOWNLOAD_URLS = [
  `https://unpkg.com/web-tree-sitter@${WEB_TREE_SITTER_VERSION}/tree-sitter.wasm`,
  `https://cdn.jsdelivr.net/npm/web-tree-sitter@${WEB_TREE_SITTER_VERSION}/tree-sitter.wasm`,
]

export function setTreeSitterWasmPath(wasmPath: string): void {
  process.env[TREE_SITTER_WASM_ENV_VAR] = wasmPath
}

function getEmbeddedWasmBinary(): Uint8Array | undefined {
  return (
    globalThis as { [WASM_BINARY_GLOBAL_KEY]?: Uint8Array }
  )[WASM_BINARY_GLOBAL_KEY]
}

function downloadWasmTo(targetPath: string): string | null {
  process.stderr.write(
    `[tree-sitter] tree-sitter.wasm missing; downloading to ${targetPath}\n`,
  )
  for (const url of WASM_DOWNLOAD_URLS) {
    try {
      execFileSync(
        'curl',
        [
          '-fsSL',
          '--connect-timeout',
          '10',
          '--max-time',
          '60',
          '-o',
          targetPath,
          url,
        ],
        { stdio: 'pipe' },
      )
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
        process.stderr.write(`[tree-sitter] downloaded ${url}\n`)
        return targetPath
      }
    } catch (err) {
      process.stderr.write(
        `[tree-sitter] download from ${url} failed: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      )
    }
  }
  return null
}

function resolveTreeSitterWasm(scriptDir: string): string {

  const override = process.env[TREE_SITTER_WASM_ENV_VAR]
  if (override && fs.existsSync(override)) {
    return override
  }

  const scriptDirFallback = path.join(scriptDir, 'tree-sitter.wasm')
  if (fs.existsSync(scriptDirFallback)) {
    return scriptDirFallback
  }

  try {
    const siblingDir = path.dirname(process.execPath)
    const sibling = path.join(siblingDir, 'tree-sitter.wasm')
    if (fs.existsSync(sibling)) {
      return sibling
    }

    const downloaded = downloadWasmTo(sibling)
    if (downloaded) return downloaded
  } catch {
  }

  try {
    const pkgDir = path.dirname(require.resolve('web-tree-sitter'))
    const wasm = path.join(pkgDir, 'tree-sitter.wasm')
    if (fs.existsSync(wasm)) {
      return wasm
    }
  } catch {
  }

  const overrideDiagnostic = override
    ? ` (env ${TREE_SITTER_WASM_ENV_VAR}=${override} did not exist)`
    : ''
  throw new Error(
    `Internal error: tree-sitter.wasm not found (looked at scriptDir=${scriptDir}, dirname(process.execPath)=${path.dirname(process.execPath)}, and via web-tree-sitter package${overrideDiagnostic}). Set ${TREE_SITTER_WASM_ENV_VAR} or ensure the file is included in your deployment bundle.`,
  )
}

export async function initTreeSitterForNode(): Promise<void> {
  const embedded = getEmbeddedWasmBinary()
  if (embedded) {
    await Parser.init({ wasmBinary: embedded })
    return
  }

  await Parser.init({
    locateFile: (name: string, scriptDir: string) => {
      if (name === 'tree-sitter.wasm') {
        return resolveTreeSitterWasm(scriptDir)
      }

      return path.join(scriptDir, name)
    },
  })
}
