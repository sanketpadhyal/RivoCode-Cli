import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'

export const GlobComponent = defineToolComponent({
  toolName: 'glob',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input as any
    const pattern = input?.pattern ?? ''
    const cwd = input?.cwd ?? ''

    let hasError = false

    if (toolBlock.output) {
      const outputArray = Array.isArray(toolBlock.output)
        ? toolBlock.output
        : [toolBlock.output]

      for (const item of outputArray) {
        const output = item as any
        if (output?.type === 'json' && output?.value) {
          const value = output.value as any
          if (value.errorMessage) {
            hasError = true
          }
        }
      }
    }

    if (!pattern) {
      return { content: null }
    }

    let summary = pattern

    if (cwd) {
      summary += ` in ${cwd}`
    }

    if (hasError) {
      summary += ' (error)'
    }

    return {
      content: <SimpleToolCallItem name="Glob" description={summary} />,
    }
  },
})
