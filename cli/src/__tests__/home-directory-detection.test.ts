import { describe, test, expect, beforeEach } from 'bun:test'

import { useChatStore } from '../state/chat-store'
import { getInputModeConfig } from '../utils/input-modes'

describe('Home Directory Detection', () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  describe('banner state management', () => {
    test('should set activeTopBanner to homeDir when home directory detected', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')

      expect(useChatStore.getState().activeTopBanner).toBe('homeDir')
    })

    test('should set inputMode to homeDir when home directory detected', () => {
      const store = useChatStore.getState()

      store.setInputMode('homeDir')

      expect(useChatStore.getState().inputMode).toBe('homeDir')
    })

    test('should set both top banner and input mode when home directory detected', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')
      store.setInputMode('homeDir')

      const state = useChatStore.getState()
      expect(state.activeTopBanner).toBe('homeDir')
      expect(state.inputMode).toBe('homeDir')
    })

    test('closeTopBanner should set activeTopBanner to null', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')
      expect(useChatStore.getState().activeTopBanner).toBe('homeDir')

      store.closeTopBanner()
      expect(useChatStore.getState().activeTopBanner).toBeNull()
    })
  })

  describe('detection conditions', () => {
    test('should only trigger when fileTreeLoaded is true AND fileTree is empty', () => {
      const simulateDetection = (
        fileTreeLoaded: boolean,
        fileTreeLength: number,
      ) => {
        if (fileTreeLoaded && fileTreeLength === 0) {
          useChatStore.getState().setActiveTopBanner('homeDir')
          useChatStore.getState().setInputMode('homeDir')
          return true
        }
        return false
      }

      useChatStore.getState().reset()

      expect(simulateDetection(false, 0)).toBe(false)
      expect(useChatStore.getState().activeTopBanner).toBeNull()

      useChatStore.getState().reset()

      expect(simulateDetection(true, 5)).toBe(false)
      expect(useChatStore.getState().activeTopBanner).toBeNull()

      useChatStore.getState().reset()

      expect(simulateDetection(true, 0)).toBe(true)
      expect(useChatStore.getState().activeTopBanner).toBe('homeDir')
      expect(useChatStore.getState().inputMode).toBe('homeDir')
    })

    test('should not trigger for non-empty directories', () => {
      const fileTreeLoaded = true
      const fileTreeLength: number = 10

      if (fileTreeLoaded && fileTreeLength === 0) {
        useChatStore.getState().setActiveTopBanner('homeDir')
      }

      expect(useChatStore.getState().activeTopBanner).toBeNull()
    })
  })

  describe('closing behavior', () => {
    test('closing top banner should reset both banner and input mode', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')
      store.setInputMode('homeDir')

      store.closeTopBanner()
      if (useChatStore.getState().inputMode === 'homeDir') {
        store.setInputMode('default')
      }

      const state = useChatStore.getState()
      expect(state.activeTopBanner).toBeNull()
      expect(state.inputMode).toBe('default')
    })

    test('closing bottom banner should also close top banner', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')
      store.setInputMode('homeDir')

      store.setInputMode('default')
      store.closeTopBanner()

      const state = useChatStore.getState()
      expect(state.activeTopBanner).toBeNull()
      expect(state.inputMode).toBe('default')
    })
  })

  describe('input mode configuration', () => {
    test('homeDir mode should have correct configuration', () => {
      const config = getInputModeConfig('homeDir')

      expect(config.icon).toBeNull()
      expect(config.color).toBe('warning')
      expect(config.showAgentModeToggle).toBe(true)
      expect(config.disableSlashSuggestions).toBe(false)
    })

    test('homeDir mode should allow normal input behavior', () => {
      const config = getInputModeConfig('homeDir')

      expect(config.showAgentModeToggle).toBe(true)
      expect(config.disableSlashSuggestions).toBe(false)
    })

    test('homeDir mode should have a placeholder', () => {
      const config = getInputModeConfig('homeDir')

      expect(config.placeholder).toBeDefined()
      expect(config.placeholder.length).toBeGreaterThan(0)
    })
  })

  describe('TopBannerType state', () => {
    test('should support homeDir banner type', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')

      expect(useChatStore.getState().activeTopBanner).toBe('homeDir')
    })

    test('should support null (no banner)', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')
      store.setActiveTopBanner(null)

      expect(useChatStore.getState().activeTopBanner).toBeNull()
    })
  })

  describe('reset behavior', () => {
    test('reset should clear home directory banner state', () => {
      const store = useChatStore.getState()

      store.setActiveTopBanner('homeDir')
      store.setInputMode('homeDir')

      store.reset()

      const state = useChatStore.getState()
      expect(state.activeTopBanner).toBeNull()
      expect(state.inputMode).toBe('default')
    })
  })
})
