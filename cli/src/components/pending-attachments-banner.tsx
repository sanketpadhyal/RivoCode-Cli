import { BottomBanner } from './bottom-banner'
import { FileAttachmentCard } from './file-attachment-card'
import { ImageCard } from './image-card'
import { TextAttachmentCard } from './text-attachment-card'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'

import type {
  PendingFileAttachment,
  PendingImageAttachment,
  PendingTextAttachment,
} from '../types/store'

export const PendingAttachmentsBanner = () => {
  const theme = useTheme()
  const pendingAttachments = useChatStore((state) => state.pendingAttachments)
  const removePendingAttachment = useChatStore(
    (state) => state.removePendingAttachment,
  )

  const pendingImages = pendingAttachments.filter(
    (a): a is PendingImageAttachment => a.kind === 'image',
  )
  const pendingTextAttachments = pendingAttachments.filter(
    (a): a is PendingTextAttachment => a.kind === 'text',
  )
  const pendingFileAttachments = pendingAttachments.filter(
    (a): a is PendingFileAttachment => a.kind === 'file',
  )

  const errorImages: PendingImageAttachment[] = []
  const validImages: PendingImageAttachment[] = []
  for (const img of pendingImages) {
    if (img.status === 'error') {
      errorImages.push(img)
    } else {
      validImages.push(img)
    }
  }

  const hasValidImages = validImages.length > 0
  const hasTextAttachments = pendingTextAttachments.length > 0
  const hasFileAttachments = pendingFileAttachments.length > 0
  const hasErrorsOnly = errorImages.length > 0 && !hasValidImages && !hasTextAttachments && !hasFileAttachments

  if (!hasValidImages && !hasTextAttachments && !hasFileAttachments && errorImages.length === 0) {
    return null
  }

  if (hasErrorsOnly) {
    return (
      <BottomBanner borderColorKey="error">
        {errorImages.map((image, index) => (
          <text key={`${image.path}-${index}`} style={{ fg: theme.error }}>
            {image.note} ({image.filename})
          </text>
        ))}
      </BottomBanner>
    )
  }

  return (
    <BottomBanner borderColorKey="imageCardBorder">
      {errorImages.map((image, index) => (
        <text key={`error-${image.path}-${index}`} style={{ fg: theme.error }}>
          {image.note} ({image.filename})
        </text>
      ))}

      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {validImages.map((image, index) => (
          <ImageCard
            key={`img-${image.path}-${index}`}
            image={image}
            onRemove={() => removePendingAttachment(image.path)}
          />
        ))}

        {pendingTextAttachments.map((attachment) => (
          <TextAttachmentCard
            key={attachment.id}
            attachment={attachment}
            onRemove={() => removePendingAttachment(attachment.id)}
          />
        ))}

        {pendingFileAttachments.map((attachment) => (
          <FileAttachmentCard
            key={attachment.id}
            attachment={attachment}
            onRemove={() => removePendingAttachment(attachment.path)}
          />
        ))}
      </box>
    </BottomBanner>
  )
}
