import { Transform } from 'node:stream'
import { StringDecoder } from 'string_decoder'

import { includesMatch, isWhitespace } from './string'

export type TextNode = {
  contents: string
}

export type CDATANode = {
  contents: string
}

export type CommentNode = {
  contents: string
}

export type ProcessingInstructionNode = {
  contents: string
}

export type TagOpenNode = {
  name: string
  attrs: string
  isSelfClosing: boolean

  rawTag: string
}

export type TagCloseNode = {
  name: string

  rawTag: string
}

export type NextFunction = (err?: Error) => void

export interface SaxyEvents {
  finish: () => void
  error: (err: Error) => void
  text: (data: TextNode) => void
  cdata: (data: CDATANode) => void
  comment: (data: CommentNode) => void
  processinginstruction: (data: ProcessingInstructionNode) => void
  tagopen: (data: TagOpenNode) => void
  tagclose: (data: TagCloseNode) => void
}

export type SaxyEventNames = keyof SaxyEvents

export type SaxyEventArgs =
  | Error
  | TextNode
  | CDATANode
  | CommentNode
  | ProcessingInstructionNode
  | TagOpenNode
  | TagCloseNode

export interface Saxy {
  on<U extends SaxyEventNames>(event: U, listener: SaxyEvents[U]): this
  on(event: string | symbol | Event, listener: (...args: any[]) => void): this
  once<U extends SaxyEventNames>(event: U, listener: SaxyEvents[U]): this
}

export type TagSchema = {
  [topLevelTag: string]: (string | RegExp)[]
}

const Node = {
  text: 'text',
  cdata: 'cdata',
  comment: 'comment',
  processingInstruction: 'processinginstruction',
  tagOpen: 'tagopen',
  tagClose: 'tagclose',
} as Record<string, SaxyEventNames>

const parseEntities = (input: string): string => {
  let position = 0
  let next = 0
  const parts = []

  while ((next = input.indexOf('&', position)) !== -1) {
    if (next > position) {
      const beforeEntity = input.slice(position, next)
      parts.push(beforeEntity)
    }

    const semiColonPos = input.indexOf(';', next)

    if (semiColonPos === -1) {
      const remaining = input.slice(next)
      parts.push(remaining)
      position = input.length
      break
    }

    const entityName = input.slice(next + 1, semiColonPos)

    if (/[ &<>]/.test(entityName) || entityName.length === 0) {
      parts.push('&')
      position = next + 1
      continue
    }

    if (entityName === 'quot') {
      parts.push('"')
    } else if (entityName === 'amp') {
      parts.push('&')
    } else if (entityName === 'apos') {
      parts.push("'")
    } else if (entityName === 'lt') {
      parts.push('<')
    } else if (entityName === 'gt') {
      parts.push('>')
    } else if (entityName.startsWith('#')) {
      let value
      if (entityName[1] === 'x' || entityName[1] === 'X') {
        value = parseInt(entityName.slice(2), 16)
      } else {
        value = parseInt(entityName.slice(1), 10)
      }

      if (isNaN(value)) {
        parts.push('&' + entityName + ';')
      } else {
        parts.push(String.fromCharCode(value))
      }
    } else {
      parts.push('&' + entityName + ';')
    }
    position = semiColonPos + 1
  }

  if (position < input.length) {
    const remaining = input.slice(position)
    parts.push(remaining)
  }

  const result = parts.join('')
  return result
}

export const parseAttrs = (
  input: string,
): { attrs: Record<string, string>; errors: string[] } => {
  const attrs = {} as Record<string, string>
  const end = input.length
  let position = 0
  const errors: string[] = []

  const seekNextWhitespace = (pos: number): number => {
    pos += 1
    while (pos < end && !isWhitespace(input[pos])) {
      pos += 1
    }
    return pos
  }

  attrLoop: while (position < end) {
    if (isWhitespace(input[position])) {
      position += 1
      continue
    }

    let startName = position

    while (input[position] !== '=' && position < end) {
      if (isWhitespace(input[position])) {
        errors.push(
          `Attribute names may not contain whitespace: ${input.slice(startName, position)}`,
        )
        continue attrLoop
      }

      position += 1
    }

    if (position === end) {
      errors.push(
        `Expected a value for the attribute: ${input.slice(startName, position)}`,
      )
      break
    }

    const attrName = input.slice(startName, position)
    position += 1
    const startQuote = input[position]
    position += 1

    if (startQuote !== '"' && startQuote !== "'") {
      position = seekNextWhitespace(position)
      errors.push(
        `Attribute values should be quoted: ${input.slice(startName, position)}`,
      )
      continue
    }

    const endQuote = input.indexOf(startQuote, position)

    if (endQuote === -1) {
      position = seekNextWhitespace(position)
      errors.push(
        `Unclosed attribute value: ${input.slice(startName, position)}`,
      )
      continue
    }

    const attrValue = input.slice(position, endQuote)

    attrs[attrName] = attrValue
    position = endQuote + 1
  }

  return { attrs, errors }
}

const findIndexOutside = (
  haystack: string,
  predicate: Function,
  delim = '',
  fromIndex = 0,
) => {
  const length = haystack.length
  let index = fromIndex
  let inDelim = false

  while (index < length && (inDelim || !predicate(haystack[index]))) {
    if (haystack[index] === delim) {
      inDelim = !inDelim
    }

    ++index
  }

  return index === length ? -1 : index
}

export class Saxy extends Transform {
  private _decoder: StringDecoder
  private _tagStack: string[]
  private _waiting: { token: string; data: unknown } | null
  private _schema: TagSchema | null
  private _textBuffer: string
  private _shouldParseEntities: boolean

  static parseAttrs = parseAttrs

  static parseEntities = parseEntities

  constructor(schema?: TagSchema, shouldParseEntities: boolean = true) {
    super({ decodeStrings: false, defaultEncoding: 'utf8' })

    this._decoder = new StringDecoder('utf8')

    this._tagStack = []

    this._waiting = null

    this._schema = schema || null

    this._textBuffer = ''

    this._shouldParseEntities = shouldParseEntities
  }

  public _write(
    chunk: Buffer | string,
    encoding: string,
    callback: NextFunction,
  ) {
    const data =
      encoding === 'buffer'
        ? this._decoder.write(chunk as Buffer)
        : (chunk as string)

    this._parseChunk(data, callback)
  }

  public _final(callback: NextFunction) {
    this._parseChunk(this._decoder.end(), (err?: Error) => {
      if (err) {
        callback(err)
        return
      }

      if (this._textBuffer.length > 0) {
        const parsedText = this._shouldParseEntities
          ? parseEntities(this._textBuffer)
          : this._textBuffer
        this.emit(Node.text, { contents: parsedText })
        this._textBuffer = ''
      }

      if (this._waiting !== null) {
        switch (this._waiting.token) {
          case Node.text:
            this.emit('text', { contents: this._waiting.data })
            break
          case Node.cdata:
            callback(new Error('Unclosed CDATA section'))
            return
          case Node.comment:
            callback(new Error('Unclosed comment'))
            return
          case Node.processingInstruction:
            callback(new Error('Unclosed processing instruction'))
            return
          case Node.tagOpen:
          case Node.tagClose:
            return
          default:
        }
      }

      if (this._tagStack.length !== 0) {
        return
      }

      callback()
    })
  }

  public parse(input: Buffer | string): this {
    this.end(input)
    return this
  }

  private _wait(token: string, data: unknown) {
    this._waiting = { token, data }
  }

  private _unwait() {
    if (this._waiting === null) {
      return ''
    }

    const data = this._waiting.data
    this._waiting = null
    return data
  }

  private _handleTagOpening(node: TagOpenNode) {
    const { name } = node

    if (this._schema) {
      if (this._tagStack.length === 0) {
        if (!this._schema[name]) {
          this.emit(Node.text, { contents: node.rawTag })
          return
        }
      }
      else {
        const parentTag = this._tagStack[this._tagStack.length - 1]
        if (
          !this._schema[parentTag] ||
          !includesMatch(this._schema[parentTag], name)
        ) {
          this.emit(Node.text, { contents: node.rawTag })
          return
        }
      }
    }

    if (!node.isSelfClosing) {
      this._tagStack.push(node.name)
    }

    this.emit(Node.tagOpen, node)

    if (node.isSelfClosing) {
      this.emit(Node.tagClose, {
        name: node.name,
        rawTag: '',
      })
    }
  }

  private _parseChunk(input: string, callback: NextFunction) {
    const waitingData = this._unwait()
    input = waitingData + input

    let chunkPos = 0
    const end = input.length

    while (chunkPos < end) {
      if (
        input[chunkPos] !== '<' ||
        (chunkPos + 1 < end && !this._isXMLTagStart(input, chunkPos + 1))
      ) {
        let nextTag = input.indexOf('<', chunkPos)
        while (
          nextTag !== -1 &&
          nextTag + 1 < end &&
          !this._isXMLTagStart(input, nextTag + 1)
        ) {
          nextTag = input.indexOf('<', nextTag + 1)
        }

        if (nextTag === -1) {
          let chunk = input.slice(chunkPos)

          if (this._tagStack.length === 1 && !chunk.trim()) {
            chunk = ''
          }

          const lastAmp = chunk.lastIndexOf('&')
          if (
            this._shouldParseEntities &&
            lastAmp !== -1 &&
            chunk.indexOf(';', lastAmp) === -1
          ) {
            const postAmp = chunk.slice(lastAmp + 1)
            const isPotentialEntity =
              /^(#\d*)?$/.test(postAmp) ||
              /^[a-zA-Z]{0,6}$/.test(postAmp)
            if (isPotentialEntity) {
              this._wait(Node.text, chunk.slice(lastAmp))
              chunk = chunk.slice(0, lastAmp)
            }
          }

          if (chunk.length > 0) {
            this._textBuffer += chunk
          }

          chunkPos = end
          break
        }

        let chunk = input.slice(chunkPos, nextTag)

        if (this._tagStack.length === 1 && !chunk.trim()) {
          chunk = ''
        }

        if (chunk.length > 0) {
          this._textBuffer += chunk
        }

        if (this._textBuffer.length > 0) {
          const parsedText = this._shouldParseEntities
            ? parseEntities(this._textBuffer)
            : this._textBuffer
          this.emit(Node.text, { contents: parsedText })
          this._textBuffer = ''
        }

        chunkPos = nextTag
      }

      chunkPos += 1

      const tagClose = findIndexOutside(
        input,
        (char: string) => char === '>',
        '"',
        chunkPos,
      )

      if (tagClose === -1) {
        this._wait(Node.tagOpen, input.slice(chunkPos - 1))
        break
      }

      if (input[chunkPos] === '/') {
        const tagName = input.slice(chunkPos + 1, tagClose)
        const stackedTagName = this._tagStack[this._tagStack.length - 1]

        if (this._schema) {
          if (this._tagStack.length === 1) {
            if (!this._schema[tagName]) {
              const rawTag = input.slice(chunkPos - 1, tagClose + 1)
              this.emit(Node.text, { contents: rawTag })
              chunkPos = tagClose + 1
              continue
            }
          }
          else {
            const parentTag = this._tagStack[this._tagStack.length - 2]
            if (
              !this._schema[parentTag] ||
              !includesMatch(this._schema[parentTag], tagName)
            ) {
              const rawTag = input.slice(chunkPos - 1, tagClose + 1)
              this.emit(Node.text, { contents: rawTag })
              chunkPos = tagClose + 1
              continue
            }
          }
        }

        if (tagName === stackedTagName) {
          this._tagStack.pop()
        }

        if (!this._schema || stackedTagName === tagName) {
          this.emit(Node.tagClose, {
            name: tagName,
            rawTag: input.slice(chunkPos - 1, tagClose + 1),
          })
        } else {
          const rawTag = input.slice(chunkPos - 1, tagClose + 1)
          this.emit(Node.text, { contents: rawTag })
        }

        chunkPos = tagClose + 1
        continue
      }

      const isSelfClosing = input[tagClose - 1] === '/'
      let realTagClose = isSelfClosing ? tagClose - 1 : tagClose

      const whitespace = input.slice(chunkPos).search(/\s/)

      const rawTag = input.slice(chunkPos - 1, tagClose + 1)

      if (whitespace === -1 || whitespace >= tagClose - chunkPos) {
        this._handleTagOpening({
          name: input.slice(chunkPos, realTagClose),
          attrs: '',
          isSelfClosing,
          rawTag,
        })
      } else if (whitespace === 0) {
        this.emit(Node.text, { contents: rawTag })
      } else {
        this._handleTagOpening({
          name: input.slice(chunkPos, chunkPos + whitespace),
          attrs: input.slice(chunkPos + whitespace, realTagClose),
          isSelfClosing,
          rawTag,
        })
      }

      chunkPos = tagClose + 1
    }

    if (this._textBuffer.length > 0) {
      const parsedText = this._shouldParseEntities
        ? parseEntities(this._textBuffer)
        : this._textBuffer
      this.emit(Node.text, { contents: parsedText })
      this._textBuffer = ''
    }

    callback()
  }

  private _isXMLTagStart(input: string, pos: number): boolean {
    const firstChar = input[pos]
    return /[A-Za-z_:]/.test(firstChar) || firstChar === '/'
  }
}
