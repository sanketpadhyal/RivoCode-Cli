import { useRenderer } from '@opentui/react'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Button } from './button'
import { useLoginMutation } from '../hooks/use-auth-query'
import { useClipboard } from '../hooks/use-clipboard'
import { useFetchLoginUrl } from '../hooks/use-fetch-login-url'
import { useLoginKeyboardHandlers } from '../hooks/use-login-keyboard-handlers'
import { useLoginPolling } from '../hooks/use-login-polling'
import { useLogo } from '../hooks/use-logo'
import { useSheenAnimation } from '../hooks/use-sheen-animation'
import { useTheme } from '../hooks/use-theme'
import { formatUrl, calculateResponsiveLayout } from '../login/utils'
import { useLoginStore } from '../state/login-store'
import { IS_FREEBUFF } from '../utils/constants'
import { copyTextToClipboard, isRemoteSession } from '../utils/clipboard'
import { getFingerprintId } from '../utils/fingerprint'
import { logger } from '../utils/logger'
import { getLogoBlockColor, getLogoAccentColor } from '../utils/theme-system'

import type { User } from '../utils/auth'

interface LoginModalProps {
  onLoginSuccess: (user: User) => void
  hasInvalidCredentials?: boolean | null
}

export const LoginModal = ({
  onLoginSuccess,
  hasInvalidCredentials = false,
}: LoginModalProps) => {
  const renderer = useRenderer()
  const theme = useTheme()

  const {
    loginUrl,
    loading,
    error,
    fingerprintId,
    fingerprintHash,
    expiresAt,
    isWaitingForEnter,
    hasOpenedBrowser,
    sheenPosition,
    justCopied,
    setLoginUrl,
    setLoading,
    setError,
    setFingerprintId,
    setFingerprintHash,
    setExpiresAt,
    setIsWaitingForEnter,
    setHasOpenedBrowser,
    setSheenPosition,
    setCopyMessage,
    setJustCopied,
    setHasClickedLink,
  } = useLoginStore()

  const [isCopyButtonHovered, setIsCopyButtonHovered] = useState(false)

  const loginMutation = useLoginMutation()

  const fetchLoginUrlMutation = useFetchLoginUrl({
    setLoginUrl,
    setFingerprintHash,
    setExpiresAt,
    setIsWaitingForEnter,
    setHasOpenedBrowser,
    setError,
  })

  const copyToClipboard = useCallback(
    async (text: string) => {
      if (!text || text.trim().length === 0) return

      setHasClickedLink(true)

      try {
        await copyTextToClipboard(text, {
          suppressGlobalMessage: true,
        })

        setJustCopied(true)
        setCopyMessage('✓ URL copied to clipboard!')
        setTimeout(() => {
          setCopyMessage(null)
          setJustCopied(false)
        }, 3000)
      } catch (err) {
        logger.error(err, 'Failed to copy to clipboard')
      }
    },
    [setHasClickedLink, setJustCopied, setCopyMessage],
  )

  const fetchLoginUrlAndOpenBrowser = useCallback(async () => {
    if (loading || hasOpenedBrowser) return

    setLoading(true)
    setError(null)

    const id = await getFingerprintId()
    setFingerprintId(id)

    fetchLoginUrlMutation.mutate(id, {
      onSettled: () => {
        setLoading(false)
      },
    })
  }, [
    loading,
    hasOpenedBrowser,
    setLoading,
    setError,
    setFingerprintId,
    fetchLoginUrlMutation,
  ])

  const loginMutationRef = useRef(loginMutation)
  const onLoginSuccessRef = useRef(onLoginSuccess)

  useEffect(() => {
    loginMutationRef.current = loginMutation
  }, [loginMutation])

  useEffect(() => {
    onLoginSuccessRef.current = onLoginSuccess
  }, [onLoginSuccess])

  const handleLoginSuccess = useCallback((user: User) => {
    loginMutationRef.current.mutate(user, {
      onSuccess: (validatedUser) => {
        onLoginSuccessRef.current(validatedUser)
      },
      onError: (error) => {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          '❌ Login validation failed, proceeding with raw user',
        )
        onLoginSuccessRef.current(user)
      },
    })
  }, [])

  const handleTimeout = useCallback(() => {
    setError('Login timed out. Please try again.')
    setIsWaitingForEnter(false)
  }, [setError, setIsWaitingForEnter])

  const handlePollingError = useCallback(
    (pollingError: string) => {
      setError(pollingError)
      setIsWaitingForEnter(false)
    },
    [setError, setIsWaitingForEnter],
  )

  useLoginPolling({
    loginUrl,
    fingerprintId,
    fingerprintHash,
    expiresAt,
    isWaitingForEnter,
    onSuccess: handleLoginSuccess,
    onTimeout: handleTimeout,
    onError: handlePollingError,
  })

  useLoginKeyboardHandlers({
    loginUrl,
    hasOpenedBrowser,
    loading,
    onFetchLoginUrl: fetchLoginUrlAndOpenBrowser,
    onCopyUrl: copyToClipboard,
  })

  const terminalWidth = renderer?.width || 80
  const terminalHeight = renderer?.height || 24

  const {
    isVerySmall,
    isNarrow,
    containerPadding,
    headerMarginTop,
    headerMarginBottom,
    sectionMarginBottom,
    contentMaxWidth,
    maxUrlWidth,
  } = calculateResponsiveLayout(terminalWidth, terminalHeight)

  const loginUrlLines = useMemo(
    () => (loginUrl ? formatUrl(loginUrl, maxUrlWidth) : []),
    [loginUrl, maxUrlWidth],
  )
  const loginUrlWrapped = loginUrlLines.length > 1

  const blockColor = getLogoBlockColor(theme.name)
  const accentColor = getLogoAccentColor(theme.name)
  const { applySheenToChar } = useSheenAnimation({
    logoColor: theme.foreground,
    accentColor,
    blockColor,
    terminalWidth: renderer?.width,
    sheenPosition,
    setSheenPosition,
  })

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
    applySheenToChar,
    textColor: theme.foreground,
  })

  const { hasSelection } = useClipboard()

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
      {hasInvalidCredentials && (
        <box
          style={{
            width: '100%',
            padding: 1,
            backgroundColor: theme.surface,
            flexShrink: 0,
          }}
        >
          <text style={{ wrapMode: 'word' }}>
            <span fg={theme.secondary}>
              {isNarrow
                ? "⚠ Found API key but it's invalid. Please log in again."
                : '⚠ We found an API key but it appears to be invalid. Please log in again to continue.'}
            </span>
          </text>
        </box>
      )}

      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: containerPadding,
          gap: 0,
        }}
      >
        <box
          key="codebuff-logo"
          style={{
            flexDirection: 'column',
            alignItems: contentMaxWidth < 40 ? 'center' : 'flex-start',
            marginTop: headerMarginTop,
            marginBottom: headerMarginBottom,
            flexShrink: 0,
          }}
        >
          {logoComponent}
        </box>

        {loading && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <text style={{ wrapMode: 'none' }}>
              <span fg={theme.secondary}>Loading...</span>
            </text>
          </box>
        )}

        {error && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: sectionMarginBottom,
              maxWidth: contentMaxWidth,
              flexShrink: 0,
            }}
          >
            <text style={{ wrapMode: 'word' }}>
              <span fg="red">Error: {error}</span>
            </text>
            {!isVerySmall && (
              <text style={{ wrapMode: 'word' }}>
                <span fg={theme.secondary}>
                  {isNarrow
                    ? 'Please try again'
                    : 'Please restart the CLI and try again'}
                </span>
              </text>
            )}
          </box>
        )}

        {!loading && !error && !hasOpenedBrowser && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: sectionMarginBottom,
              maxWidth: contentMaxWidth,
              flexShrink: 0,
            }}
          >
            <text style={{ wrapMode: 'word' }}>
              <span fg={'#00cc00'}>
                Press ENTER to login...
              </span>
            </text>
          </box>
        )}

        {!loading && !error && loginUrl && hasOpenedBrowser && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: sectionMarginBottom,
              maxWidth: contentMaxWidth,
              flexShrink: 0,
              gap: isVerySmall ? 0 : 1,
            }}
          >
            <text style={{ wrapMode: 'word' }}>
              <span fg={theme.foreground}>
                {isNarrow
                  ? 'Open this URL to login:'
                  : 'Open this URL in your browser to login:'}
              </span>
            </text>
            <box
              style={{
                width: '100%',
                flexShrink: 0,
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              {loginUrlLines.map((line, index) => (
                <text key={index} style={{ wrapMode: 'none' }}>
                  <span
                    fg={
                      justCopied
                        ? theme.success
                        : hasSelection
                          ? theme.info
                          : theme.primary
                    }
                  >
                    {line}
                  </span>
                </text>
              ))}
            </box>
            {loginUrlWrapped && (
              <text style={{ wrapMode: 'word' }}>
                <span fg={theme.warning}>
                  ⚠ The link wraps across lines — clicking it will cut it off.
                  Press c to copy the full link instead.
                </span>
              </text>
            )}
            <box
              style={{
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                flexShrink: 0,
              }}
            >
              <Button
                onClick={() => copyToClipboard(loginUrl)}
                onMouseOver={() => setIsCopyButtonHovered(true)}
                onMouseOut={() => setIsCopyButtonHovered(false)}
              >
                <text>
                  <span
                    fg={
                      justCopied
                        ? theme.foreground
                        : isCopyButtonHovered
                          ? theme.foreground
                          : theme.primary
                    }
                  >
                    {justCopied ? '[ ✓ Copied! ]' : '[ Copy link (c) ]'}
                  </span>
                </text>
              </Button>
            </box>
            <box
              style={{
                marginTop: isVerySmall ? 1 : 2,
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                flexShrink: 0,
              }}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg={theme.secondary}>
                  Waiting for login...
                </span>
              </text>
              {isRemoteSession() && !isVerySmall && (
                <text style={{ wrapMode: 'word' }}>
                  <span fg={theme.secondary}>
                    Tip: Can't copy? Exit and run{' '}
                  </span>
                  <span fg={theme.primary}>{IS_FREEBUFF ? 'freebuff' : 'codebuff'} login</span>
                  <span fg={theme.secondary}>
                    {' '}instead.
                  </span>
                </text>
              )}
            </box>
          </box>
        )}
      </box>
    </box>
  )
}
