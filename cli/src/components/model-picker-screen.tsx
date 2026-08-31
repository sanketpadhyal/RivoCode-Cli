import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

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
  icon: string
  iconPadding: string
  iconColor: string
  category?: 'recommended' | 'other'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'minimax-free',
    name: 'minimax-free',
    badge: '(MiniMax M2.7 · 196k Context · Free Tier)',
    icon: '∿',
    iconPadding: ' ',
    iconColor: '#F43F5E',
    description: 'MiniMax M2.7 on OpenRouter · 196,000 token window · Fast, high-productivity foundation model for coding & long sessions',
    category: 'recommended',
  },
  {
    id: 'llama-3.3-70b-free',
    name: 'llama-3.3-70b-free',
    badge: '(Meta Llama 3.3 · Free Tier)',
    icon: '∞',
    iconPadding: ' ',
    iconColor: '#0081FB',
    description: 'Free Meta Llama 3.3 70B on OpenRouter (openrouter.ai/keys) · Easy setup & long sessions · Good for basic coding, Git & React · Not suitable for large refactors',
    category: 'other',
  },
  {
    id: 'gemini',
    name: 'gemini-3.6-flash',
    badge: '(Google Gemini · 1M Context & Fast)',
    icon: '✦',
    iconPadding: ' ',
    iconColor: '#38BDF8',
    description: 'Google Gemini via Google AI Studio (aistudio.google.com) · 1M token window · Recommended for big tasks, deep reasoning & large codebases',
    category: 'other',
  },
]

interface ModelPickerScreenProps {
  onSelectModel: (model: ModelOption) => void
  onBack: () => void
}

const MAX_VISIBLE_ITEMS = 6

export const ModelPickerScreen = ({
  onSelectModel,
  onBack,
}: ModelPickerScreenProps) => {
  const theme = useTheme()
  const { contentMaxWidth, terminalHeight } = useTerminalDimensions()
  const isCompactHeight = terminalHeight < 26
  const [filterText, setFilterText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)

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

  // Keep selected index within bounds and adjust scroll offset
  useEffect(() => {
    if (selectedIndex >= filteredModels.length) {
      setSelectedIndex(Math.max(0, filteredModels.length - 1))
    }
  }, [filteredModels.length, selectedIndex])

  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex)
    } else if (selectedIndex >= scrollOffset + MAX_VISIBLE_ITEMS) {
      setScrollOffset(selectedIndex - MAX_VISIBLE_ITEMS + 1)
    }
  }, [selectedIndex, scrollOffset])

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

        if (key.name === 'pageup') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) => Math.max(0, prev - MAX_VISIBLE_ITEMS))
          return
        }

        if (key.name === 'pagedown') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex((prev) =>
            Math.min(filteredModels.length - 1, prev + MAX_VISIBLE_ITEMS),
          )
          return
        }

        if (key.name === 'home') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex(0)
          return
        }

        if (key.name === 'end') {
          if ('preventDefault' in key && typeof key.preventDefault === 'function') {
            key.preventDefault()
          }
          setSelectedIndex(Math.max(0, filteredModels.length - 1))
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
          setScrollOffset(0)
          return
        }

        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          setFilterText((prev) => prev + key.sequence)
          setSelectedIndex(0)
          setScrollOffset(0)
        }
      },
      [filteredModels, onBack, onSelectModel, selectedIndex],
    ),
  )

  const visibleModels = useMemo(() => {
    return filteredModels.slice(scrollOffset, scrollOffset + MAX_VISIBLE_ITEMS)
  }, [filteredModels, scrollOffset])

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        width: '100%',
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <box style={{ flexDirection: 'column' }}>
        {!isCompactHeight && (
          <box style={{ marginBottom: 1 }}>
            {logoComponent}
          </box>
        )}

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
          {'\n'}
          <span fg="#ffb703">ℹ </span>
          <span fg={theme.muted}>
            Select a model below. You will enter your free API key after selection.
          </span>
          {'\n\n'}
          {filteredModels.map((model, idx) => {
            const isSelected = idx === selectedIndex
            const prevModel = idx > 0 ? filteredModels[idx - 1] : null
            const showRecommendedHeader =
              model.category === 'recommended' &&
              (!prevModel || prevModel.category !== 'recommended')
            const showOtherHeader =
              model.category === 'other' &&
              (!prevModel || prevModel.category !== 'other')

            return (
              <React.Fragment key={model.id}>
                {showRecommendedHeader && (
                  <>
                    <span fg={theme.muted} attributes={TextAttributes.BOLD}>
                      Recommended
                    </span>
                    {'\n\n'}
                  </>
                )}
                {showOtherHeader && (
                  <>
                    {idx > 0 ? '\n\n' : ''}
                    <span fg={theme.muted} attributes={TextAttributes.BOLD}>
                      Other Models
                    </span>
                    {'\n\n'}
                  </>
                )}
                <span fg={isSelected ? theme.primary : theme.muted}>
                  {isSelected ? '▶ ' : '  '}
                </span>
                <span fg={model.iconColor} attributes={TextAttributes.BOLD}>
                  {model.icon}
                </span>
                <span>{model.iconPadding}</span>
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
                <span fg={theme.muted}>       {model.description}</span>
                {idx < filteredModels.length - 1 &&
                filteredModels[idx + 1].category === model.category
                  ? '\n\n'
                  : ''}
              </React.Fragment>
            )
          })}
          {filteredModels.length === 0 && (
            <span fg={theme.muted}>  No matching models found</span>
          )}
          {'\n\n'}
          <span fg={theme.muted}>↑/↓ navigate · </span>
          <span fg={theme.foreground}>enter</span>
          <span fg={theme.muted}> select · </span>
          <span fg={theme.foreground}>←</span>
          <span fg={theme.muted}> back</span>
        </text>
      </box>
    </box>
  )
}
