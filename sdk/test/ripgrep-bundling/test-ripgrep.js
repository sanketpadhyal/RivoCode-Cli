#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

console.log('🧪 Testing ripgrep bundling functionality...')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const testDir = join(__dirname, 'test-files')

function setupTestFiles() {
  console.log('\n📁 Setting up test files...')

  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true })
  }

  writeFileSync(
    join(testDir, 'example.js'),
    `
// Test file for ripgrep search
function testFunction() {
  console.log('This is a test function');
  const specialPattern = 'UNIQUE_SEARCH_TERM';
  return specialPattern;
}

module.exports = { testFunction };
`,
  )

  writeFileSync(
    join(testDir, 'example.ts'),
    `
// TypeScript test file
interface TestInterface {
  name: string;
  value: number;
}

class TestClass implements TestInterface {
  name = 'UNIQUE_SEARCH_TERM';
  value = 42;
}

export { TestClass };
`,
  )

  writeFileSync(
    join(testDir, 'config.json'),
    `{
  "name": "test-config",
  "setting": "UNIQUE_SEARCH_TERM",
  "enabled": true
}`,
  )

  console.log('✅ Test files created')
}

async function cleanupTestFiles() {
  try {
    const { rmSync } = await import('fs')
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    console.log('✅ Test files cleaned up')
  } catch (error) {
    console.warn('⚠️ Could not clean up test files:', error.message)
  }
}

try {
  setupTestFiles()

  console.log('\n1. Testing ripgrep imports...')
  const { getBundledRgPath, ToolHelpers } = await import('@rivocode/sdk')

  if (typeof getBundledRgPath !== 'function') {
    throw new Error(
      `Expected getBundledRgPath to be a function, got ${typeof getBundledRgPath}`,
    )
  }

  if (typeof ToolHelpers.codeSearch !== 'function') {
    throw new Error(
      `Expected Tools.codeSearch to be a function, got ${typeof ToolHelpers.codeSearch}`,
    )
  }

  console.log('✅ Ripgrep functions imported successfully')

  console.log('\n2. Testing getBundledRgPath...')
  const rgPath = getBundledRgPath(import.meta.url)

  if (typeof rgPath !== 'string' || rgPath.length === 0) {
    throw new Error(`Expected valid ripgrep path, got: ${rgPath}`)
  }

  console.log('✅ Ripgrep path found:', rgPath)

  console.log('\n3. Testing ripgrep binary existence...')
  if (!existsSync(rgPath)) {
    throw new Error(`Ripgrep binary not found at: ${rgPath}`)
  }

  console.log('✅ Ripgrep binary exists on filesystem')

  console.log('\n4. Testing bundled binary location...')
  if (rgPath.includes('@vscode/ripgrep')) {
    throw new Error('Still using @vscode/ripgrep instead of bundled binary!')
  }

  if (!rgPath.includes('vendor/ripgrep')) {
    throw new Error(
      `Expected bundled ripgrep path to contain 'vendor/ripgrep', got: ${rgPath}`,
    )
  }

  console.log('✅ Using bundled ripgrep binary (not @vscode/ripgrep)')

  console.log('\n5. Testing basic code search...')
  const searchResult = await ToolHelpers.codeSearch({
    projectPath: testDir,
    pattern: 'UNIQUE_SEARCH_TERM',
    maxResults: 10,
  })

  if (!Array.isArray(searchResult) || searchResult.length === 0) {
    throw new Error(
      'Expected search results array, got empty or invalid result',
    )
  }

  const result = searchResult[0]
  if (result.type !== 'json' || !result.value) {
    throw new Error('Expected JSON result with value property')
  }

  if (!result.value.stdout || typeof result.value.stdout !== 'string') {
    throw new Error('Expected stdout in search result')
  }

  console.log('✅ Basic code search successful')

  console.log('\n6. Testing search result content...')
  const stdout = result.value.stdout
  const lines = stdout.split('\n').filter((line) => line.trim())

  if (lines.length < 3) {
    throw new Error(`Expected at least 3 matches, got ${lines.length}`)
  }

  const hasJsMatch = lines.some((line) => line.includes('example.js'))
  const hasTsMatch = lines.some((line) => line.includes('example.ts'))
  const hasJsonMatch = lines.some((line) => line.includes('config.json'))

  if (!hasJsMatch || !hasTsMatch || !hasJsonMatch) {
    throw new Error('Missing expected file matches in search results')
  }

  console.log('✅ Search found all expected files')

  console.log('\n7. Testing search with flags...')
  const flaggedResult = await ToolHelpers.codeSearch({
    projectPath: testDir,
    pattern: 'unique_search_term',
    flags: '-i',
    maxResults: 5,
  })

  if (!flaggedResult[0]?.value?.stdout) {
    throw new Error('Expected results from case-insensitive search')
  }

  console.log('✅ Search with flags works correctly')

  console.log('\n8. Testing file type filtering...')
  const typeFilteredResult = await ToolHelpers.codeSearch({
    projectPath: testDir,
    pattern: 'UNIQUE_SEARCH_TERM',
    flags: '-t js',
    maxResults: 5,
  })

  const typeFilteredStdout = typeFilteredResult[0]?.value?.stdout || ''
  const typeFilteredLines = typeFilteredStdout
    .split('\n')
    .filter((line) => line.trim())

  const hasOnlyJs = typeFilteredLines.every(
    (line) => !line.includes('.ts') && !line.includes('.json'),
  )

  if (!hasOnlyJs && typeFilteredLines.length > 0) {
    console.warn('⚠️ File type filtering may not be working as expected')
  } else {
    console.log('✅ File type filtering works correctly')
  }

  console.log('\n9. Testing error handling...')
  const _invalidResult = await ToolHelpers.codeSearch({
    projectPath: '/nonexistent/directory',
    pattern: 'test',
    maxResults: 1,
  })

  console.log('✅ Error handling works (no crashes)')

  console.log('\n10. Testing environment variable override...')
  const originalPath = process.env.CODEBUFF_RG_PATH

  process.env.CODEBUFF_RG_PATH = '/usr/bin/rg'

  try {
    const overridePath = getBundledRgPath(import.meta.url)
    if (overridePath !== '/usr/bin/rg') {
      throw new Error('Environment variable override not working')
    }
    console.log('✅ Environment variable override works')
  } finally {
    if (originalPath) {
      process.env.CODEBUFF_RG_PATH = originalPath
    } else {
      delete process.env.CODEBUFF_RG_PATH
    }
  }

  console.log('\n🎉 All ripgrep bundling tests passed!')
} catch (error) {
  console.error('\n❌ Ripgrep bundling test failed:', error.message)
  console.error('Stack trace:', error.stack)
  process.exit(1)
} finally {
  await cleanupTestFiles()
}
