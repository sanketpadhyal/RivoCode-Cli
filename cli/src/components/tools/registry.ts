import { ApplyPatchComponent } from './apply-patch'
import { CodeSearchComponent } from './code-search'
import {
  ManageConnectionsComponent,
  ExecuteToolComponent,
  SearchToolsComponent,
  GetToolSchemasComponent,
} from './composio'
import { GlobComponent } from './glob'
import { GravityIndexComponent } from './gravity-index'
import { ListDirectoryComponent } from './list-directory'
import { ReadDocsComponent } from './read-docs'
import { ReadFilesComponent } from './read-files'
import { ReadSubtreeComponent } from './read-subtree'
import { ReadURLComponent } from './read-url'
import { RenderUIComponent } from './render-ui'
import { WebSearchComponent } from './web-search'
import { RunTerminalCommandComponent } from './run-terminal-command'
import { SkillComponent } from './skill'
import { StrReplaceComponent } from './str-replace'
import { SuggestFollowupsComponent } from './suggest-followups'
import { TaskCompleteComponent } from './task-completed'
import { WriteFileComponent } from './write-file'
import { WriteTodosComponent } from './write-todos'

import type {
  ToolComponent,
  ToolRenderConfig,
  ToolRenderOptions,
  ToolBlock,
} from './types'
import type { ChatTheme } from '../../types/theme-system'
import type { ToolName } from '@codebuff/sdk'

const toolComponentRegistry = new Map<ToolName, ToolComponent>([
  [ApplyPatchComponent.toolName, ApplyPatchComponent],
  [CodeSearchComponent.toolName, CodeSearchComponent],
  [ManageConnectionsComponent.toolName, ManageConnectionsComponent],
  [ExecuteToolComponent.toolName, ExecuteToolComponent],
  [SearchToolsComponent.toolName, SearchToolsComponent],
  [GetToolSchemasComponent.toolName, GetToolSchemasComponent],
  [GlobComponent.toolName, GlobComponent],
  [GravityIndexComponent.toolName, GravityIndexComponent],
  [ListDirectoryComponent.toolName, ListDirectoryComponent],
  [RunTerminalCommandComponent.toolName, RunTerminalCommandComponent],
  [ReadDocsComponent.toolName, ReadDocsComponent],
  [ReadFilesComponent.toolName, ReadFilesComponent],
  [ReadSubtreeComponent.toolName, ReadSubtreeComponent],
  [ReadURLComponent.toolName, ReadURLComponent],
  [RenderUIComponent.toolName, RenderUIComponent],
  [WebSearchComponent.toolName, WebSearchComponent],
  [WriteTodosComponent.toolName, WriteTodosComponent],
  [StrReplaceComponent.toolName, StrReplaceComponent],
  [SuggestFollowupsComponent.toolName, SuggestFollowupsComponent],
  [WriteFileComponent.toolName, WriteFileComponent],
  [TaskCompleteComponent.toolName, TaskCompleteComponent],
  ['propose_str_replace', StrReplaceComponent],
  ['propose_write_file', WriteFileComponent],
  [SkillComponent.toolName, SkillComponent],
])

export function registerToolComponent(component: ToolComponent): void {
  toolComponentRegistry.set(component.toolName, component)
}

export function getToolComponent(
  toolName: ToolName,
): ToolComponent | undefined {
  return toolComponentRegistry.get(toolName)
}

export function renderToolComponent(
  toolBlock: ToolBlock,
  theme: ChatTheme,
  options: ToolRenderOptions,
): ToolRenderConfig | undefined {
  const component = getToolComponent(toolBlock.toolName)

  if (component === undefined) {
    return undefined
  }

  try {
    return component.render(toolBlock as any, theme, options)
  } catch (error) {
    console.error(
      `Error rendering tool component for ${toolBlock.toolName}:`,
      error,
    )
    return undefined
  }
}

export function getRegisteredToolNames(): ToolName[] {
  return Array.from(toolComponentRegistry.keys())
}
