import { TextAttributes } from '@opentui/core'

import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'

import type { ToolRenderConfig } from './types'

interface WriteTodosItemProps {
  todos: Array<{ task: string; completed: boolean }>
}

const WriteTodosItem = ({ todos }: WriteTodosItemProps) => {
  const theme = useTheme()
  const bulletChar = '• '

  return (
    <box style={{ flexDirection: 'column', gap: 0, width: '100%' }}>
      <box
        style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}
      >
        <text style={{ wrapMode: 'word' }}>
          <span fg={theme.foreground}>{bulletChar}</span>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            TODOs
          </span>
        </text>
      </box>

      {todos.map((todo, index) => (
        <box
          key={`todo-${index}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            paddingLeft: 2,
          }}
        >
          <text style={{ wrapMode: 'word' }}>
            {todo.completed ? (
              <>
                <span fg={theme.success}>✓  </span>
                <span
                  fg={theme.muted}
                  attributes={TextAttributes.STRIKETHROUGH}
                >
                  {todo.task}
                </span>
              </>
            ) : (
              <>
                <span fg={theme.foreground}>☐  </span>
                <span fg={theme.foreground}>{todo.task}</span>
              </>
            )}
          </text>
        </box>
      ))}
    </box>
  )
}

export const WriteTodosComponent = defineToolComponent({
  toolName: 'write_todos',

  render(toolBlock): ToolRenderConfig {
    const { input } = toolBlock

    let todos: Array<{ task: string; completed: boolean }> = []

    if (Array.isArray(input?.todos)) {
      todos = input.todos.filter(
        (todo: any) =>
          typeof todo === 'object' &&
          typeof todo.task === 'string' &&
          typeof todo.completed === 'boolean',
      )
    }

    if (todos.length === 0) {
      return { content: null }
    }

    return {
      content: <WriteTodosItem todos={todos} />,
    }
  },
})
