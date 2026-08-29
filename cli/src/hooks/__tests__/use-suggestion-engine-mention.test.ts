import { describe, test, expect } from 'bun:test'

import { isInsideStringDelimiters, parseAtInLine } from '../use-suggestion-engine'

describe('@ mention edge cases - quote detection', () => {
  test('isInsideStringDelimiters detects position inside double quotes', () => {
    expect(isInsideStringDelimiters('"hello @world"', 7)).toBe(true)
  })

  test('isInsideStringDelimiters does NOT detect position inside single quotes (apostrophes)', () => {
    expect(isInsideStringDelimiters("'hello @world'", 7)).toBe(false)
  })

  test('isInsideStringDelimiters detects position inside backticks', () => {
    expect(isInsideStringDelimiters('`hello @world`', 7)).toBe(true)
  })

  test('isInsideStringDelimiters returns false for position outside quotes', () => {
    expect(isInsideStringDelimiters('"hello" @world', 8)).toBe(false)
  })

  test('isInsideStringDelimiters handles escaped quotes', () => {
    expect(isInsideStringDelimiters('"hello \\" @world"', 11)).toBe(true)
  })
})

describe('parseAtInLine - @ mention trigger logic', () => {
  test('triggers for @ at start of line', () => {
    const result = parseAtInLine('@agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('triggers for @ after whitespace', () => {
    const result = parseAtInLine('hello @agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('does NOT trigger for @ inside double quotes', () => {
    const result = parseAtInLine('"@agent"')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ immediately after single quote (whitespace still required)', () => {
    const result = parseAtInLine("'@agent'")
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ inside backticks', () => {
    const result = parseAtInLine('`@agent`')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for email addresses', () => {
    const result = parseAtInLine('user@example.com')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for escaped @ symbol', () => {
    const result = parseAtInLine('\\@agent')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ in URLs with colon', () => {
    const result = parseAtInLine('https://example.com/@user')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ after dot', () => {
    const result = parseAtInLine('file.@property')
    expect(result.active).toBe(false)
  })

  test('triggers after closing quote', () => {
    const result = parseAtInLine('"test" @agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('handles nested quotes correctly - @ inside outer quotes', () => {
    const result = parseAtInLine('"test \'nested\' @here"')
    expect(result.active).toBe(false)
  })

  test('extracts query correctly', () => {
    const result = parseAtInLine('@myagent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('myagent')
  })

  test('does NOT trigger if @ followed by space', () => {
    const result = parseAtInLine('@ agent')
    expect(result.active).toBe(false)
  })

  test('uses lastIndexOf to find the rightmost @', () => {
    const result = parseAtInLine('@first @second')
    expect(result.active).toBe(true)
    expect(result.query).toBe('second')
  })
})

describe('parseAtInLine - comprehensive edge cases', () => {
  test.each([
    ['user@mail.example.com', 'email with subdomain'],
    ['user123@example.com', 'email with numbers'],
    ['user_name@example.com', 'email with underscores'],
    ['user-name@example.com', 'email with hyphens'],
    ['first.last@example.com', 'email with dots in username'],
  ])('does NOT trigger for %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(false)
  })

  test.each([
    ['http://example.com/@user', 'http URL'],
    ['https://example.com/@user', 'https URL'],
    ['http://localhost:3000/@user', 'URL with port'],
  ])('does NOT trigger for %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ after escaped backslash in quotes', () => {
    const result = parseAtInLine('"\\\\@test"')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger for @ when quote is escaped (string still open)', () => {
    const result = parseAtInLine('"test\\" @agent')
    expect(result.active).toBe(false)
  })

  test('triggers for @ after quote with escaped backslash before it', () => {
    const result = parseAtInLine('"test\\\\" @agent')
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('handles multiple escaped quotes correctly', () => {
    const result = parseAtInLine('"test\\"more\\" @here"')
    expect(result.active).toBe(false)
  })

  test('handles single quote inside double quotes', () => {
    const result = parseAtInLine('"it\'s @here"')
    expect(result.active).toBe(false)
  })

  test('handles double quote inside single quotes', () => {
    const result = parseAtInLine('\'say "@hello"\'')
    expect(result.active).toBe(false)
  })

  test('handles backticks with quotes inside', () => {
    const result = parseAtInLine('`"@test"`')
    expect(result.active).toBe(false)
  })

  test('finds last @ when multiple exist outside quotes', () => {
    const result = parseAtInLine('@first "@quoted" @last')
    expect(result.active).toBe(true)
    expect(result.query).toBe('last')
  })

  test('finds last @ even if previous ones are in quotes', () => {
    const result = parseAtInLine('"@in_quotes" @real_one')
    expect(result.active).toBe(true)
    expect(result.query).toBe('real_one')
  })

  test('does NOT trigger for @ followed by special characters', () => {
    const result = parseAtInLine('@!')
    expect(result.active).toBe(true)
    expect(result.query).toBe('!')
  })

  test('extracts alphanumeric query with underscores and hyphens', () => {
    const result = parseAtInLine('@my-agent_v2')
    expect(result.active).toBe(true)
    expect(result.query).toBe('my-agent_v2')
  })

  test.each([
    ['\t@agent', 'tab before @'],
    [' @agent', 'space before @'],
    ['text    @agent', 'multiple spaces before @'],
  ])('triggers with %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('handles empty string', () => {
    const result = parseAtInLine('')
    expect(result.active).toBe(false)
  })

  test('handles just @', () => {
    const result = parseAtInLine('@')
    expect(result.active).toBe(true)
    expect(result.query).toBe('')
  })

  test('handles @ at end of string with query', () => {
    const result = parseAtInLine('text @query')
    expect(result.active).toBe(true)
    expect(result.query).toBe('query')
  })

  test.each([
    ['something.@decorator', 'decorator-like syntax'],
    ['array.@index', 'array access'],
  ])('does NOT trigger for %s (%s)', (input) => {
    const result = parseAtInLine(input)
    expect(result.active).toBe(false)
  })

  test('triggers for Twitter-like handles after space', () => {
    const result = parseAtInLine('follow @username')
    expect(result.active).toBe(true)
    expect(result.query).toBe('username')
  })

  test('does NOT trigger when @ is part of word', () => {
    const result = parseAtInLine('user@mention')
    expect(result.active).toBe(false)
  })

  test('handles alternating quotes correctly', () => {
    const result = parseAtInLine('"first" \'second\' "@third"')
    expect(result.active).toBe(false)
  })

  test('triggers after all quotes are closed', () => {
    const result = parseAtInLine('"first" \'second\' @third')
    expect(result.active).toBe(true)
    expect(result.query).toBe('third')
  })

  test('does NOT trigger when inside unclosed double quote', () => {
    const result = parseAtInLine('"unclosed @mention')
    expect(result.active).toBe(false)
  })

  test('DOES trigger when inside unclosed single quote (apostrophes dont suppress)', () => {
    const result = parseAtInLine("'unclosed @mention")
    expect(result.active).toBe(true)
    expect(result.query).toBe('mention')
  })

  test('does NOT trigger when inside unclosed backtick', () => {
    const result = parseAtInLine('`unclosed @mention')
    expect(result.active).toBe(false)
  })
})

describe('single quote handling - apostrophes should NOT suppress @ menu', () => {
  const contractions = [
    ["don't", 'agent'],
    ["it's", 'agent'],
    ["I'm", 'agent'],
    ["can't", 'agent'],
    ["won't", 'agent'],
    ["you're", 'agent'],
    ["they're", 'agent'],
    ["doesn't", 'agent'],
  ] as const

  test.each(contractions)(
    'triggers @ after contraction "%s"',
    (contraction, expectedQuery) => {
      const result = parseAtInLine(`I ${contraction} @${expectedQuery}`)
      expect(result.active).toBe(true)
      expect(result.query).toBe(expectedQuery)
    },
  )

  const possessives = [
    ["user's", 'mention'],
    ["file's", 'content'],
  ] as const

  test.each(possessives)(
    'triggers @ after possessive "%s"',
    (possessive, expectedQuery) => {
      const result = parseAtInLine(`${possessive} @${expectedQuery}`)
      expect(result.active).toBe(true)
      expect(result.query).toBe(expectedQuery)
    },
  )

  test('triggers @ with multiple apostrophes in sentence', () => {
    const result = parseAtInLine("I don't think it's working @agent")
    expect(result.active).toBe(true)
    expect(result.query).toBe('agent')
  })

  test('triggers @ after space inside single-quoted-looking string', () => {
    const result = parseAtInLine("'hello @world'")
    expect(result.active).toBe(true)
    expect(result.query).toBe("world'")
  })

  test('does NOT trigger @ at start of single-quoted-looking string (whitespace required)', () => {
    const result = parseAtInLine("'@agent'")
    expect(result.active).toBe(false)
  })

  test('does NOT trigger when @ is inside double quotes even with apostrophes', () => {
    const result = parseAtInLine('"I don\'t @agent"')
    expect(result.active).toBe(false)
  })

  test('does NOT trigger when @ is inside backticks even with apostrophes', () => {
    const result = parseAtInLine("`I don't @agent`")
    expect(result.active).toBe(false)
  })

  const realWorldExamples = [
    ["Why doesn't this work? @agent", 'agent'],
    ["That's what @file-picker", 'file-picker'],
    ["What's @commander", 'commander'],
  ] as const

  test.each(realWorldExamples)(
    'triggers in natural sentence: "%s"',
    (sentence, expectedQuery) => {
      const result = parseAtInLine(sentence)
      expect(result.active).toBe(true)
      expect(result.query).toBe(expectedQuery)
    },
  )
})
