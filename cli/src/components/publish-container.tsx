import { pluralize } from '@codebuff/common/util/string'
import { TextAttributes } from '@opentui/core'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { AgentChecklist } from './agent-checklist'
import { Button } from './button'
import { MultilineInput, type MultilineInputHandle } from './multiline-input'
import { PublishConfirmation, getAllPublishAgentIds } from './publish-confirmation'
import { SelectedChips } from './selected-chips'
import { Separator } from './separator'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { usePublishStore } from '../state/publish-store'
import { loadLocalAgents, loadAgentDefinitions } from '../utils/local-agent-registry'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'
import { BORDER_CHARS } from '../utils/ui-constants'

interface PublishContainerProps {
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  onExitPublish?: () => void
  onPublish: (agentIds: string[]) => Promise<void>
  width: number
}

export const PublishContainer: React.FC<PublishContainerProps> = ({
  inputRef,
  onExitPublish,
  onPublish,
  width,
}) => {
  const theme = useTheme()
  const { width: widthLayout, height: heightLayout } = useTerminalLayout()
  const isTooSmall = widthLayout.atMost('xs') || heightLayout.atMost('xs')
  const [closeButtonHovered, setCloseButtonHovered] = useState(false)
  const [nextButtonHovered, setNextButtonHovered] = useState(false)
  const [backButtonHovered, setBackButtonHovered] = useState(false)
  const [publishButtonHovered, setPublishButtonHovered] = useState(false)

  const {
    publishMode,
    selectedAgentIds,
    searchQuery,
    currentStep,
    focusedIndex,
    isPublishing,
    successResult,
    errorResult,
    includeDependents,
    toggleAgentSelection,
    setSearchQuery,
    goToConfirmation,
    goBackToSelection,
    setFocusedIndex,
    closePublish,
    setIncludeDependents,
  } = usePublishStore(
    useShallow((state) => ({
      publishMode: state.publishMode,
      selectedAgentIds: state.selectedAgentIds,
      searchQuery: state.searchQuery,
      currentStep: state.currentStep,
      focusedIndex: state.focusedIndex,
      isPublishing: state.isPublishing,
      successResult: state.successResult,
      errorResult: state.errorResult,
      includeDependents: state.includeDependents,
      toggleAgentSelection: state.toggleAgentSelection,
      setSearchQuery: state.setSearchQuery,
      goToConfirmation: state.goToConfirmation,
      goBackToSelection: state.goBackToSelection,
      setFocusedIndex: state.setFocusedIndex,
      closePublish: state.closePublish,
      setIncludeDependents: state.setIncludeDependents,
    })),
  )

  const inputFocused = useChatStore((state) => state.inputFocused)

  const agents = useMemo(() => loadLocalAgents().filter(a => !a.isBundled), [])
  const agentDefinitions = useMemo(() => {
    const defs = loadAgentDefinitions()
    const map = new Map<string, { spawnableAgents?: string[] }>()
    for (const def of defs) {
      map.set(def.id, { spawnableAgents: def.spawnableAgents })
    }
    return map
  }, [])

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents
    const query = searchQuery.toLowerCase()
    return agents.filter(
      (agent) =>
        agent.displayName.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query),
    )
  }, [agents, searchQuery])

  const selectedAgents = useMemo(() => {
    return agents.filter((a) => selectedAgentIds.has(a.id))
  }, [agents, selectedAgentIds])

  const canProceed = selectedAgentIds.size > 0

  const handleSearchKeyIntercept = useCallback(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      if (key.name === 'escape') {
        if (searchQuery.length > 0) {
          setSearchQuery('')
        } else {
          closePublish()
          onExitPublish?.()
        }
        return true
      }
      if (key.name === 'up') {
        setFocusedIndex(Math.max(0, focusedIndex - 1))
        return true
      }
      if (key.name === 'down') {
        setFocusedIndex(Math.min(filteredAgents.length - 1, focusedIndex + 1))
        return true
      }
      if (isPlainEnterKey(key)) {
        const agent = filteredAgents[focusedIndex]
        if (agent) {
          toggleAgentSelection(agent.id)
        }
        return true
      }
      if (key.name === 'tab' && !key.shift) {
        if (canProceed) {
          goToConfirmation()
        }
        return true
      }
      return false
    },
    [
      focusedIndex,
      filteredAgents,
      canProceed,
      searchQuery,
      setFocusedIndex,
      toggleAgentSelection,
      goToConfirmation,
      setSearchQuery,
      closePublish,
      onExitPublish,
    ],
  )

  const handleCancel = useCallback(() => {
    closePublish()
    onExitPublish?.()
  }, [closePublish, onExitPublish])

  const handleNext = useCallback(() => {
    if (canProceed) {
      goToConfirmation()
    }
  }, [canProceed, goToConfirmation])

  const handleBack = useCallback(() => {
    goBackToSelection()
  }, [goBackToSelection])

  const publishAgentIds = useMemo(
    () => getAllPublishAgentIds(selectedAgents, agents, agentDefinitions, includeDependents),
    [selectedAgents, agents, agentDefinitions, includeDependents]
  )

  const handlePublish = useCallback(async () => {
    await onPublish(publishAgentIds)
  }, [publishAgentIds, onPublish])

  useEffect(() => {
    if (publishMode && inputRef.current && currentStep === 'selection') {
      inputRef.current.focus()
    }
  }, [publishMode, inputRef, currentStep])

  useEffect(() => {
    if (!publishMode || currentStep === 'selection') return

    if (typeof process !== 'undefined' && process.stdin) {
      const stdin = process.stdin
      const onData = (data: Buffer) => {
        if (data[0] === 0x1b && data.length === 1) {
          handleCancel()
        }
      }
      stdin.on('data', onData)
      return () => {
        stdin.off('data', onData)
      }
    }
    return undefined
  }, [publishMode, currentStep, handleCancel])

  if (!publishMode) {
    return null
  }

  if (isTooSmall) {
    return (
      <box
        border
        borderStyle="single"
        borderColor={theme.info}
        customBorderChars={BORDER_CHARS}
        style={{
          flexDirection: 'column',
          gap: 1,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 1,
          paddingBottom: 1,
        }}
      >
        <text style={{ fg: theme.warning, attributes: TextAttributes.BOLD }}>
          Terminal too small
        </text>
        <text style={{ fg: theme.muted }}>
          Please resize your terminal to use the publish menu.
        </text>
        <Button
          onClick={handleCancel}
          style={{
            marginTop: 1,
            paddingLeft: 1,
            paddingRight: 1,
            borderStyle: 'single',
            borderColor: theme.border,
            customBorderChars: BORDER_CHARS,
          }}
        >
          <text style={{ fg: theme.foreground }}>CLOSE</text>
        </Button>
      </box>
    )
  }

  if (agents.length === 0) {
    return (
      <box
        border
        borderStyle="single"
        borderColor={theme.info}
        customBorderChars={BORDER_CHARS}
        style={{
          flexDirection: 'column',
          gap: 1,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 1,
          paddingBottom: 1,
        }}
      >
        <text style={{ fg: theme.warning, attributes: TextAttributes.BOLD }}>
          No agents found
        </text>
        <text style={{ fg: theme.muted }}>
          Create agents in the .agents/ directory to publish them.
        </text>
        <text style={{ fg: theme.muted }}>
          See: https://codebuff.com/docs/agents for guidance.
        </text>
        <Button
          onClick={handleCancel}
          style={{
            marginTop: 1,
            paddingLeft: 1,
            paddingRight: 1,
            borderStyle: 'single',
            borderColor: theme.border,
            customBorderChars: BORDER_CHARS,
          }}
        >
          <text style={{ fg: theme.foreground }}>CLOSE</text>
        </Button>
      </box>
    )
  }

  return (
    <box
      border
      borderStyle="single"
      borderColor={theme.info}
      customBorderChars={BORDER_CHARS}
      style={{
        flexDirection: 'column',
        gap: 0,
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
          justifyContent: 'space-between',
          marginTop: 1,
        }}
      >
        <text style={{ wrapMode: 'none', marginLeft: 1, marginRight: 1 }}>
          <span fg={theme.secondary}>
            {currentStep === 'selection' && (selectedAgents.length > 0
              ? `Selected ${pluralize(selectedAgents.length, 'agent')} to publish`
              : 'Select agents to publish')}
            {currentStep === 'confirmation' && 'Confirm publish'}
            {currentStep === 'success' && 'Publish complete'}
            {currentStep === 'error' && 'Publish failed'}
          </span>
        </text>
        <box
          style={{ paddingRight: 1 }}
          onMouseDown={handleCancel}
          onMouseOver={() => setCloseButtonHovered(true)}
          onMouseOut={() => setCloseButtonHovered(false)}
        >
          <text style={{ wrapMode: 'none' }} selectable={false}>
            <span fg={closeButtonHovered ? theme.foreground : theme.secondary}>
              [x]
            </span>
          </text>
        </box>
      </box>

      {currentStep === 'selection' && (
        <>
          <Separator width={width} widthOffset={4} />
          <box style={{ paddingTop: 0, paddingBottom: 0 }}>
            <MultilineInput
              value={searchQuery}
              onChange={({ text }) => setSearchQuery(text)}
              onSubmit={handleNext}
              onPaste={() => {}}
              onKeyIntercept={handleSearchKeyIntercept}
              placeholder="Type to search agents..."
              focused={inputFocused}
              maxHeight={1}
              minHeight={1}
              ref={inputRef}
              cursorPosition={searchQuery.length}
            />
          </box>
          <Separator width={width} widthOffset={4} />

          {selectedAgents.length > 0 && (
            <>
              <SelectedChips
                selectedAgents={selectedAgents.map((a) => ({
                  id: a.id,
                  displayName: a.displayName,
                }))}
                onRemove={toggleAgentSelection}
              />
              <Separator width={width} widthOffset={4} />
            </>
          )}

          <AgentChecklist
            allAgents={agents}
            filteredAgents={filteredAgents}
            selectedIds={selectedAgentIds}
            searchQuery={searchQuery}
            focusedIndex={focusedIndex}
            onToggleAgent={toggleAgentSelection}
            onFocusChange={setFocusedIndex}
            agentDefinitions={agentDefinitions}
          />

          <Separator width={width} widthOffset={4} />
          <box
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <text style={{ fg: theme.muted }}>
              ↑↓ navigate • Enter toggle • Tab next
            </text>
            <Button
              onClick={handleNext}
              onMouseOver={() => setNextButtonHovered(true)}
              onMouseOut={() => setNextButtonHovered(false)}
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: canProceed ? theme.foreground : theme.border,
                customBorderChars: BORDER_CHARS,
                backgroundColor: 'transparent',
              }}
            >
              <text
                style={{ wrapMode: 'none' }}
                attributes={
                  canProceed
                    ? undefined
                    : TextAttributes.DIM | TextAttributes.ITALIC
                }
              >
                <span
                  fg={
                    canProceed
                      ? nextButtonHovered
                        ? theme.primary
                        : theme.foreground
                      : theme.muted
                  }
                >
                  NEXT
                </span>
              </text>
            </Button>
          </box>
        </>
      )}

      {currentStep === 'confirmation' && (
        <>
          <Separator width={width} widthOffset={4} />
          <box style={{ paddingTop: 1, paddingBottom: 1 }}>
            <PublishConfirmation
              selectedAgents={selectedAgents}
              allAgents={agents}
              agentDefinitions={agentDefinitions}
              includeDependents={includeDependents}
              onToggleDependents={() => setIncludeDependents(!includeDependents)}
            />
          </box>

          <Separator width={width} widthOffset={4} />
          <box
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 0,
              paddingBottom: 0,
              gap: 2,
            }}
          >
            <Button
              onClick={handleBack}
              onMouseOver={() => setBackButtonHovered(true)}
              onMouseOut={() => setBackButtonHovered(false)}
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: theme.border,
                customBorderChars: BORDER_CHARS,
                backgroundColor: 'transparent',
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span
                  fg={backButtonHovered ? theme.foreground : theme.secondary}
                >
                  BACK
                </span>
              </text>
            </Button>
            <Button
              onClick={handlePublish}
              onMouseOver={() => setPublishButtonHovered(true)}
              onMouseOut={() => setPublishButtonHovered(false)}
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: isPublishing ? theme.border : theme.success,
                customBorderChars: BORDER_CHARS,
                backgroundColor: 'transparent',
              }}
            >
              <text
                style={{ wrapMode: 'none' }}
                attributes={isPublishing ? TextAttributes.DIM : undefined}
              >
                <span
                  fg={
                    isPublishing
                      ? theme.muted
                      : publishButtonHovered
                        ? theme.success
                        : theme.foreground
                  }
                >
                  {isPublishing ? 'PUBLISHING...' : `PUBLISH ${pluralize(publishAgentIds.length, 'AGENT')}`}
                </span>
              </text>
            </Button>
          </box>
        </>
      )}

      {currentStep === 'success' && successResult && (
        <>
          <Separator width={width} widthOffset={4} />
          <box style={{ paddingTop: 1, paddingBottom: 1, flexDirection: 'column', gap: 1 }}>
            <box style={{ flexDirection: 'row', gap: 1 }}>
              <text style={{ fg: theme.success }}>✓</text>
              <text style={{ fg: theme.foreground, attributes: TextAttributes.BOLD }}>
                Successfully published {successResult.agents.length} agent{successResult.agents.length !== 1 ? 's' : ''}!
              </text>
            </box>

            <box style={{ flexDirection: 'column', gap: 0, paddingLeft: 2 }}>
              {successResult.agents.map((agent) => (
                <box key={agent.id} style={{ flexDirection: 'row', gap: 1 }}>
                  <text style={{ fg: theme.muted }}>•</text>
                  <text style={{ fg: theme.foreground }}>
                    {agent.displayName}
                  </text>
                  <text style={{ fg: theme.secondary }}>
                    ({successResult.publisherId}/{agent.id}@{agent.version})
                  </text>
                </box>
              ))}
            </box>
          </box>

          <Separator width={width} widthOffset={4} />
          <box
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <Button
              onClick={handleCancel}
              onMouseOver={() => setCloseButtonHovered(true)}
              onMouseOut={() => setCloseButtonHovered(false)}
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: theme.success,
                customBorderChars: BORDER_CHARS,
                backgroundColor: 'transparent',
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg={closeButtonHovered ? theme.success : theme.foreground}>
                  DONE
                </span>
              </text>
            </Button>
          </box>
        </>
      )}

      {currentStep === 'error' && errorResult && (
        <>
          <Separator width={width} widthOffset={4} />
          <box style={{ paddingTop: 1, paddingBottom: 1, flexDirection: 'column', gap: 1 }}>
            <box style={{ flexDirection: 'row', gap: 1 }}>
              <text style={{ fg: theme.error }}>✗</text>
              <text style={{ fg: theme.error, attributes: TextAttributes.BOLD }}>
                Publish failed
              </text>
            </box>

            <box style={{ flexDirection: 'column', gap: 0, paddingLeft: 2 }}>
              {errorResult.error && (
                <text style={{ fg: theme.foreground }}>{errorResult.error}</text>
              )}
              {errorResult.details && (
                <text style={{ fg: theme.muted }}>{errorResult.details}</text>
              )}
              {errorResult.hint && (
                <text style={{ fg: theme.warning, marginTop: 1 }}>💡 {errorResult.hint}</text>
              )}
            </box>
          </box>

          <Separator width={width} widthOffset={4} />
          <box
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <Button
              onClick={handleBack}
              onMouseOver={() => setBackButtonHovered(true)}
              onMouseOut={() => setBackButtonHovered(false)}
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: theme.border,
                customBorderChars: BORDER_CHARS,
                backgroundColor: 'transparent',
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg={backButtonHovered ? theme.foreground : theme.secondary}>
                  TRY AGAIN
                </span>
              </text>
            </Button>
            <Button
              onClick={handleCancel}
              onMouseOver={() => setCloseButtonHovered(true)}
              onMouseOut={() => setCloseButtonHovered(false)}
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: theme.border,
                customBorderChars: BORDER_CHARS,
                backgroundColor: 'transparent',
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg={closeButtonHovered ? theme.foreground : theme.secondary}>
                  CLOSE
                </span>
              </text>
            </Button>
          </box>
        </>
      )}
    </box>
  )
}
