import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useMemo, useState } from 'react'

import { useLogo } from '../hooks/use-logo'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { KeyEvent } from '@opentui/core'

export interface ModelOption {
  id: string
  name: string
  badge?: string
  description: string
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'groq',
    name: 'groq',
    badge: '(Fast)',
    description: 'Ultra-fast low-latency inference on Groq LPUs',
  },
  {
    id: 'gpt-oss',
    name: 'gpt-oss',
    badge: '(High Reasoning)',
    description: 'Open-source flagship reasoning model for complex coding',
  },
]

interface ModelPickerScreenProps {
  onSelectModel: (model: ModelOption) => void
  onBack: () => void
}

export const ModelPickerScreen = ({
  onSelectModel,
  onBack,
}: ModelPickerScreenProps) => {
  const theme = useTheme()
  const { contentMaxWidth } = useTerminalDimensions()
  const [filterText, setFilterText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
  })

  const filteredModels = useMemo(() => {
    if (!filterText.trim()) return AVAILABLE_MODELS
    const query = filterText.toLowerCase()
    return AVAILABLE_MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query),
    )
  }, [filterText])

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

        if (key.name === 'left' || key.name === 'escape') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          onBack()
          return
        }

        if (key.name === 'up' || (key.ctrl && key.name === 'k')) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) =>
            filteredModels.length === 0
              ? 0
              : prev === 0
                ? filteredModels.length - 1
                : prev - 1,
          )
          return
        }

        if (
          key.name === 'down' ||
          (key.ctrl && key.name === 'j') ||
          key.name === 'tab'
        ) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) =>
            filteredModels.length === 0
              ? 0
              : prev === filteredModels.length - 1
                ? 0
                : prev + 1,
          )
          return
        }

        if (isPlainEnterKey(key)) {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          if (filteredModels[selectedIndex]) {
            onSelectModel(filteredModels[selectedIndex])
          }
          return
        }

        if (key.name === 'backspace' || key.name === 'delete') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setFilterText((prev) => prev.slice(0, -1))
          setSelectedIndex(0)
          return
        }

        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          setFilterText((prev) => prev + key.sequence)
          setSelectedIndex(0)
        }
      },
      [filteredModels, onBack, onSelectModel, selectedIndex],
    ),
  )

  return (
    <box
      style={{
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        width: '100%',
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <box style={{ flexDirection: 'column', gap: 1 }}>
        <box style={{ marginBottom: 1 }}>
          {logoComponent}
        </box>

        <box style={{ flexDirection: 'row', alignItems: 'center' }}>
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
              Select model for{' '}
            </span>
            <span fg={theme.primary} attributes={TextAttributes.BOLD}>
              RivoCode
            </span>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
              :{' '}
            </span>
            {filterText.length > 0 ? (
              <span fg={theme.primary}>{filterText}</span>
            ) : (
              <span fg={theme.muted}>Type to filter...</span>
            )}
          </text>
        </box>

        <box style={{ flexDirection: 'column', marginTop: 1, gap: 1 }}>
          <text style={{ wrapMode: 'none', fg: theme.muted }}>
            <span attributes={TextAttributes.BOLD}>Recommended</span>
          </text>

          {filteredModels.map((model, idx) => {
            const isSelected = idx === selectedIndex

            return (
              <box
                key={model.id}
                style={{
                  flexDirection: 'column',
                  marginBottom: 1,
                }}
              >
                <text style={{ wrapMode: 'none' }}>
                  <span fg={isSelected ? theme.primary : theme.muted}>
                    {isSelected ? '▶ ' : '  '}
                  </span>
                  <span
                    fg={theme.foreground}
                    attributes={isSelected ? TextAttributes.BOLD : undefined}
                  >
                    {model.name}
                  </span>
                  {model.badge ? (
                    <span fg={theme.muted}> {model.badge}</span>
                  ) : null}
                  {'\n'}
                  <span fg={theme.muted}>    {model.description}</span>
                </text>
              </box>
            )
          })}

          {filteredModels.length === 0 && (
            <text style={{ wrapMode: 'none', fg: theme.muted }}>
              <span>  No matching models found</span>
            </text>
          )}
        </box>
      </box>

      <box style={{ marginTop: 1 }}>
        <text style={{ wrapMode: 'none', fg: theme.muted }}>
          <span>↑/↓ navigate · </span>
          <span fg={theme.foreground}>enter</span>
          <span> select · </span>
          <span fg={theme.foreground}>←</span>
          <span> back</span>
        </text>
      </box>
    </box>
  )
}
