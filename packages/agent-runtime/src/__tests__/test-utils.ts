import { promptSuccess } from '@rivocode/common/util/error'
import { generateCompactId } from '@rivocode/common/util/string'

import type { StreamChunk } from '@rivocode/common/types/contracts/llm'
import type { PromptResult } from '@rivocode/common/util/error'
import type { ProjectFileContext } from '@rivocode/common/util/file'

export function createToolCallChunk<T extends string>(
  toolName: T,
  input: Record<string, unknown>,
  toolCallId?: string,
): StreamChunk {
  return {
    type: 'tool-call',
    toolName,
    toolCallId: toolCallId ?? generateCompactId(),
    input,
  }
}

export function createMockStreamWithToolCalls(
  chunks: (string | { toolName: string; input: Record<string, unknown> })[],
): AsyncGenerator<StreamChunk, PromptResult<string | null>> {
  async function* generator(): AsyncGenerator<
    StreamChunk,
    PromptResult<string | null>
  > {
    for (const chunk of chunks) {
      if (typeof chunk === 'string') {
        yield { type: 'text' as const, text: chunk }
      } else {
        yield createToolCallChunk(chunk.toolName, chunk.input)
      }
    }
    return promptSuccess('mock-message-id')
  }
  return generator()
}

export const mockFileContext: ProjectFileContext = {
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}
