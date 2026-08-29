import { CodebuffClient } from '@rivocode/sdk'

async function main() {
  const client = new CodebuffClient({
    apiKey: process.env.CODEBUFF_API_KEY,
    cwd: process.cwd(),
  })

  const runState1 = await client.run({
    agent: 'codebuff/base@0.0.16',
    prompt: 'Create a simple calculator class',
    handleEvent: (event) => {
      console.log('Codebuff Event', JSON.stringify(event))
    },
  })

  const _runOrError2 = await client.run({
    agent: 'codebuff/base@0.0.16',
    prompt: 'Add unit tests for the calculator',
    previousRun: runState1,
    handleEvent: (event) => {
      console.log('Codebuff Event', JSON.stringify(event))
    },
  })
}

main()
