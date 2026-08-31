import React from 'react'

import { BottomBanner } from './bottom-banner'
import { useSubscriptionQuery } from '../hooks/use-subscription-query'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'

const HELP_TIMEOUT = 60 * 1000

const SectionHeader = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme()
  return <text style={{ fg: theme.muted }}>{children}</text>
}

const Shortcut = ({
  keys,
  action,
}: {
  keys: string
  action: string
}) => {
  const theme = useTheme()
  return (
    <box style={{ flexDirection: 'row', gap: 1 }}>
      <text style={{ fg: theme.foreground }}>{keys}</text>
      <text style={{ fg: theme.muted }}>{action}</text>
    </box>
  )
}

export const HelpBanner = () => {
  const setInputMode = useChatStore((state) => state.setInputMode)
  const theme = useTheme()
  const { data: subscriptionData } = useSubscriptionQuery()
  const hasSubscription = subscriptionData?.hasSubscription ?? false

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setInputMode('default')
    }, HELP_TIMEOUT)
    return () => clearTimeout(timer)
  }, [setInputMode])

  return (
    <BottomBanner
      borderColorKey="info"
      onClose={() => setInputMode('default')}
    >
      <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        <box style={{ flexDirection: 'column', gap: 0 }}>
          <SectionHeader>Shortcuts</SectionHeader>
          <box style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, paddingLeft: 2 }}>
            <Shortcut keys="Ctrl+C / Esc" action="stop" />
            <Shortcut keys="Ctrl+J / Opt+Enter" action="newline" />
            <Shortcut keys="↑↓" action="history" />
            <Shortcut keys="Ctrl+T" action="collapse/expand agents" />
            <Shortcut keys="Ctrl+Q" action="edit queued messages" />
          </box>
        </box>

        <box style={{ flexDirection: 'column', gap: 0 }}>
          <SectionHeader>Features</SectionHeader>
          <box style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, paddingLeft: 2 }}>
            <Shortcut keys="/" action="commands" />
            <Shortcut keys="@files" action="mention" />
            <Shortcut keys="@agents" action="use agent" />
            <Shortcut keys="!bash" action="run command" />
          </box>
        </box>

        <box style={{ flexDirection: 'column', gap: 0 }}>
          <SectionHeader>Tips</SectionHeader>
          <box style={{ flexDirection: 'column', paddingLeft: 2 }}>
            <text style={{ fg: theme.muted }}>
              Use @ to reference agents to spawn or files to read
            </text>
            <text style={{ fg: theme.muted }}>
              Drag to select text — it copies automatically (or click ⎘ on a
              message)
            </text>
            <text style={{ fg: theme.muted }}>
              Esc to cancel the current response
            </text>
          </box>
        </box>

        <box style={{ flexDirection: 'column', gap: 0 }}>
          <SectionHeader>Credits</SectionHeader>
          <box style={{ flexDirection: 'column', paddingLeft: 2 }}>
            <box style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1 }}>
              <text style={{ fg: theme.foreground }}>1 credit = 1 cent</text>
              <text style={{ fg: theme.muted }}>·</text>
              <text style={{ fg: theme.foreground }}>/subscribe</text>
              <text style={{ fg: theme.muted }}>·</text>
              <text style={{ fg: theme.foreground }}>/usage</text>
              {!hasSubscription && (
                <>
                  <text style={{ fg: theme.muted }}>·</text>
                  <text style={{ fg: theme.foreground }}>/ads:enable</text>
                </>
              )}
            </box>
            <text style={{ fg: theme.muted }}>
              Subscribe for the best credit rates — /subscribe
            </text>
          </box>
        </box>
      </box>
    </BottomBanner>
  )
}
