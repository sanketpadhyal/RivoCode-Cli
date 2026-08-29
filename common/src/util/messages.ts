import { modelMessageSchema } from 'ai'
import { cloneDeep, has, isEqual } from 'lodash'

import type { Logger } from '../types/contracts/logger'
import type { JSONValue } from '../types/json'
import type {
  AssistantMessage,
  AuxiliaryMessageData,
  Message,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from '../types/messages/codebuff-message'
import type {
  ToolCallPart,
  ToolResultOutput,
} from '../types/messages/content-part'
import type { ProviderMetadata } from '../types/messages/provider-metadata'
import type {
  AssistantModelMessage,
  ModelMessage,
  SystemModelMessage,
  ToolModelMessage,
  UserModelMessage,
} from 'ai'

export function toContentString(msg: ModelMessage): string {
  const { content } = msg
  if (typeof content === 'string') return content
  return content
    .map((item) =>
      item && 'text' in item && typeof item.text === 'string' ? item.text : '',
    )
    .join('\n')
}

export function withCacheControl<T extends object>(
  obj: T & { providerOptions?: ProviderMetadata },
): T & { providerOptions: ProviderMetadata } {
  const wrapper = cloneDeep(obj) as T & {
    providerOptions: ProviderMetadata
  }
  if (!wrapper.providerOptions) {
    wrapper.providerOptions = {}
  }

  for (const provider of [
    'anthropic',
    'openrouter',
    'openaiCompatible',
  ] as const) {
    if (!wrapper.providerOptions[provider]) {
      wrapper.providerOptions[provider] = {}
    }
    wrapper.providerOptions[provider].cache_control = { type: 'ephemeral' }
  }

  return wrapper
}

export function withoutCacheControl<T extends object>(
  obj: T & { providerOptions?: ProviderMetadata },
): T & { providerOptions?: ProviderMetadata } {
  const wrapper = cloneDeep(obj) as T & {
    providerOptions?: ProviderMetadata
  }

  for (const provider of [
    'anthropic',
    'openrouter',
    'openaiCompatible',
  ] as const) {
    if (has(wrapper.providerOptions?.[provider]?.cache_control, 'type')) {
      delete wrapper.providerOptions?.[provider]?.cache_control?.type
    }
    if (
      Object.keys(wrapper.providerOptions?.[provider]?.cache_control ?? {})
        .length === 0
    ) {
      delete wrapper.providerOptions?.[provider]?.cache_control
    }
    if (Object.keys(wrapper.providerOptions?.[provider] ?? {}).length === 0) {
      delete wrapper.providerOptions?.[provider]
    }
  }

  if (Object.keys(wrapper.providerOptions ?? {}).length === 0) {
    delete wrapper.providerOptions
  }

  return wrapper
}

type NonStringContent<T extends { content: any }> = Omit<T, 'content'> & {
  content: Exclude<T['content'], string>
}
type ModelMessageWithAuxiliaryData = (
  | SystemModelMessage
  | NonStringContent<UserModelMessage>
  | NonStringContent<AssistantModelMessage>
  | ToolModelMessage
) &
  AuxiliaryMessageData

function assistantToCodebuffMessage(
  message: Omit<AssistantMessage, 'content'> & {
    content: Exclude<AssistantMessage['content'], string>[number]
  },
): AssistantMessage {
  return cloneDeep({ ...message, content: [message.content] })
}

function toolResultMessage(
  message: ToolMessage,
  output: Extract<ToolResultOutput, { type: 'json' }>,
): ModelMessageWithAuxiliaryData {
  return cloneDeep<ToolModelMessage>({
    ...message,
    role: 'tool',
    content: [{ ...message, output, type: 'tool-result' }],
  })
}

const EMPTY_TOOL_OUTPUT = { type: 'json', value: '' } as const

function convertToolResultMessage(
  message: ToolMessage,
): ModelMessageWithAuxiliaryData[] {
  if (message.content.length === 0) {
    return [toolResultMessage(message, EMPTY_TOOL_OUTPUT)]
  }
  const toolMessages: ModelMessageWithAuxiliaryData[] = []
  const mediaMessages: ModelMessageWithAuxiliaryData[] = []
  for (const c of message.content) {
    if (c.type === 'json') {
      toolMessages.push(toolResultMessage(message, c))
      continue
    }
    if (c.type === 'media') {
      mediaMessages.push(
        cloneDeep<UserMessage>({
          ...message,
          role: 'user',
          content: [{ type: 'file', data: c.data, mediaType: c.mediaType }],
        }),
      )
      continue
    }
    c satisfies never
    throw new Error(
      `Invalid tool output type: ${(c as { type: unknown }).type}`,
    )
  }

  if (toolMessages.length === 0) {
    toolMessages.push(toolResultMessage(message, EMPTY_TOOL_OUTPUT))
  }

  return [...toolMessages, ...mediaMessages]
}

function convertToolMessage(message: Message): ModelMessageWithAuxiliaryData[] {
  if (message.role === 'system') {
    return [
      {
        ...message,
        content: message.content.map(({ text }) => text).join('\n\n'),
      },
    ]
  }
  if (message.role === 'user') {
    return [cloneDeep(message)]
  }
  if (message.role === 'assistant') {
    if (typeof message.content === 'string') {
      return [
        cloneDeep({
          ...message,
          content: [{ type: 'text' as const, text: message.content }],
        }),
      ]
    }
    return message.content.map((c) => {
      return assistantToCodebuffMessage({
        ...message,
        content: c,
      })
    })
  }
  if (message.role === 'tool') {
    return convertToolResultMessage(message)
  }
  message satisfies never
  throw new Error(
    `Invalid message role: ${(message as { role: unknown }).role}`,
  )
}

function convertToolMessages(
  messages: Message[],
): ModelMessageWithAuxiliaryData[] {
  const withoutToolMessages: ModelMessageWithAuxiliaryData[] = []
  const unanswered = new Set<string>()
  let pendingMedia: ModelMessageWithAuxiliaryData[] = []
  const flushMedia = () => {
    if (unanswered.size > 0 || pendingMedia.length === 0) return
    withoutToolMessages.push(...pendingMedia)
    pendingMedia = []
  }

  for (const message of messages) {
    const converted = convertToolMessage(message)
    if (message.role !== 'tool') {
      flushMedia()
      withoutToolMessages.push(...converted)
      for (const part of converted) {
        if (part.role !== 'assistant') continue
        for (const content of part.content) {
          if (content.type !== 'tool-call') continue
          if (content.providerExecuted !== true) {
            unanswered.add(content.toolCallId)
          }
        }
      }
      continue
    }
    for (const part of converted) {
      if (part.role !== 'tool') {
        pendingMedia.push(part)
        continue
      }
      withoutToolMessages.push(part)
      for (const content of part.content) {
        if (content.type === 'tool-result') {
          unanswered.delete(content.toolCallId)
        }
      }
    }
    flushMedia()
  }

  withoutToolMessages.push(...pendingMedia)
  return withoutToolMessages
}

const LONE_SURROGATE_REGEX =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

function toWellFormedString(str: string): string {
  return str.replace(LONE_SURROGATE_REGEX, '�')
}

function wellFormStringsInPlace(value: unknown): void {
  if (!value || typeof value !== 'object') return
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    const item = obj[key]
    if (typeof item === 'string') {
      obj[key] = toWellFormedString(item)
    } else {
      wellFormStringsInPlace(item)
    }
  }
}

export function convertCbToModelMessages({
  messages,
  includeCacheControl = true,
  logger,
}: {
  messages: Message[]
  includeCacheControl?: boolean
  logger?: Logger
}): ModelMessage[] {
  const sendableMessages = dropUnansweredToolCalls(messages)
  const toolMessagesConverted: ModelMessageWithAuxiliaryData[] =
    convertToolMessages(sendableMessages)

  const aggregated: ModelMessageWithAuxiliaryData[] = []
  for (const message of toolMessagesConverted) {
    if (aggregated.length === 0) {
      aggregated.push(message)
      continue
    }

    const lastMessage = aggregated[aggregated.length - 1]
    if (
      lastMessage.timeToLive !== message.timeToLive ||
      !isEqual(lastMessage.providerOptions, message.providerOptions) ||
      !isEqual(lastMessage.tags, message.tags)
    ) {
      aggregated.push(message)
      continue
    }
    if (lastMessage.role === 'system' && message.role === 'system') {
      lastMessage.content += '\n\n' + message.content
      continue
    }
    if (lastMessage.role === 'user' && message.role === 'user') {
      lastMessage.content.push(...message.content)
      continue
    }
    if (lastMessage.role === 'assistant' && message.role === 'assistant') {
      lastMessage.content.push(...message.content)
      continue
    }

    aggregated.push(message)
  }

  for (const message of aggregated) {
    if (typeof message.content === 'string') {
      message.content = toWellFormedString(message.content)
    } else {
      wellFormStringsInPlace(message.content)
    }
  }

  if (!includeCacheControl) {
    return aggregated
  }

  for (const tag of [
    'LAST_ASSISTANT_MESSAGE',
    'USER_PROMPT',
    'STEP_PROMPT',
    undefined,
  ] as const) {
    let index =
      tag === 'LAST_ASSISTANT_MESSAGE'
        ? aggregated.findLastIndex((m) => m.role === 'assistant')
        : tag
          ? aggregated.findLastIndex((m) => m.tags?.includes(tag))
          : aggregated.length
    if (index <= 0) {
      continue
    }

    let prevMessage: (typeof aggregated)[number]
    let contentBlock: (typeof prevMessage)['content']
    addCacheControlLoop: while (true) {
      index--

      if (index < 0) {
        break
      }

      prevMessage = aggregated[index]
      contentBlock = prevMessage.content

      if (typeof contentBlock === 'string') {
        aggregated[index] = withCacheControl(aggregated[index])
        break
      }

      let lastContentIndex = contentBlock.length
      let lastContentPart: (typeof contentBlock)[number]
      while (true) {
        lastContentIndex--
        lastContentPart = contentBlock[lastContentIndex]

        if (lastContentIndex < 0) {
          break
        }

        if (lastContentPart.type !== 'text') {
          contentBlock[lastContentIndex] = withCacheControl(
            contentBlock[lastContentIndex],
          )
          break addCacheControlLoop
        }

        prevMessage.content = [
          ...contentBlock.slice(0, lastContentIndex),
          withCacheControl(lastContentPart),
          ...contentBlock.slice(lastContentIndex + 1),
        ] as typeof contentBlock

        break addCacheControlLoop
      }
      break
    }
  }

  for (let i = 0; i < aggregated.length; i++) {
    const message = aggregated[i]
    const result = modelMessageSchema.safeParse(message)
    if (!result.success) {
      if (logger) {
        logger.error(
          { message, aggregated, error: result.error },
          `convertCbToModelMessages: Message at index ${i} failed schema validation.`,
        )
      }
      throw new Error(
        `convertCbToModelMessages: Message at index ${i} failed schema validation.\n` +
        `Role: ${message.role}\n` +
        `Message:\n${result.error.message}`,
      )
    }
  }

  return aggregated
}

export function dropUnansweredToolCalls(messages: Message[]): Message[] {
  const pending = new Map<string, ToolCallPart[]>()
  const unanswered = new Set<ToolCallPart>()
  const flushPending = () => {
    for (const calls of pending.values()) {
      for (const call of calls) unanswered.add(call)
    }
    pending.clear()
  }

  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type !== 'tool-call' || part.providerExecuted === true) continue
        const calls = pending.get(part.toolCallId)
        if (calls) calls.push(part)
        else pending.set(part.toolCallId, [part])
      }
    } else if (message.role === 'tool') {
      pending.delete(message.toolCallId)
    } else if (message.role === 'user' || message.role === 'system') {
      flushPending()
    }
  }
  flushPending()

  if (unanswered.size === 0) return messages

  return messages.flatMap((message) => {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      return [message]
    }
    const content = message.content.filter(
      (part) => part.type !== 'tool-call' || !unanswered.has(part),
    )
    return content.length > 0 ? [{ ...message, content }] : []
  })
}

export type SystemContent =
  | string
  | SystemMessage['content'][number]
  | SystemMessage['content']
export function systemContent(
  content: SystemContent,
): SystemMessage['content'] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  if (Array.isArray(content)) {
    return content
  }
  return [content]
}

export function systemMessage(
  params:
    | SystemContent
    | ({
      content: SystemContent
    } & Omit<SystemMessage, 'role' | 'content'>),
): SystemMessage {
  if (typeof params === 'object' && 'content' in params) {
    return {
      ...params,
      role: 'system',
      content: systemContent(params.content),
    }
  }
  return {
    role: 'system',
    content: systemContent(params),
  }
}

export type UserContent =
  | string
  | UserMessage['content'][number]
  | UserMessage['content']
export function userContent(content: UserContent): UserMessage['content'] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  if (Array.isArray(content)) {
    return content
  }
  return [content]
}

export function userMessage(
  params:
    | UserContent
    | ({
      content: UserContent
    } & Omit<UserMessage, 'role' | 'content'>),
): UserMessage {
  if (typeof params === 'object' && 'content' in params) {
    return {
      ...params,
      role: 'user',
      content: userContent(params.content),
      sentAt: Date.now(),
    }
  }
  return {
    role: 'user',
    content: userContent(params),
    sentAt: Date.now(),
  }
}

export type AssistantContent =
  | string
  | AssistantMessage['content'][number]
  | AssistantMessage['content']
export function assistantContent(
  content: AssistantContent,
): AssistantMessage['content'] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  if (Array.isArray(content)) {
    return content
  }
  return [content]
}

export function assistantMessage(
  params:
    | AssistantContent
    | ({
      content: AssistantContent
    } & Omit<AssistantMessage, 'role' | 'content'>),
): AssistantMessage {
  if (typeof params === 'object' && 'content' in params) {
    return {
      ...params,
      role: 'assistant',
      content: assistantContent(params.content),
      sentAt: Date.now(),
    }
  }
  return {
    role: 'assistant',
    content: assistantContent(params),
    sentAt: Date.now(),
  }
}

export function jsonToolResult<T extends JSONValue>(
  value: T,
): [
    Extract<ToolResultOutput, { type: 'json' }> & {
      value: T
    },
  ] {
  return [
    {
      type: 'json',
      value,
    },
  ]
}

export function mediaToolResult(params: {
  data: string
  mediaType: string
}): [Extract<ToolResultOutput, { type: 'media' }>] {
  const { data, mediaType } = params
  return [
    {
      type: 'media',
      data,
      mediaType,
    },
  ]
}
