import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const EVAL_JSON = `${STORE}/internal/biz-data-eval.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = 'e2b0a78c53fdd2e842d06c107e7333c50681a9c4'
const VITE_PID = 1985
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 180000
const FALLBACK_WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'

const KIND_RESOURCE = {
  采购订单: 'biz_purchase_orders',
  项目任务: 'biz_project_tasks',
  销售订单: 'biz_sales_orders',
  项目: 'biz_projects',
  费用报销: 'biz_expenses',
  请假申请: 'biz_leave_requests',
  销售合同: 'biz_contracts',
  销售回款: 'biz_payments',
  员工档案: 'biz_employees',
  仓库: 'biz_warehouses',
  供应商: 'biz_suppliers',
  出入库流水: 'biz_stock_movements',
}

const evalDoc = JSON.parse(await readFile(EVAL_JSON, 'utf8'))
const sharedCases = evalDoc.results.filter((row) => row.classId === 'shared')
const MAIN = [
  { key: 'done', say: '已完成', slug: 'done' },
  { key: 'other', say: '其他', slug: 'other' },
  { key: 'doing', say: '进行中', slug: 'doing' },
].map((meta) => ({
  ...meta,
  caseRow: sharedCases.find((r) => r.objects?.say === meta.say),
}))

const SPOTS = [
  {
    short: 'warehouse-semi',
    speech: '半成品库的仓库',
    expectKind: '仓库',
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    fullResource: 'biz_warehouses',
    shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-warehouse-semi.png`,
  },
  {
    short: 'supplier-c',
    speech: 'C的供应商',
    expectKind: '供应商',
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
    fullResource: 'biz_suppliers',
    shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-supplier-c.png`,
  },
  {
    short: 'movement-production',
    speech: '生产领料的出入库流水',
    expectKind: '出入库流水',
    library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } },
    fullResource: 'biz_stock_movements',
    shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-movement-production.png`,
  },
  {
    short: 'spot-manager',
    speech: '现查员工档案的直属上级',
    expectKind: '员工档案',
    library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } },
    fullResource: 'biz_employees',
    shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-manager.png`,
    spotManager: true,
  },
]

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

function fakeHop(plan, owners) {
  const ownerSet = new Set(owners || [])
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  if (steps.length > 1) {
    return { fakeHop: true, reason: 'steps>1' }
  }
  for (const step of steps) {
    const k = String(step.kind || '').trim()
    if (k && !ownerSet.has(k) && k !== String(plan?.kind || '').trim()) {
      return { fakeHop: true, reason: 'step-kind-' + k }
    }
  }
  const kinds = steps.map((s) => String(s.kind || '').trim()).filter(Boolean)
  if (
    ownerSet.has('费用报销') &&
    ownerSet.has('员工档案') &&
    kinds.includes('请假申请') &&
    !kinds.every((k) => ownerSet.has(k))
  ) {
    return { fakeHop: true, reason: '报销-请假-档案-hop' }
  }
  let from = plan?.from
  while (from && typeof from === 'object') {
    const fk = String(from.kind || '').trim()
    if (fk && !ownerSet.has(fk) && fk !== String(plan?.kind || '').trim()) {
      return { fakeHop: true, reason: 'from-chain-' + fk }
    }
    from = from.from
  }
  return { fakeHop: false, reason: null }
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

async function loadLibraryHelpers() {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const meta = async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    })
    const body = await res.json()
    if (!res.ok) return null
    const count = Number(body?.meta?.count)
    return Number.isFinite(count) ? count : null
  }
  return { meta }
}

async function libraryForCase(caseRow, meta) {
  const out = {}
  const full = {}
  for (const opt of flattenOptions(caseRow.objects)) {
    const resource = KIND_RESOURCE[opt.kind]
    if (!resource) continue
    out[opt.kind] = await meta(resource, opt.field && opt.code ? { [opt.field]: opt.code } : undefined)
    full[opt.kind] = await meta(resource)
  }
  return { byKind: out, fullByKind: full }
}

function speechFor(text) {
  const s = String(text || '').trim()
  return s.includes(TAIL) ? s : `${s.replace(/[。.]?$/, '')}。${TAIL}`
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
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
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

async function dismissPending(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  if (!json?.data?.sheet) return
  await bffJson('/api/v1/biz/pending-sheet/dismiss', { method: 'POST', body: { sessionId, cwd: DATA } }).catch(() => ({}))
}

async function readUi(page, spotManager) {
  return page.evaluate((wantMgr) => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const hitTotalStateAttr = footerEl?.getAttribute('data-hit-total-state') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const tableBody = document.querySelector('table tbody')
    const visibleRowCount = tableBody ? tableBody.querySelectorAll('tr').length : 0
    let emptyManagerCells = null
    if (wantMgr && tableBody) {
      const headers = [...document.querySelectorAll('table thead th')].map((th) =>
        (th.textContent || '').replace(/\s+/g, '').trim(),
      )
      const idx = headers.findIndex((h) => h.includes('直属上级'))
      if (idx >= 0) {
        emptyManagerCells = [...tableBody.querySelectorAll('tr')].filter((tr) => {
          const cell = tr.querySelectorAll('td')[idx]
          return cell && !(cell.textContent || '').trim()
        }).length
      }
    }
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr,
      visibleRowCount,
      emptyManagerCells,
    }
  }, spotManager)
}

async function officialSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  return json?.data?.sheet || null
}

async function runPromptSession(page, workspaceId, speech) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId }, timeoutMs: 30000 })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error('session-create-failed')
  await page.goto(mainBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
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
  return sessionId
}

async function clickKindChip(page, kind) {
  const chip = page.locator('button.btn').filter({ hasText: kind }).first()
  await chip.scrollIntoViewIfNeeded().catch(() => {})
  try {
    await chip.click({ timeout: 20000, force: true })
    return { clicked: true }
  } catch (err) {
    return { clicked: false, error: String(err.message || err) }
  }
}

async function waitStable(page, sessionId, expectKind, spotManager) {
  let sheet = null
  let ui = null
  let stable = 0
  let lastKey = ''
  for (let i = 0; i < 80; i += 1) {
    sheet = await officialSheet(sessionId)
    ui = await readUi(page, spotManager)
    const key = `${sheet?.kind}|${ui.footerAttr}|${sheet?.hitTotal}|${ui.visibleRowCount}`
    const ok =
      sheet?.kind === expectKind &&
      ui.footerAttr &&
      (ui.footerAttr === '总数未知' || ui.footerAttr === '不完整' || /^共\s+\d+\s+条/.test(ui.footerAttr))
    if (ok) {
      if (key === lastKey) stable += 1
      else stable = 0
      lastKey = key
      if (stable >= 2) break
    } else {
      stable = 0
      lastKey = key
    }
    await page.waitForTimeout(400)
  }
  return { sheet, ui }
}

async function shotFooter(page, path) {
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path,
      clip: {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 520),
        width: Math.min(1120, 1580),
        height: Math.min(580, 1100),
      },
    })
  } else {
    await page.screenshot({ path, fullPage: false })
  }
}

function sidePass({ library, fullTable, rightHit, footerCount, hitTotalState, planVals, opt, gate, fake }) {
  const notes = []
  let pass = true
  if (fake?.fakeHop) {
    pass = false
    notes.push(`假hop:${fake.reason}`)
  }
  if (!gate) {
    pass = false
    notes.push('闸未过')
  }
  if (library != null && rightHit != null && rightHit !== library) {
    pass = false
    notes.push(`右边${rightHit}≠库${library}`)
  }
  if (library != null && footerCount != null && footerCount !== library) {
    pass = false
    notes.push(`页脚${footerCount}≠库${library}`)
  }
  if (rightHit != null && footerCount != null && rightHit !== footerCount) {
    pass = false
    notes.push('页脚≠右边')
  }
  if (library != null && rightHit === fullTable && library !== fullTable) {
    pass = false
    notes.push('右边整表')
  }
  if (library != null && footerCount === fullTable && library !== fullTable) {
    pass = false
    notes.push('页脚整表')
  }
  if (hitTotalState && hitTotalState !== 'known' && library != null) {
    pass = false
    notes.push(`hitTotalState=${hitTotalState}`)
  }
  const code = String(opt?.code || '').trim()
  const say = String(opt?.say || '').trim()
  if (planVals && code && !planVals.includes(code) && !planVals.includes(say)) {
    pass = false
    notes.push(`计划缺${code}`)
  }
  return { pass, notes: notes.join('；') || '一致' }
}

function auditSlots() {
  const slotsPath = `${REPO}/runtime/vendor-overlays/dsh-lan-assist/slots.js`
  const text = execSync(`grep -nE '已完成|其他|请假申请|completed|doing|\\b42\\b|\\b26\\b' '${slotsPath}' || true`, {
    encoding: 'utf8',
  }).trim()
  return {
    slotsJsPath: slotsPath,
    hardcodedLiterals: text ? text.split('\n') : [],
    pierced: Boolean(text),
  }
}

await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })
const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || FALLBACK_WS)

const { meta } = await loadLibraryHelpers()
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

const groups = []
for (const group of MAIN) {
  const caseRow = group.caseRow
  if (!caseRow) continue
  const speech = speechFor(caseRow.speech)
  const lib = await libraryForCase(caseRow, meta)
  const sessionId = await runPromptSession(page, workspaceId, speech)
  let baseSheet = await officialSheet(sessionId)
  let plan = sheetToPlan(baseSheet)
  const gate = gatePass(caseRow, plan)
  const hop = fakeHop(plan, caseRow.objects?.owners || [])
  const sides = []
  for (const kind of caseRow.objects?.owners || []) {
    const opt = flattenOptions(caseRow.objects).find((o) => o.kind === kind)
    const click = await clickKindChip(page, kind)
    await page.waitForTimeout(800)
    let { sheet, ui } = await waitStable(page, sessionId, kind, false)
    if (!click.clicked || sheet?.kind !== kind) {
      sheet = await officialSheet(sessionId)
      ui = await readUi(page, false)
    }
    plan = sheetToPlan(sheet) || plan
    const planVals = planWhereValues(plan, kind)
    const peer = (plan?.peers || []).find((p) => p.kind === kind)
    const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    const library = lib.byKind[kind] ?? null
    const fullTable = lib.fullByKind[kind] ?? null
    const shot = `${STORE}/media/biz-data-eval-shared-enum-adv-${group.slug}-${kind}.png`
    await shotFooter(page, shot)
    const sideGate = gatePass(caseRow, plan)
    const sideHop = fakeHop(plan, caseRow.objects?.owners || [])
    const { pass, notes } = sidePass({
      library,
      fullTable,
      rightHit,
      footerCount: ui.footerCount,
      hitTotalState: String(sheet?.hitTotalState || ui.hitTotalStateAttr || ''),
      planVals,
      opt,
      gate: sideGate,
      fake: sideHop,
    })
    sides.push({
      object: kind,
      library,
      fullTable,
      rightHitTotal: rightHit,
      hitTotalState: sheet?.hitTotalState || ui.hitTotalStateAttr || null,
      footerText: ui.footerVisible,
      footerAttr: ui.footerAttr,
      footerCount: ui.footerCount,
      planValues: planVals,
      gatePass: sideGate,
      fakeHop: sideHop.fakeHop,
      fakeHopReason: sideHop.reason,
      pass,
      note: notes,
      screenshot: shot,
    })
  }
  groups.push({
    group: group.slug,
    say: group.say,
    speech,
    sessionId,
    owners: caseRow.objects?.owners,
    gatePass: gate,
    fakeHop: hop.fakeHop,
    fakeHopReason: hop.reason,
    sides,
    groupPass: sides.every((s) => s.pass) && gate && !hop.fakeHop,
  })
}

const spots = []
for (const spot of SPOTS) {
  const speech = speechFor(spot.speech)
  const libraryHit = await meta(spot.library.resource, spot.library.filter)
  const fullTable = await meta(spot.fullResource)
  const sessionId = await runPromptSession(page, workspaceId, speech)
  const { sheet, ui } = await waitStable(page, sessionId, spot.expectKind, spot.spotManager)
  await shotFooter(page, spot.shot)
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  let pass = true
  const notes = []
  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    pass = false
    notes.push(`右边${rightHit}≠库${libraryHit}`)
  }
  if (libraryHit != null && ui.footerCount != null && ui.footerCount !== libraryHit) {
    pass = false
    notes.push(`页脚${ui.footerCount}≠库${libraryHit}`)
  }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) {
    pass = false
    notes.push('页脚≠右边')
  }
  if (libraryHit != null && rightHit === fullTable && libraryHit !== fullTable) {
    pass = false
    notes.push('右边整表')
  }
  if (spot.spotManager && ui.emptyManagerCells > 0) {
    notes.push(`本页直属上级空${ui.emptyManagerCells}格`)
  }
  spots.push({
    short: spot.short,
    speech,
    sessionId,
    library: libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    footerText: ui.footerVisible,
    footerAttr: ui.footerAttr,
    footerCount: ui.footerCount,
    sheetKind: sheet?.kind,
    pass,
    note: notes.join('；') || '一致',
    screenshot: spot.shot,
  })
}

await browser.close()

const codeAudit = auditSlots()
const allPass =
  groups.every((g) => g.groupPass) &&
  spots.every((s) => s.pass) &&
  !codeAudit.pierced

const report = {
  branch: 'cursor/eval-three-causes-2d90',
  sha: COMMIT,
  vitePid5174: VITE_PID,
  runtimePort: 4318,
  workspace: DATA,
  classId: 'shared-adv',
  codeAudit,
  mainGroups: groups,
  spotChecks: spots,
  allPass,
}

await writeFile(`${STORE}/internal/biz-data-eval-shared-enum-adv.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ allPass, groups: groups.map((g) => ({ g: g.group, pass: g.groupPass, sides: g.sides.map((s) => ({ o: s.object, pass: s.pass, lib: s.library, right: s.rightHitTotal, foot: s.footerCount })) })), spots: spots.map((s) => ({ s: s.short, pass: s.pass })) }))
