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
  category: 'Recommended' | 'More'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'glm-5.3-flash:cloud',
    name: 'glm-5.3-flash:cloud',
    badge: '(Upgrade required)',
    description:
      'Fast reasoning for coding and agentic workloads with 1M context and native image understanding',
    category: 'Recommended',
  },
  {
    id: 'glm-5.3:cloud',
    name: 'glm-5.3:cloud',
    description:
      'Long-horizon coding and agentic engineering with deep reasoning and a 1M context',
    category: 'Recommended',
  },
  {
    id: 'deepseek-v4-flash:cloud',
    name: 'deepseek-v4-flash:cloud',
    description: 'Fast coding and agentic tool use with 1M context',
    category: 'Recommended',
  },
  {
    id: 'gemma4:31b-cloud',
    name: 'gemma4:31b-cloud',
    description: 'Agentic workflows and multimodal reasoning',
    category: 'Recommended',
  },
  {
    id: 'gemma4:26b',
    name: 'gemma4:26b',
    description:
      'Agentic workflows and multimodal reasoning, ~19GB, (not downloaded)',
    category: 'Recommended',
  },
  {
    id: 'gemma4:12b',
    name: 'gemma4:12b',
    description: 'Fast local coding and reasoning model',
    category: 'More',
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

  const recommendedModels = useMemo(
    () => filteredModels.filter((m) => m.category === 'Recommended'),
    [filteredModels],
  )
  const moreModels = useMemo(
    () => filteredModels.filter((m) => m.category === 'More'),
    [filteredModels],
  )

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

  let globalIndexCounter = 0

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
            <b>
              <span fg={theme.foreground}>Select model for </span>
              <span fg={theme.primary}>RivoCode</span>
              <span fg={theme.foreground}>: </span>
            </b>
            {filterText.length > 0 ? (
              <span fg={theme.primary}>{filterText}</span>
            ) : (
              <span fg={theme.muted}>Type to filter...</span>
            )}
          </text>
        </box>

        {recommendedModels.length > 0 && (
          <box style={{ flexDirection: 'column', marginTop: 1, gap: 0 }}>
            <text style={{ wrapMode: 'none', fg: theme.muted }}>
              <b>Recommended</b>
            </text>

            {recommendedModels.map((model) => {
              const itemIndex = globalIndexCounter++
              const isSelected = itemIndex === selectedIndex

              return (
                <box
                  key={model.id}
                  style={{
                    flexDirection: 'column',
                    marginTop: 0,
                    marginBottom: 0,
                  }}
                >
                  <text style={{ wrapMode: 'none' }}>
                    {isSelected ? (
                      <>
                        <span fg={theme.primary}>▶ </span>
                        <b>
                          <span fg={theme.foreground}>{model.name}</span>
                        </b>
                      </>
                    ) : (
                      <>
                        <span>  </span>
                        <span fg={theme.foreground}>{model.name}</span>
                      </>
                    )}
                    {model.badge && (
                      <span fg={theme.muted}> {model.badge}</span>
                    )}
                  </text>
                  <text style={{ wrapMode: 'none', fg: theme.muted, paddingLeft: 4 }}>
                    <span>{model.description}</span>
                  </text>
                </box>
              )
            })}
          </box>
        )}

        {moreModels.length > 0 && (
          <box style={{ flexDirection: 'column', marginTop: 1, gap: 0 }}>
            <text style={{ wrapMode: 'none', fg: theme.muted }}>
              <b>More</b>
            </text>

            {moreModels.map((model) => {
              const itemIndex = globalIndexCounter++
              const isSelected = itemIndex === selectedIndex

              return (
                <box
                  key={model.id}
                  style={{
                    flexDirection: 'column',
                    marginTop: 0,
                    marginBottom: 0,
                  }}
                >
                  <text style={{ wrapMode: 'none' }}>
                    {isSelected ? (
                      <>
                        <span fg={theme.primary}>▶ </span>
                        <b>
                          <span fg={theme.foreground}>{model.name}</span>
                        </b>
                      </>
                    ) : (
                      <>
                        <span>  </span>
                        <span fg={theme.foreground}>{model.name}</span>
                      </>
                    )}
                    {model.badge && (
                      <span fg={theme.muted}> {model.badge}</span>
                    )}
                  </text>
                  <text style={{ wrapMode: 'none', fg: theme.muted, paddingLeft: 4 }}>
                    <span>{model.description}</span>
                  </text>
                </box>
              )
            })}
          </box>
        )}
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
