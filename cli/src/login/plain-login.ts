import readline from 'readline'
import { cyan, green, red, bold } from 'picocolors'

import { DEFAULT_BYPASS_USER, saveUserCredentials } from '../utils/auth'

export async function runPlainLogin(): Promise<void> {
  console.log()
  console.log(bold('RivoCode Authentication'))
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise<void>((resolve) => {
    rl.question('Enter access code: ', (input) => {
      rl.close()
      const code = input.trim().toLowerCase()

      if (code === 'sanket') {
        saveUserCredentials(DEFAULT_BYPASS_USER)
        console.log()
        console.log(green('✓ Logged in as Sanket Padhyal (RivoCode)'))
        console.log()
        console.log('You can now run ' + cyan('rivocode') + ' to start.')
        console.log()
        resolve()
        process.exit(0)
      } else {
        console.log()
        console.log(red('❌ Invalid access code. (Hint: sanket)'))
        console.log()
        resolve()
        process.exit(1)
      }
    })
  })
}
