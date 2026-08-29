import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'

export const TaskCompleteComponent = defineToolComponent({
  toolName: 'task_completed',

  render(): ToolRenderConfig {
    return {
      content: null,
    }
  },
})
