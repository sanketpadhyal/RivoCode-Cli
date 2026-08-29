import { existsSync, writeFileSync } from 'fs'

import {
  getTerminalWatchdogDiagnostics,
  startTerminalWatchdog,
  stopTerminalWatchdog,
} from '../../utils/terminal-watchdog'

const [mode, ttyPath] = process.argv.slice(2)

if (!mode || !ttyPath) {
  console.error(
    'usage: terminal-watchdog-fixture.ts <hang|clean|spawn-failure> <ttyPath>',
  )
  process.exit(2)
}

async function waitForArmed(): Promise<void> {
  if (process.platform !== 'win32') return
  if (!getTerminalWatchdogDiagnostics().armed) return
  const deadline = Date.now() + 40_000
  while (Date.now() < deadline) {
    if (existsSync(`${ttyPath}.armed`)) return
    await new Promise((r) => setTimeout(r, 50))
  }
  console.error(`watchdog never armed within 40s (marker: ${ttyPath}.armed)`)
  process.exit(3)
}

if (mode === 'spawn-failure') {
  const failure = await new Promise<unknown>((resolve) => {
    startTerminalWatchdog({
      ttyPath,
      reportFailure: resolve,
      windowsPowerShellPath: `${ttyPath}.missing.exe`,
    })
    setTimeout(() => {
      console.error('watchdog failure was not reported')
      process.exit(4)
    }, 10_000)
  })
  writeFileSync(ttyPath, JSON.stringify(failure))
  process.exit(0)
}

startTerminalWatchdog({ ttyPath })

if (mode === 'clean') {
  await waitForArmed()
  stopTerminalWatchdog()
  console.log('ready')
  process.exit(0)
}

await waitForArmed()
console.log('ready')
setInterval(() => {}, 1_000)
