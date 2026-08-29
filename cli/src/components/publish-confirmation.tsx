import { TextAttributes } from '@opentui/core'
import React, { useMemo, useState } from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'
import { getSimpleAgentId } from '../utils/agent-id-utils'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { LocalAgentInfo } from '../utils/local-agent-registry'

interface PublishConfirmationProps {
  selectedAgents: LocalAgentInfo[]
  allAgents: LocalAgentInfo[]
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>
  includeDependents: boolean
  onToggleDependents: () => void
}

const SECTION_MAX_HEIGHT = 4

function computeDependencies(
  selectedAgentIds: Set<string>,
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>,
  localAgentIds: Set<string>,
): Set<string> {
  const dependencies = new Set<string>()
  const visited = new Set<string>()

  function collectDependencies(agentId: string) {
    if (visited.has(agentId)) return
    visited.add(agentId)

    const definition = agentDefinitions.get(agentId)
    const spawnableAgents = definition?.spawnableAgents ?? []

    for (const spawnableId of spawnableAgents) {
      const simpleId = getSimpleAgentId(spawnableId)
      if (localAgentIds.has(simpleId) && !selectedAgentIds.has(simpleId)) {
        dependencies.add(simpleId)
        collectDependencies(simpleId)
      }
    }
  }

  for (const agentId of selectedAgentIds) {
    collectDependencies(agentId)
  }

  return dependencies
}

function computeDependents(
  selectedAgentIds: Set<string>,
  dependencyIds: Set<string>,
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>,
  localAgentIds: Set<string>,
): Set<string> {
  const dependents = new Set<string>()
  const alreadyIncluded = new Set([...selectedAgentIds, ...dependencyIds])

  const spawnedBy = new Map<string, Set<string>>()
  for (const [agentId, definition] of agentDefinitions) {
    const spawnableAgents = definition.spawnableAgents ?? []
    for (const spawnableId of spawnableAgents) {
      const simpleId = getSimpleAgentId(spawnableId)
      if (!spawnedBy.has(simpleId)) {
        spawnedBy.set(simpleId, new Set())
      }
      spawnedBy.get(simpleId)!.add(agentId)
    }
  }

  const visited = new Set<string>()
  function findParents(agentId: string) {
    const parents = spawnedBy.get(agentId)
    if (!parents) return

    for (const parentId of parents) {
      if (visited.has(parentId)) continue
      visited.add(parentId)

      if (alreadyIncluded.has(parentId)) continue
      if (!localAgentIds.has(parentId)) continue

      dependents.add(parentId)
      findParents(parentId)
    }
  }

  for (const agentId of selectedAgentIds) {
    findParents(agentId)
  }

  return dependents
}

interface AgentSectionProps {
  title?: string
  titleInBorder?: boolean
  agents: Array<{ id: string; displayName: string }>
  theme: ReturnType<typeof useTheme>
  symbol: string
  symbolColor: string
  textColor: string
  maxHeight: number
  rightContent?: React.ReactNode
}

const AgentSection: React.FC<AgentSectionProps> = ({
  title,
  titleInBorder = false,
  agents,
  theme,
  symbol,
  symbolColor,
  textColor,
  maxHeight,
  rightContent,
}) => {
  const needsScroll = agents.length > maxHeight

  if (agents.length === 0 && !rightContent) {
    return null
  }

  const showHeader = (title && !titleInBorder) || rightContent

  const titleText = title ? `${title} (${agents.length})` : undefined

  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      {showHeader && (
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {title && !titleInBorder ? (
            <text style={{ fg: theme.secondary, attributes: TextAttributes.BOLD }}>
              {titleText}
            </text>
          ) : (
            <text></text>
          )}
          {rightContent}
        </box>
      )}

      {agents.length > 0 && (
        <box
          border
          borderStyle="single"
          borderColor={theme.border}
          customBorderChars={BORDER_CHARS}
          style={{
            flexDirection: 'column',
          }}
        >
          {titleInBorder && titleText && (
            <box style={{ paddingLeft: 1, paddingRight: 1 }}>
              <text style={{ fg: theme.secondary, attributes: TextAttributes.BOLD }}>
                {titleText}
              </text>
            </box>
          )}
          <scrollbox
            scrollX={false}
            scrollbarOptions={{ visible: false }}
            verticalScrollbarOptions={{
              visible: needsScroll,
              trackOptions: { width: 1 },
            }}
            style={{
              height: Math.min(agents.length, maxHeight),
              rootOptions: {
                flexDirection: 'row',
                backgroundColor: 'transparent',
              },
              wrapperOptions: {
                border: false,
                backgroundColor: 'transparent',
                flexDirection: 'column',
              },
              contentOptions: {
                flexDirection: 'column',
                gap: 0,
                backgroundColor: 'transparent',
                paddingLeft: 1,
                paddingRight: 1,
              },
            }}
          >
            {agents.map((agent) => {
              const displayText =
                agent.displayName !== agent.id
                  ? `${agent.displayName} (${agent.id})`
                  : agent.displayName

              return (
                <box key={agent.id} style={{ flexDirection: 'row', gap: 1 }}>
                  <text style={{ fg: symbolColor }}>{symbol}</text>
                  <text style={{ fg: textColor }}>{displayText}</text>
                </box>
              )
            })}
          </scrollbox>
        </box>
      )}
    </box>
  )
}

const DirectionLabel: React.FC<{ theme: ReturnType<typeof useTheme>; direction: 'up' | 'down' }> = ({ theme, direction }) => (
  <box style={{ flexDirection: 'column', alignItems: 'center', gap: 0 }}>
    <text style={{ fg: theme.border }}> │</text>
    <text style={{ fg: theme.muted }}>spawns</text>
    <text style={{ fg: theme.border }}> {direction === 'down' ? '↓' : '↑'}</text>
  </box>
)

export const PublishConfirmation: React.FC<PublishConfirmationProps> = ({
  selectedAgents,
  allAgents,
  agentDefinitions,
  includeDependents,
  onToggleDependents,
}) => {
  const theme = useTheme()
  const [toggleHovered, setToggleHovered] = useState(false)

  const selectedIds = useMemo(
    () => new Set(selectedAgents.map((a) => a.id)),
    [selectedAgents]
  )

  const localAgentIds = useMemo(
    () => new Set(allAgents.map((a) => a.id)),
    [allAgents]
  )

  const dependencyIds = useMemo(
    () => computeDependencies(selectedIds, agentDefinitions, localAgentIds),
    [selectedIds, agentDefinitions, localAgentIds]
  )

  const dependentIds = useMemo(
    () => computeDependents(selectedIds, dependencyIds, agentDefinitions, localAgentIds),
    [selectedIds, dependencyIds, agentDefinitions, localAgentIds]
  )

  const selectedList = useMemo(
    () =>
      selectedAgents.map((a) => ({
        id: a.id,
        displayName: a.displayName,
      })),
    [selectedAgents]
  )

  const dependencyList = useMemo(
    () =>
      Array.from(dependencyIds).map((id) => {
        const agent = allAgents.find((a) => a.id === id)
        return {
          id,
          displayName: agent?.displayName ?? id,
        }
      }),
    [dependencyIds, allAgents]
  )

  const dependentList = useMemo(
    () =>
      Array.from(dependentIds).map((id) => {
        const agent = allAgents.find((a) => a.id === id)
        return {
          id,
          displayName: agent?.displayName ?? id,
        }
      }),
    [dependentIds, allAgents]
  )

  const hasDependents = dependentList.length > 0
  const hasDependencies = dependencyList.length > 0

  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
        {hasDependents && (
          <>
            {includeDependents ? (
              <>
                <AgentSection
                  title="PARENTS"
                  titleInBorder
                  agents={dependentList}
                  theme={theme}
                  symbol="+"
                  symbolColor={theme.info}
                  textColor={theme.muted}
                  maxHeight={SECTION_MAX_HEIGHT}
                  rightContent={
                    <Button
                      onClick={onToggleDependents}
                      onMouseOver={() => setToggleHovered(true)}
                      onMouseOut={() => setToggleHovered(false)}
                      style={{
                        backgroundColor: 'transparent',
                        paddingLeft: 0,
                        paddingRight: 0,
                      }}
                    >
                      <text
                        style={{
                          fg: toggleHovered ? theme.error : theme.secondary,
                          attributes: toggleHovered ? TextAttributes.UNDERLINE : undefined,
                        }}
                      >
                        − remove
                      </text>
                    </Button>
                  }
                />
                <DirectionLabel theme={theme} direction="down" />
              </>
            ) : (
              <>
                <box style={{ alignItems: 'center' }}>
                  <Button
                    onClick={onToggleDependents}
                    onMouseOver={() => setToggleHovered(true)}
                    onMouseOut={() => setToggleHovered(false)}
                    style={{
                      backgroundColor: 'transparent',
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                    }}
                  >
                    <box
                      border
                      borderStyle="single"
                      borderColor={toggleHovered ? theme.info : theme.border}
                      customBorderChars={BORDER_CHARS}
                      style={{ paddingLeft: 1, paddingRight: 1 }}
                    >
                      <text
                        style={{
                          fg: toggleHovered ? theme.info : theme.muted,
                          attributes: toggleHovered ? TextAttributes.BOLD : undefined,
                        }}
                      >
                        ⊕ Add {dependentList.length} parent{dependentList.length !== 1 ? 's' : ''}
                      </text>
                    </box>
                  </Button>
                </box>
                <DirectionLabel theme={theme} direction="down" />
              </>
            )}
          </>
        )}

        <AgentSection
          title="SELECTED"
          titleInBorder
          agents={selectedList}
          theme={theme}
          symbol="✓"
          symbolColor={theme.success}
          textColor={theme.foreground}
          maxHeight={SECTION_MAX_HEIGHT}
        />

      {hasDependencies && (
        <>
          <DirectionLabel theme={theme} direction="down" />
          <AgentSection
            agents={dependencyList}
            theme={theme}
            symbol="+"
            symbolColor={theme.info}
            textColor={theme.muted}
            maxHeight={SECTION_MAX_HEIGHT}
          />
        </>
      )}
    </box>
  )
}

export function getAllPublishAgentIds(
  selectedAgents: LocalAgentInfo[],
  allAgents: LocalAgentInfo[],
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>,
  includeDependents: boolean = false,
): string[] {
  const publishableAgents = allAgents.filter((a) => !a.isBundled)
  const publishableSelectedAgents = selectedAgents.filter((a) => !a.isBundled)
  const localAgentIds = new Set(publishableAgents.map((a) => a.id))

  const selectedIds = new Set(publishableSelectedAgents.map((a) => a.id))
  const result = new Set<string>(selectedIds)

  function collectDependencies(agentId: string) {
    if (!localAgentIds.has(agentId)) return

    const definition = agentDefinitions.get(agentId)
    const spawnableAgents = definition?.spawnableAgents ?? []

    for (const spawnableId of spawnableAgents) {
      const simpleId = getSimpleAgentId(spawnableId)
      if (localAgentIds.has(simpleId) && !result.has(simpleId)) {
        result.add(simpleId)
        collectDependencies(simpleId)
      }
    }
  }

  for (const agent of publishableSelectedAgents) {
    collectDependencies(agent.id)
  }

  if (includeDependents) {
    const parentMap = new Map<string, string[]>()

    for (const [agentId, definition] of agentDefinitions) {
      if (!localAgentIds.has(agentId)) continue

      const spawnableAgents = definition.spawnableAgents ?? []
      for (const spawnableId of spawnableAgents) {
        const simpleId = getSimpleAgentId(spawnableId)
        if (!localAgentIds.has(simpleId)) continue

        const parents = parentMap.get(simpleId)
        if (parents) {
          parents.push(agentId)
        } else {
          parentMap.set(simpleId, [agentId])
        }
      }
    }

    const stack = Array.from(result)
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue

      const parents = parentMap.get(current) ?? []
      for (const parentId of parents) {
        if (result.has(parentId)) continue

        result.add(parentId)
        stack.push(parentId)
      }
    }
  }

  return Array.from(result)
}
