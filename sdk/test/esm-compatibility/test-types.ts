import {
  CodebuffClient as ClientClass,
  getCustomToolDefinition,
} from '@codebuff/sdk'
import * as FullSDK from '@codebuff/sdk'
;

import type {
  CodebuffClient,
  CustomToolDefinition,
  RunState,
} from '@codebuff/sdk'
(async () => {
  const testClient: CodebuffClient = {} as any
  const testTool: CustomToolDefinition = {} as any
  const testState: RunState = {} as any

  console.log('✅ Type imports successful')

  const clientConstructor = ClientClass
  const toolDefFunction = getCustomToolDefinition

  console.log(
    '✅ Value imports successful:',
    typeof clientConstructor,
    typeof toolDefFunction,
  )

  type ClientOptions = ConstructorParameters<typeof ClientClass>[0]

  const mockOptions: ClientOptions = {
    apiKey: 'test-key',
  }

  const mockClient = new ClientClass(mockOptions)

  console.log('✅ Client instantiation types work correctly')

  type MockTool = ReturnType<typeof getCustomToolDefinition>
  const toolTypeTest: MockTool = {} as any

  console.log('✅ Custom tool definition types work correctly')

  const dynamicSDK = await import('@codebuff/sdk')
  const ClientFromDynamic: typeof ClientClass = dynamicSDK.CodebuffClient
  console.log('✅ Dynamic imports work in TypeScript ESM')

  const ClientFromNamespace: typeof ClientClass = FullSDK.CodebuffClient
  console.log('✅ Namespace imports work correctly')
})()

export {}
