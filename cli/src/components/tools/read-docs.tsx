import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'

export const ReadDocsComponent = defineToolComponent({
  toolName: 'read_docs',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input as any

    const libraryTitle =
      typeof input?.libraryTitle === 'string' ? input.libraryTitle.trim() : ''
    const topic = typeof input?.topic === 'string' ? input.topic.trim() : ''

    if (!libraryTitle && !topic) {
      return { content: null }
    }

    const description =
      libraryTitle && topic
        ? `${libraryTitle}: ${topic}`
        : libraryTitle || topic

    return {
      content: (
        <SimpleToolCallItem name="Read Docs" description={description} />
      ),
    }
  },
})
