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

const CASES = [
  {
    short: 'supplier-c',
    label: '供应商 / C',
    speech: `C的供应商。${TAIL}`,
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
    expectKind: '供应商',
  },
  {
    short: 'movement-production',
    label: '出入库流水 / 生产领料',
    speech: `生产领料的出入库流水。${TAIL}`,
    library: { resource: 'biz_stock_movements', filter: { $or: [{ bizType: '生产领料' }, { refType: '生产领料' }] } },
    expectKind: '出入库流水',
  },
  {
    short: 'warehouse-semi',
    label: '仓库 / 半成品库',
    speech: `半成品库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    expectKind: '仓库',
  },
  {
    short: 'spot-manager',
    label: '抽查 员工直属上级',
    speech: `现查员工档案的直属上级。${TAIL}`,
    library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } },
    expectKind: '员工档案',
  },
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

async function libraryCounts() {
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
  const movementProductionCount = async () => {
    try {
      return await meta('biz_stock_movements', { refType: '生产领料' })
    } catch {
      return null
    }
  }
  const out = { full: {}, byCase: {} }
  for (const c of CASES) {
    if (c.short === 'movement-production') {
      out.byCase[c.short] = await movementProductionCount()
      if (!out.full.biz_stock_movements) out.full.biz_stock_movements = await meta('biz_stock_movements')
      continue
    }
    const { resource, filter } = c.library
    out.byCase[c.short] = await meta(resource, filter)
    if (!out.full[resource]) out.full[resource] = await meta(resource)
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
    else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
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
    const footer = footerAttr || [...document.querySelectorAll('span')].map((s) => s.textContent?.trim() || '').find((t) => /^共\s+\d+\s+条/.test(t)) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const planCandidates = [...document.querySelectorAll('button, [role="combobox"]')]
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() || '')
      .filter((t) => t.includes('现查') && t.length < 200)
    return { footer, footerCount, planLine: planCandidates[0] || '' }
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

async function runCase(page, workspaceId, c, lib) {
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
  let ui = await readUi(page)
  const libraryHit = lib.byCase[c.short]
  for (let i = 0; i < 50; i += 1) {
    const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
    if (hit != null && footer != null && hit === footer && hit === libraryHit) break
    await page.waitForTimeout(800)
    ui = await readUi(page)
  }
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
  const screenshotPath = `${STORE}/media/biz-data-eval-enum-fix-2-${c.short}.png`
  await page.screenshot({ path: screenshotPath, fullPage: false })
  return {
    label: c.label,
    speech: c.speech,
    libraryHit,
    fullTable: lib.full[c.library.resource],
    rightHitTotal: rightHit,
    rightKind: sheet?.kind || null,
    footer,
    footerText: ui.footer,
    planLine: ui.planLine,
    where: sheet?.where || [],
    pass: rightHit === libraryHit && footer === libraryHit && String(sheet?.kind || '') === c.expectKind,
    screenshot: screenshotPath,
  }
}

const lib = await libraryCounts()
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

const results = []
for (const c of CASES) {
  results.push(await runCase(page, workspaceId, c, lib))
}
await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  cases: results,
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-fix-2.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
