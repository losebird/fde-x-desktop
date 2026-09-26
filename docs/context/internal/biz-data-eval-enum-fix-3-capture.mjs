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

const PRIMARY = [
  {
    short: 'warehouse-semi',
    label: '仓库 / 半成品库',
    kind: '仓库',
    speech: `半成品库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-fix-3-warehouse-semi.png`,
  },
  {
    short: 'warehouse-mixed',
    label: '仓库 / 综合库',
    kind: '仓库',
    speech: `综合库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '综合库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-fix-3-warehouse-mixed.png`,
  },
]

const SPOT = [
  { short: 'supplier-c', kind: '供应商', speech: `C的供应商。${TAIL}`, library: { resource: 'biz_suppliers', filter: { rating: 'C' } }, want: 16 },
  { short: 'movement-production', kind: '出入库流水', speech: `生产领料的出入库流水。${TAIL}`, library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } }, want: 1647 },
  { short: 'spot-manager', kind: '员工档案', speech: `现查员工档案的直属上级。${TAIL}`, library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } }, want: 80 },
  { short: 'ticket-resolved', kind: '工单', speech: `已解决的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { status: 'resolved' } }, want: 121 },
  { short: 'ticket-closed', kind: '工单', speech: `已关闭的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { status: 'closed' } }, want: 115 },
]

async function bffJson(path, { method = 'GET', body, timeoutMs = 30000 } = {}) {
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
  return { json: await res.json().catch(() => ({})) }
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
    return Number(body?.meta?.count)
  }
  const out = {}
  for (const c of cases) out[c.short] = await meta(c.library.resource, c.library.filter)
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

async function readFooter(page) {
  return page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
}

async function runCase(page, workspaceId, c, lib, { capture = false }) {
  const want = lib[c.short]
  const wantFooter = `共 ${want} 条`
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  const preview = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: { cwd: DATA, sessionId, kind: c.kind, action: '现查', speech: c.speech },
  })
  const sheet = preview.json?.data?.sheet || preview.json?.sheet || {}
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  let footerText = ''
  for (let i = 0; i < 80; i += 1) {
    footerText = await readFooter(page)
    if (footerText === wantFooter) break
    await page.waitForTimeout(400)
  }
  if (capture) await page.screenshot({ path: c.screenshot, fullPage: false })
  const rightHit = sheet.hitTotal == null ? null : Number(sheet.hitTotal)
  const footerCount = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
  return {
    label: c.label || c.short,
    speech: c.speech,
    libraryHit: want,
    rightHitTotal: rightHit,
    footer: Number.isFinite(footerCount) ? footerCount : null,
    footerText,
    where: sheet.where || [],
    pass: rightHit === want && footerText === wantFooter,
    screenshot: capture ? c.screenshot : undefined,
  }
}

const allCases = [...PRIMARY, ...SPOT]
const lib = await libraryCounts(allCases)
const ws = ((await bffJson('/api/v1/workspaces')).json?.data?.items || (await bffJson('/api/v1/workspaces')).json?.items || [])
  .find((r) => String(r?.cwd || r?.desc || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
if (!workspaceId) throw new Error('workspace-missing')

if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}

await mkdir(`${STORE}/media`, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 60000 })

const primary = []
for (const c of PRIMARY) primary.push(await runCase(page, workspaceId, c, lib, { capture: true }))

const spotChecks = []
for (const c of SPOT) spotChecks.push(await runCase(page, workspaceId, c, lib, { capture: false }))

await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  vendorOverlayApplied: true,
  aiReload: true,
  primary,
  spotChecks,
  allPass: primary.every((r) => r.pass) && spotChecks.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-fix-3.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
