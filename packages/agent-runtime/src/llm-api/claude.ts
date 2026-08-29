export type TextBlock = {
  text: string
  type: 'text'
}

export type System = string | Array<TextBlock>
