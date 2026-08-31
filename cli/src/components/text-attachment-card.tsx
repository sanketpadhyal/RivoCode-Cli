import { AttachmentCard } from './attachment-card'
import { useTheme } from '../hooks/use-theme'

import type { PendingTextAttachment } from '../types/store'

const TEXT_CARD_WIDTH = 34
const MAX_PREVIEW_CHARS = 50

interface TextAttachmentCardProps {
  attachment: PendingTextAttachment | { preview: string; charCount: number }
  onRemove?: () => void
  showRemoveButton?: boolean
}

export const TextAttachmentCard = ({
  attachment,
  onRemove,
  showRemoveButton = true,
}: TextAttachmentCardProps) => {
  const theme = useTheme()

  const rawPreview = attachment.preview.trim().replace(/\r?\n+/g, ' ')
  const displayPreview =
    rawPreview.slice(0, MAX_PREVIEW_CHARS) +
    (rawPreview.length > MAX_PREVIEW_CHARS ? '…' : '')

  return (
    <AttachmentCard
      width={TEXT_CARD_WIDTH}
      onRemove={onRemove}
      showRemoveButton={showRemoveButton}
      label="[Text Attachment]"
    >
      <box
        style={{
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <text
          style={{
            fg: theme.foreground,
            wrapMode: 'word',
          }}
        >
          {displayPreview || '(empty text)'}
        </text>
        <text
          style={{
            fg: theme.muted,
            wrapMode: 'none',
          }}
        >
          {attachment.charCount.toLocaleString()} chars
        </text>
      </box>
    </AttachmentCard>
  )
}
