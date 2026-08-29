import * as fs from 'fs'
import * as path from 'path'

import './types'

import { Language, Parser, Query } from 'web-tree-sitter'

import { initTreeSitterForNode } from './init-node'
import { DEBUG_PARSING } from './parse'

import csharpQuery from './tree-sitter-queries/tree-sitter-c_sharp-tags.scm'
import cppQuery from './tree-sitter-queries/tree-sitter-cpp-tags.scm'
import goQuery from './tree-sitter-queries/tree-sitter-go-tags.scm'
import javaQuery from './tree-sitter-queries/tree-sitter-java-tags.scm'
import javascriptQuery from './tree-sitter-queries/tree-sitter-javascript-tags.scm'
import pythonQuery from './tree-sitter-queries/tree-sitter-python-tags.scm'
import rubyQuery from './tree-sitter-queries/tree-sitter-ruby-tags.scm'
import rustQuery from './tree-sitter-queries/tree-sitter-rust-tags.scm'
import typescriptQuery from './tree-sitter-queries/tree-sitter-typescript-tags.scm'
import { getDirnameDynamically } from './utils'

export interface LanguageConfig {
  extensions: string[]
  wasmFile: string
  queryPathOrContent: string

  parser?: Parser
  query?: Query
  language?: Language
}

export interface RuntimeLanguageLoader {
  loadLanguage(wasmFile: string): Promise<Language>
  initParser(): Promise<void>
}

export const WASM_FILES = {
  'tree-sitter-c-sharp.wasm': 'tree-sitter-c-sharp.wasm',
  'tree-sitter-cpp.wasm': 'tree-sitter-cpp.wasm',
  'tree-sitter-go.wasm': 'tree-sitter-go.wasm',
  'tree-sitter-java.wasm': 'tree-sitter-java.wasm',
  'tree-sitter-javascript.wasm': 'tree-sitter-javascript.wasm',
  'tree-sitter-python.wasm': 'tree-sitter-python.wasm',
  'tree-sitter-ruby.wasm': 'tree-sitter-ruby.wasm',
  'tree-sitter-rust.wasm': 'tree-sitter-rust.wasm',
  'tree-sitter-tsx.wasm': 'tree-sitter-tsx.wasm',
  'tree-sitter-typescript.wasm': 'tree-sitter-typescript.wasm',
} as const

export const languageTable: LanguageConfig[] = [
  {
    extensions: ['.ts'],
    wasmFile: WASM_FILES['tree-sitter-typescript.wasm'],
    queryPathOrContent: typescriptQuery,
  },
  {
    extensions: ['.tsx'],
    wasmFile: WASM_FILES['tree-sitter-tsx.wasm'],
    queryPathOrContent: typescriptQuery,
  },
  {
    extensions: ['.js', '.jsx'],
    wasmFile: WASM_FILES['tree-sitter-javascript.wasm'],
    queryPathOrContent: javascriptQuery,
  },
  {
    extensions: ['.py'],
    wasmFile: WASM_FILES['tree-sitter-python.wasm'],
    queryPathOrContent: pythonQuery,
  },
  {
    extensions: ['.java'],
    wasmFile: WASM_FILES['tree-sitter-java.wasm'],
    queryPathOrContent: javaQuery,
  },
  {
    extensions: ['.cs'],
    wasmFile: WASM_FILES['tree-sitter-c-sharp.wasm'],
    queryPathOrContent: csharpQuery,
  },
  {
    extensions: ['.cpp', '.hpp'],
    wasmFile: WASM_FILES['tree-sitter-cpp.wasm'],
    queryPathOrContent: cppQuery,
  },
  {
    extensions: ['.rs'],
    wasmFile: WASM_FILES['tree-sitter-rust.wasm'],
    queryPathOrContent: rustQuery,
  },
  {
    extensions: ['.rb'],
    wasmFile: WASM_FILES['tree-sitter-ruby.wasm'],
    queryPathOrContent: rubyQuery,
  },
  {
    extensions: ['.go'],
    wasmFile: WASM_FILES['tree-sitter-go.wasm'],
    queryPathOrContent: goQuery,
  },
]

let customWasmDir: string | undefined

export function setWasmDir(dir: string): void {
  customWasmDir = dir
}

export function getWasmDir(): string | undefined {
  return customWasmDir
}

function resolveWasmPath(wasmFileName: string): string {
  const customWasmDirPath = getWasmDir()
  if (customWasmDirPath) {
    return path.join(customWasmDirPath, wasmFileName)
  }

  const envWasmDir = process.env.CODEBUFF_WASM_DIR
  if (envWasmDir) {
    return path.join(envWasmDir, wasmFileName)
  }

  const moduleDir = (() => {
    const dirname = getDirnameDynamically()
    if (typeof dirname !== 'undefined') {
      return dirname
    }
    return process.cwd()
  })()

  const possiblePaths = [
    path.join(moduleDir, '..', 'wasm', wasmFileName),
    path.join(moduleDir, 'wasm', wasmFileName),
    path.join(process.cwd(), 'dist', 'wasm', wasmFileName),
  ]

  for (const wasmPath of possiblePaths) {
    try {
      return wasmPath
    } catch {
      continue
    }
  }

  return possiblePaths[0]
}

function tryResolveFromPackage(wasmFileName: string): string | null {
  try {
    return require.resolve(`@vscode/tree-sitter-wasm/wasm/${wasmFileName}`)
  } catch {
    return null
  }
}

class UnifiedLanguageLoader implements RuntimeLanguageLoader {
  private parserReady: Promise<void>

  constructor() {
    this.parserReady = initTreeSitterForNode()
  }

  async initParser(): Promise<void> {
    await this.parserReady
  }

  async loadLanguage(wasmFile: string): Promise<Language> {
    let wasmPath = resolveWasmPath(wasmFile)

    let lang: Language
    try {
      lang = await Language.load(wasmPath)
    } catch (err) {
      const fallbackPath = tryResolveFromPackage(wasmFile)
      if (fallbackPath) {
        lang = await Language.load(fallbackPath)
      } else {
        throw err
      }
    }

    return lang
  }
}

export function findLanguageConfigByExtension(
  filePath: string,
): LanguageConfig | undefined {
  const ext = path.extname(filePath)
  return languageTable.find((c) => c.extensions.includes(ext))
}

export async function createLanguageConfig(
  filePath: string,
  runtimeLoader: RuntimeLanguageLoader,
): Promise<LanguageConfig | undefined> {
  const cfg = findLanguageConfigByExtension(filePath)
  if (!cfg) {
    return undefined
  }

  if (!cfg.parser) {
    try {
      await runtimeLoader.initParser()

      const lang = await runtimeLoader.loadLanguage(cfg.wasmFile)

      const parser = new Parser()
      parser.setLanguage(lang)

      const queryContent = path.isAbsolute(cfg.queryPathOrContent)
        ? fs.readFileSync(cfg.queryPathOrContent, 'utf8')
        : cfg.queryPathOrContent

      cfg.language = lang
      cfg.parser = parser
      cfg.query = new Query(lang, queryContent)
    } catch (err) {
      throw err
    }
  }

  return cfg
}

const unifiedLoader = new UnifiedLanguageLoader()

export async function getLanguageConfig(
  filePath: string,
): Promise<LanguageConfig | undefined> {
  try {
    return await createLanguageConfig(filePath, unifiedLoader)
  } catch (err) {
    if (DEBUG_PARSING) {
      console.error('[tree-sitter] Load error for', filePath, err)
    }
    return undefined
  }
}
