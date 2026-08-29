import { AskUserBridge } from '@rivocode/common/utils/ask-user-bridge'
import { useEffect } from 'react'

import { useChatStore } from '../state/chat-store'

import type { AskUserQuestion } from '../types/store'

const REDUNDANT_OPTION_PATTERNS = [
  /^custom$/i,
  /^other$/i,
  /^none\s*(of\s*the\s*above)?$/i,
  /^something\s*else$/i,
  /^enter\s*(my\s*)?own$/i,
  /^type\s*(my\s*)?own$/i,
  /^write\s*(my\s*)?own$/i,
]

function getOptionLabel(option: string | { label: string; description?: string }): string {
  return typeof option === 'string' ? option : option.label
}

function isRedundantOption(option: string | { label: string; description?: string }): boolean {
  const label = getOptionLabel(option).trim()
  return REDUNDANT_OPTION_PATTERNS.some((pattern) => pattern.test(label))
}

function filterRedundantOptions(questions: AskUserQuestion[]): AskUserQuestion[] {
  return questions.map((question) => {
    const filteredOptions = question.options.filter((option) => !isRedundantOption(option))
    return {
      ...question,
      options: filteredOptions as typeof question.options,
    }
  })
}

export function useAskUserBridge() {
  const setAskUserState = useChatStore((state) => state.setAskUserState)

  useEffect(() => {
    const unsubscribe = AskUserBridge.subscribe((request) => {
      if (request) {
        const filteredQuestions = filterRedundantOptions(request.questions)
        setAskUserState({
          toolCallId: request.toolCallId,
          questions: filteredQuestions,
          selectedAnswers: filteredQuestions.map((q) => (q.multiSelect ? [] : -1)),
          otherTexts: new Array(filteredQuestions.length).fill(''),
        })
      } else {
        setAskUserState(null)
      }
    })
    return unsubscribe
  }, [setAskUserState])

  const submitAnswers = (
    answers: Array<{
      questionIndex: number
      selectedOption?: string
      selectedOptions?: string[]
      otherText?: string
    }>
  ) => {
    AskUserBridge.submit({ answers })
  }

  const skip = () => {
    AskUserBridge.submit({ skipped: true })
  }

  return { submitAnswers, skip }
}
