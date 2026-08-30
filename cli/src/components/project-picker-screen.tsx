import os from 'os'

import { TextAttributes } from '@opentui/core'
import React, { useCallback, useMemo, useState } from 'react'

import { Button } from './button'
import { MultilineInput } from './multiline-input'
import { SelectableList } from './selectable-list'
import { TerminalLink } from './terminal-link'
import { useDirectoryBrowser } from '../hooks/use-directory-browser'
import { useLogo } from '../hooks/use-logo'
import { usePathTabCompletion } from '../hooks/use-path-tab-completion'
import { useSearchableList } from '../hooks/use-searchable-list'
import { useSheenAnimation } from '../hooks/use-sheen-animation'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import { exitCliCleanly } from '../utils/exit-cleanly'
import { formatCwd } from '../utils/path-helpers'
import { loadRecentProjects } from '../utils/recent-projects'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'
import { getLogoBlockColor, getLogoAccentColor } from '../utils/theme-system'

import type { SelectableListItem } from './selectable-list'

const LAYOUT = {
  MAX_CONTENT_WIDTH: 80,
  PREFERRED_CONTENT_WIDTH: 60,
  CONTENT_PADDING: 4,

  INPUT_HEIGHT: 1,
  BOTTOM_BAR_HEIGHT: 2,
  MIN_LIST_HEIGHT: 2,
  MAX_LIST_HEIGHT: 12,

  COMPACT_MODE_THRESHOLD: 12,

  LOGO_HEIGHT: 8,
  HELP_TEXT_HEIGHT: 2,

  MAIN_CONTENT_PADDING: 2,
  LOGO_MARGIN_TOP: 1,
  LOGO_MARGIN_BOTTOM: 1,
  HELP_TEXT_MARGIN_BOTTOM: 1,
  RECENTS_MARGIN_TOP: 1,
  RECENTS_PADDING_LEFT: 1,
} as const

interface ProjectPickerScreenProps {
  onSelectProject: (projectPath: string) => void
  initialPath?: string
}

export const ProjectPickerScreen: React.FC<ProjectPickerScreenProps> = ({
  onSelectProject,
  initialPath,
}) => {
  const theme = useTheme()
  const [sheenPosition, setSheenPosition] = useState(0)

  const {
    currentPath,
    setCurrentPath,
    directories,
    expandPath,
    tryNavigateToPath,
    navigateToDirectory,
  } = useDirectoryBrowser({ initialPath })

  const directoryItems: SelectableListItem[] = useMemo(
    () =>
      directories.map((entry) => ({
        id: entry.path,
        label: entry.name,
        icon: entry.isParent ? '↑' : entry.isGitRepo ? '📦' : '📁',
        secondary: entry.isGitRepo ? '(git repo)' : undefined,
        accent: entry.isGitRepo,
      })),
    [directories],
  )

  const {
    searchQuery,
    setSearchQuery,
    focusedIndex,
    setFocusedIndex,
    filteredItems: filteredDirectoryItems,
    handleFocusChange,
  } = useSearchableList({
    items: directoryItems,
    resetKey: currentPath,
  })

  const recentProjects = useMemo(() => {
    const homeDir = os.homedir()
    return loadRecentProjects().filter((project) => project.path !== homeDir)
  }, [])

  const { terminalWidth, terminalHeight } = useTerminalLayout()
  const contentMaxWidth = Math.min(
    terminalWidth - LAYOUT.CONTENT_PADDING,
    LAYOUT.MAX_CONTENT_WIDTH,
  )
  const contentWidth = Math.min(LAYOUT.PREFERRED_CONTENT_WIDTH, contentMaxWidth)

  const isCompactMode = terminalHeight < LAYOUT.COMPACT_MODE_THRESHOLD
  const mainPadding = isCompactMode ? 0 : LAYOUT.MAIN_CONTENT_PADDING

  const essentialHeight =
    LAYOUT.INPUT_HEIGHT + 2 + LAYOUT.BOTTOM_BAR_HEIGHT + (isCompactMode ? 0 : 2)

  const remainingHeight = terminalHeight - essentialHeight

  const filePickerHeight = Math.max(
    LAYOUT.MIN_LIST_HEIGHT,
    Math.min(remainingHeight, LAYOUT.MAX_LIST_HEIGHT),
  )

  const spaceAfterFilePicker = remainingHeight - filePickerHeight

  const logoHeightNeeded =
    LAYOUT.LOGO_HEIGHT +
    (isCompactMode ? 0 : LAYOUT.LOGO_MARGIN_TOP + LAYOUT.LOGO_MARGIN_BOTTOM)
  const helpTextHeightNeeded =
    LAYOUT.HELP_TEXT_HEIGHT +
    (isCompactMode ? 0 : LAYOUT.HELP_TEXT_MARGIN_BOTTOM)

  let availableForOptional = spaceAfterFilePicker

  let recentsToShow = 0
  if (recentProjects.length > 0 && availableForOptional >= 2) {
    const baseRecentsHeight =
      1 + (isCompactMode ? 0 : LAYOUT.RECENTS_MARGIN_TOP)
    const remainingForRecents = availableForOptional - baseRecentsHeight
    recentsToShow = Math.min(
      recentProjects.length,
      Math.max(0, remainingForRecents),
      3,
    )
    if (recentsToShow > 0) {
      availableForOptional -=
        recentsToShow + 1 + (isCompactMode ? 0 : LAYOUT.RECENTS_MARGIN_TOP)
    }
  }

  const canShowLogo = !isCompactMode && availableForOptional >= logoHeightNeeded
  if (canShowLogo) {
    availableForOptional -= logoHeightNeeded
  }

  const canShowHelpText =
    !isCompactMode && availableForOptional >= helpTextHeightNeeded

  const canShowRecents = recentsToShow > 0
  const maxRecentsToShow = recentsToShow

  const canShowFilePicker = remainingHeight >= LAYOUT.MIN_LIST_HEIGHT
  const maxListHeight = filePickerHeight

  const shouldCenterContent = !isCompactMode && spaceAfterFilePicker > 10

  const blockColor = getLogoBlockColor(theme.name)
  const accentColor = getLogoAccentColor(theme.name)
  const { applySheenToChar } = useSheenAnimation({
    logoColor: theme.foreground,
    accentColor,
    blockColor,
    terminalWidth,
    sheenPosition,
    setSheenPosition,
  })

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
    applySheenToChar,
    textColor: theme.foreground,
  })

  const handleDirectorySelect = useCallback(
    (item: SelectableListItem) => {
      const entry = directories.find((d) => d.path === item.id)
      if (entry) {
        navigateToDirectory(entry)
      }
    },
    [directories, navigateToDirectory],
  )

  const selectCurrentDirectory = useCallback(() => {
    onSelectProject(currentPath)
  }, [currentPath, onSelectProject])

  const { handleTabCompletion } = usePathTabCompletion({
    searchQuery,
    setSearchQuery,
    currentPath,
    setCurrentPath,
    expandPath,
  })

  const handleSearchKeyIntercept = useCallback(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      if (key.name === 'escape') {
        if (searchQuery.length > 0) {
          setSearchQuery('')
        }
        return true
      }
      if (key.name === 'tab') {
        return handleTabCompletion()
      }
      if (key.name === 'up') {
        setFocusedIndex((prev) => Math.max(0, prev - 1))
        return true
      }
      if (key.name === 'down') {
        setFocusedIndex((prev) =>
          Math.min(filteredDirectoryItems.length - 1, prev + 1),
        )
        return true
      }
      if (isPlainEnterKey(key)) {
        if (searchQuery.startsWith('/') || searchQuery.startsWith('~')) {
          if (tryNavigateToPath(searchQuery)) {
            return true
          }
        }
        const focused = filteredDirectoryItems[focusedIndex]
        if (focused) {
          const entry = directories.find((d) => d.path === focused.id)
          if (entry) {
            navigateToDirectory(entry)
          }
        }
        return true
      }
      if (key.name === 'c' && key.ctrl) {
        void exitCliCleanly()
        return true
      }
      return false
    },
    [
      searchQuery,
      setSearchQuery,
      handleTabCompletion,
      setFocusedIndex,
      filteredDirectoryItems,
      focusedIndex,
      tryNavigateToPath,
      directories,
      navigateToDirectory,
    ],
  )

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.surface,
        padding: 0,
        flexDirection: 'column',
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: shouldCenterContent ? 'center' : 'flex-start',
          width: '100%',
          padding: mainPadding,
          gap: isCompactMode ? 0 : 1,
          flexGrow: 1,
          flexShrink: 1,
        }}
      >
        {canShowLogo && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              marginTop: isCompactMode ? 0 : LAYOUT.LOGO_MARGIN_TOP,
              marginBottom: isCompactMode ? 0 : LAYOUT.LOGO_MARGIN_BOTTOM,
              flexShrink: 0,
            }}
          >
            <box style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {logoComponent}
            </box>
          </box>
        )}

        <box
          style={{
            width: contentWidth,
            flexShrink: 0,
            marginBottom: 1,
            flexDirection: 'column',
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
              Select project workspace for{' '}
            </span>
            <span fg={theme.primary} attributes={TextAttributes.BOLD}>
              RivoCode
            </span>
            <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
              :
            </span>
          </text>
          <text style={{ wrapMode: 'none', fg: theme.muted }}>
            <span>Current: </span>
            <span fg={theme.secondary}>{formatCwd(currentPath)}</span>
          </text>
        </box>

        <box
          style={{
            width: contentWidth,
            flexShrink: 0,
            marginBottom: 1,
          }}
        >
          <MultilineInput
            value={searchQuery}
            onChange={({ text }) => setSearchQuery(text)}
            onSubmit={() => {}}
            onPaste={() => {}}
            onKeyIntercept={handleSearchKeyIntercept}
            placeholder="Type to search folder or enter path..."
            focused={true}
            maxHeight={1}
            minHeight={1}
            cursorPosition={searchQuery.length}
          />
        </box>

        {canShowFilePicker && (
          <box
            style={{
              flexDirection: 'column',
              width: contentWidth,
              borderStyle: 'single',
              borderColor: '#334155',
              flexShrink: 0,
            }}
            border={['top', 'bottom', 'left', 'right']}
          >
            <SelectableList
              items={filteredDirectoryItems}
              focusedIndex={focusedIndex}
              maxHeight={maxListHeight}
              onSelect={handleDirectorySelect}
              onFocusChange={handleFocusChange}
              emptyMessage={
                searchQuery ? 'No matching directories' : 'No subdirectories'
              }
            />
          </box>
        )}

        {canShowRecents && (
          <box
            style={{
              flexDirection: 'column',
              width: contentWidth,
              marginTop: isCompactMode ? 0 : LAYOUT.RECENTS_MARGIN_TOP,
              flexShrink: 0,
              gap: 0,
            }}
          >
            <text style={{ fg: theme.muted, height: 1 }}>Recent Workspaces:</text>
            {recentProjects.slice(0, maxRecentsToShow).map((project, idx) => (
              <box
                key={project.path}
                style={{
                  flexDirection: 'row',
                  gap: 1,
                  paddingLeft: isCompactMode ? 0 : LAYOUT.RECENTS_PADDING_LEFT,
                  height: 1,
                }}
              >
                <text style={{ fg: theme.primary }}>[{idx + 1}]</text>
                <TerminalLink
                  text={formatCwd(project.path)}
                  onActivate={() => onSelectProject(project.path)}
                  underlineOnHover={true}
                  containerStyle={{ width: 'auto' }}
                />
              </box>
            ))}
          </box>
        )}
      </box>

      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          paddingTop: 1,
          paddingBottom: 1,
          borderStyle: 'single',
          borderColor: theme.border,
          flexShrink: 0,
          backgroundColor: theme.surface,
        }}
        border={['top']}
      >
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: contentWidth,
          }}
        >
          <text style={{ fg: theme.muted }}>
            <span>↑/↓ navigate · </span>
            <span fg={theme.foreground}>enter</span>
            <span> open · </span>
            <span fg={theme.foreground}>tab</span>
            <span> complete</span>
          </text>

          <Button
            onClick={selectCurrentDirectory}
            style={{
              paddingLeft: 2,
              paddingRight: 2,
              paddingTop: 0,
              paddingBottom: 0,
              backgroundColor: theme.primary,
            }}
          >
            <text style={{ fg: '#000000', attributes: TextAttributes.BOLD }}>
              Open Workspace
            </text>
          </Button>
        </box>
      </box>
    </box>
  )
}
