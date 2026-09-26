import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const PRIMARY = [
  {
    short: 'warehouse-semi',
    label: '仓库 / 半成品库',
    speech: `半成品库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    expectKind: '仓库',
    screenshot: `${STORE}/media/biz-data-eval-enum-fix-3-warehouse-semi.png`,
  },
  {
    short: 'warehouse-mixed',
    label: '仓库 / 综合库',
    speech: `综合库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '综合库' } },
    expectKind: '仓库',
    screenshot: `${STORE}/media/biz-data-eval-enum-fix-3-warehouse-mixed.png`,
  },
]

const SPOT = [
  { short: 'supplier-c', speech: `C的供应商。${TAIL}`, library: { resource: 'biz_suppliers', filter: { rating: 'C' } }, expectKind: '供应商', want: 16 },
  { short: 'movement-production', speech: `生产领料的出入库流水。${TAIL}`, library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } }, expectKind: '出入库流水', want: 1647 },
  { short: 'spot-manager', speech: `现查员工档案的直属上级。${TAIL}`, library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } }, expectKind: '员工档案', want: 80 },
  { short: 'ticket-resolved', speech: `已解决的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { status: 'resolved' } }, expectKind: '工单', want: 121 },
  { short: 'ticket-closed', speech: `已关闭的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { status: 'closed' } }, expectKind: '工单', want: 115 },
]

async function bffJson(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      Origin: mainBase,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { http: res.status, json: await res.json().catch(() => ({})) }
}

async function libraryCounts(cases) {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const noco = async (path) => {
    const res = await fetch(`http://127.0.0.1:13000${path}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return json
  }
  const meta = async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const body = await noco(`/api/${resource}:list?page=1&pageSize=1${q}`)
    const c = Number(body?.meta?.count)
    return Number.isFinite(c) ? c : null
  }
  const out = { byCase: {} }
  for (const c of cases) {
    const { resource, filter } = c.library
    out.byCase[c.short] = await meta(resource, filter)
  }
  return out
}

function seedState(page, workspaceId, sessionId) {
  return page.evaluate(({ wsId, cwd, sid }) => {
    const key = 'scene-39-workstation'
    const state = JSON.parse(localStorage.getItem(key) || '{"state":{}}')
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, cwd, desc: cwd } : r))
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((p) => {
      if (p?.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    localStorage.setItem(key, JSON.stringify(state))
  }, { wsId: workspaceId, cwd: DATA, sid: sessionId })
}

async function readUi(page) {
  return page.evaluate(() => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const footer = footerAttr || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    return { footer, footerCount }
  })
}

async function dismissPending(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  if (!sheet) return
  await bffJson('/api/v1/biz/pending-sheet/dismiss', { method: 'POST', body: { sessionId, cwd: DATA } }).catch(() => ({}))
  await bffJson('/api/v1/biz/preview/dismiss', {
    method: 'POST',
    body: { sessionId, cwd: DATA, preview_id: sheet.preview_id || sheet.previewId },
  }).catch(() => ({}))
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

async function runCase(page, workspaceId, c, lib, { capture = false } = {}) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId }, timeoutMs: 30000 })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error(`session-create-failed ${c.short}`)
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await dismissPending(sessionId)
  await page.waitForTimeout(600)
  await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: c.speech },
    timeoutMs: 20000,
  })
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) break
    await page.waitForTimeout(1500)
  }
  const sheet = await official(sessionId)
  const libraryHit = c.want ?? lib.byCase[c.short]
  let ui = await readUi(page)
  for (let i = 0; i < 60; i += 1) {
    const wantFooter = `共 ${libraryHit} 条`
    if (ui.footer === wantFooter) break
    const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
    if (hit === libraryHit && footer === libraryHit) break
    await page.waitForTimeout(800)
    ui = await readUi(page)
  }
  if (capture && c.screenshot) {
    await page.screenshot({ path: c.screenshot, fullPage: false })
  }
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = ui.footer
  const footerCount = Number.isFinite(ui.footerCount) ? ui.footerCount : null
  return {
    label: c.label || c.short,
    speech: c.speech,
    libraryHit,
    rightHitTotal: rightHit,
    footer: footerCount,
    footerText: footer,
    where: sheet?.where || [],
    pass: rightHit === libraryHit && footerCount === libraryHit && String(sheet?.kind || '') === c.expectKind,
    screenshot: capture ? c.screenshot : undefined,
  }
}

const libPrimary = await libraryCounts(PRIMARY)
const libSpot = await libraryCounts(SPOT)
const lib = { byCase: { ...libPrimary.byCase, ...libSpot.byCase } }

const ws = ((await bffJson('/api/v1/workspaces')).json?.data?.items || (await bffJson('/api/v1/workspaces')).json?.items || [])
  .find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
if (!workspaceId) throw new Error('workspace-missing')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded' })
if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}
for (let i = 0; i < 60; i += 1) {
  if ((await bffJson('/api/v1/ai/status')).json?.data?.connected) break
  await page.waitForTimeout(1000)
}

await mkdir(`${STORE}/media`, { recursive: true })

const primaryResults = []
for (const c of PRIMARY) {
  primaryResults.push(await runCase(page, workspaceId, c, lib, { capture: true }))
}

const spotResults = []
for (const c of SPOT) {
  spotResults.push(await runCase(page, workspaceId, c, lib, { capture: false }))
}

await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  vendorOverlayApplied: true,
  aiReload: true,
  primary: primaryResults,
  spotChecks: spotResults,
  allPass: primaryResults.every((r) => r.pass) && spotResults.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-fix-3.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
