import { defineToolComponent } from './types'
import { TerminalCommandDisplay } from '../terminal-command-display'

import type { ToolRenderConfig } from './types'

export interface ParsedTerminalOutput {
  output: string | null
  startingCwd?: string
}

export const parseTerminalOutput = (rawOutput: string | undefined): ParsedTerminalOutput => {
  if (!rawOutput) {
    return { output: null }
  }

  try {
    const parsed = JSON.parse(rawOutput)
    const value = Array.isArray(parsed) ? parsed[0]?.value : parsed
    if (value) {
      const startingCwd = value.startingCwd
      if (value.errorMessage) {
        return { output: `Error: ${value.errorMessage}`, startingCwd }
      }
      const stdout = value.stdout || ''
      const stderr = value.stderr || ''
      const output = (stdout + stderr).trimEnd() || null
      return { output, startingCwd }
    }
    return { output: null }
  } catch {
    return { output: rawOutput.trimEnd() || null }
  }
}

export const RunTerminalCommandComponent = defineToolComponent({
  toolName: 'run_terminal_command',

  render(toolBlock, _theme, options): ToolRenderConfig {
    const input = toolBlock.input as { command?: string; timeout_seconds?: number } | undefined
    const command = typeof input?.command === 'string' ? input.command.trim() : ''
    const timeoutSeconds = typeof input?.timeout_seconds === 'number' ? input.timeout_seconds : undefined

    const { output, startingCwd } = parseTerminalOutput(toolBlock.output)

    const content = (
      <TerminalCommandDisplay
        command={command}
        output={output}
        expandable={true}
        maxVisibleLines={5}
        cwd={startingCwd}
        timeoutSeconds={timeoutSeconds}
        availableWidth={options.availableWidth}
      />
    )

    return {
      content,
      collapsedPreview: `$ ${command}`,
    }
  },
})
