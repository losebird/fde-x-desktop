import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test'
import { connectCore } from './host-core'

test.use({
  extraHTTPHeaders: { Origin: 'http://127.0.0.1:5174' },
})

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000)
  await connectCore(request)
})

type SessionRow = {
  sessionId: string
  cwd?: string
  agentPreset?: string
  title?: string
  updatedAt?: number
}

async function readJson(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const text = await response.text()
  const body = text ? JSON.parse(text) as { data?: Record<string, unknown>; error?: { message?: string } } : {}
  expect(response.ok(), body.error?.message || text.slice(0, 400)).toBeTruthy()
  return body
}

async function createWorkspace(request: APIRequestContext, path: string, title: string) {
  const response = await request.post('/api/v1/ai/workspaces', { data: { path, title } })
  const body = await readJson(response)
  const data = body.data || {}
  return {
    workspaceId: String(data.workspaceId || ''),
    path: String(data.path || path),
    title: String(data.title || title),
  }
}

async function createSession(request: APIRequestContext, cwd: string) {
  const response = await request.post('/api/v1/ai/sessions', { data: { cwd } })
  const body = await readJson(response)
  const data = body.data || {}
  return String(data.sessionId || '')
}

async function listSessions(request: APIRequestContext) {
  const response = await request.get('/api/v1/ai/sessions?includeBlank=true&includeSubagents=true')
  const body = await readJson(response)
  const items = (body.data?.items || []) as SessionRow[]
  return Array.isArray(items) ? items : []
}

async function asideCount(page: Page) {
  const aside = page.locator('aside').filter({ has: page.getByTitle(/会话栏/) })
  const listed = await aside.locator('ul li').count()
  if (listed > 0) return listed
  return aside.locator('button[title]').evaluateAll((nodes) => nodes.filter((node) => {
    const title = node.getAttribute('title') || ''
    return title !== '收起会话栏' && title !== '展开会话栏' && title !== '新建会话' && title !== '管理会话'
  }).length)
}

async function chooseWorkspace(page: Page, name: string) {
  await page.getByTitle(/当前工作区:/).click()
  await page.getByRole('menuitem').filter({ hasText: name }).click()
  await page.getByTitle(new RegExp(`当前工作区: ${name}`)).waitFor()
}

function watchEventWorkspaces(page: Page) {
  const opened: string[] = []
  page.on('request', (req: Request) => {
    let url: URL
    try {
      url = new URL(req.url())
    } catch {
      return
    }
    if (url.pathname !== '/api/v1/events') return
    opened.push(url.searchParams.get('workspace') || '')
  })
  return opened
}

async function openBriefing(page: Page) {
  const generate = page.getByRole('button', { name: '生成新早报' })
  if (await generate.isVisible()) return
  await page.getByRole('button', { name: '早报', exact: true }).first().click()
  await generate.waitFor()
}

function briefingDefinition(cwd: string) {
  return {
    workspaceCwd: cwd,
    sections: [
      {
        id: 'mail',
        type: 'mcp',
        title: '重要邮件',
        enabled: true,
        render: 'list',
        params: { server: 'mail', tool: 'mcp__mail__imap_search', limit: 8 },
      },
    ],
    schedule: { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: false, tz: 'Asia/Shanghai' },
    delivery: { peerId: '' },
  }
}

test('new briefing and REST sessions show in the sidebar without a reload', async ({ page, request }) => {
  test.setTimeout(120_000)
  const root = await mkdtemp(join(tmpdir(), 'fde-session-list-'))
  const cwd = join(root, 'a')
  await mkdir(cwd)
  const title = `list-${root.split('/').at(-1)}`
  await createWorkspace(request, cwd, title)
  const sessionId = await createSession(request, cwd)
  expect(sessionId).toBeTruthy()

  let loads = 0
  page.on('load', () => {
    loads += 1
  })
  const eventWorkspaces = watchEventWorkspaces(page)
  await page.goto(`/ai/${sessionId}`, { waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByText('会话', { exact: true }).waitFor()
  await chooseWorkspace(page, title)
  await expect.poll(() => eventWorkspaces.includes(cwd), {
    message: 'workspace event stream was not open',
  }).toBe(true)
  await expect.poll(() => asideCount(page)).toBeGreaterThan(0)
  const countBefore = await asideCount(page)
  const idsBefore = new Set((await listSessions(request)).map((row) => row.sessionId))
  const loadsAtRest = loads

  const definition = await readJson(await request.put('/api/v1/briefing/definition', {
    data: briefingDefinition(cwd),
  }))
  const definitionId = String(definition.data?.id || '')
  const briefingRun = request.post('/api/v1/briefing/run', {
    data: { workspaceCwd: cwd, mode: 'full', ...(definitionId ? { definitionId } : {}) },
    timeout: 90_000,
  })

  await expect.poll(async () => {
    const rows = await listSessions(request)
    return rows.some((row) => !idsBefore.has(row.sessionId) && row.cwd === cwd && row.agentPreset === 'fde-briefing')
  }, { timeout: 30_000, message: 'briefing run did not create an fde-briefing session' }).toBe(true)

  await expect.poll(() => asideCount(page), {
    timeout: 10_000,
    message: 'sidebar did not show the new briefing session without a reload',
  }).toBe(countBefore + 1)

  const briefingId = (await listSessions(request)).find((row) => !idsBefore.has(row.sessionId) && row.agentPreset === 'fde-briefing')?.sessionId
  const extraId = await createSession(request, cwd)
  expect(extraId).toBeTruthy()
  expect(extraId).not.toBe(briefingId)
  await expect.poll(() => asideCount(page), {
    timeout: 15_000,
    message: 'sidebar did not show the new REST session without a reload',
  }).toBe(countBefore + 2)
  expect(loads).toBe(loadsAtRest)

  const briefingResult = await briefingRun
  expect(briefingResult.status()).toBeLessThan(500)
})

test('the generate briefing button adds the session to the sidebar without a reload', async ({ page, request }) => {
  test.setTimeout(120_000)
  const root = await mkdtemp(join(tmpdir(), 'fde-session-list-'))
  const cwd = join(root, 'a')
  await mkdir(cwd)
  const title = `button-${root.split('/').at(-1)}`
  await createWorkspace(request, cwd, title)
  const sessionId = await createSession(request, cwd)

  let loads = 0
  page.on('load', () => {
    loads += 1
  })
  const eventWorkspaces = watchEventWorkspaces(page)
  await page.goto(`/ai/${sessionId}`, { waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByText('会话', { exact: true }).waitFor()
  await chooseWorkspace(page, title)
  await expect.poll(() => eventWorkspaces.includes(cwd), {
    message: 'workspace event stream was not open',
  }).toBe(true)
  await readJson(await request.put('/api/v1/briefing/definition', {
    data: briefingDefinition(cwd),
  }))
  await openBriefing(page)
  const countBefore = await asideCount(page)
  const idsBefore = new Set((await listSessions(request)).map((row) => row.sessionId))
  const loadsAtRest = loads
  const runFromPage = page.waitForRequest((req) => {
    return req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/briefing/run'
  })

  await page.getByRole('button', { name: '生成新早报' }).click()
  await runFromPage

  await expect.poll(async () => {
    const rows = await listSessions(request)
    return rows.some((row) => !idsBefore.has(row.sessionId) && row.cwd === cwd && row.agentPreset === 'fde-briefing')
  }, { timeout: 30_000, message: 'generate button did not create an fde-briefing session' }).toBe(true)
  await expect.poll(() => asideCount(page), {
    timeout: 10_000,
    message: 'sidebar did not show the briefing session from the generate button',
  }).toBe(countBefore + 1)
  expect(loads).toBe(loadsAtRest)
})

test.describe('narrow sidebar', () => {
  // 820px viewport: the tool rail leaves the AI column near the collapse line.
  // If it is still the wide list, fold it. The count is the icon-bar buttons.
  test.use({ viewport: { width: 820, height: 900 } })

  test('a new session appears in the collapsed icon bar without a reload', async ({ page, request }) => {
    const root = await mkdtemp(join(tmpdir(), 'fde-session-list-'))
    const cwd = join(root, 'a')
    await mkdir(cwd)
    const title = `narrow-${root.split('/').at(-1)}`
    await createWorkspace(request, cwd, title)
    const sessionId = await createSession(request, cwd)

    let loads = 0
    page.on('load', () => {
      loads += 1
    })
    const eventWorkspaces = watchEventWorkspaces(page)
    await page.goto(`/ai/${sessionId}`, { waitUntil: 'domcontentloaded' })
    expect(page.viewportSize()).toEqual({ width: 820, height: 900 })
    await page.locator('aside').getByTitle(/会话栏/).first().waitFor()
    await chooseWorkspace(page, title)
    await expect.poll(() => eventWorkspaces.includes(cwd), {
      message: 'workspace event stream was not open',
    }).toBe(true)

    const aside = page.locator('aside').filter({ has: page.getByTitle(/会话栏/) })
    const collapse = aside.getByTitle('收起会话栏')
    if (await collapse.isVisible()) await collapse.click()
    await expect(aside.getByTitle('展开会话栏')).toBeVisible()
    await expect(aside.locator('ul')).toHaveCount(0)
    const icons = aside.locator('div.space-y-1 > button')
    const countBefore = await icons.count()
    expect(countBefore).toBeGreaterThan(0)
    const loadsAtRest = loads

    const created = await createSession(request, cwd)
    expect(created).toBeTruthy()
    expect(created).not.toBe(sessionId)
    await expect.poll(() => icons.count(), {
      timeout: 10_000,
      message: 'narrow icon bar did not show the new session without a reload',
    }).toBe(countBefore + 1)
    expect(loads).toBe(loadsAtRest)
  })
})
