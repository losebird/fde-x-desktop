import { expect, type APIRequestContext } from '@playwright/test'

const HOST_PIN = '0.2.0-rc.2'

type AiStatus = {
  connected?: boolean
  version?: string | null
  workspace?: string
}

export async function readAiStatus(request: APIRequestContext) {
  const response = await request.get('/api/v1/ai/status')
  expect(response.ok()).toBeTruthy()
  const body = await response.json() as { data?: AiStatus }
  return body.data ?? {}
}

export async function connectCore(request: APIRequestContext) {
  const current = await readAiStatus(request)
  if (current.connected && current.version === HOST_PIN && current.workspace?.startsWith('/')) return current
  const response = await request.post('/api/v1/ai/connect', { data: {} })
  const body = await response.json() as { data?: AiStatus; error?: { message?: string } }
  expect(response.status(), body.error?.message || '').toBe(200)
  expect(body.data?.connected).toBe(true)
  expect(body.data?.version).toBe(HOST_PIN)
  expect(body.data?.workspace).toEqual(expect.stringMatching(/^\//))
  return body.data ?? {}
}
