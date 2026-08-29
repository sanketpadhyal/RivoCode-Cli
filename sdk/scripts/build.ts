
import { mkdir, cp, readFile, writeFile, rm } from 'fs/promises'
import Module from 'module'
import { delimiter, join } from 'path'

import { generateDtsBundle } from 'dts-bundle-generator'

const workspaceNodeModules = join(import.meta.dir, '..', 'node_modules')
const existingNodePath = process.env.NODE_PATH ?? ''
const nodePathEntries = existingNodePath
  ? new Set(existingNodePath.split(delimiter))
  : new Set<string>()

if (!nodePathEntries.has(workspaceNodeModules)) {
  nodePathEntries.add(workspaceNodeModules)
  process.env.NODE_PATH = Array.from(nodePathEntries).join(delimiter)
  const moduleWithInit = Module as unknown as { _initPaths?: () => void }
  moduleWithInit._initPaths?.()
}

async function build() {
  console.log('🧹 Cleaning dist directory...')
  await rm('dist', { recursive: true, force: true })

  await mkdir('./dist', { recursive: true })

  const pkgText = await Bun.file('./package.json').text()
  const pkg = JSON.parse(pkgText)
  const external = [
    ...Object.keys(pkg.dependencies || {}).filter(
      (dep) => !dep.startsWith('@rivocode/'),
    ),
    'fs',
    'path',
    'child_process',
    'os',
    'crypto',
    'stream',
    'util',
    'ws',
    'bufferutil',
    'utf-8-validate',
    'http',
    'https',
    'net',
    'tls',
    'url',
    'events',
  ]
  console.log('📦 Building ESM format...')
  await Bun.build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist',
    target: 'node',
    format: 'esm',
    minify: false,
    sourcemap: 'linked',
    external,
    naming: '[dir]/index.mjs',
    env: 'NEXT_PUBLIC_*',
    loader: {
      '.scm': 'text',
    },
    plugins: [],
  })

  console.log('📦 Building AI SDK CJS shim...')
  const aiShimBuild = await Bun.build({
    entrypoints: [
      join(import.meta.dir, '..', '..', 'node_modules/ai/dist/index.js'),
    ],
    outdir: 'dist/vendor',
    target: 'node',
    format: 'cjs',
    minify: false,
    naming: 'ai.cjs',
  })
  if (!aiShimBuild.success) {
    throw new AggregateError(aiShimBuild.logs, 'AI SDK CJS shim build failed')
  }

  console.log('📦 Building CJS format...')
  await Bun.build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist',
    target: 'node',
    format: 'cjs',
    minify: false,
    sourcemap: 'linked',
    external,
    naming: '[dir]/index.cjs',
    define: {
      'import.meta.url': 'undefined',
      'import.meta': 'undefined',
    },
    env: 'NEXT_PUBLIC_*',
    loader: {
      '.scm': 'text',
    },
    plugins: [],
  })

  const cjsPath = 'dist/index.cjs'
  const cjs = await readFile(cjsPath, 'utf8')
  const cjsWithAiShim = cjs.replaceAll(
    'require("ai")',
    'require("./vendor/ai.cjs")',
  )
  if (cjsWithAiShim === cjs) {
    throw new Error('CJS build did not contain the expected external AI SDK import')
  }
  await writeFile(cjsPath, cjsWithAiShim)

  console.log('🩹 Patching broken export aliases (Bun bundler dedup workaround)...')
  await fixBrokenExportAliases('dist/index.mjs')
  await fixBrokenExportAliases('dist/index.cjs')

  console.log('📝 Generating and bundling TypeScript declarations...')
  try {
    const [bundle] = generateDtsBundle(
      [
        {
          filePath: 'src/index.ts',
          output: {
            exportReferencedTypes: false,
          },
          libraries: {
            importedLibraries: [
              '@rivocode/common',
              '@rivocode/agent-runtime',
              '@rivocode/code-map',
              '@rivocode/llm-providers',
            ],
          },
        },
      ],
      {
        preferredConfigPath: join(import.meta.dir, '..', 'tsconfig.build.json'),
      },
    )

    await writeFile('dist/index.d.ts', bundle)
    await fixDuplicateImports()
    console.log('  ✓ Created bundled type definitions')
  } catch (error) {
    console.error('❌ TypeScript declaration bundling failed:', error.message)
    process.exit(1)
  }

  console.log('📂 Copying WASM files for tree-sitter...')
  await copyWasmFiles()

  console.log('📂 Copying vendored ripgrep binaries...')
  await copyRipgrepVendor()

  console.log('✅ Build complete!')
  console.log('  📄 dist/index.mjs (ESM)')
  console.log('  📄 dist/index.cjs (CJS)')
  console.log('  📄 dist/index.d.ts (Types)')
}

async function fixBrokenExportAliases(filePath: string) {
  let content
  try {
    content = await readFile(filePath, 'utf-8')
  } catch (error) {
    console.warn(`  ⚠ Skipping patch for missing ${filePath}`)
    return
  }

  const declared = new Set()
  const declRegex =
    /^(?:var|let|const|class|(?:async\s+)?function\*?)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/gm
  for (const match of content.matchAll(declRegex)) {
    declared.add(match[1])
  }

  function findExisting(local) {
    if (declared.has(local)) return local
    const m = local.match(/^([A-Za-z_$][A-Za-z0-9_$]*?)(\d+)$/)
    if (!m) return null
    const base = m[1]
    const num = parseInt(m[2], 10)
    for (let i = num - 1; i >= 1; i--) {
      const candidate = base + i
      if (declared.has(candidate)) return candidate
    }
    if (declared.has(base)) return base
    return null
  }

  let rewritten = 0
  let removed = 0

  const blockRegex = /^export\s*\{\s*\n([\s\S]*?)\n\s*\};?/gm
  content = content.replace(blockRegex, (full, body) => {
    const lines = body.split('\n')
    const fixed = []
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const aliasMatch = line.match(
        /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*,?$/,
      )
      if (aliasMatch) {
        const local = aliasMatch[1]
        const alias = aliasMatch[2]
        const found = findExisting(local)
        if (!found) {
          removed++
          continue
        }
        if (found !== local) rewritten++
        if (found === alias) {
          fixed.push(`  ${found},`)
        } else {
          fixed.push(`  ${found} as ${alias},`)
        }
        continue
      }

      const bareMatch = line.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*,?$/)
      if (bareMatch) {
        const name = bareMatch[1]
        if (declared.has(name)) {
          fixed.push(`  ${name},`)
        } else {
          const found = findExisting(name)
          if (found && found !== name) {
            fixed.push(`  ${found} as ${name},`)
            rewritten++
          } else {
            removed++
          }
        }
        continue
      }

      fixed.push(rawLine)
    }
    return `export {\n${fixed.join('\n')}\n};`
  })

  if (rewritten > 0 || removed > 0) {
    await writeFile(filePath, content)
    console.log(
      `  ✓ Patched ${filePath} — ${rewritten} aliases rewritten, ${removed} broken exports dropped`,
    )
  } else {
    console.log(`  ✓ ${filePath} already clean (no broken aliases found)`)
  }
}

async function fixDuplicateImports() {
  try {
    let content = await readFile('dist/index.d.ts', 'utf-8')

    const zodDefaultImportRegex = /import\s+z\s+from\s+['"]zod\/v4['"];?\n?/g
    const zodNamedImportRegex =
      /import\s+\{\s*z\s*\}\s+from\s+['"]zod\/v4['"];?/

    if (
      content.match(zodNamedImportRegex) &&
      content.match(zodDefaultImportRegex)
    ) {
      content = content.replace(zodDefaultImportRegex, '')
    }

    await writeFile('dist/index.d.ts', content)
    console.log('  ✓ Fixed duplicate imports in bundled types')
  } catch (error) {
    console.warn('  ⚠ Warning: Could not fix duplicate imports:', error.message)
  }
}

async function copyWasmFiles() {
  const wasmSourceDir = '../node_modules/@vscode/tree-sitter-wasm/wasm'
  const wasmFiles = [
    'tree-sitter.wasm',
    'tree-sitter-c-sharp.wasm',
    'tree-sitter-cpp.wasm',
    'tree-sitter-go.wasm',
    'tree-sitter-java.wasm',
    'tree-sitter-javascript.wasm',
    'tree-sitter-python.wasm',
    'tree-sitter-ruby.wasm',
    'tree-sitter-rust.wasm',
    'tree-sitter-tsx.wasm',
    'tree-sitter-typescript.wasm',
  ]

  await mkdir('dist/wasm', { recursive: true })

  for (const wasmFile of wasmFiles) {
    try {
      await cp(`${wasmSourceDir}/${wasmFile}`, `dist/wasm/${wasmFile}`)
      console.log(`  ✓ Copied ${wasmFile}`)
    } catch (error) {
      console.warn(`  ⚠ Warning: Could not copy ${wasmFile}:`, error.message)
    }
  }
}

async function copyRipgrepVendor() {
  const vendorSrc = 'vendor/ripgrep'
  const vendorDest = 'dist/vendor/ripgrep'
  try {
    await mkdir(vendorDest, { recursive: true })
    await cp(vendorSrc, vendorDest, { recursive: true })
    console.log('  ✓ Copied vendored ripgrep binaries')
  } catch (e) {
    console.warn(
      '  ⚠ No vendored ripgrep found; skipping (use fetch-ripgrep.ts first)',
    )
  }
}

if (import.meta.main) {
  build().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
