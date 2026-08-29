import { mock } from 'bun:test'

import type { CodebuffApiClient } from '../../utils/codebuff-api'

export interface MockApiClientOverrides {
  get?: ReturnType<typeof mock>
  post?: ReturnType<typeof mock>
  put?: ReturnType<typeof mock>
  patch?: ReturnType<typeof mock>
  delete?: ReturnType<typeof mock>
  request?: ReturnType<typeof mock>
  me?: ReturnType<typeof mock>
  usage?: ReturnType<typeof mock>
  loginCode?: ReturnType<typeof mock>
  loginStatus?: ReturnType<typeof mock>
  publish?: ReturnType<typeof mock>
  logout?: ReturnType<typeof mock>
  feedback?: ReturnType<typeof mock>
  baseUrl?: string
  authToken?: string
}

const defaultOkResponse = () =>
  Promise.resolve({ ok: true as const, status: 200 })

export const createMockApiClient = (
  overrides: MockApiClientOverrides = {},
): CodebuffApiClient => ({
  get: (overrides.get ?? mock(defaultOkResponse)) as CodebuffApiClient['get'],
  post: (overrides.post ??
    mock(defaultOkResponse)) as CodebuffApiClient['post'],
  put: (overrides.put ?? mock(defaultOkResponse)) as CodebuffApiClient['put'],
  patch: (overrides.patch ??
    mock(defaultOkResponse)) as CodebuffApiClient['patch'],
  delete: (overrides.delete ??
    mock(defaultOkResponse)) as CodebuffApiClient['delete'],
  request: (overrides.request ??
    mock(defaultOkResponse)) as CodebuffApiClient['request'],
  me: (overrides.me ?? mock(defaultOkResponse)) as CodebuffApiClient['me'],
  usage: (overrides.usage ??
    mock(defaultOkResponse)) as CodebuffApiClient['usage'],
  loginCode: (overrides.loginCode ??
    mock(defaultOkResponse)) as CodebuffApiClient['loginCode'],
  loginStatus: (overrides.loginStatus ??
    mock(defaultOkResponse)) as CodebuffApiClient['loginStatus'],
  publish: (overrides.publish ??
    mock(defaultOkResponse)) as CodebuffApiClient['publish'],
  logout: (overrides.logout ??
    mock(defaultOkResponse)) as CodebuffApiClient['logout'],
  feedback: (overrides.feedback ??
    mock(defaultOkResponse)) as CodebuffApiClient['feedback'],
  baseUrl: overrides.baseUrl ?? 'https://test.codebuff.com',
  authToken: overrides.authToken,
})
