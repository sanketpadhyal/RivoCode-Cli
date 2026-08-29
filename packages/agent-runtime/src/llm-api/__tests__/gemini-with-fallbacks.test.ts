import { openrouterModels } from '@rivocode/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@rivocode/common/testing/impl/agent-runtime'
import {
  ABORT_ERROR_MESSAGE,
  promptAborted,
  promptSuccess,
} from '@rivocode/common/util/error'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { promptFlashWithFallbacks } from '../gemini-with-fallbacks'

import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@rivocode/common/types/contracts/agent-runtime'

describe('promptFlashWithFallbacks', () => {
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

  const baseParams = {
    model: openrouterModels.openrouter_gemini2_5_flash,
    runId: 'test-run-id',
    clientSessionId: 'test-client-session',
    fingerprintId: 'test-fingerprint',
    userInputId: 'test-user-input',
    userId: 'test-user-id',
  }

  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL }
  })

  afterEach(() => {
    mock.restore()
  })

  describe('abort handling', () => {
    it('should throw immediately when finetuned model returns aborted', async () => {
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted('User cancelled')),
      )

      await expect(
        promptFlashWithFallbacks({
          ...agentRuntimeImpl,
          ...baseParams,
          messages: [],
          useFinetunedModel: 'gemini-2.0-flash-exp' as any,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow(ABORT_ERROR_MESSAGE)

      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })

    it('should throw immediately when main Gemini call returns aborted', async () => {
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted()),
      )

      await expect(
        promptFlashWithFallbacks({
          ...agentRuntimeImpl,
          ...baseParams,
          messages: [],
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow(ABORT_ERROR_MESSAGE)

      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })

    it('should throw immediately when fallback call returns aborted', async () => {
      let callCount = 0
      agentRuntimeImpl.promptAiSdk = mock(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Gemini API error'))
        }
        return Promise.resolve(promptAborted('User cancelled during fallback'))
      })

      await expect(
        promptFlashWithFallbacks({
          ...agentRuntimeImpl,
          ...baseParams,
          messages: [],
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow(ABORT_ERROR_MESSAGE)

      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(2)
    })

    it('should not fall back when finetuned model is aborted even if other models available', async () => {
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.resolve(promptAborted()),
      )

      await expect(
        promptFlashWithFallbacks({
          ...agentRuntimeImpl,
          ...baseParams,
          messages: [],
          useFinetunedModel: 'gemini-2.0-flash-exp' as any,
          useGPT4oInsteadOfClaude: true,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow(ABORT_ERROR_MESSAGE)

      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })

    it('should not fall back when native AbortError is thrown', async () => {
      const nativeAbortError = new DOMException('signal is aborted without reason', 'AbortError')
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.reject(nativeAbortError),
      )

      await expect(
        promptFlashWithFallbacks({
          ...agentRuntimeImpl,
          ...baseParams,
          messages: [],
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow()

      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })

    it('should not fall back when Error with name AbortError is thrown', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.reject(abortError),
      )

      await expect(
        promptFlashWithFallbacks({
          ...agentRuntimeImpl,
          ...baseParams,
          messages: [],
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow()

      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })

    it('should fall back from finetuned model to Gemini on non-abort error', async () => {
      let callCount = 0
      agentRuntimeImpl.promptAiSdk = mock(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Finetuned model error'))
        }
        return Promise.resolve(promptSuccess('Gemini response'))
      })

      const result = await promptFlashWithFallbacks({
        ...agentRuntimeImpl,
        ...baseParams,
        messages: [],
        useFinetunedModel: 'gemini-2.0-flash-exp' as any,
        signal: new AbortController().signal,
      })

      expect(result).toBe('Gemini response')
      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(2)
    })

    it('should fall back from Gemini to Claude on non-abort error', async () => {
      let callCount = 0
      agentRuntimeImpl.promptAiSdk = mock(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Gemini error'))
        }
        return Promise.resolve(promptSuccess('Claude response'))
      })

      const result = await promptFlashWithFallbacks({
        ...agentRuntimeImpl,
        ...baseParams,
        messages: [],
        signal: new AbortController().signal,
      })

      expect(result).toBe('Claude response')
      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(2)
    })

    it('should fall back from Gemini to GPT-4o when useGPT4oInsteadOfClaude is true', async () => {
      let callCount = 0
      agentRuntimeImpl.promptAiSdk = mock(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Gemini error'))
        }
        return Promise.resolve(promptSuccess('GPT-4o response'))
      })

      const result = await promptFlashWithFallbacks({
        ...agentRuntimeImpl,
        ...baseParams,
        messages: [],
        useGPT4oInsteadOfClaude: true,
        signal: new AbortController().signal,
      })

      expect(result).toBe('GPT-4o response')
      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(2)
    })
  })

  describe('successful responses', () => {
    it('should return response from finetuned model when successful', async () => {
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.resolve(promptSuccess('Finetuned model response')),
      )

      const result = await promptFlashWithFallbacks({
        ...agentRuntimeImpl,
        ...baseParams,
        messages: [],
        useFinetunedModel: 'gemini-2.0-flash-exp' as any,
        signal: new AbortController().signal,
      })

      expect(result).toBe('Finetuned model response')
      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })

    it('should return response from main Gemini when successful', async () => {
      agentRuntimeImpl.promptAiSdk = mock(() =>
        Promise.resolve(promptSuccess('Gemini response')),
      )

      const result = await promptFlashWithFallbacks({
        ...agentRuntimeImpl,
        ...baseParams,
        messages: [],
        signal: new AbortController().signal,
      })

      expect(result).toBe('Gemini response')
      expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledTimes(1)
    })
  })
})
