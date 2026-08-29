import { z } from 'zod/v4'

import { CodebuffClient, getCustomToolDefinition } from '@codebuff/sdk'

import type { AgentDefinition } from '@codebuff/sdk'

async function main() {
  const client = new CodebuffClient({
    apiKey: process.env.CODEBUFF_API_KEY,
    cwd: process.cwd(),
  })

  const myCustomAgent: AgentDefinition = {
    id: 'my-custom-agent',
    model: 'google/gemini-3.1-flash-lite',
    displayName: 'Sentiment analyzer',
    toolNames: ['fetch_api_data'],
    instructionsPrompt: `
1. Describe the different sentiments in the given prompt.
2. Score the prompt along the following 5 dimensions:
  happiness, sadness, anger, fear, and surprise.`,
  }

  const myCustomTool = getCustomToolDefinition({
    toolName: 'fetch_api_data',
    description: 'Fetch data from an API endpoint',
    inputSchema: z.object({
      url: z.url(),
      method: z.enum(['GET', 'POST']).default('GET'),
      headers: z.record(z.string(), z.string()).optional(),
    }),
    exampleInputs: [{ url: 'https://api.example.com/data', method: 'GET' }],
    execute: async ({ url, method, headers }) => {
      const response = await fetch(url, { method, headers })
      const data = await response.text()
      return [
        {
          type: 'json' as const,
          value: {
            message: `API Response: ${data.slice(0, 5000)}...`,
          },
        },
      ]
    },
  })

  const { output } = await client.run({
    agent: 'my-custom-agent',
    prompt: "Today I'm feeling very happy!",

    agentDefinitions: [myCustomAgent],
    customToolDefinitions: [myCustomTool],

    handleEvent: (event) => {
      console.log('Codebuff Event', JSON.stringify(event))
    },
  })

  if (output.type === 'error') {
    console.error(`The run failed:\n${output.message}`)
  } else {
    console.log('The run succeeded with output:', output)
  }
}

main()
