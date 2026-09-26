import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = '7f62dc2'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const SPEECH = `员工档案的员工档案。${TAIL}`
const screenshot = `${STORE}/media/biz-data-eval-self-loop-official-emp.png`
const reportPath = `${STORE}/internal/biz-data-eval-self-loop-official.json`

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
      if (p?.id === 'data') return { ...p, state: 'full', width: 1200 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    localStorage.setItem(key, JSON.stringify(state))
  }, { wsId: workspaceId, cwd: DATA, sid: sessionId })
}

async function pendingSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

async function readFooter(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-records-footer]')
    return {
      attr: el?.getAttribute('data-records-footer') || '',
      visible: (el?.textContent || '').trim(),
      state: el?.getAttribute('data-hit-total-state') || '',
    }
  })
}

async function countDataRows(page) {
  return page.evaluate(() => [...document.querySelectorAll('table tbody tr')].filter((tr) => {
    const tds = tr.querySelectorAll('td')
    if (tds.length === 1 && Number(tds[0].getAttribute('colspan') || 0) > 1) return false
    return tds.length > 1
  }).length)
}

async function shotRecordsTable(page, path) {
  const box = await page.evaluate(() => {
    const footer = document.querySelector('[data-records-footer]')
    const table = document.querySelector('table')
    if (!footer || !table) return null
    const fr = footer.getBoundingClientRect()
    const tr = table.getBoundingClientRect()
    const top = Math.max(0, tr.top - 72)
    const bottom = fr.bottom + 8
    const left = Math.max(0, Math.min(tr.left, fr.left) - 8)
    const right = Math.max(tr.right, fr.right) + 8
    return {
      x: left,
      y: top,
      width: Math.min(1320, right - left),
      height: Math.min(960, bottom - top),
    }
  })
  if (!box || box.width < 240 || box.height < 240) return false
  await page.screenshot({ path, clip: box })
  return true
}

let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}

const lib = await libraryCounts()
await mkdir(`${STORE}/media`, { recursive: true })

const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId: WS } })
const sessionId = String(created.json?.data?.sessionId || '').trim()
await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
  method: 'POST',
  body: { text: SPEECH },
  timeoutMs: 30000,
})

let sheet = null
let turnDone = false
for (let i = 0; i < 120; i += 1) {
  const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
  if (!running && i > 3) turnDone = true
  sheet = await pendingSheet(sessionId)
  const ht = Number(sheet?.hitTotal)
  if (
    sheet?.kind === '员工档案'
    && sheet?.action === '现查'
    && sheet?.hitTotalState === 'known'
    && (ht === lib.empWithManager || ht === lib.empWithSubordinates)
    && Array.isArray(sheet.rows)
    && sheet.rows.length > 0
  ) break
  await new Promise((r) => setTimeout(r, 2000))
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } })
await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, WS, sessionId)
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})

const pendingLink = page.locator('button.underline').filter({ hasText: /员工档案/ }).first()
if (await pendingLink.isVisible({ timeout: 20000 }).catch(() => false)) {
  await pendingLink.click()
}

let footer = { attr: '', visible: '', state: '' }
let rowCount = 0
const uiDeadline = Date.now() + 120000
while (Date.now() < uiDeadline) {
  footer = await readFooter(page)
  rowCount = await countDataRows(page)
  const n = Number((footer.attr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
  const okN = n === lib.empWithManager || n === lib.empWithSubordinates
  if (footer.state === 'known' && okN && rowCount >= 1) break
  await page.waitForTimeout(500)
}

const footerNum = Number((footer.attr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
const footerOk = footerNum === lib.empWithManager || footerNum === lib.empWithSubordinates
const hasOfficialTable = rowCount >= 1
const shotOk = footerOk && hasOfficialTable && footer.state === 'known'
  ? await shotRecordsTable(page, screenshot)
  : false

await browser.close()

const peerTotals = Array.isArray(sheet?.peers)
  ? sheet.peers.map((p) => ({ relation: p?.relation, hitTotal: p?.hitTotal }))
  : []
const rightHitTotal = sheet?.hitTotalState === 'known' && sheet?.hitTotal != null ? Number(sheet.hitTotal) : null

const pass = turnDone
  && sheet?.action === '现查'
  && hasOfficialTable
  && footerOk
  && footer.state === 'known'
  && shotOk
  && footer.visible.includes(`共 ${footerNum} 条`)

const report = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  repo: REPO,
  library: lib,
  case: {
    speech: SPEECH,
    sessionId,
    turnDone,
    hitTotal: sheet?.hitTotal,
    pendingRows: Array.isArray(sheet?.rows) ? sheet.rows.length : 0,
    peerTotals,
    footerText: footer.attr,
    footerVisible: footer.visible,
    footer: Number.isFinite(footerNum) ? footerNum : null,
    hitTotalStateUi: footer.state,
    tableBodyRows: rowCount,
    rightHitTotal,
    fullTable: lib.employees,
    hasOfficialTable,
    pass,
    screenshot,
    evidence: 'IM prompt 后 pending 有行；业务记录页表体与页脚 known 后截 table+footer',
  },
}

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ pass, footer, rowCount, shotOk, pendingRows: sheet?.rows?.length }, null, 2))
process.exit(pass ? 0 : 1)
