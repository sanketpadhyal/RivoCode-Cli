import { TextAttributes } from '@opentui/core'
import { memo, useState } from 'react'

import { BlocksRenderer } from './blocks/blocks-renderer'
import { UserContentWithCopyButton } from './blocks/user-content-copy'
import { Button } from './button'
import { FileAttachmentCard } from './file-attachment-card'
import { ImageCard } from './image-card'
import { MessageFooter } from './message-footer'
import { TextAttachmentCard } from './text-attachment-card'
import { UserErrorBanner } from './user-error-banner'
import { ValidationErrorPopover } from './validation-error-popover'
import { useTheme } from '../hooks/use-theme'
import { useWhyDidYouUpdateById } from '../hooks/use-why-did-you-update'
import { useChatStore } from '../state/chat-store'
import { getCliEnv } from '../utils/env'
import { type MarkdownPalette } from '../utils/markdown-renderer'
import { formatCwd } from '../utils/path-helpers'

import type { FeedbackCategory } from '@rivocode/common/constants/feedback'

import type {
  ContentBlock,
  FileAttachment,
  ImageAttachment,
  TextAttachment,
  ChatMessageMetadata,
} from '../types/chat'
import type { ThemeColor } from '../types/theme-system'

interface MessageBlockProps {
  messageId: string
  blocks?: ContentBlock[]
  content: string
  isUser: boolean
  isAi: boolean
  isLoading: boolean
  timestamp: string
  isComplete?: boolean
  completionTime?: string
  credits?: number
  timerStartTime: number | null
  textColor?: ThemeColor
  timestampColor: string
  markdownOptions: { codeBlockWidth: number; palette: MarkdownPalette }
  availableWidth: number
  markdownPalette: MarkdownPalette
  onToggleCollapsed: (id: string) => void
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
  onFeedback?: (messageId: string) => void
  onCloseFeedback?: () => void
  validationErrors?: Array<{ id: string; message: string }>
  userError?: string
  onOpenFeedback?: (options?: {
    category?: FeedbackCategory
    footerMessage?: string
    errors?: Array<{ id: string; message: string }>
  }) => void
  attachments?: ImageAttachment[]
  textAttachments?: TextAttachment[]
  fileAttachments?: FileAttachment[]
  metadata?: ChatMessageMetadata
  isLastMessage?: boolean
}

const MessageAttachments = memo(({
  imageAttachments,
  textAttachments,
  fileAttachments,
}: {
  imageAttachments: ImageAttachment[]
  textAttachments: TextAttachment[]
  fileAttachments: FileAttachment[]
}) => {
  if (imageAttachments.length === 0 && textAttachments.length === 0 && fileAttachments.length === 0) {
    return null
  }

  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      {imageAttachments.map((attachment) => (
        <ImageCard
          key={attachment.path}
          image={attachment}
          showRemoveButton={false}
        />
      ))}
      {textAttachments.map((attachment) => (
        <TextAttachmentCard
          key={attachment.id}
          attachment={attachment}
          showRemoveButton={false}
        />
      ))}
      {fileAttachments.map((attachment) => (
        <FileAttachmentCard
          key={attachment.path}
          attachment={attachment}
          showRemoveButton={false}
        />
      ))}
    </box>
  )
})

export const MessageBlock = memo(({
  messageId,
  blocks,
  content,
  isUser,
  isAi,
  isLoading,
  timestamp,
  isComplete,
  completionTime,
  credits,
  timerStartTime,
  textColor,
  timestampColor,
  markdownOptions,
  availableWidth,
  markdownPalette,
  onToggleCollapsed,
  onBuildFast,
  onBuildMax,
  onBuildLite,
  onFeedback,
  onCloseFeedback,
  validationErrors,
  userError,
  onOpenFeedback,
  attachments,
  textAttachments,
  fileAttachments,
  metadata,
  isLastMessage,
}: MessageBlockProps) => {
  const [showValidationPopover, setShowValidationPopover] = useState(false)
  const selectedModel = useChatStore((state) => state.selectedModel)

  const bashCwd = metadata?.bashCwd ? formatCwd(metadata.bashCwd) : undefined

  useWhyDidYouUpdateById(
    'MessageBlock',
    messageId,
    {
      messageId,
      blocks,
      content,
      isUser,
      isAi,
      isLoading,
      timestamp,
      isComplete,
      completionTime,
      credits,
      timerStartTime,
      textColor,
      timestampColor,
      markdownOptions,
      availableWidth,
      markdownPalette,
      onToggleCollapsed,
      onBuildFast,
      onBuildMax,
      onBuildLite,
      onFeedback,
      onCloseFeedback,
      validationErrors,
      onOpenFeedback,
      metadata,
      isLastMessage,
    },
    {
      logLevel: 'debug',
      enabled: getCliEnv().CODEBUFF_PERF_TEST === 'true',
    },
  )

  const theme = useTheme()
  const resolvedTextColor = textColor ?? theme.foreground

  return (
    <box
      style={{
        flexDirection: 'column',
        width: '100%',
        marginTop: 0,
        marginBottom: 1,
      }}
    >
      {isUser && !bashCwd && (
        <box
          style={{
            flexDirection: 'column',
            width: '100%',
            gap: 0,
          }}
        >
          <box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 1 }}>
            <text style={{ wrapMode: 'none' }}>
              <span fg={timestampColor} attributes={TextAttributes.DIM}>
                {`[${timestamp}] `}
              </span>
              <span fg={theme.primary} attributes={TextAttributes.BOLD}>
                ❯{' '}
              </span>
            </text>

            <box style={{ flexGrow: 1, flexShrink: 1 }}>
              {blocks ? (
                <BlocksRenderer
                  sourceBlocks={blocks}
                  messageId={messageId}
                  isLoading={isLoading}
                  isComplete={isComplete}
                  isUser={isUser}
                  textColor={resolvedTextColor}
                  availableWidth={availableWidth}
                  markdownPalette={markdownPalette}
                  onToggleCollapsed={onToggleCollapsed}
                  onBuildFast={onBuildFast}
                  onBuildMax={onBuildMax}
                  onBuildLite={onBuildLite}
                  isLastMessage={isLastMessage}
                  contentToCopy={undefined}
                />
              ) : (
                <UserContentWithCopyButton
                  content={content}
                  messageId={messageId}
                  isLoading={isLoading}
                  isComplete={isComplete}
                  isUser={isUser}
                  textColor={resolvedTextColor}
                  codeBlockWidth={markdownOptions.codeBlockWidth}
                  palette={markdownOptions.palette}
                  showCopyButton={false}
                />
              )}
            </box>

            {validationErrors && validationErrors.length > 0 && (
              <Button
                onClick={() => setShowValidationPopover(!showValidationPopover)}
              >
                <text
                  style={{
                    fg: theme.error,
                    wrapMode: 'none',
                  }}
                >
                  [!]
                </text>
              </Button>
            )}
          </box>

          {((attachments && attachments.length > 0) ||
            (textAttachments && textAttachments.length > 0) ||
            (fileAttachments && fileAttachments.length > 0)) && (
            <MessageAttachments
              imageAttachments={attachments ?? []}
              textAttachments={textAttachments ?? []}
              fileAttachments={fileAttachments ?? []}
            />
          )}
        </box>
      )}

      {bashCwd && (
        <box style={{ flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 1 }}>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'none',
              fg: timestampColor,
            }}
          >
            {`[${timestamp}]`}
          </text>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'none',
              fg: theme.muted,
            }}
          >
            •
          </text>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'word',
              fg: theme.muted,
            }}
          >
            {bashCwd}
          </text>
        </box>
      )}

      {isUser &&
        !bashCwd &&
        validationErrors &&
        validationErrors.length > 0 &&
        showValidationPopover && (
          <box style={{ paddingTop: 1, paddingBottom: 1 }}>
            <ValidationErrorPopover
              errors={validationErrors}
              onOpenFeedback={onOpenFeedback}
              onClose={() => setShowValidationPopover(false)}
            />
          </box>
        )}

      {isAi && (
        <box style={{ flexDirection: 'column', gap: 1, width: '100%', marginTop: 0 }}>
          <box style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <text style={{ wrapMode: 'none' }}>
              <span fg={theme.primary} attributes={TextAttributes.BOLD}>
                ✦{' '}
              </span>
              <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
                RivoCode
              </span>
              <span fg={theme.muted}>
                {' '}({selectedModel ?? 'deepseek'})
              </span>
            </text>
          </box>

          <box style={{ flexDirection: 'column', gap: 1, width: '100%', paddingLeft: 0 }}>
            {blocks ? (
              <box
                style={{
                  flexDirection: 'column',
                  gap: 1,
                  width: '100%',
                }}
              >
                <BlocksRenderer
                  sourceBlocks={blocks}
                  messageId={messageId}
                  isLoading={isLoading}
                  isComplete={isComplete}
                  isUser={isUser}
                  textColor={resolvedTextColor}
                  availableWidth={availableWidth}
                  markdownPalette={markdownPalette}
                  onToggleCollapsed={onToggleCollapsed}
                  onBuildFast={onBuildFast}
                  onBuildMax={onBuildMax}
                  onBuildLite={onBuildLite}
                  isLastMessage={isLastMessage}
                  contentToCopy={undefined}
                />
              </box>
            ) : (
              <UserContentWithCopyButton
                content={content}
                messageId={messageId}
                isLoading={isLoading}
                isComplete={isComplete}
                isUser={isUser}
                textColor={resolvedTextColor}
                codeBlockWidth={markdownOptions.codeBlockWidth}
                palette={markdownOptions.palette}
                showCopyButton={false}
              />
            )}
          </box>
        </box>
      )}

      {isAi && userError && <UserErrorBanner error={userError} />}

      {isAi && (
        <MessageFooter
          messageId={messageId}
          blocks={blocks}
          content={content}
          isLoading={isLoading}
          isComplete={isComplete}
          completionTime={completionTime}
          credits={credits}
          timerStartTime={timerStartTime}
          onFeedback={onFeedback}
          onCloseFeedback={onCloseFeedback}
        />
      )}
    </box>
  )
})
