import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = '0c05a4774649e74722e09dc5a2c9fb44f9925b20'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000
const SPEECH = `员工档案的员工档案。${TAIL}`

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
    const body = await res.json()
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return body
  }
  const meta = async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const body = await noco(`/api/${resource}:list?page=1&pageSize=1${q}`)
    const c = Number(body?.meta?.count)
    return Number.isFinite(c) ? c : null
  }
  const employees = await meta('biz_employees')
  const empWithManager = await meta('biz_employees', { managerId: { $notEmpty: true } })
  let empWithSubordinates = 0
  const managerIds = new Set()
  let page = 1
  while (page < 50) {
    const body = await noco(`/api/biz_employees:list?page=${page}&pageSize=200&sort=id&fields=managerId`)
    const rows = body.data || []
    for (const r of rows) {
      const raw = r?.managerId
      const id = raw && typeof raw === 'object' ? raw.id : raw
      if (id != null && String(id).trim() !== '') managerIds.add(String(id))
    }
    if (!rows.length || rows.length < 200) break
    page += 1
  }
  empWithSubordinates = managerIds.size
  return { employees, empWithManager, empWithSubordinates }
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

async function pendingSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

async function waitTurn(sessionId) {
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) return true
    await new Promise((r) => setTimeout(r, 1200))
  }
  return false
}

let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}

const lib = await libraryCounts()
await mkdir(`${STORE}/media`, { recursive: true })
const screenshot = `${STORE}/media/biz-data-eval-self-loop-generated-fix-4-emp.png`
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId: WS } })
const sessionId = String(created.json?.data?.sessionId || '').trim()
await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
  method: 'POST',
  body: { text: SPEECH },
  timeoutMs: 30000,
})
await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, WS, sessionId)
const turnDone = await waitTurn(page, sessionId)

let sheet = null
for (let i = 0; i < 50; i += 1) {
  sheet = await pendingSheet(sessionId)
  if (sheet?.kind === '员工档案' && sheet?.action === '现查') break
  await new Promise((r) => setTimeout(r, 1000))
}

const peerTotals = Array.isArray(sheet?.peers)
  ? sheet.peers.map((p) => ({ relation: p?.relation, hitTotal: p?.hitTotal }))
  : []
const rightHitTotal = sheet?.hitTotalState === 'known' && sheet?.hitTotal != null ? Number(sheet.hitTotal) : null

await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, WS, sessionId)
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})
await page.waitForSelector('[data-records-footer]', { timeout: 90000 }).catch(() => {})

let footerText = ''
const uiDeadline = Date.now() + 120000
while (Date.now() < uiDeadline) {
  footerText = await readFooter(page)
  if (footerText && footerText !== `共 ${lib.employees} 条`) break
  await page.waitForTimeout(500)
}
const footerNum = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
const hasOfficialTable = await page.locator('table').first().isVisible().catch(() => false)
const chipButtons = page.locator('.btn').filter({ hasText: '员工档案' })
const chipCount = await chipButtons.count().catch(() => 0)
const hasKindChips = chipCount > 0
const chipLabels = hasKindChips
  ? await chipButtons.evaluateAll((nodes) => nodes.map((n) => (n.textContent || '').trim()).filter(Boolean))
  : []
const footerEl = page.locator('[data-records-footer]')
const chipAnchor = page.locator('div.flex.items-center.gap-2.flex-wrap').first()
await footerEl.scrollIntoViewIfNeeded().catch(() => {})
const footerBox = await footerEl.boundingBox().catch(() => null)
const chipBox = await chipAnchor.boundingBox().catch(() => null)
const top = chipBox ? Math.max(0, chipBox.y - 12) : (footerBox ? Math.max(0, footerBox.y - 480) : 0)
const bottom = footerBox ? footerBox.y + footerBox.height + 16 : (top + 560)
const height = Math.min(900, Math.max(320, bottom - top))
if (footerBox || chipBox) {
  await page.screenshot({
    path: screenshot,
    clip: {
      x: Math.max(0, (footerBox || chipBox).x - 48),
      y: top,
      width: Math.min(1180, 1680),
      height,
    },
  })
} else {
  await page.screenshot({ path: screenshot, fullPage: false })
}
await browser.close()

const chipShowsFullTable = chipLabels.some((label) => /员工档案\s*120/.test(label) || label === '员工档案120')
const pass = turnDone
  && sheet?.action === '现查'
  && hasOfficialTable
  && hasKindChips
  && !chipShowsFullTable
  && footerNum !== lib.employees
  && rightHitTotal !== lib.employees
  && (peerTotals.some((p) => p.hitTotal === lib.empWithManager || p.hitTotal === lib.empWithSubordinates)
    || chipLabels.some((l) => /80|15/.test(l)))

const report = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  repo: REPO,
  rootCause: 'biz_preview 槽里 speech 被落成动作码「现查」或空，isGeneratedSelfLoopSpeech 对不上用户「X的X」，generatedSelfLoopEdgePeers 返回空，整表 120。',
  fix: 'translateBizIntent 不再用 action 顶替 speech、转发 userSpeech；pickHopSpeech 丢弃动作码；enrich/recover 与 write 侧 userSpeech 回退挂 peer。',
  library: lib,
  case: {
    speech: SPEECH,
    sessionId,
    turnDone,
    hitTotal: sheet?.hitTotal,
    peerTotals,
    footerText,
    footer: Number.isFinite(footerNum) ? footerNum : null,
    rightHitTotal,
    fullTable: lib.employees,
    hasOfficialTable,
    hasKindChips,
    chipLabels,
    pass,
    screenshot,
  },
}

await writeFile(`${STORE}/internal/biz-data-eval-self-loop-generated-fix-4.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ pass, footerText, peerTotals, chipLabels }, null, 2))
process.exit(pass ? 0 : 1)
