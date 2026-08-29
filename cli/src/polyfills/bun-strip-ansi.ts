import { stripAnsi } from '@codebuff/common/util/string'

const bunGlobal = globalThis as typeof globalThis & {
  Bun?: {
    stripANSI?: (input: string) => string
  }
}

if (bunGlobal.Bun && typeof bunGlobal.Bun.stripANSI !== 'function') {
  bunGlobal.Bun.stripANSI = stripAnsi
}
