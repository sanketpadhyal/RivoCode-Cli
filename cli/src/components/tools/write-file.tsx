import { StrReplaceComponent } from './str-replace'
import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'

export const WriteFileComponent = defineToolComponent({
  toolName: 'write_file',

  render(toolBlock, theme, options): ToolRenderConfig {
    return StrReplaceComponent.render(toolBlock as any, theme, options)
  },
})
