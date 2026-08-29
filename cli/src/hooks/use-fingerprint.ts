import { useEffect, useState } from 'react'

import { calculateFingerprint, generateFingerprintIdSync } from '../utils/fingerprint'
import { logger } from '../utils/logger'

interface UseFingerprintResult {
  fingerprintId: string
  isEnhanced: boolean
  isLoading: boolean
}

export function useFingerprint(): UseFingerprintResult {
  const [state, setState] = useState<UseFingerprintResult>(() => ({
    fingerprintId: generateFingerprintIdSync(),
    isEnhanced: false,
    isLoading: true,
  }))

  useEffect(() => {
    let cancelled = false

    const generateEnhanced = async () => {
      try {
        const enhancedFingerprint = await calculateFingerprint()
        if (!cancelled) {
          setState({
            fingerprintId: enhancedFingerprint,
            isEnhanced: enhancedFingerprint.startsWith('enhanced-'),
            isLoading: false,
          })
        }
      } catch (error) {
        logger.error(error, 'Failed to generate enhanced fingerprint')
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
          }))
        }
      }
    }

    generateEnhanced()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
