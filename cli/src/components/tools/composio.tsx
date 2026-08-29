import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'

import type { ToolBlock, ToolRenderConfig } from './types'

function formatList(items: string[], maxItems = 3): string {
  if (items.length === 0) return ''
  const shown = items.slice(0, maxItems)
  const remainder = items.length - shown.length
  const suffix = remainder > 0 ? ` +${remainder} more` : ''
  return shown.join(', ') + suffix
}

export const ManageConnectionsComponent = defineToolComponent({
  toolName: 'composio_manage_connections',

  render(toolBlock: ToolBlock & { toolName: 'composio_manage_connections' }): ToolRenderConfig {
    const input = toolBlock.input as {
      toolkits?: string[]
      reinitiate_all?: boolean
    } | undefined
    const toolkits = input?.toolkits ?? []
    const description = toolkits.length > 0 ? formatList(toolkits) : ''

    return {
      content: (
        <SimpleToolCallItem name="App Connections" description={description} />
      ),
      collapsedPreview: description,
    }
  },
})

export const ExecuteToolComponent = defineToolComponent({
  toolName: 'composio_multi_execute_tool',

  render(toolBlock: ToolBlock & { toolName: 'composio_multi_execute_tool' }): ToolRenderConfig {
    const input = toolBlock.input as {
      tools?: Array<Record<string, unknown>>
      thought?: string
    } | undefined
    const tools = input?.tools ?? []
    const thought = input?.thought

    const description =
      thought ??
      (tools.length > 0
        ? formatList(
            tools.map((t) =>
              typeof t.slug === 'string' ? t.slug : JSON.stringify(t),
            ),
          )
        : '')

    return {
      content: (
        <SimpleToolCallItem name="App Action" description={description} />
      ),
      collapsedPreview: description,
    }
  },
})

export const SearchToolsComponent = defineToolComponent({
  toolName: 'composio_search_tools',

  render(toolBlock: ToolBlock & { toolName: 'composio_search_tools' }): ToolRenderConfig {
    const input = toolBlock.input as {
      queries?: unknown[]
    } | undefined
    const queries = input?.queries ?? []
    const description =
      queries.length > 0
        ? formatList(
            queries.map((q) => (typeof q === 'string' ? q : JSON.stringify(q))),
          )
        : ''

    return {
      content: (
        <SimpleToolCallItem name="App Search" description={description} />
      ),
      collapsedPreview: description,
    }
  },
})

export const GetToolSchemasComponent = defineToolComponent({
  toolName: 'composio_get_tool_schemas',

  render(toolBlock: ToolBlock & { toolName: 'composio_get_tool_schemas' }): ToolRenderConfig {
    const input = toolBlock.input as {
      tool_slugs?: string[]
    } | undefined
    const toolSlugs = input?.tool_slugs ?? []
    const description = toolSlugs.length > 0 ? formatList(toolSlugs) : ''

    return {
      content: (
        <SimpleToolCallItem name="App Schemas" description={description} />
      ),
      collapsedPreview: description,
    }
  },
})
