import { memo, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useSheenAnimation } from '../hooks/use-sheen-animation'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { IS_FREEBUFF } from '../utils/constants'
import { openFileAtPath } from '../utils/open-file'
import { formatCwd } from '../utils/path-helpers'
import { getLogoAccentColor, getLogoBlockColor } from '../utils/theme-system'
import { TerminalLink } from './terminal-link'

export const ChatHeader = memo(function ChatHeader({
  projectRoot,
  animationEnabled,
}: {
  projectRoot: string
  animationEnabled: boolean
}) {
  const { contentMaxWidth, terminalWidth } = useTerminalDimensions()
  const theme = useTheme()
  const [sheenPosition, setSheenPosition] = useState(0)
  const blockColor = getLogoBlockColor(theme.name)
  const accentColor = getLogoAccentColor(theme.name)
  const { applySheenToChar } = useSheenAnimation({
    enabled: animationEnabled,
    logoColor: theme.foreground,
    accentColor,
    blockColor,
    terminalWidth,
    sheenPosition,
    setSheenPosition,
  })
  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
    accentColor,
    blockColor,
    applySheenToChar,
  })

  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 2,
        paddingLeft: 1,
        paddingRight: 1,
        marginBottom: 1,
        marginTop: 1,
        alignItems: 'center',
      }}
    >
      <box style={{ flexShrink: 0 }}>
        {logoComponent}
      </box>
      <box style={{ flexDirection: 'column', gap: 0 }}>
        <text style={{ wrapMode: 'none' }}>
          <b>
            <span fg={theme.primary}>RivoCode CLI 1.0.0</span>
          </b>
        </text>
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>sanketpadhyal@gmail.com (Created by Sanket Padhyal)</span>
        </text>
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>Gemini 3.7 Flash (High)</span>
        </text>
        <text style={{ wrapMode: 'none', fg: theme.secondary }}>
          <span>{formatCwd(projectRoot)}</span>
        </text>
      </box>
    </box>
  )
})
