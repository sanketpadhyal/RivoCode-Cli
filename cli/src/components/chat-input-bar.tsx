import {
  isShallowScanRoot,
  SHALLOW_SCAN_MAX_DEPTH,
} from '@rivocode/common/project-file-tree'
import React from 'react'

import { AgentModeToggle } from './agent-mode-toggle'
import { Button } from './button'
import { ClickableTitleBox } from './clickable-title-box'
import { CommandPermissionPrompt } from './command-permission-prompt'
import { MultipleChoiceForm } from './ask-user'
import { FeedbackContainer } from './feedback-container'
import { InputModeBanner } from './input-mode-banner'
import { MultilineInput, type MultilineInputHandle } from './multiline-input'
import { OutOfCreditsBanner } from './out-of-credits-banner'
import { PublishContainer } from './publish-container'
import { SuggestionMenu, type SuggestionItem } from './suggestion-menu'
import { TextAttributes } from '@opentui/core'
import { useAskUserBridge } from '../hooks/use-ask-user-bridge'
import { useEvent } from '../hooks/use-event'
import { tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { shouldInterceptChatInputKey } from '../utils/chat-input-key-intercept'
import { getInputModeConfig } from '../utils/input-modes'
import { getTokenStats } from '../utils/context-compactor'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { useTheme } from '../hooks/use-theme'
import type { InputValue, TerminalSession } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { MouseEvent } from '@opentui/core'

type Theme = ReturnType<typeof useTheme>

interface ChatInputBarProps {
  inputValue: string
  cursorPosition: number
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  inputFocused: boolean
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  inputPlaceholder: string
  lastEditDueToNav: boolean

  agentMode: AgentMode
  toggleAgentMode: () => void
  setAgentMode: (mode: AgentMode) => void

  hasSlashSuggestions: boolean
  hasMentionSuggestions: boolean
  hasSuggestionMenu: boolean
  slashSuggestionItems: SuggestionItem[]
  agentSuggestionItems: SuggestionItem[]
  fileSuggestionItems: SuggestionItem[]
  slashSelectedIndex: number
  agentSelectedIndex: number
  onSlashItemClick?: (index: number) => void
  onMentionItemClick?: (index: number) => void

  theme: Theme
  terminalHeight: number
  separatorWidth: number
  shouldCenterInputVertically: boolean
  inputBoxTitle: string | undefined
  onQueuePreviewClick?: () => void
  isCompactHeight: boolean
  isNarrowWidth: boolean

  feedbackMode: boolean
  handleExitFeedback: () => void

  publishMode: boolean
  handleExitPublish: () => void
  handlePublish: (agentIds: string[]) => Promise<void>

  handleSubmit: () => Promise<void>
  onPaste: (fallbackText?: string) => void
  onInterruptStream: () => void
}

export const ChatInputBar = ({
  inputValue,
  cursorPosition,
  setInputValue,
  inputFocused,
  inputRef,
  inputPlaceholder,
  lastEditDueToNav,
  agentMode,
  toggleAgentMode,
  setAgentMode,
  hasSlashSuggestions,
  hasMentionSuggestions,
  hasSuggestionMenu,
  slashSuggestionItems,
  agentSuggestionItems,
  fileSuggestionItems,
  slashSelectedIndex,
  agentSelectedIndex,
  onSlashItemClick,
  onMentionItemClick,
  theme,
  terminalHeight,
  separatorWidth,
  shouldCenterInputVertically,
  inputBoxTitle,
  onQueuePreviewClick,
  isCompactHeight,
  isNarrowWidth,
  feedbackMode,
  handleExitFeedback,
  publishMode,
  handleExitPublish,
  handlePublish,
  handleSubmit,
  onPaste,
  onInterruptStream,
}: ChatInputBarProps) => {
  const inputMode = useChatStore((state) => state.inputMode)
  const setInputMode = useChatStore((state) => state.setInputMode)
  const autoAcceptEdits = useChatStore((state) => state.autoAcceptEdits)
  const messages = useChatStore((state) => state.messages)
  const selectedModel = useChatStore((state) => state.selectedModel)
  const tokenStats = getTokenStats(messages, selectedModel)
  const sessions = useChatStore((state) => state.terminalSessions)
  const activeSession =
    sessions.find((s: TerminalSession) => s.status === 'running') ||
    (sessions.length > 0 ? sessions[0] : null)

  const modeConfig = getInputModeConfig(inputMode)
  const askUserState = useChatStore((state) => state.askUserState)
  const hasAnyPreview = hasSuggestionMenu

  const mentionMenuFooter = isShallowScanRoot(tryGetProjectRoot())
    ? `Files shown up to ${SHALLOW_SCAN_MAX_DEPTH} levels deep — open a project folder for full results`
    : undefined

  const normalModeMaxVisible = terminalHeight > 35 ? 15 : 10
  const { submitAnswers, skip } = useAskUserBridge()
  const [askUserTitle] = React.useState(' Some questions for you ')

  const handleKeyIntercept = useEvent(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      return shouldInterceptChatInputKey(key, {
        hasSlashSuggestions,
        hasMentionSuggestions,
        lastEditDueToNav,
        cursorPosition,
        inputLength: inputValue.length,
      })
    },
  )

  if (feedbackMode) {
    return (
      <FeedbackContainer
        inputRef={inputRef}
        onExitFeedback={handleExitFeedback}
        width={separatorWidth}
      />
    )
  }

  if (publishMode) {
    return (
      <PublishContainer
        inputRef={inputRef}
        onExitPublish={handleExitPublish}
        onPublish={handlePublish}
        width={separatorWidth}
      />
    )
  }

  if (inputMode === 'outOfCredits') {
    return <OutOfCreditsBanner />
  }

  if (inputMode === 'subscriptionLimit') {
    return <InputModeBanner />
  }

  const handleInputChange = (value: InputValue) => {
    if (inputMode === 'default' && value.text === '!') {
      setInputMode('bash')
      setInputValue({
        text: '',
        cursorPosition: 0,
        lastEditDueToNav: value.lastEditDueToNav,
      })
      return
    }

    // Check if input contains an image file path (from terminal paste or drag)
    const imagePathRegex = /(?:'|")?(\/(?:[^\n'"\0]+\/)*(?:Screenshot|clipboard|[^\n'"\0]+)\.(?:png|jpe?g|webp|gif|bmp|tiff))(?:'|")?/i
    const match = value.text.match(imagePathRegex)
    if (match && match[1]) {
      const extractedPath = match[1].replace(/\\ /g, ' ').trim()
      const textWithoutPath = value.text.replace(match[0], '').replace(/\[Image \d+\]\s*/g, '').trim()

      setInputValue({
        text: textWithoutPath,
        cursorPosition: textWithoutPath.length,
        lastEditDueToNav: false,
      })

      onPaste(extractedPath)
      return
    }

    setInputValue(value)
  }

  const handleFormSubmit = (
    answers: { question: string; answer: string }[],
  ) => {
    if (!askUserState) return

    const formattedAnswers = askUserState.questions.map((q, idx) => {
      const answerObj = answers[idx]
      if (!answerObj || answerObj.answer === 'Skipped') {
        return { questionIndex: idx }
      }

      if (q.multiSelect) {
        const selectedOptions = answerObj.answer.split(', ').filter(Boolean)

        const allMatchKnownOptions = selectedOptions.every((selected) =>
          q.options.some((opt) => {
            const label = typeof opt === 'string' ? opt : opt.label
            return label === selected
          }),
        )

        if (allMatchKnownOptions && selectedOptions.length > 0) {
          return {
            questionIndex: idx,
            selectedOptions,
          }
        }

        return {
          questionIndex: idx,
          otherText: answerObj.answer,
        }
      }

      const matchingOptionIndex = q.options.findIndex((opt) => {
        const label = typeof opt === 'string' ? opt : opt.label
        return label === answerObj.answer
      })

      if (matchingOptionIndex >= 0) {
        return {
          questionIndex: idx,
          selectedOption: answerObj.answer,
        }
      }

      return {
        questionIndex: idx,
        otherText: answerObj.answer,
      }
    })

    submitAnswers(formattedAnswers)
  }

  const handleFormSkip = () => {
    if (!askUserState) return
    skip()
    onInterruptStream()
  }

  const effectivePlaceholder =
    inputMode === 'default' ? inputPlaceholder : modeConfig.placeholder
  const borderColor = theme[modeConfig.color]

  if (askUserState) {
    const isCommand = askUserState.questions[0]?.header === 'Command'
    if (isCommand) {
      const q = askUserState.questions[0]
      const rawOptions = q.options.map((opt) => (typeof opt === 'string' ? opt : opt.label))
      return (
        <CommandPermissionPrompt
          question={q.question}
          options={rawOptions}
          modelName={useChatStore.getState().selectedModel || 'Gemini 3.6 Flash'}
          agentMode={agentMode || 'high'}
          onSubmit={(selectedAnswer) => {
            submitAnswers([
              {
                questionIndex: 0,
                selectedOption: selectedAnswer,
              },
            ])
          }}
          onCancel={handleFormSkip}
        />
      )
    }

    return (
      <box
        title={askUserTitle}
        titleAlignment="center"
        style={{
          width: '100%',
          borderStyle: 'single',
          borderColor: theme.primary,
          customBorderChars: BORDER_CHARS,
        }}
      >
        <MultipleChoiceForm
          questions={askUserState.questions}
          onSubmit={handleFormSubmit}
          onSkip={handleFormSkip}
        />
      </box>
    )
  }

  if (isCompactHeight) {
    const compactMaxHeight = Math.floor(terminalHeight / 2)
    return (
      <>
        {hasSlashSuggestions ? (
          <SuggestionMenu
            items={slashSuggestionItems}
            selectedIndex={slashSelectedIndex}
            maxVisible={5}
            prefix="/"
            onItemClick={onSlashItemClick}
          />
        ) : null}
        {hasMentionSuggestions ? (
          <SuggestionMenu
            items={[...agentSuggestionItems, ...fileSuggestionItems]}
            selectedIndex={agentSelectedIndex}
            maxVisible={5}
            prefix="@"
            onItemClick={onMentionItemClick}
            footer={mentionMenuFooter}
          />
        ) : null}
        {inputBoxTitle && onQueuePreviewClick && (
          <Button
            onClick={(event) => {
              if ((event as MouseEvent | undefined)?.button === 0) {
                onQueuePreviewClick()
              }
            }}
            style={{
              width: '100%',
              height: 1,
              paddingLeft: 1,
              paddingRight: 1,
              backgroundColor: theme.surface,
              overflow: 'hidden',
            }}
          >
            <text style={{ fg: theme.muted, wrapMode: 'none' }}>
              {inputBoxTitle.trim()}
            </text>
          </Button>
        )}
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: '100%',
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: theme.surface,
          }}
        >
          {modeConfig.label && (
            <box style={{ flexShrink: 0, paddingRight: 1 }}>
              <text>
                <span
                  bg={theme.info}
                  fg={theme.background}
                >{` ${modeConfig.label} `}</span>
              </text>
            </box>
          )}
          {modeConfig.icon && (
            <box
              style={{
                flexShrink: 0,
                paddingRight: 1,
              }}
            >
              <text style={{ fg: theme[modeConfig.color] }}>
                {modeConfig.icon}
              </text>
            </box>
          )}
          {!modeConfig.label && !modeConfig.icon && (
            <box style={{ flexShrink: 0, paddingRight: 1 }}>
              <text style={{ fg: '#facc15' }}>❯</text>
            </box>
          )}
          <MultilineInput
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            onPaste={onPaste}
            onKeyIntercept={handleKeyIntercept}
            placeholder={effectivePlaceholder}
            focused={inputFocused && !feedbackMode}
            maxHeight={compactMaxHeight}
            ref={inputRef}
            cursorPosition={cursorPosition}
          />
        </box>
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <box style={{ flexDirection: 'row', alignItems: 'center' }}>
            {activeSession ? (
              <text style={{ wrapMode: 'none' }}>
                <span
                  fg={activeSession.status === 'running' ? '#38bdf8' : '#94a3b8'}
                  attributes={TextAttributes.BOLD}
                >
                  {`{} [Terminal: ${activeSession.command.slice(0, 20)}] `}
                </span>
                <span fg={activeSession.status === 'running' ? '#4ade80' : '#38bdf8'}>
                  {activeSession.status === 'running' ? '● Running ' : '✓ Done '}
                </span>
                <span fg={theme.muted}>
                  {'(Ctrl+O to view logs)'}
                </span>
              </text>
            ) : autoAcceptEdits ? (
              <text style={{ wrapMode: 'none' }}>
                <span fg="#f43f5e">
                  {'⚡ auto accept edits is on'}
                </span>
              </text>
            ) : null}
          </box>
          <box style={{ flexDirection: 'row', alignItems: 'center' }}>
            <text style={{ wrapMode: 'none' }}>
              <span fg={theme.muted}>
                {`◷ ${tokenStats.formattedTokens} / ${tokenStats.formattedMax} (${tokenStats.percent}%)`}
              </span>
            </text>
          </box>
        </box>
        <InputModeBanner />
      </>
    )
  }

  const widthToUse = separatorWidth || 80
  const dividerLine = '─'.repeat(Math.max(10, widthToUse))

  return (
    <>
      {hasSlashSuggestions ? (
        <SuggestionMenu
          items={slashSuggestionItems}
          selectedIndex={slashSelectedIndex}
          maxVisible={5}
          prefix="/"
          onItemClick={onSlashItemClick}
        />
      ) : null}
      {hasMentionSuggestions ? (
        <SuggestionMenu
          items={[...agentSuggestionItems, ...fileSuggestionItems]}
          selectedIndex={agentSelectedIndex}
          maxVisible={5}
          prefix="@"
          onItemClick={onMentionItemClick}
          footer={mentionMenuFooter}
        />
      ) : null}

      <box
        style={{
          width: '100%',
          flexDirection: 'column',
          gap: 0,
          marginTop: 0,
          marginBottom: 0,
        }}
      >
        {/* Top Claude-style divider line */}
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.border}>
            {dividerLine}
          </span>
        </text>

        {/* Input prompt row */}
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: '100%',
            paddingTop: 0,
            paddingBottom: 0,
          }}
        >
          {modeConfig.label && (
            <box style={{ flexShrink: 0, paddingRight: 1 }}>
              <text>
                <span
                  bg={theme.info}
                  fg={theme.background}
                >{` ${modeConfig.label} `}</span>
              </text>
            </box>
          )}
          {modeConfig.icon && (
            <box
              style={{
                flexShrink: 0,
                paddingRight: 1,
              }}
            >
              <text style={{ fg: theme[modeConfig.color] }}>
                {modeConfig.icon}
              </text>
            </box>
          )}
          {!modeConfig.label && !modeConfig.icon && (
            <box style={{ flexShrink: 0, paddingRight: 1 }}>
              <text style={{ fg: '#facc15' }}>❯</text>
            </box>
          )}
          <box style={{ flexGrow: 1, minWidth: 0 }}>
            <MultilineInput
              value={inputValue}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              onPaste={onPaste}
              onKeyIntercept={handleKeyIntercept}
              placeholder={effectivePlaceholder || 'Try "fix typecheck errors"'}
              focused={inputFocused && !feedbackMode}
              maxHeight={Math.floor(terminalHeight / 2)}
              ref={inputRef}
              cursorPosition={cursorPosition}
            />
          </box>
        </box>

        {/* Bottom Claude-style divider line */}
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.border}>
            {dividerLine}
          </span>
        </text>
      </box>

      {/* Status footer below bottom divider */}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          paddingLeft: 0,
          paddingRight: 0,
          marginTop: 0,
        }}
      >
        <box style={{ flexDirection: 'row', alignItems: 'center' }}>
          {activeSession ? (
            <text style={{ wrapMode: 'none' }}>
              <span
                fg={activeSession.status === 'running' ? '#38bdf8' : '#94a3b8'}
                attributes={TextAttributes.BOLD}
              >
                {`{} [Terminal: ${activeSession.command.slice(0, 26)}] `}
              </span>
              <span fg={activeSession.status === 'running' ? '#4ade80' : '#38bdf8'}>
                {activeSession.status === 'running' ? '● Running ' : '✓ Done '}
              </span>
              <span fg={theme.muted}>
                {'(Ctrl+O to view logs)'}
              </span>
            </text>
          ) : autoAcceptEdits ? (
            <text style={{ wrapMode: 'none' }}>
              <span fg="#f43f5e">
                {'◈ auto accept edits is on'}
              </span>
            </text>
          ) : null}
        </box>
        <box style={{ flexDirection: 'row', alignItems: 'center' }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.muted}>
              {`◷ ${tokenStats.formattedTokens} / ${tokenStats.formattedMax} (${tokenStats.percent}%)`}
            </span>
          </text>
        </box>
      </box>
      <InputModeBanner />
    </>
  )
}
