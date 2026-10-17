import { mkdir, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const bff = 'http://127.0.0.1:4318'
const web = 'http://127.0.0.1:5174'
const origin = web
const cwdA = '/tmp/fde-ws-a'
const cwdB = '/tmp/fde-ws-b'
const outDir = join(import.meta.dirname, '..', '..', 'artifacts', 'briefing-session-bugs')

async function api(method, path, body, timeoutMs = 20000) {
  const response = await fetch(`${bff}${path}`, {
    method,
    headers: {
      Origin: origin,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 600)}`)
    error.status = response.status
    error.body = json
    throw error
  }
  return json
}

function watchEvents() {
  const events = []
  const req = http.request({
    hostname: '127.0.0.1',
    port: 4318,
    path: '/api/v1/events',
    headers: { Origin: origin, Accept: 'text/event-stream' },
  }, (res) => {
    res.setEncoding('utf8')
    let buf = ''
    res.on('data', (chunk) => {
      buf += chunk
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const part of parts) {
        const dataLine = part.split('\n').find((line) => line.startsWith('data:'))
        if (!dataLine) continue
        try {
          events.push(JSON.parse(dataLine.slice(5).trim()))
        } catch {
          /* ping or comment */
        }
      }
    })
  })
  req.on('error', () => {})
  req.end()
  return {
    events,
    close() {
      req.destroy()
    },
  }
}

function sessionItems(payload) {
  const items = payload?.data?.items || payload?.items || []
  return Array.isArray(items) ? items : []
}

async function listSessions() {
  const payload = await api('GET', '/api/v1/ai/sessions?includeBlank=true&includeSubagents=true')
  return sessionItems(payload)
}

const report = {
  connected: false,
  liveBriefing: null,
  list: null,
  workspace: null,
  error: '',
}

await mkdir(outDir, { recursive: true })

try {
  let status = await api('GET', '/api/v1/ai/status')
  if (!status?.data?.connected) {
    status = await api('POST', '/api/v1/ai/connect', {}, 180000)
  }
  report.connected = Boolean(status?.data?.connected)
  report.status = {
    connected: status?.data?.connected,
    version: status?.data?.version,
    lastError: status?.data?.lastError || '',
  }
  if (!report.connected) throw new Error(`host not connected: ${report.status.lastError || 'no error'}`)

  const workspaceA = await api('POST', '/api/v1/ai/workspaces', { path: cwdA, title: 'repro-a' })
  const workspaceB = await api('POST', '/api/v1/ai/workspaces', { path: cwdB, title: 'repro-b' })
  const idA = workspaceA.data.workspaceId
  const idB = workspaceB.data.workspaceId
  await api('POST', '/api/v1/workspaces', {
    id: idA,
    name: 'repro-a',
    metadata: { cwd: workspaceA.data.path },
  })
  await api('POST', '/api/v1/workspaces', {
    id: idB,
    name: 'repro-b',
    metadata: { cwd: workspaceB.data.path },
  })

  const createdA = await api('POST', '/api/v1/ai/sessions', { cwd: workspaceA.data.path })
  const createdB = await api('POST', '/api/v1/ai/sessions', { cwd: workspaceB.data.path })
  const sessionA = createdA.data.sessionId
  const sessionB = createdB.data.sessionId

  const stream = watchEvents()
  await new Promise((resolve) => setTimeout(resolve, 300))
  const eventsBeforeBriefing = stream.events.length
  const beforeBriefing = new Set((await listSessions()).map((row) => row.sessionId))
  const definition = await api('PUT', '/api/v1/briefing/definition', {
    workspaceCwd: workspaceA.data.path,
    sections: [
      { id: 'mail', type: 'mcp', title: '重要邮件', enabled: true, render: 'list', params: { server: 'mail', tool: 'mcp__mail__imap_search', limit: 8 } },
      { id: 'news', type: 'mcp', title: '行业资讯', enabled: true, render: 'list', params: { server: 'ai-hot', tool: 'mcp__ai-hot__aihot_get_latest', limit: 8 } },
    ],
    schedule: { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: false, tz: 'Asia/Shanghai' },
    delivery: { peerId: '' },
  })
  const briefing = await api('POST', '/api/v1/briefing/run', {
    workspaceCwd: workspaceA.data.path,
    mode: 'full',
    definitionId: definition.data.id,
  }, 45000)
  const afterSessions = await listSessions()
  const briefingSession = afterSessions.find((row) => !beforeBriefing.has(row.sessionId) && row.agentPreset === 'fde-briefing')
    || afterSessions.find((row) => row.sessionId === briefing.data?.briefing?.sessionId)
  const briefingEvents = stream.events.slice(eventsBeforeBriefing).filter((event) => event.type === 'ai.session.changed' || event.type === 'briefing.ready')
  const sections = briefing.data?.briefing?.sections || []
  report.liveBriefing = {
    status: briefing.data?.briefing?.status,
    sessionId: briefing.data?.briefing?.sessionId || '',
    sections: sections.map((section) => ({ title: section.title, error: section.error || '', items: Array.isArray(section.items) ? section.items.length : 0 })),
    newBriefingSession: briefingSession
      ? { sessionId: briefingSession.sessionId, agentPreset: briefingSession.agentPreset, cwd: briefingSession.cwd }
      : null,
    sseTypes: briefingEvents.map((event) => event.type),
    emittedSessionChanged: briefingEvents.some((event) => event.type === 'ai.session.changed' && event.payload?.sessionId === briefing.data?.briefing?.sessionId),
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const consoleNotes = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleNotes.push(msg.text())
  })
  await page.goto(`${web}/ai/${sessionA}`, { waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByText('会话', { exact: true }).waitFor({ timeout: 30000 })
  await page.getByTitle(/当前工作区:/).click()
  await page.getByRole('menuitem').filter({ hasText: 'repro-a' }).click()
  await page.getByTitle(/当前工作区: repro-a/).waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  const countBefore = await page.locator('aside ul li').count()
  await page.screenshot({ path: join(outDir, 'list-before-create.png') })
  const seen = stream.events.length
  const extra = await api('POST', '/api/v1/ai/sessions', { cwd: workspaceA.data.path })
  const extraId = extra.data.sessionId
  const apiHasExtra = (await listSessions()).some((row) => row.sessionId === extraId)
  await page.waitForTimeout(2500)
  const countAfter = await page.locator('aside ul li').count()
  const sseAfterCreate = stream.events.slice(seen).filter((event) => event.type === 'ai.session.changed')
  await page.screenshot({ path: join(outDir, 'list-after-create-no-reload.png') })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('aside').getByText('会话', { exact: true }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(1000)
  const countReloaded = await page.locator('aside ul li').count()
  await page.screenshot({ path: join(outDir, 'list-after-reload.png') })
  report.list = {
    sessionA,
    extraId,
    apiHasExtra,
    countBefore,
    countAfter,
    countReloaded,
    sseSawCreate: sseAfterCreate.some((event) => JSON.stringify(event.payload || event).includes(extraId)),
    sseCreateCount: sseAfterCreate.length,
    listStayedUntilReload: countAfter === countBefore && countReloaded > countBefore,
  }

  await page.getByTitle(/当前工作区:/).click()
  await page.getByRole('menuitem').filter({ hasText: 'repro-b' }).click()
  await page.waitForTimeout(1500)
  const urlAfterSwitch = page.url()
  const iframeSrc = await page.locator('iframe[title="DSH 会话"]').getAttribute('src').catch(() => '')
  const buttonTitle = await page.getByTitle(/当前工作区:/).getAttribute('title')
  await page.screenshot({ path: join(outDir, 'workspace-switch.png') })
  report.workspace = {
    sessionA,
    sessionB,
    workspaceA: idA,
    workspaceB: idB,
    urlAfterSwitch,
    iframeSrc,
    buttonTitle,
    urlStayedOnA: urlAfterSwitch.includes(`/ai/${sessionA}`),
    iframeStayedOnA: String(iframeSrc || '').includes(encodeURIComponent(sessionA)) || String(iframeSrc || '').includes(sessionA),
    iframeDidNotOpenB: !String(iframeSrc || '').includes(sessionB),
    switcherShowsB: String(buttonTitle || '').includes('repro-b'),
  }
  report.consoleErrors = consoleNotes.slice(0, 20)
  stream.close()
  await browser.close()
} catch (error) {
  report.error = error instanceof Error ? error.stack || error.message : String(error)
}

await writeFile(join(outDir, 'page-repro.json'), `${JSON.stringify(report, null, 2)}\n`)
const listOk = report.list?.listStayedUntilReload === true && report.list?.sseSawCreate === true
const switchOk = report.workspace?.urlStayedOnA === true
  && report.workspace?.iframeStayedOnA === true
  && report.workspace?.iframeDidNotOpenB === true
  && report.workspace?.switcherShowsB === true
const liveOk = report.liveBriefing
  && report.liveBriefing.sections.some((section) => section.title === '重要邮件' && String(section.error).includes('会话未投影 mcp__mail__imap_search'))
  && report.liveBriefing.sections.some((section) => section.title === '行业资讯' && String(section.error).includes('会话未投影 mcp__ai-hot__aihot_get_latest'))
  && report.liveBriefing.emittedSessionChanged === false
if (!report.connected) {
  console.error(report.error || 'host not connected')
  process.exit(2)
}
console.log(JSON.stringify({
  liveOk,
  listOk,
  switchOk,
  mail: report.liveBriefing?.sections?.find((section) => section.title === '重要邮件'),
  news: report.liveBriefing?.sections?.find((section) => section.title === '行业资讯'),
  list: report.list,
  workspace: report.workspace,
}, null, 2))
if (!liveOk || !listOk || !switchOk) process.exit(1)
