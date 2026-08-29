import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'

import type { ToolRenderConfig } from './types'

export const ReadSubtreeComponent = defineToolComponent({
  toolName: 'read_subtree',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input as any
    const paths: string[] = Array.isArray(input?.paths)
      ? input.paths.filter((p: any) => typeof p === 'string' && p.trim().length)
      : []

    const displayPath: string =
      typeof input?.path === 'string' && input.path.trim().length > 0
        ? input.path.trim()
        : paths[0] || ''

    const finalPath = displayPath || '.'

    const ReadSubtreeContent = () => {
      const theme = useTheme()
      return (
        <SimpleToolCallItem
          name="List deeply"
          description={finalPath}
          descriptionColor={theme.directory}
        />
      )
    }

    return {
      content: <ReadSubtreeContent />,
    }
  },
})
