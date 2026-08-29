import type { ContentBlock } from '../../types/chat'
import type { ChatTheme } from '../../types/theme-system'
import type { ToolName } from '@codebuff/sdk'
import type { ReactNode } from 'react'

export type ToolBlock = Extract<ContentBlock, { type: 'tool' }>

export type ToolRenderOptions = {
  availableWidth: number
  indentationOffset: number
  previewPrefix?: string
  labelWidth: number
}

export type ToolRenderConfig = {
  path?: string
  content?: ReactNode
  collapsedPreview?: string
}

export interface ToolComponent<T extends ToolName = ToolName> {
  toolName: T

  render(
    toolBlock: ToolBlock & { toolName: T },
    theme: ChatTheme,
    options: ToolRenderOptions,
  ): ToolRenderConfig
}

export function defineToolComponent<T extends ToolName>(
  component: ToolComponent<T>,
): ToolComponent<T> {
  return component
}
