import React from 'react'

import { HelpBanner } from './help-banner'
import { PendingAttachmentsBanner } from './pending-attachments-banner'
import { SubscriptionLimitBanner } from './subscription-limit-banner'
import { UsageBanner } from './usage-banner'
import { useChatStore } from '../state/chat-store'

const BANNER_REGISTRY: Record<
  string,
  (ctx: { showTime: number }) => React.ReactNode
> = {
  default: () => <PendingAttachmentsBanner />,
  image: () => <PendingAttachmentsBanner />,
  usage: ({ showTime }: { showTime: number }) => <UsageBanner showTime={showTime} />,
  help: () => <HelpBanner />,
  subscriptionLimit: () => <SubscriptionLimitBanner />,
}

export const InputModeBanner = () => {
  const inputMode = useChatStore((state) => state.inputMode)

  const [usageBannerShowTime, setUsageBannerShowTime] = React.useState(() =>
    Date.now(),
  )

  React.useEffect(() => {
    if (inputMode === 'usage') {
      setUsageBannerShowTime(Date.now())
    }
  }, [inputMode])

  const renderBanner = BANNER_REGISTRY[inputMode]

  if (!renderBanner) {
    return null
  }

  return <>{renderBanner({ showTime: usageBannerShowTime })}</>
}
