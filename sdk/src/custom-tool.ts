import type { ToolName } from '@codebuff/common/tools/constants'
import type { ToolResultOutput } from '@codebuff/common/types/messages/content-part'
import type { z } from 'zod/v4'

export type CustomToolDefinition<
  N extends string = string,
  Args extends any = any,
  Input extends any = any,
> = {
  toolName: N
  inputSchema: z.ZodType<Args, Input>
  description: string
  endsAgentStep: boolean
  exampleInputs: Input[]
  execute: (params: Args) => Promise<ToolResultOutput[]>
}

export function getCustomToolDefinition<
  TN extends string,
  Args extends any,
  Input extends any,
>({
  toolName,
  inputSchema,
  description,
  endsAgentStep = true,
  exampleInputs = [],
  execute,
}: {
  toolName: TN extends ToolName
    ? TN & {
        error: `Hi there. This is a message from the Codebuff team: You have used a custom tool where you needed to use overrideTools instead for name: ${TN}`
      }
    : TN
  inputSchema: z.ZodType<Args, Input>
  description: string
  endsAgentStep?: boolean
  exampleInputs?: Input[]
  execute: (params: Args) => Promise<ToolResultOutput[]> | ToolResultOutput[]
}): CustomToolDefinition<TN, Args, Input> {
  return {
    toolName,
    inputSchema,
    description,
    endsAgentStep,
    exampleInputs,
    execute: async (params) => {
      return await execute(params)
    },
  }
}
