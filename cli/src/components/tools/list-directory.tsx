import React from 'react'

import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'

import type { ToolRenderConfig } from './types'

export const ListDirectoryComponent = defineToolComponent({
  toolName: 'list_directory',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input as any

    let directories: string[] = []

    if (Array.isArray(input?.directories)) {
      directories = input.directories
        .map((dir: any) =>
          typeof dir === 'object' && dir.path ? dir.path : dir,
        )
        .filter(
          (path: any) => typeof path === 'string' && path.trim().length > 0,
        )
    } else if (
      typeof input?.path === 'string' &&
      input.path.trim().length > 0
    ) {
      directories = [input.path.trim()]
    }

    if (directories.length === 0) {
      return { content: null }
    }

    const description = directories.join(', ')

    const ListDirectoryContent = () => {
      const theme = useTheme()
      return (
        <SimpleToolCallItem
          name="List"
          description={description}
          descriptionColor={theme.directory}
        />
      )
    }

    return {
      content: <ListDirectoryContent />,
    }
  },
})
