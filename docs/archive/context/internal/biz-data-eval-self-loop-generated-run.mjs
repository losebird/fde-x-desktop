import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = '2321ed1b9a7fe7cb6b370632c817fbe77826f141'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const CASES = [
  {
    short: 'emp-manager',
    label: '员工档案 → 员工档案 / manager',
    edge: { from: '员工档案', to: '员工档案', field: 'manager' },
    speech: `员工档案的员工档案。${TAIL}`,
    kind: '员工档案',
    libraryKey: 'empWithManager',
    fullTableKey: 'employees',
  },
  {
    short: 'emp-subordinates',
    label: '员工档案 → 员工档案 / subordinates',
    edge: { from: '员工档案', to: '员工档案', field: 'subordinates' },
    speech: `员工档案的员工档案。${TAIL}`,
    kind: '员工档案',
    libraryKey: 'empWithSubordinates',
    fullTableKey: 'employees',
  },
  {
    short: 'dept-parent',
    label: '{{t("Departments")}} → {{t("Departments")}} / parent',
    edge: { from: '{{t("Departments")}}', to: '{{t("Departments")}}', field: 'parent' },
    speech: `{{t("Departments")}}的{{t("Departments")}}。${TAIL}`,
    kind: '{{t("Departments")}}',
    libraryKey: 'deptWithParent',
    fullTableKey: 'departments',
  },
  {
    short: 'dept-children',
    label: '{{t("Departments")}} → {{t("Departments")}} / children',
    edge: { from: '{{t("Departments")}}', to: '{{t("Departments")}}', field: 'children' },
    speech: `{{t("Departments")}}的{{t("Departments")}}。${TAIL}`,
    kind: '{{t("Departments")}}',
    libraryKey: 'deptWithChildren',
    fullTableKey: 'departments',
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
  const empRes = 'biz_employees'
  const deptRes = 'departments'
  const employees = await meta(empRes)
  const departments = await meta(deptRes)
  const empWithManager = await meta(empRes, { managerId: { $notEmpty: true } })
  let empWithSubordinates = 0
  const managerIds = new Set()
  let page = 1
  while (page < 50) {
    const body = await noco(`/api/${empRes}:list?page=${page}&pageSize=200&sort=id&fields=managerId`)
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
  const deptWithParent = await meta(deptRes, { parentId: { $notEmpty: true } })
  let deptWithChildren = 0
  page = 1
  const parentIds = new Set()
  while (page < 20) {
    const body = await noco(`/api/${deptRes}:list?page=${page}&pageSize=200&sort=id&fields=parentId`)
    const rows = body.data || []
    for (const r of rows) {
      const raw = r?.parentId
      const id = raw && typeof raw === 'object' ? raw.id : raw
      if (id != null && String(id).trim() !== '') parentIds.add(String(id))
    }
    if (!rows.length || rows.length < 200) break
    page += 1
  }
  deptWithChildren = parentIds.size
  return {
    employees,
    departments,
    empWithManager,
    empWithSubordinates,
    deptWithParent,
    deptWithChildren,
  }
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

async function waitTurn(page, sessionId) {
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) return true
    await page.waitForTimeout(1200)
  }
  return false
}

let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
  status = await bffJson('/api/v1/ai/status')
}
if (!status.json?.data?.connected) {
  await mkdir(`${STORE}/internal`, { recursive: true })
  await writeFile(
    `${STORE}/internal/biz-data-eval-self-loop-generated.json`,
    `${JSON.stringify({ commit: COMMIT, branch: 'cursor/eval-three-causes-2d90', blocked: 'ai/not-connected', aiStatus: status.json?.data || null }, null, 2)}\n`,
  )
  console.error('AI not connected')
  process.exit(2)
}

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const wsRow = (wsPayload?.data?.items || wsPayload?.items || []).find(
  (r) => String(r?.cwd || r?.description || r?.desc || '') === DATA,
)
const workspaceId = String(wsRow?.id || WS)
const lib = await libraryCounts()
await mkdir(`${STORE}/media`, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const screenshot = `${STORE}/media/biz-data-eval-self-loop-generated-${c.short}.png`
  const libraryHit = lib[c.libraryKey]
  const fullTable = lib[c.fullTableKey]
  const wantFooter = `共 ${libraryHit} 条`
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  const promptRes = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: c.speech },
    timeoutMs: 30000,
  })
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  const turnDone = await waitTurn(page, sessionId)

  let sheet = null
  for (let i = 0; i < 40; i += 1) {
    sheet = await pendingSheet(sessionId)
    if (sheet?.kind === c.kind && sheet?.action === '现查') break
    await page.waitForTimeout(1000)
  }
  let previewRes = null
  if (!sheet?.action) {
    previewRes = await bffJson('/api/v1/biz/preview', {
      method: 'POST',
      body: { workspaceId, cwd: DATA, kind: c.kind, action: '现查', speech: c.speech, sessionId },
      timeoutMs: TURN_MS,
    })
    sheet = previewRes.json?.data?.sheet || previewRes.json?.data || sheet
  }
  const right = sheet?.hitTotalState === 'known' && sheet?.hitTotal != null ? Number(sheet.hitTotal) : null

  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})
  await page.waitForSelector('[data-records-footer]', { timeout: 90000 }).catch(() => {})

  let footerText = ''
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    footerText = await readFooter(page)
    if (footerText === wantFooter) break
    await page.waitForTimeout(500)
  }
  const footerCount = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
  const hasOfficialTable = await page.locator('table').first().isVisible().catch(() => false)
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path: screenshot,
      clip: {
        x: Math.max(0, box.x - 48),
        y: Math.max(0, box.y - 480),
        width: Math.min(1180, 1680),
        height: Math.min(560, 1000),
      },
    })
  } else {
    await page.screenshot({ path: screenshot, fullPage: false })
  }

  const pass =
    turnDone &&
    sheet?.action === '现查' &&
    right === libraryHit &&
    footerText === wantFooter &&
    Number.isFinite(footerCount) &&
    footerCount === libraryHit &&
    right !== fullTable

  results.push({
    short: c.short,
    label: c.label,
    edge: c.edge,
    speech: c.speech,
    sessionId,
    libraryHit,
    fullTable,
    rightHitTotal: right,
    footer: Number.isFinite(footerCount) ? footerCount : null,
    footerText,
    action: sheet?.action,
    hitTotalState: sheet?.hitTotalState,
    promptHttp: promptRes.http,
    previewHttp: previewRes?.http ?? null,
    previewError: previewRes?.json?.error || null,
    hasOfficialTable,
    turnDone,
    pass,
    screenshot,
  })
  await page.close()
}

await browser.close()

const report = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  repo: REPO,
  classId: 'edge',
  category: 'generated-self-loop-speech-X的X',
  note: '评测集口语 X的X；未重打人话上级/下属；整表不能当自环命中',
  library: lib,
  cases: results,
  allPass: results.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-self-loop-generated.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ allPass: report.allPass, pass: results.filter((r) => r.pass).length, total: results.length, lib }))
