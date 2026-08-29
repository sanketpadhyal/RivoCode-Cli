import { openaiModels, openrouterModels } from '@codebuff/common/old-constants'
import { isAbortError, unwrapPromptResult } from '@codebuff/common/util/error'

import type {
  FinetunedVertexModel,
} from '@codebuff/common/old-constants'
import type { PromptAiSdkFn } from '@codebuff/common/types/contracts/llm'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { ParamsExcluding } from '@codebuff/common/types/function-params'
import type { Message } from '@codebuff/common/types/messages/codebuff-message'

export async function promptFlashWithFallbacks(
  params: {
    messages: Message[]
    costMode?: string
    useGPT4oInsteadOfClaude?: boolean
    thinkingBudget?: number
    useFinetunedModel?: FinetunedVertexModel | undefined
    promptAiSdk: PromptAiSdkFn
    logger: Logger
  } & ParamsExcluding<PromptAiSdkFn, 'messages'>,
): Promise<string> {
  const {
    messages,
    costMode: _costMode,
    useGPT4oInsteadOfClaude,
    useFinetunedModel,
    promptAiSdk,
    logger,
  } = params

  if (useFinetunedModel) {
    try {
      return unwrapPromptResult(
        await promptAiSdk({
          ...params,
          messages,
          model: useFinetunedModel,
        }),
      )
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      logger.warn(
        { error },
        'Error calling finetuned model, falling back to Gemini API',
      )
    }
  }

  try {
    return unwrapPromptResult(await promptAiSdk({ ...params, messages }))
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    logger.warn(
      { error },
      `Error calling Gemini API, falling back to ${useGPT4oInsteadOfClaude ? 'gpt-4o' : 'Claude'}`,
    )
    return unwrapPromptResult(
      await promptAiSdk({
        ...params,
        messages,
        model: useGPT4oInsteadOfClaude
          ? openaiModels.gpt4o
          : openrouterModels.openrouter_claude_3_5_haiku,
      }),
    )
  }
}
