import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000
const WHOLE = { 客户: 302 }

const CASES = [
  {
    short: 'customer-individual',
    label: '客户 / 个人客户',
    speech: `个人客户的客户。${TAIL}`,
    kind: '客户',
    library: { resource: 'biz_customers', filter: { customerType: 'individual' } },
  },
  {
    short: 'customer-enterprise',
    label: '客户 / 企业客户',
    speech: `企业客户的客户。${TAIL}`,
    kind: '客户',
    library: { resource: 'biz_customers', filter: { customerType: 'enterprise' } },
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
  out['客户-whole'] = await meta('biz_customers', null)
  return out
}

function seedState(page, workspaceId, sessionId) {
  return page.evaluate(
    ({ wsId, cwd, sid }) => {
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
    },
    { wsId: workspaceId, cwd: DATA, sid: sessionId },
  )
}

async function readFooter(page) {
  return page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
}

function evaluatePass(c, { libraryHit, right, footerText, footerCount, sheet, http, json }) {
  const wantFooter = `共 ${libraryHit} 条`
  const whole = WHOLE[c.kind]
  const failReasons = []

  if (sheet?.action !== '现查') failReasons.push('action-not-现查')
  if (json?.error) failReasons.push('preview-error')
  if (http !== 200) failReasons.push(`http-${http}`)
  if (!footerText) failReasons.push('no-records-footer')

  if (whole != null && right === whole && right !== libraryHit) {
    failReasons.push(`whole-table-right-${whole}`)
  }
  if (whole != null && footerCount === whole && footerCount !== libraryHit) {
    failReasons.push(`whole-table-footer-${whole}`)
  }

  if (libraryHit === 0) {
    if (footerText === '总数未知') failReasons.push('empty-footer-unknown')
    if (footerText !== '共 0 条') failReasons.push('empty-footer-not-zero')
    if (right !== 0) failReasons.push('empty-right-not-zero')
  } else {
    if (right !== libraryHit) failReasons.push('right-mismatch')
    if (footerText !== wantFooter) failReasons.push('footer-text-mismatch')
    if (!Number.isFinite(footerCount) || footerCount !== libraryHit) failReasons.push('footer-count-mismatch')
  }

  return { pass: failReasons.length === 0, failReasons, wantFooter }
}

let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
  status = await bffJson('/api/v1/ai/status')
}
if (!status.json?.data?.connected) {
  await mkdir(`${STORE}/internal`, { recursive: true })
  await writeFile(
    `${STORE}/internal/biz-data-eval-empty-zero-2-adv.json`,
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

const libRaw = await libraryCounts()
const lib = {
  'customer-individual': libRaw['customer-individual'],
  'customer-enterprise': libRaw['customer-enterprise'],
}
await mkdir(`${STORE}/media`, { recursive: true })
const browser = await chromium.launch({ headless: true })

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

const results = []
for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const screenshot = `${STORE}/media/biz-data-eval-empty-zero-2-adv-${c.short}.png`
  const libraryHit = lib[c.short]
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  const promptRes = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: c.speech },
    timeoutMs: 30000,
  })
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await waitTurn(page, sessionId)

  let sheet = null
  for (let i = 0; i < 30; i += 1) {
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
  const http = previewRes?.http ?? promptRes.http
  const json = { error: sheet?.action === '现查' ? null : previewRes?.json?.error || 'no-sheet' }
  const right = sheet?.hitTotalState === 'known' && sheet?.hitTotal != null ? Number(sheet.hitTotal) : null

  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('[data-records-footer]', { timeout: 90000 }).catch(() => {})

  let footerText = ''
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    footerText = await readFooter(page)
    sheet = (await pendingSheet(sessionId)) || sheet
    if (libraryHit === 0 && footerText === '共 0 条') break
    if (libraryHit > 0 && footerText === `共 ${libraryHit} 条`) break
    if (footerText === '总数未知' && libraryHit === 0) break
    await page.waitForTimeout(500)
  }

  const footerCount = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
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

  const { pass, failReasons, wantFooter } = evaluatePass(c, {
    libraryHit,
    right,
    footerText,
    footerCount,
    sheet,
    http,
    json,
  })

  results.push({
    short: c.short,
    label: c.label,
    speech: c.speech,
    sessionId,
    libraryHit,
    rightHitTotal: right,
    sheetHitTotal: sheet?.hitTotal == null ? null : Number(sheet.hitTotal),
    hitTotalState: sheet?.hitTotalState,
    wantFooter,
    footer: Number.isFinite(footerCount) ? footerCount : null,
    footerText,
    action: sheet?.action,
    promptHttp: promptRes.http,
    previewHttp: previewRes?.http ?? null,
    previewError: json?.error || null,
    pass,
    failReasons: pass ? [] : failReasons,
    screenshot,
  })
  console.log(c.short, pass ? 'PASS' : `FAIL ${failReasons.join(',')}`)
  await page.close()
}

await browser.close()

const report = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  aiConnected: Boolean(status.json?.data?.connected),
  library: lib,
  wholeTableGuards: WHOLE,
  cases: results,
  allPass: results.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-empty-zero-2-adv.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ allPass: report.allPass }))
