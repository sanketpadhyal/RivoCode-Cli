import { useKeyboard } from '@opentui/react'
import { TextAttributes, type KeyEvent } from '@opentui/core'
import React, { useCallback, useState } from 'react'

import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'
import type { ProjectContextData } from './project-context'

interface ContinueWorkScreenProps {
  context: ProjectContextData
  onContinue: () => void
  onStartFresh: () => void
}

export const ContinueWorkScreen = ({
  context,
  onContinue,
  onStartFresh,
}: ContinueWorkScreenProps) => {
  const theme = useTheme()
  const { terminalHeight } = useTerminalDimensions()
  const [selectedIndex, setSelectedIndex] = useState(0)

  // compact mode when terminal is too short to show everything
  const isCompact = terminalHeight < 18

  const options = [
    {
      title: 'Continue previous work',
      desc: `Resume with previous context (${context.lastModel || 'deepseek'})`,
      action: onContinue,
    },
    {
      title: 'Start fresh in this workspace',
      desc: 'Pick a new model and start a new clean session',
      action: onStartFresh,
    },
  ]

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (key.ctrl && key.name === 'c') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          void exitCliCleanly()
          return
        }

        if (key.name === 'up' || key.name === 'k') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) => (prev === 0 ? options.length - 1 : prev - 1))
          return
        }

        if (key.name === 'down' || key.name === 'j' || key.name === 'tab') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) => (prev === options.length - 1 ? 0 : prev + 1))
          return
        }

        if (isPlainEnterKey(key)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          options[selectedIndex].action()
        }
      },
      [options, selectedIndex],
    ),
  )

  const formatLastActive = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Recently'
    }
  }

  const renderOptions = () => {
    if (selectedIndex === 0) {
      return (
        <>
          <span fg="#55ff55" attributes={TextAttributes.BOLD}>
            {'> Continue previous work'}
          </span>
          {'\n'}
          <span fg={theme.muted}>
            {'  Resume with previous context (' + (context.lastModel || 'deepseek') + ')'}
          </span>
          {'\n\n'}
          <span fg={theme.muted}>{'  Start fresh in this workspace'}</span>
          {'\n'}
          <span fg={theme.muted}>{'  Pick a new model and start a new clean session'}</span>
        </>
      )
    }
    return (
      <>
        <span fg={theme.muted}>{'  Continue previous work'}</span>
        {'\n'}
        <span fg={theme.muted}>
          {'  Resume with previous context (' + (context.lastModel || 'deepseek') + ')'}
        </span>
        {'\n\n'}
        <span fg="#55ff55" attributes={TextAttributes.BOLD}>
          {'> Start fresh in this workspace'}
        </span>
        {'\n'}
        <span fg={theme.muted}>{'  Pick a new model and start a new clean session'}</span>
      </>
    )
  }

  return (
    <box
      style={{
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        width: '100%',
        paddingLeft: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ flexDirection: 'column' }}>
        <text style={{ wrapMode: 'none' }}>
          {/* Header — always shown */}
          <span fg="#ffb703" attributes={TextAttributes.BOLD}>RivoCode</span>
          <span fg={theme.secondary}> · Saved Workspace Found</span>
          {'\n\n'}

          {/* Subtitle — hidden in compact mode when second option is selected */}
          {(!isCompact || selectedIndex === 0) && (
            <>
              <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
                Do you want to continue with your old work?
              </span>
              {'\n'}
              <span fg={theme.secondary}>
                Previous workspace state was detected in this folder:
              </span>
              {'\n\n'}
            </>
          )}

          {/* Metadata — abbreviated in compact mode */}
          {isCompact ? (
            <>
              <span fg={theme.muted}>  Work: </span>
              <span fg="#55ff55" attributes={TextAttributes.BOLD}>{context.workName}</span>
              {selectedIndex === 0 && (
                <>
                  {'\n'}
                  <span fg={theme.muted}>  Last Active: </span>
                  <span fg={theme.secondary}>{formatLastActive(context.lastActive)}</span>
                </>
              )}
            </>
          ) : (
            <>
              <span fg={theme.muted}>  Work: </span>
              <span fg="#55ff55" attributes={TextAttributes.BOLD}>{context.workName}</span>
              {'\n'}
              <span fg={theme.muted}>  Path: </span>
              <span fg={theme.secondary}>{context.projectPath}</span>
              {'\n'}
              <span fg={theme.muted}>  Last Active: </span>
              <span fg={theme.secondary}>{formatLastActive(context.lastActive)}</span>
              {'\n'}
              <span fg={theme.muted}>  Sessions: </span>
              <span fg={theme.secondary}>{context.sessionCount}</span>
            </>
          )}

          {'\n\n'}

          {/* Options — always shown */}
          {renderOptions()}

          {'\n\n'}

          {/* Nav hint */}
          <span fg={theme.muted}>{'↑/↓ Navigate · '}</span>
          <span fg={theme.foreground}>enter</span>
          <span fg={theme.muted}>{' Confirm'}</span>
        </text>
      </box>

      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          width: '100%',
          paddingRight: 2,
        }}
      >
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>{context.lastModel ? `${context.lastModel} (Saved)` : 'RivoCode'}</span>
        </text>
      </box>
    </box>
  )
}
