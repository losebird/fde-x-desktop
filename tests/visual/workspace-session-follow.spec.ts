import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test'
import { connectCore } from './host-core'

const shellOrigin = { Origin: 'http://127.0.0.1:5174' }

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000)
  const connected = await request.post('/api/v1/ai/connect', { data: {}, headers: shellOrigin })
  expect(connected.ok()).toBeTruthy()
  await connectCore(request)
})

type SessionRow = {
  sessionId: string
  cwd?: string
  title?: string
  updatedAt?: number
  origin?: string
  parentSessionId?: string
}

async function readJson(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const text = await response.text()
  const body = text ? JSON.parse(text) as { data?: Record<string, unknown>; error?: { message?: string } } : {}
  expect(response.ok(), body.error?.message || text.slice(0, 400)).toBeTruthy()
  return body
}

async function createWorkspace(request: APIRequestContext, path: string, title: string) {
  const response = await request.post('/api/v1/ai/workspaces', { data: { path, title }, headers: shellOrigin })
  const body = await readJson(response)
  const data = body.data || {}
  expect(data.path, 'workspace create returned no path').toEqual(expect.any(String))
  expect(data.path, 'workspace create returned an empty path').not.toEqual('')
  return {
    workspaceId: String(data.workspaceId || ''),
    path: data.path,
  }
}

// Host workspace identity is fs.realpath. macOS tmp is /var, stored as /private/var.

async function createSession(request: APIRequestContext, cwd: string) {
  const response = await request.post('/api/v1/ai/sessions', { data: { cwd }, headers: shellOrigin })
  const body = await readJson(response)
  return String((body.data || {}).sessionId || '')
}

async function renameSession(request: APIRequestContext, sessionId: string, title: string) {
  const response = await request.post(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/rename`, {
    data: { title },
    headers: shellOrigin,
  })
  await readJson(response)
}

async function listSessions(request: APIRequestContext) {
  const response = await request.get('/api/v1/ai/sessions?includeBlank=true&includeSubagents=true', {
    headers: shellOrigin,
  })
  const body = await readJson(response)
  const items = (body.data?.items || []) as SessionRow[]
  return Array.isArray(items) ? items : []
}

function latestSessionId(rows: SessionRow[], cwd: string) {
  let latestId = ''
  let latestTime = -Infinity
  for (const row of rows) {
    if (row.origin === 'subagent' || row.parentSessionId) continue
    if (row.cwd !== cwd) continue
    const time = Number(row.updatedAt) || 0
    if (time >= latestTime) {
      latestTime = time
      latestId = row.sessionId
    }
  }
  return latestId
}

async function chooseWorkspace(page: Page, name: string) {
  await page.getByTitle(/当前工作区:/).click()
  await page.getByRole('menuitem').filter({ hasText: name }).click()
  await page.getByTitle(new RegExp(`当前工作区: ${name}`)).waitFor()
}

function isSessionCreate(request: Request) {
  return request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/ai/sessions'
}

test('switching workspace follows that workspace latest session without a reload', async ({ page, request }) => {
  test.setTimeout(120_000)
  const root = await mkdtemp(join(tmpdir(), 'fde-ws-follow-'))
  const dirA = join(root, 'a')
  const dirB = join(root, 'b')
  await mkdir(dirA)
  await mkdir(dirB)
  const titleA = `follow-a-${root.split('/').at(-1)}`
  const titleB = `follow-b-${root.split('/').at(-1)}`
  const cwdA = (await createWorkspace(request, dirA, titleA)).path
  const cwdB = (await createWorkspace(request, dirB, titleB)).path
  const sessionA = await createSession(request, cwdA)
  const older = await createSession(request, cwdB)
  const newer = await createSession(request, cwdB)
  await renameSession(request, older, 'older-b')
  await renameSession(request, newer, 'newer-b')
  const expected = latestSessionId(await listSessions(request), cwdB)
  const expectedTitle = expected === newer ? 'newer-b' : 'older-b'
  expect(expected).toBeTruthy()

  let loads = 0
  page.on('load', () => {
    loads += 1
  })
  await page.goto(`/ai/${sessionA}`, { waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByText('会话', { exact: true }).waitFor()
  await chooseWorkspace(page, titleA)
  await expect(page).toHaveURL(new RegExp(`/ai/${sessionA}`))
  const loadsAtRest = loads

  await chooseWorkspace(page, titleB)
  await expect.poll(() => page.url(), {
    message: 'address stayed on the previous workspace session',
  }).toContain(`/ai/${expected}`)
  await expect.poll(async () => page.locator('iframe[title="DSH 会话"]').getAttribute('src')).toContain(
    `fde-session=${encodeURIComponent(expected)}`,
  )
  await expect(page.locator('aside ul li').filter({ hasText: expectedTitle }).locator('.font-medium')).toBeVisible()
  expect(loads).toBe(loadsAtRest)
})

test('an empty workspace is handed to connectWorkspace', async ({ page, request }) => {
  test.setTimeout(120_000)
  const root = await mkdtemp(join(tmpdir(), 'fde-ws-empty-'))
  const dirA = join(root, 'a')
  const dirEmpty = join(root, 'empty')
  await mkdir(dirA)
  await mkdir(dirEmpty)
  const titleA = `empty-a-${root.split('/').at(-1)}`
  const titleEmpty = `empty-b-${root.split('/').at(-1)}`
  const cwdA = (await createWorkspace(request, dirA, titleA)).path
  const cwdEmpty = (await createWorkspace(request, dirEmpty, titleEmpty)).path
  const sessionA = await createSession(request, cwdA)

  const creates: string[] = []
  page.on('request', (req) => {
    if (isSessionCreate(req)) creates.push(req.url())
  })
  let loads = 0
  page.on('load', () => {
    loads += 1
  })
  await page.goto(`/ai/${sessionA}`, { waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByText('会话', { exact: true }).waitFor()
  await chooseWorkspace(page, titleA)
  const loadsAtRest = loads
  creates.length = 0

  await chooseWorkspace(page, titleEmpty)
  await expect.poll(async () => {
    if (creates.length) return 'posted'
    const rows = await listSessions(request)
    return rows.some((row) => row.cwd === cwdEmpty) ? 'hosted' : 'waiting'
  }, {
    timeout: 15_000,
    message: 'empty workspace was not handed to connectWorkspace',
  }).toBe('hosted')
  expect(creates).toEqual([])
  expect(page.url()).not.toContain(sessionA)
  const iframeSrc = await page.locator('iframe[title="DSH 会话"]').getAttribute('src')
  expect(iframeSrc || '').not.toContain(sessionA)
  expect(loads).toBe(loadsAtRest)
})
