import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const CASES = [
  {
    short: 'ticket-new',
    label: '工单 / 新建',
    speech: `新建的工单。${TAIL}`,
    kind: '工单',
    library: { resource: 'biz_tickets', filter: { status: 'new' } },
    expect: 37,
  },
  {
    short: 'contract-sales',
    label: '销售合同 / 销售合同',
    speech: `销售合同的销售合同。${TAIL}`,
    kind: '销售合同',
    library: { resource: 'biz_contracts', filter: { contractType: 'sales' } },
    expect: 220,
  },
  {
    short: 'contract-service',
    label: '销售合同 / 服务合同',
    speech: `服务合同的销售合同。${TAIL}`,
    kind: '销售合同',
    library: { resource: 'biz_contracts', filter: { contractType: 'service' } },
    expect: 54,
  },
  {
    short: 'customer-enterprise',
    label: '客户 / 企业客户',
    speech: `企业客户的客户。${TAIL}`,
    kind: '客户',
    library: { resource: 'biz_customers', filter: { customerType: 'enterprise' } },
    expect: 212,
  },
  {
    short: 'customer-individual',
    label: '客户 / 个人客户',
    speech: `个人客户的客户。${TAIL}`,
    kind: '客户',
    library: { resource: 'biz_customers', filter: { customerType: 'individual' } },
    expect: 0,
  },
  {
    short: 'customer-won',
    label: '客户 / 成交客户',
    speech: `成交客户的客户。${TAIL}`,
    kind: '客户',
    library: { resource: 'biz_customers', filter: { status: 'active' } },
    expect: 179,
  },
  {
    short: 'lead-new',
    label: '销售线索 / 新线索',
    speech: `新线索的销售线索。${TAIL}`,
    kind: '销售线索',
    library: { resource: 'biz_leads', filter: { status: 'new' } },
    expect: 139,
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
  const meta = async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (!res.ok) throw new Error(`${res.status} ${resource}`)
    const c = Number(body?.meta?.count)
    return Number.isFinite(c) ? c : null
  }
  const out = {}
  for (const c of CASES) {
    const { resource, filter } = c.library
    out[c.short] = await meta(resource, filter)
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

async function readFooter(page) {
  return page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
}

let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
  status = await bffJson('/api/v1/ai/status')
}
if (!status.json?.data?.connected) {
  const out = {
    commit: COMMIT,
    branch: 'cursor/eval-three-causes-2d90',
    blocked: 'ai/not-connected',
    aiStatus: status.json?.data || null,
    cases: CASES.map((c) => ({ short: c.short, label: c.label, speech: c.speech })),
  }
  await writeFile(`${STORE}/internal/biz-data-eval-enum-live.json`, `${JSON.stringify(out, null, 2)}\n`)
  console.error('AI runtime not connected; wrote blocked report')
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 60000 })

const results = []
for (const c of CASES) {
  const screenshot = `${STORE}/media/biz-data-eval-enum-live-${c.short}.png`
  const libraryHit = lib[c.short]
  const wantFooter = `共 ${libraryHit} 条`
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  const { http, json } = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: {
      workspaceId,
      cwd: DATA,
      kind: c.kind,
      action: '现查',
      speech: c.speech,
      sessionId,
    },
    timeoutMs: TURN_MS,
  })
  const sheet = json?.data?.sheet || json?.data
  const right = sheet?.hitTotalState === 'known' && sheet?.hitTotal != null ? Number(sheet.hitTotal) : null
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
  const footerCount = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
  await page.screenshot({ path: screenshot, fullPage: false })
  const pass =
    sheet?.action === '现查' &&
    right === libraryHit &&
    footerText === wantFooter &&
    Number.isFinite(footerCount) &&
    footerCount === libraryHit
  results.push({
    short: c.short,
    label: c.label,
    speech: c.speech,
    libraryHit,
    rightHitTotal: right,
    footer: Number.isFinite(footerCount) ? footerCount : null,
    footerText,
    action: sheet?.action,
    hitTotalState: sheet?.hitTotalState,
    promptHttp: http,
    previewError: json?.error || null,
    pass,
    screenshot,
  })
}
await browser.close()

const report = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  library: lib,
  cases: results,
  allPass: results.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-live.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ allPass: report.allPass, pass: results.filter((r) => r.pass).length, total: results.length }))
