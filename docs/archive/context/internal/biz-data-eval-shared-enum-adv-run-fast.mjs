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
const FALLBACK_WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 150000

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
const sharedCases = evalDoc.results.filter((r) => r.classId === 'shared')
const MAIN = ['已完成', '其他', '进行中'].map((say) => ({
  say,
  slug: say === '已完成' ? 'done' : say === '其他' ? 'other' : 'doing',
  caseRow: sharedCases.find((r) => r.objects?.say === say),
}))

const SPOTS = [
  { short: 'warehouse-semi', speech: '半成品库的仓库', expectKind: '仓库', library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } }, fullResource: 'biz_warehouses', shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-warehouse-semi.png` },
  { short: 'supplier-c', speech: 'C的供应商', expectKind: '供应商', library: { resource: 'biz_suppliers', filter: { rating: 'C' } }, fullResource: 'biz_suppliers', shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-supplier-c.png` },
  { short: 'movement-production', speech: '生产领料的出入库流水', expectKind: '出入库流水', library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } }, fullResource: 'biz_stock_movements', shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-movement-production.png` },
  { short: 'spot-manager', speech: '现查员工档案的直属上级', expectKind: '员工档案', library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } }, fullResource: 'biz_employees', shot: `${STORE}/media/biz-data-eval-shared-enum-adv-spot-manager.png`, spotManager: true },
]

function flattenOptions(objects) {
  const out = []
  for (const group of objects?.options || []) for (const opt of group) out.push(opt)
  return out
}

function planWhereValues(plan, kind) {
  if (!plan || typeof plan !== 'object') return null
  if (String(plan.kind || '').trim() === kind) return (plan.where || []).flatMap((t) => t.values || [])
  const peer = (plan.peers || []).find((row) => String(row.kind || '').trim() === kind)
  if (peer) return (peer.where || []).flatMap((t) => t.values || [])
  for (const step of plan.steps || []) {
    if (String(step.kind || '').trim() === kind) return (step.where || []).flatMap((t) => t.values || [])
  }
  let from = plan.from
  while (from && typeof from === 'object') {
    if (String(from.kind || '').trim() === kind) return (from.where || []).flatMap((t) => t.values || [])
    from = from.from
  }
  return null
}

function gatePass(caseRow, plan) {
  for (const opt of flattenOptions(caseRow.objects)) {
    const vals = planWhereValues(plan, opt.kind)
    if (!vals) return false
    const code = String(opt.code || '').trim()
    const say = String(opt.say || '').trim()
    if (!vals.includes(code) && !vals.includes(say)) return false
  }
  const owners = new Set(caseRow.objects?.owners || [])
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  if (steps.length > 1) return false
  for (const step of steps) {
    const k = String(step.kind || '').trim()
    if (k && !owners.has(k) && k !== String(plan?.kind || '').trim()) return false
  }
  return true
}

function fakeHop(plan, owners) {
  const ownerSet = new Set(owners || [])
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  if (steps.length > 1) return { fakeHop: true, reason: 'steps>1' }
  for (const step of steps) {
    const k = String(step.kind || '').trim()
    if (k && !ownerSet.has(k) && k !== String(plan?.kind || '').trim()) return { fakeHop: true, reason: 'step-' + k }
  }
  return { fakeHop: false, reason: null }
}

function sheetToPlan(sheet) {
  if (!sheet || typeof sheet !== 'object') return null
  return { kind: sheet.kind, where: sheet.where || sheet.listWhere || [], steps: sheet.steps || [], from: sheet.from, peers: sheet.peers || [], hitTotal: sheet.hitTotal, hitTotalState: sheet.hitTotalState }
}

async function bffJson(path, { method = 'GET', body, timeoutMs = 25000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, { method, headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) })
  return { json: await res.json().catch(() => ({})) }
}

async function loadMeta() {
  const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8')).lookupToken
  return async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, { headers: { authorization: `Bearer ${token}` } })
    const body = await res.json()
    return Number.isFinite(Number(body?.meta?.count)) ? Number(body.meta.count) : null
  }
}

async function libraryForCase(caseRow, meta) {
  const byKind = {}
  const fullByKind = {}
  for (const opt of flattenOptions(caseRow.objects)) {
    const resource = KIND_RESOURCE[opt.kind]
    if (!resource) continue
    byKind[opt.kind] = await meta(resource, opt.field && opt.code ? { [opt.field]: opt.code } : undefined)
    fullByKind[opt.kind] = await meta(resource)
  }
  return { byKind, fullByKind }
}

function speechFor(text) {
  const s = String(text || '').trim()
  return s.includes(TAIL) ? s : `${s.replace(/[。.]?$/, '')}。${TAIL}`
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
    state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    localStorage.setItem(key, JSON.stringify(state))
  }, { wsId: workspaceId, cwd: DATA, sid: sessionId })
}

async function officialSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  return (await bffJson(`/api/v1/biz/pending-sheet?${q}`)).json?.data?.sheet || null
}

async function readUi(page, spotManager) {
  return page.evaluate((wantMgr) => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    let emptyManagerCells = null
    if (wantMgr) {
      const headers = [...document.querySelectorAll('table thead th')].map((th) => (th.textContent || '').replace(/\s+/g, '').trim())
      const idx = headers.findIndex((h) => h.includes('直属上级'))
      const tbody = document.querySelector('table tbody')
      if (idx >= 0 && tbody) {
        emptyManagerCells = [...tbody.querySelectorAll('tr')].filter((tr) => !(tr.querySelectorAll('td')[idx]?.textContent || '').trim()).length
      }
    }
    return { footerAttr, footerVisible, footerCount: Number.isFinite(footerCount) ? footerCount : null, hitTotalStateAttr: footerEl?.getAttribute('data-hit-total-state') || '', emptyManagerCells }
  }, spotManager)
}

async function runSession(page, workspaceId, speech) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error('no-session')
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 8000 }).catch(() => {})
  await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, { method: 'POST', body: { text: speech } })
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) break
    await page.waitForTimeout(1200)
  }
  return sessionId
}

async function shotFooter(page, path) {
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) await page.screenshot({ path, clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 520), width: 1120, height: 580 } })
  else await page.screenshot({ path })
}

function assessSide({ library, fullTable, sheet, ui, planVals, opt, gate, hop }) {
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const notes = []
  let pass = true
  if (hop.fakeHop) { pass = false; notes.push('假hop:' + hop.reason) }
  if (!gate) { pass = false; notes.push('闸未过') }
  if (library != null && rightHit != null && rightHit !== library) { pass = false; notes.push(`右边${rightHit}≠库${library}`) }
  if (library != null && ui.footerCount != null && ui.footerCount !== library) { pass = false; notes.push(`页脚${ui.footerCount}≠库${library}`) }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) { pass = false; notes.push('页脚≠右边') }
  const code = String(opt?.code || '').trim()
  if (planVals && code && !planVals.includes(code)) { pass = false; notes.push('计划缺' + code) }
  return { pass, rightHit, notes: notes.join('；') || '一致', fullTable }
}

function auditSlots() {
  const slotsPath = `${REPO}/runtime/vendor-overlays/dsh-lan-assist/slots.js`
  const text = execSync(`grep -nE '已完成|其他|请假申请|completed|doing|\\b42\\b|\\b26\\b' '${slotsPath}' || true`, { encoding: 'utf8' }).trim()
  return { slotsJsPath: slotsPath, hardcodedLiterals: text ? text.split('\n') : [], pierced: Boolean(text) }
}

await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })
const workspaceId = FALLBACK_WS
const meta = await loadMeta()
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const mainGroups = []

for (const group of MAIN) {
  const caseRow = group.caseRow
  const speech = speechFor(caseRow.speech)
  const lib = await libraryForCase(caseRow, meta)
  const sessionId = await runSession(page, workspaceId, speech)
  const sides = []
  for (const kind of caseRow.objects.owners) {
    await page.locator('button.btn').filter({ hasText: kind }).first().click({ timeout: 25000, force: true }).catch(() => {})
    await page.waitForTimeout(900)
    const sheet = await officialSheet(sessionId)
    const ui = await readUi(page, false)
    const plan = sheetToPlan(sheet)
    const opt = flattenOptions(caseRow.objects).find((o) => o.kind === kind)
    const planVals = planWhereValues(plan, kind)
    const hop = fakeHop(plan, caseRow.objects.owners)
    const gate = gatePass(caseRow, plan)
    const shot = `${STORE}/media/biz-data-eval-shared-enum-adv-${group.slug}-${kind}.png`
    await shotFooter(page, shot)
    const { pass, rightHit, notes } = assessSide({ library: lib.byKind[kind], fullTable: lib.fullByKind[kind], sheet, ui, planVals, opt, gate, hop })
    sides.push({ object: kind, library: lib.byKind[kind], fullTable: lib.fullByKind[kind], rightHitTotal: rightHit, hitTotalState: sheet?.hitTotalState || ui.hitTotalStateAttr, footerText: ui.footerVisible, footerAttr: ui.footerAttr, footerCount: ui.footerCount, planValues: planVals, gatePass: gate, fakeHop: hop.fakeHop, fakeHopReason: hop.reason, pass, note: notes, screenshot: shot, sheetKind: sheet?.kind })
  }
  const baseSheet = await officialSheet(sessionId)
  const basePlan = sheetToPlan(baseSheet)
  mainGroups.push({ group: group.slug, say: group.say, speech, sessionId, gatePass: gatePass(caseRow, basePlan), fakeHop: fakeHop(basePlan, caseRow.objects.owners).fakeHop, sides, groupPass: sides.every((s) => s.pass) })
}

const spotChecks = []
for (const spot of SPOTS) {
  const speech = speechFor(spot.speech)
  const libraryHit = await meta(spot.library.resource, spot.library.filter)
  const fullTable = await meta(spot.fullResource)
  const sessionId = await runSession(page, workspaceId, speech)
  const sheet = await officialSheet(sessionId)
  const ui = await readUi(page, spot.spotManager)
  await shotFooter(page, spot.shot)
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  let pass = libraryHit != null && rightHit === libraryHit && ui.footerCount === libraryHit
  const notes = []
  if (!pass) notes.push(`库${libraryHit} 右${rightHit} 脚${ui.footerCount}`)
  if (spot.spotManager && ui.emptyManagerCells > 0) notes.push(`上级空${ui.emptyManagerCells}`)
  spotChecks.push({ short: spot.short, speech, sessionId, library: libraryHit, fullTable, rightHitTotal: rightHit, footerText: ui.footerVisible, footerAttr: ui.footerAttr, footerCount: ui.footerCount, sheetKind: sheet?.kind, pass, note: notes.join('；') || '一致', screenshot: spot.shot })
}

await browser.close()
const codeAudit = auditSlots()
const allPass = mainGroups.every((g) => g.groupPass) && spotChecks.every((s) => s.pass) && !codeAudit.pierced
const report = { branch: 'cursor/eval-three-causes-2d90', sha: COMMIT, vitePid5174: VITE_PID, runtimePort: 4318, workspace: DATA, classId: 'shared-adv', codeAudit, mainGroups, spotChecks, allPass }
await writeFile(`${STORE}/internal/biz-data-eval-shared-enum-adv.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ allPass, mainGroups: mainGroups.map((g) => ({ g: g.group, pass: g.groupPass, sides: g.sides.map((s) => ({ o: s.object, pass: s.pass, lib: s.library, r: s.rightHitTotal, f: s.footerCount })) })), spots: spotChecks.map((s) => ({ s: s.short, pass: s.pass })) }))
