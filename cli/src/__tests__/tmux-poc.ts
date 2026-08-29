#!/usr/bin/env bun

import { spawn } from 'child_process'

import stripAnsi from 'strip-ansi'

import { isTmuxAvailable, sleep } from './test-utils'

function tmux(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tmux', args, { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`tmux command failed: ${stderr}`))
      }
    })
  })
}

async function capturePane(sessionName: string): Promise<string> {
  return await tmux(['capture-pane', '-t', sessionName, '-p'])
}

async function testCLIWithTmux() {
  const sessionName = 'codebuff-test-' + Date.now()

  console.log('🚀 Starting tmux-based CLI test...')
  console.log(`📦 Session: ${sessionName}`)

  if (!isTmuxAvailable()) {
    console.error('❌ tmux not found')
    console.error('\n📦 Installation:')
    console.error('  macOS:   brew install tmux')
    console.error('  Ubuntu:  sudo apt-get install tmux')
    console.error('  Windows: Use WSL and run sudo apt-get install tmux')
    console.error(
      '\nℹ️  This is just a proof-of-concept. See the documentation for alternatives.',
    )
    process.exit(1)
  }

  try {
    const version = await tmux(['-V'])
    console.log(`✅ tmux is installed: ${version.trim()}`)

    console.log('\n📺 Creating tmux session...')
    await tmux([
      'new-session',
      '-d',
      '-s',
      sessionName,
      '-x',
      '120',
      '-y',
      '30',
      'bun',
      'run',
      'src/entry.ts',
      '--help',
    ])
    console.log('✅ Session created')

    await sleep(1000)

    console.log('\n📸 Capturing initial output...')
    const initialOutput = await capturePane(sessionName)
    const cleanOutput = stripAnsi(initialOutput)

    console.log('\n--- Output ---')
    console.log(cleanOutput)
    console.log('--- End Output ---\n')

    const checks = [
      { text: '--agent', pass: cleanOutput.includes('--agent') },
      { text: 'Usage:', pass: cleanOutput.includes('Usage:') },
      { text: '--help', pass: cleanOutput.includes('--help') },
    ]

    console.log('🔍 Verification:')
    checks.forEach(({ text, pass }) => {
      console.log(
        `  ${pass ? '✅' : '❌'} Contains "${text}"${pass ? '' : ' - NOT FOUND'}`,
      )
    })

    const allPassed = checks.every((c) => c.pass)
    console.log(
      `\n${allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed'}`,
    )

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    console.log('\n🧹 Cleaning up...')
    try {
      await tmux(['kill-session', '-t', sessionName])
      console.log('✅ Session cleaned up')
    } catch (e) {
      console.log('⚠️  Session may have already exited')
    }
  }
}

testCLIWithTmux().catch(console.error)
