import { TextAttributes } from '@opentui/core'
import React, { memo, useCallback, useMemo, useState } from 'react'

const CARD_HORIZONTAL_PADDING = 4
const STATS_BAR_WIDTH = 5
const MIN_INNER_WIDTH = 10

const EMPTY_STATE_LABELS = {
  running: 'generating...',
  complete: 'no changes',
  failed: 'failed',
  cancelled: 'cancelled',
} as const

import { useGridLayout } from '../../hooks/use-grid-layout'
import { useTheme } from '../../hooks/use-theme'
import { getAgentStatusInfo } from '../../utils/agent-helpers'
import {
  buildActivityTimeline,
  getImplementorDisplayName,
  getImplementorIndex,
  getFileStatsFromBlocks,
  truncateWithEllipsis,
  type FileStats,
} from '../../utils/implementor-helpers'
import { getRelativePath } from '../../utils/path-helpers'
import { PROPOSAL_BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'
import { CollapseButton } from '../collapse-button'
import { DiffViewer } from '../tools/diff-viewer'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

interface ImplementorGroupProps {
  implementors: AgentContentBlock[]
  siblingBlocks: ContentBlock[]
  availableWidth: number
}

export const ImplementorGroup = memo(
  ({ implementors, siblingBlocks, availableWidth }: ImplementorGroupProps) => {
    const { columnWidth: cardWidth, columnGroups } = useGridLayout(
      implementors,
      availableWidth,
    )

    return (
      <box
        style={{
          flexDirection: 'column',
          gap: 1,
          width: '100%',
          marginTop: 1,
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            gap: 1,
            width: '100%',
            alignItems: 'flex-start',
          }}
        >
          {columnGroups.map((columnItems, colIdx) => {
            const columnKey = columnItems[0]?.agentId ?? `col-${colIdx}`
            return (
              <box
                key={columnKey}
                style={{
                  flexDirection: 'column',
                  gap: 0,
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 0,
                  minWidth: 0,
                }}
              >
                {columnItems.map((agentBlock) => {
                  const implementorIndex = getImplementorIndex(
                    agentBlock,
                    siblingBlocks,
                  )

                  return (
                    <ImplementorCard
                      key={agentBlock.agentId}
                      agentBlock={agentBlock}
                      implementorIndex={implementorIndex}
                      cardWidth={cardWidth}
                    />
                  )
                })}
              </box>
            )
          })}
        </box>
      </box>
    )
  },
)

interface ImplementorCardProps {
  agentBlock: AgentContentBlock
  implementorIndex?: number
  cardWidth: number
}

const ImplementorCard = memo(
  ({ agentBlock, implementorIndex, cardWidth }: ImplementorCardProps) => {
    const theme = useTheme()
    const [selectedFile, setSelectedFile] = useState<string | null>(null)

    const isComplete = agentBlock.status === 'complete'

    const displayName = getImplementorDisplayName(
      agentBlock.agentType,
      implementorIndex,
    )

    const fileStats = useMemo(
      () => getFileStatsFromBlocks(agentBlock.blocks),
      [agentBlock.blocks],
    )

    const timeline = useMemo(
      () => buildActivityTimeline(agentBlock.blocks),
      [agentBlock.blocks],
    )

    const fileDiffs = useMemo(() => {
      const diffs = new Map<string, string>()
      for (const item of timeline) {
        if (item.type === 'edit' && item.diff) {
          diffs.set(item.content, item.diff)
        }
      }
      return diffs
    }, [timeline])

    const {
      indicator: statusIndicator,
      label: statusLabel,
      color: statusColor,
    } = getAgentStatusInfo(agentBlock.status, theme)
    const statusText =
      statusIndicator === '✓'
        ? `${statusLabel} ${statusIndicator}`
        : `${statusIndicator} ${statusLabel}`

    const innerWidth = Math.max(
      MIN_INNER_WIDTH,
      cardWidth - CARD_HORIZONTAL_PADDING,
    )

    const handleFileSelect = useCallback((filePath: string) => {
      setSelectedFile((prev) => (prev === filePath ? null : filePath))
    }, [])

    return (
      <box
        border
        borderStyle="single"
        customBorderChars={PROPOSAL_BORDER_CHARS}
        borderColor={isComplete ? theme.muted : theme.primary}
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
            width: '100%',
          }}
        >
          <text
            fg={theme.foreground}
            attributes={TextAttributes.BOLD}
            style={{ wrapMode: 'none' }}
          >
            {displayName}
          </text>
          <text
            fg={statusColor}
            attributes={TextAttributes.DIM}
            style={{ wrapMode: 'none' }}
          >
            {statusText}
          </text>
        </box>

        {agentBlock.initialPrompt && (
          <box style={{ marginTop: 1, width: '100%' }}>
            <text fg={theme.muted} attributes={TextAttributes.ITALIC}>
              {agentBlock.initialPrompt}
            </text>
          </box>
        )}

        {fileStats.length > 0 && (
          <CompactFileStats
            fileStats={fileStats}
            availableWidth={innerWidth}
            selectedFile={selectedFile}
            onSelectFile={handleFileSelect}
            fileDiffs={fileDiffs}
          />
        )}

        {fileStats.length === 0 && (
          <text
            fg={theme.muted}
            attributes={TextAttributes.ITALIC}
            style={{ marginTop: 1 }}
          >
            {EMPTY_STATE_LABELS[agentBlock.status]}
          </text>
        )}
      </box>
    )
  },
)

interface CompactFileStatsProps {
  fileStats: FileStats[]
  availableWidth: number
  selectedFile: string | null
  onSelectFile: (filePath: string) => void
  fileDiffs: Map<string, string>
}

const CompactFileStats = memo(
  ({
    fileStats,
    availableWidth,
    selectedFile,
    onSelectFile,
    fileDiffs,
  }: CompactFileStatsProps) => {
    const theme = useTheme()

    const maxBarWidth = STATS_BAR_WIDTH

    const maxAddedStrWidth = Math.max(
      ...fileStats.map((f) => `+${f.stats.linesAdded}`.length),
      2,
    )
    const maxRemovedStrWidth = Math.max(
      ...fileStats.map((f) => `-${f.stats.linesRemoved}`.length),
      2,
    )

    return (
      <box style={{ flexDirection: 'column', marginTop: 1 }}>
        {fileStats.map((file, idx) => (
          <CompactFileRow
            key={`${file.path}-${idx}`}
            file={file}
            availableWidth={availableWidth}
            maxBarWidth={maxBarWidth}
            maxAddedStrWidth={maxAddedStrWidth}
            maxRemovedStrWidth={maxRemovedStrWidth}
            isSelected={selectedFile === file.path}
            onSelect={() => onSelectFile(file.path)}
            diff={fileDiffs.get(file.path)}
          />
        ))}
      </box>
    )
  },
)

interface CompactFileRowProps {
  file: FileStats
  availableWidth: number
  maxBarWidth: number
  maxAddedStrWidth: number
  maxRemovedStrWidth: number
  isSelected: boolean
  onSelect: () => void
  diff?: string
}

const CompactFileRow = memo(
  ({
    file,
    availableWidth,
    maxBarWidth,
    maxAddedStrWidth,
    maxRemovedStrWidth,
    isSelected,
    onSelect,
    diff,
  }: CompactFileRowProps) => {
    const theme = useTheme()
    const [isHovered, setIsHovered] = useState(false)

    const addedStr = `+${file.stats.linesAdded}`
    const removedStr = `-${file.stats.linesRemoved}`

    const addedSectionWidth = maxBarWidth + maxAddedStrWidth
    const removedSectionWidth = maxBarWidth + maxRemovedStrWidth

    const addedContent = (addedStr + ' ').padStart(addedSectionWidth)
    const removedContent = (' ' + removedStr).padEnd(removedSectionWidth)

    const barWidth = 2 * maxBarWidth + maxAddedStrWidth + maxRemovedStrWidth
    const fixedWidth = 1 + 2 + 2 + barWidth
    const maxFilePathWidth = Math.max(10, availableWidth - fixedWidth)

    const relativePath = getRelativePath(file.path)
    const displayPath = truncateWithEllipsis(relativePath, maxFilePathWidth)

    return (
      <box style={{ flexDirection: 'column' }}>
        <box style={{ flexDirection: 'row', alignItems: 'center' }}>
          <text fg={theme.muted} style={{ flexShrink: 0 }}>
            {file.changeType}
          </text>
          <text style={{ flexShrink: 0 }}> </text>

          <Button
            onClick={onSelect}
            onMouseOver={() => setIsHovered(true)}
            onMouseOut={() => setIsHovered(false)}
            style={{
              paddingLeft: 0,
              paddingRight: 0,
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 0,
            }}
          >
            <text
              fg={theme.foreground}
              attributes={
                isHovered || isSelected ? TextAttributes.UNDERLINE : undefined
              }
              style={{
                wrapMode: 'none',
              }}
            >
              {displayPath}
            </text>
          </Button>
          <text style={{ flexShrink: 0 }}> </text>

          <text style={{ flexShrink: 0, wrapMode: 'none' }}>
            <span fg={theme.foreground} bg="#3A5A3A">
              {addedContent}
            </span>
            <span fg={theme.foreground} bg="#5A3A3A">
              {removedContent}
            </span>
          </text>
        </box>

        {isSelected && diff && (
          <box style={{ flexDirection: 'column', marginTop: 1, width: '100%' }}>
            <box
              style={{
                flexDirection: 'column',
                width: '100%',
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 1,
                paddingBottom: 1,
                backgroundColor: theme.surface,
              }}
            >
              <DiffViewer diffText={diff} />
            </box>
            <CollapseButton onClick={onSelect} />
          </box>
        )}
      </box>
    )
  },
)

export { ImplementorCard as ImplementorRow }
