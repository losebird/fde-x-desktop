import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { mkdir } from 'node:fs/promises'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TURN_MS = 240000

const cases = [
  { short: 'product', speech: '现查商品物料的出入库流水。只要预览，不要过账，不要 biz_write。' },
  { short: 'stock-movements', speech: '现查商品物料的出入库流水，走 stockMovements。只要预览，不要过账，不要 biz_write。' },
  { short: 'warehouse', speech: '现查仓库的出入库流水。只要预览，不要过账，不要 biz_write。' },
  { short: 'roles', speech: '现查{{t("Departments")}}的{{t("Roles")}}。只要预览，不要过账，不要 biz_write。' },
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

const wsBody = (await bffJson('/api/v1/workspaces')).json || {}
const workspaces = wsBody?.data?.items || wsBody?.items || []
const ws = workspaces.find((row) => String(row?.cwd || row?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
const workspaceName = String(ws?.name || ws?.title || '')
if (!workspaceId) throw new Error('workspace missing')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function running(sessionId) {
  const { json } = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)
  return Boolean(json?.data?.running)
}

async function readPanel() {
  return page.evaluate(() => {
    const footer = document.querySelector('[data-records-footer]')
    const footerText = footer?.getAttribute('data-records-footer') || footer?.textContent?.trim() || ''
    const state = footer?.getAttribute('data-hit-total-state') || ''
    const rowCount = document.querySelectorAll('tbody tr').length
    const pageLine = [...document.querySelectorAll('span')].map((el) => el.textContent?.trim() || '').find((t) => /^第\s+\d+/.test(t)) || ''
    return { footerText, state, rowCount, pageLine }
  })
}

async function turn(sessionId, speech) {
  await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: speech },
    timeoutMs: 20000,
  })
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const isRunning = await running(sessionId)
    if (isRunning) saw = true
    if (saw && !isRunning) break
    await page.waitForTimeout(1200)
  }
  await page.waitForTimeout(1000)
  let panel = null
  const panelDeadline = Date.now() + 30000
  while (Date.now() < panelDeadline) {
    panel = await readPanel()
    if (panel.footerText || panel.rowCount > 0) break
    await page.waitForTimeout(500)
  }
  return panel
}

function seedState({ activeDataSubview = 'records', panelWidth = 1100, sessionId } = {}) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, activeDataSubview: view, panelWidth: width, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = view
    if (sid) state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width, view: 'data' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => {
      if (p && p.id === 'data') return { ...p, state: 'full', width }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd: DATA, activeDataSubview, panelWidth, sessionId })
}

async function official(sessionId) {
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(DATA)}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
let st = (await bffJson('/api/v1/ai/status')).json?.data || {}
if (!st.connected) await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
for (let i = 0; i < 60; i += 1) {
  await page.waitForTimeout(1000)
  st = (await bffJson('/api/v1/ai/status')).json?.data || {}
  if (st.connected) break
}
if (!st.connected) throw new Error('dsh-not-connected')

const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId }, timeoutMs: 30000 })
const sessionId = created.json?.data?.sessionId || created.json?.sessionId || ''
if (!sessionId) throw new Error('no session')

await seedState({ activeDataSubview: 'records', panelWidth: 1100, sessionId })
await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(2000)
const rec = page.getByRole('button', { name: '业务记录', exact: true })
if (await rec.count()) await rec.click({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(1500)

await mkdir(`${STORE}/media`, { recursive: true })
const results = []

for (const c of cases) {
  const panel = await turn(sessionId, c.speech)
  const sheet = await official(sessionId)
  const dest = `${STORE}/media/biz-data-eval-missing-total-adv-${c.short}.png`
  await page.evaluate(() => {
    const footer = document.querySelector('[data-records-footer]')
    if (footer) footer.scrollIntoView({ block: 'end' })
  }).catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: dest, fullPage: false })
  results.push({
    short: c.short,
    speech: c.speech,
    panel,
    sheetHitTotal: sheet?.hitTotal,
    sheetKind: sheet?.kind,
    dest,
  })
}

await browser.close()
console.log(JSON.stringify({ sessionId, workspaceId, results }, null, 2))
