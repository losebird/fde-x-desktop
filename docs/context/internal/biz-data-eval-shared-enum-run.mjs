import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const EVAL_JSON = `${STORE}/internal/biz-data-eval.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const evalDoc = JSON.parse(await readFile(EVAL_JSON, 'utf8'))
const cases = evalDoc.results.filter((row) => row.classId === 'shared')

function slugFor(caseRow, index) {
  const say = String(caseRow.objects?.say || 'enum').trim()
  const n = (caseRow.objects?.owners || []).length
  const map = {
    已完成: 'done-multi',
    其他: 'other-multi',
    进行中: 'doing-multi',
    低: 'priority-low',
    中: 'priority-medium',
    高: 'priority-high',
    紧急: 'priority-urgent',
  }
  const base = map[say] || `say-${index}`
  return `${base}-${n}k`
}

function flattenOptions(objects) {
  const out = []
  for (const group of objects?.options || []) {
    for (const opt of group) out.push(opt)
  }
  return out
}

function planWhereValues(plan, kind) {
  if (!plan || typeof plan !== 'object') return null
  if (String(plan.kind || '').trim() === kind) {
    return (plan.where || []).flatMap((term) => term.values || [])
  }
  const peer = (plan.peers || []).find((row) => String(row.kind || '').trim() === kind)
  if (peer) return (peer.where || []).flatMap((term) => term.values || [])
  for (const step of plan.steps || []) {
    if (String(step.kind || '').trim() === kind) {
      return (step.where || []).flatMap((term) => term.values || [])
    }
  }
  const from = plan.from
  if (from && typeof from === 'object' && String(from.kind || '').trim() === kind) {
    return (from.where || []).flatMap((term) => term.values || [])
  }
  return null
}

function gatePass(caseRow, plan) {
  const opts = flattenOptions(caseRow.objects)
  for (const opt of opts) {
    const vals = planWhereValues(plan, opt.kind)
    if (!vals) return false
    const code = String(opt.code || '').trim()
    const say = String(opt.say || '').trim()
    if (!vals.includes(code) && !vals.includes(say)) return false
  }
  const owners = new Set(caseRow.objects?.owners || [])
  const steps = Array.isArray(plan.steps) ? plan.steps : []
  if (steps.length > 1) return false
  if (steps.length === 1) {
    const only = String(steps[0].kind || '').trim()
    if (only && only !== String(plan.kind || '').trim() && owners.has(only)) return false
  }
  for (const step of steps) {
    const k = String(step.kind || '').trim()
    if (k && !owners.has(k) && k !== String(plan.kind || '').trim()) return false
  }
  return true
}

function sheetToPlan(sheet) {
  if (!sheet || typeof sheet !== 'object') return null
  return {
    kind: sheet.kind,
    where: sheet.where || sheet.listWhere || [],
    steps: sheet.steps || [],
    from: sheet.from,
    peers: sheet.peers || [],
    hitTotal: sheet.hitTotal,
    hitTotalState: sheet.hitTotalState,
  }
}

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

async function nocoCount(resource, field, code) {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const filter = field && code ? { [field]: code } : {}
  const q = Object.keys(filter).length ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
  const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  if (!res.ok) return null
  const count = Number(body?.meta?.count)
  return Number.isFinite(count) ? count : null
}

async function libraryByKind(caseRow) {
  const catalog = (await bffJson(`/api/v1/biz/catalog?cwd=${encodeURIComponent(DATA)}`)).json?.data?.items || []
  const out = {}
  for (const opt of flattenOptions(caseRow.objects)) {
    const row = catalog.find((item) => item.kind === opt.kind)
    if (!row?.resource) continue
    out[opt.kind] = await nocoCount(row.resource, opt.field, opt.code)
  }
  return out
}

function speechFor(caseRow) {
  return caseRow.speech.includes(TAIL) ? caseRow.speech : `${caseRow.speech.replace(/[。.]?$/, '')}。${TAIL}`
}

async function previewPlan(caseRow, speech) {
  const { json } = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: { workspaceId: WS, cwd: DATA, kind: caseRow.requestKind, action: '现查', speech },
    timeoutMs: 120000,
  })
  const sheet = json?.data?.sheet || json?.data
  return { plan: sheetToPlan(sheet), sheet, error: json?.error }
}

function seedState(page, sessionId) {
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
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
      localStorage.setItem(key, JSON.stringify(state))
    },
    { wsId: WS, cwd: DATA, sid: sessionId },
  )
}

async function dismissPending(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  if (!json?.data?.sheet) return
  await bffJson('/api/v1/biz/pending-sheet/dismiss', { method: 'POST', body: { sessionId, cwd: DATA } }).catch(() => ({}))
}

async function readUi(page) {
  return page.evaluate(() => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const planLine =
      [...document.querySelectorAll('button, [role="combobox"]')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => t.length > 4) || ''
    return { footerAttr, footerVisible, footerCount: Number.isFinite(footerCount) ? footerCount : null, planLine }
  })
}

async function runSessionCase(page, speech) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId: WS }, timeoutMs: 30000 })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error('session-create-failed')
  await page.goto(mainBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await seedState(page, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)
  await dismissPending(sessionId)
  await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: speech },
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
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const ui = await readUi(page)
  return { sessionId, sheet: json?.data?.sheet, ui }
}

await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const results = []

for (let i = 0; i < cases.length; i += 1) {
  const caseRow = cases[i]
  const short = slugFor(caseRow, i)
  const speech = speechFor(caseRow)
  const lib = await libraryByKind(caseRow).catch(() => ({}))
  const preview = await previewPlan(caseRow, speech)
  let plan = preview.plan
  let gate = gatePass(caseRow, plan)
  let sessionId = ''
  let ui = null
  let sheet = preview.sheet
  try {
    const live = await runSessionCase(page, speech)
    sessionId = live.sessionId
    ui = live.ui
    sheet = live.sheet || sheet
    plan = sheetToPlan(sheet) || plan
    gate = gatePass(caseRow, plan)
  } catch (err) {
    results.push({ short, say: caseRow.objects?.say, owners: caseRow.objects?.owners, speech, error: String(err.message || err), gatePass: gate, livePass: false })
    continue
  }
  const screenshot = `${STORE}/media/biz-data-eval-shared-enum-${short}.png`
  await page.screenshot({ path: screenshot, fullPage: false })
  const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = ui?.footerCount
  const requestKind = caseRow.requestKind
  const libraryPrimary = lib[requestKind]
  const previewHit = preview.plan?.hitTotal == null ? null : Number(preview.plan.hitTotal)
  const livePass = (
    (hit != null && footer != null && hit === footer && (libraryPrimary == null || hit === libraryPrimary))
    || (previewHit != null && (libraryPrimary == null || previewHit === libraryPrimary) && gate)
  )
  const counts = (caseRow.objects?.owners || []).map((kind) => {
    const peer = (plan?.peers || []).find((p) => p.kind === kind)
    const actual = kind === plan?.kind ? plan?.hitTotal : peer?.hitTotal
    return { kind, library: lib[kind] ?? null, actual: actual == null ? null : Number(actual) }
  })
  results.push({
    short,
    say: caseRow.objects?.say,
    owners: caseRow.objects?.owners,
    speech,
    requestKind,
    sessionId,
    gatePass: gate,
    livePass,
    plan: {
      kind: plan?.kind,
      where: plan?.where,
      steps: plan?.steps,
      from: plan?.from,
      peers: (plan?.peers || []).map((p) => ({ kind: p.kind, where: p.where, hitTotal: p.hitTotal })),
      hitTotal: plan?.hitTotal,
      hitTotalState: plan?.hitTotalState,
    },
    counts,
    right: {
      kind: sheet?.kind,
      hitTotal: sheet?.hitTotal,
      footer: ui?.footerVisible,
      footerCount: ui?.footerCount,
      planLine: ui?.planLine,
    },
    screenshot,
  })
}

await browser.close()

const summary = {
  total: results.length,
  gatePass: results.filter((r) => r.gatePass).length,
  livePass: results.filter((r) => r.livePass).length,
}
await mkdir(`${STORE}/media`, { recursive: true })
await writeFile(`${STORE}/internal/biz-data-eval-shared-enum.json`, JSON.stringify({
  branch: 'cursor/eval-three-causes-2d90',
  sha: COMMIT,
  workspace: DATA,
  classId: 'shared',
  summary,
  results,
}, null, 2))
console.log(JSON.stringify(summary))
