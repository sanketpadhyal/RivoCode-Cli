import React from 'react'

import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'
import { countCodeSearchResults } from '../../utils/code-search-summary'

import type { ToolRenderConfig } from './types'

export const CodeSearchComponent = defineToolComponent({
  toolName: 'code_search',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input as any
    const pattern = input?.pattern ?? ''
    const cwd = input?.cwd ?? ''

    const totalResults = countCodeSearchResults(toolBlock.output)

    let summary = ''

    summary += `${pattern}`

    if (cwd) {
      summary += ` in ${cwd}`
    }

    summary += ` (${totalResults} result${totalResults === 1 ? '' : 's'})`

    return {
      content: <SimpleToolCallItem name="Search" description={summary} />,
    }
  },
})
