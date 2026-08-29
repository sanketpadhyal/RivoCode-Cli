export type JSONValue =
  | null
  | string
  | number
  | boolean
  | JSONObject
  | JSONArray

export type JSONObject = { [key: string]: JSONValue | undefined }

export type JSONArray = JSONValue[]

export type JsonSchema = {
  type?:
    | 'object'
    | 'array'
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'
    | 'integer'
  description?: string
  properties?: Record<string, JsonSchema | boolean>
  required?: string[]
  enum?: Array<string | number | boolean | null>
  [k: string]: unknown
}
export type JsonObjectSchema = JsonSchema & { type: 'object' }

export type DataContent = string | Uint8Array | ArrayBuffer | Buffer

export type ProviderMetadata = Record<
  string,
  Record<string, JSONValue | undefined>
>

export type TextPart = {
  type: 'text'
  text: string
  providerOptions?: ProviderMetadata
}

export type ImagePart = {
  type: 'image'
  image: DataContent
  mediaType?: string
  providerOptions?: ProviderMetadata
}

export type FilePart = {
  type: 'file'
  data: DataContent
  filename?: string
  mediaType: string
  providerOptions?: ProviderMetadata
}

export type ReasoningPart = {
  type: 'reasoning'
  text: string
  providerOptions?: ProviderMetadata
}

export type ToolCallPart = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  providerOptions?: ProviderMetadata
  providerExecuted?: boolean
}

export type ToolResultOutput =
  | {
      type: 'json'
      value: JSONValue
    }
  | {
      type: 'media'
      data: string
      mediaType: string
    }

export type AuxiliaryMessageData = {
  providerOptions?: ProviderMetadata
  tags?: string[]

  sentAt?: number

  timeToLive?: 'agentStep' | 'userPrompt'
  keepDuringTruncation?: boolean
  keepLastTags?: string[]
}

export type SystemMessage = {
  role: 'system'
  content: TextPart[]
} & AuxiliaryMessageData

export type UserMessage = {
  role: 'user'
  content: (TextPart | ImagePart | FilePart)[]
} & AuxiliaryMessageData

export type AssistantMessage = {
  role: 'assistant'
  content: (TextPart | ReasoningPart | ToolCallPart)[]
} & AuxiliaryMessageData

export type ToolMessage = {
  role: 'tool'
  toolCallId: string
  toolName: string
  content: ToolResultOutput[]
} & AuxiliaryMessageData

export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage

export type MCPConfig =
  | {
      type?: 'stdio'
      command: string
      args?: string[]
      env?: Record<string, string>
    }
  | {
      type?: 'http' | 'sse'
      url: string
      params?: Record<string, string>
      headers?: Record<string, string>
    }

export interface Logger {
  debug: (data: any, msg?: string) => void
  info: (data: any, msg?: string) => void
  warn: (data: any, msg?: string) => void
  error: (data: any, msg?: string) => void
}
