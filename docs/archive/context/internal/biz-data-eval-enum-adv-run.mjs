import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
const VITE_PID = Number(execSync('lsof -i :5174 -t 2>/dev/null | head -1', { encoding: 'utf8' }).trim()) || null
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const CASES = [
  { short: 'ticket-resolved', label: '工单 / 已解决', speech: `已解决的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { status: 'resolved' } }, expectKind: '工单', forbidFull: true },
  { short: 'ticket-closed', label: '工单 / 已关闭', speech: `已关闭的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { status: 'closed' } }, expectKind: '工单', forbidFull: true },
  { short: 'supplier-a', label: '供应商 / A', speech: `A的供应商。${TAIL}`, library: { resource: 'biz_suppliers', filter: { rating: 'A' } }, expectKind: '供应商', forbidFull: true },
  { short: 'supplier-b', label: '供应商 / B', speech: `B的供应商。${TAIL}`, library: { resource: 'biz_suppliers', filter: { rating: 'B' } }, expectKind: '供应商', forbidFull: true },
  { short: 'supplier-c', label: '供应商 / C', speech: `C的供应商。${TAIL}`, library: { resource: 'biz_suppliers', filter: { rating: 'C' } }, expectKind: '供应商', forbidFull: true },
  { short: 'supplier-d', label: '供应商 / D', speech: `D的供应商。${TAIL}`, library: { resource: 'biz_suppliers', filter: { rating: 'D' } }, expectKind: '供应商', forbidFull: true },
  { short: 'project-active', label: '项目 / 进行中', speech: `进行中的项目。${TAIL}`, library: { resource: 'biz_projects', filter: { status: 'active' } }, expectKind: '项目', forbidZero: true },
  { short: 'task-pending', label: '项目任务 / 待处理', speech: `待处理的项目任务。${TAIL}`, library: { resource: 'biz_project_tasks', filter: { status: 'todo' } }, expectKind: '项目任务', forbidZero: true },
  { short: 'task-doing', label: '项目任务 / 进行中', speech: `进行中的项目任务。${TAIL}`, library: { resource: 'biz_project_tasks', filter: { status: 'doing' } }, expectKind: '项目任务', forbidZero: true },
  { short: 'movement-transfer', label: '出入库流水 / 库存调拨', speech: `库存调拨的出入库流水。${TAIL}`, library: { resource: 'biz_stock_movements', filter: { refType: '库存调拨' } }, expectKind: '出入库流水', forbidFull: true },
  { short: 'movement-sales', label: '出入库流水 / 销售出库', speech: `销售出库的出入库流水。${TAIL}`, library: { resource: 'biz_stock_movements', filter: { refType: '销售出库' } }, expectKind: '出入库流水', forbidFull: true },
  { short: 'movement-production', label: '出入库流水 / 生产领料', speech: `生产领料的出入库流水。${TAIL}`, library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } }, expectKind: '出入库流水', forbidFull: true },
  { short: 'movement-inventory', label: '出入库流水 / 库存盘点', speech: `库存盘点的出入库流水。${TAIL}`, library: { resource: 'biz_stock_movements', filter: { refType: '库存盘点' } }, expectKind: '出入库流水', forbidFull: true },
  { short: 'warehouse-semi', label: '仓库 / 半成品库', speech: `半成品库的仓库。${TAIL}`, library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } }, expectKind: '仓库', forbidFull: true },
  { short: 'warehouse-mixed', label: '仓库 / 综合库', speech: `综合库的仓库。${TAIL}`, library: { resource: 'biz_warehouses', filter: { whType: '综合库' } }, expectKind: '仓库', forbidFull: true },
]

const SPOT = [
  { short: 'spot-product-movements', label: '抽查 商品物料→出入库流水', speech: `现查商品物料的出入库流水。${TAIL}`, library: { walkProductFk: true }, expectKind: '出入库流水', want: 5135, screenshot: false },
  { short: 'spot-dept-roles', label: '抽查 部门→角色', speech: `现查{{t("Departments")}}的{{t("Roles")}}。${TAIL}`, library: { fixed: 0 }, expectKind: '{{t("Roles")}}', want: 0, screenshot: false },
  { short: 'spot-manager', label: '抽查 员工直属上级', speech: `现查员工档案的直属上级。${TAIL}`, library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } }, expectKind: '员工档案', want: 80, screenshot: false },
  { short: 'spot-customer-tickets', label: '抽查 客户→工单', speech: `现查客户的工单。${TAIL}`, library: { resource: 'biz_tickets', filter: { customerId: { $notEmpty: true } } }, expectKind: '工单', want: 399, screenshot: false },
]

const CODE_REVIEW = {
  commit: COMMIT,
  piercedInDiff: false,
  residualVocabOrMergeRisk: [
    'runtime/vendor-overlays/dsh-lan-assist/vocab/spoken.json:122-124（同一 say 仍列 resolved+closed+done，依赖 resolveClueValuesForField 按口语拆码）',
    'runtime/vendor-overlays/dsh-lan-assist/vocab/spoken.json:169-171（没关/未关 not 线索仍 OR 多个 closed 类码）',
  ],
  fixedInCommit: [
    'runtime/vendor-overlays/dsh-lan-assist/slots.js:compressSameKeyTerms 不再把同 keys 不同 values OR 合并',
    'runtime/vendor-overlays/dsh-lan-assist/slots.js:resolveClueValuesForField 按 schema 枚举拆命中集',
    'runtime/vendor-overlays/dsh-lan-assist/slots.js:kindMentionOverlapsEnumLabel 避免短 kind 挡住更长枚举标签',
  ],
  hardcodedEvalCountsInRuntime: false,
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
  const walkProductFk = async () => {
    let hit = 0
    let page = 1
    while (page < 300) {
      const body = await noco(`/api/biz_stock_movements:list?page=${page}&pageSize=200&sort=id&fields=product,productId`)
      const rows = body.data || []
      for (const r of rows) {
        const raw = r?.product ?? r?.productId
        const id = raw && typeof raw === 'object' ? raw.id : raw
        if (id != null && String(id).trim() !== '') hit += 1
      }
      if (!rows.length || rows.length < 200) break
      page += 1
    }
    return hit
  }
  const out = { full: {}, byCase: {} }
  for (const c of [...CASES, ...SPOT]) {
    if (c.library.fixed != null) {
      out.byCase[c.short] = c.library.fixed
      continue
    }
    if (c.library.walkProductFk) {
      out.byCase[c.short] = await walkProductFk()
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
    const planLine = planCandidates[0] || ''
    const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const kindChips = [...document.querySelectorAll('[data-kind-chip], button.rounded-full')]
      .map((el) => el.textContent?.replace(/\s+/g, '').trim() || '')
      .filter((t) => t.length > 0 && t.length < 40)
    return { footer, footerCount, planLine, banner, kindChips }
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

function assessPierce(c, lib, sheet, ui) {
  const libraryHit = lib.byCase[c.short]
  const fullTable = c.library.resource ? lib.full[c.library.resource] : (c.library.walkProductFk ? lib.full.biz_stock_movements : null)
  const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
  const notes = []
  let pierced = false
  const where = Array.isArray(sheet?.where) ? sheet.where : []

  for (const term of where) {
    const vals = term?.values || []
    if (vals.length > 1) {
      const closedLike = vals.filter((v) => /resolved|closed|done|已解决|已关闭/i.test(String(v)))
      if (closedLike.length > 1) {
        pierced = true
        notes.push(`where 同字段 OR 合并: ${JSON.stringify(vals)}`)
      }
    }
  }

  if (String(sheet?.kind || '') !== c.expectKind) {
    pierced = true
    notes.push(`落点型=${sheet?.kind}，期望 ${c.expectKind}`)
  }
  if (hit !== libraryHit) {
    pierced = true
    notes.push(`右边 hitTotal=${hit}，库=${libraryHit}`)
  }
  if (footer !== libraryHit) {
    pierced = true
    notes.push(`页脚=${footer}，库=${libraryHit}`)
  }
  if (hit != null && footer != null && hit !== footer) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }
  if (c.forbidFull && fullTable != null && hit === fullTable) {
    pierced = true
    notes.push(`命中整表 ${fullTable}`)
  }
  if (c.forbidZero && (hit === 0 || footer === 0)) {
    pierced = true
    notes.push('命中为 0')
  }
  if (hit === 236) {
    pierced = true
    notes.push('命中 236')
  }
  if (c.want != null && hit !== c.want) {
    pierced = true
    notes.push(`抽查期望 ${c.want}`)
  }

  return {
    libraryHit,
    fullTable,
    rightHitTotal: hit,
    rightKind: sheet?.kind || null,
    footer,
    footerText: ui.footer,
    planLine: ui.planLine,
    banner: ui.banner,
    kindChips: ui.kindChips,
    where,
    pierced,
    note: notes.join('；') || '库、右边、页脚一致',
  }
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
    const aligned = hit != null && footer != null && hit === footer
    const planOk = Boolean(ui.planLine || ui.banner)
    if (aligned && planOk && (libraryHit == null || hit === libraryHit)) break
    await page.waitForTimeout(800)
    ui = await readUi(page)
  }
  const assessed = assessPierce(c, lib, sheet, ui)
  const screenshotPath = c.screenshot === false
    ? null
    : `${STORE}/media/biz-data-eval-enum-adv-${c.short}.png`
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: false })
  }
  return {
    useCase: c.label,
    speech: c.speech,
    sessionId,
    ...assessed,
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
const spotChecks = []
for (const c of SPOT) {
  spotChecks.push(await runCase(page, workspaceId, c, lib))
}
await browser.close()

const ticketResolved = results.find((r) => r.useCase === '工单 / 已解决')
const ticketClosed = results.find((r) => r.useCase === '工单 / 已关闭')
if (ticketResolved && ticketClosed) {
  if (ticketResolved.rightHitTotal === ticketClosed.rightHitTotal) {
    ticketResolved.pierced = true
    ticketClosed.pierced = true
    ticketResolved.note += '；已解决与已关闭命中相同'
    ticketClosed.note += '；已解决与已关闭命中相同'
  }
}

const out = {
  branch: 'cursor/eval-three-causes-2d90',
  commit: COMMIT,
  vitePid5174: VITE_PID,
  workspace: DATA,
  library: lib,
  codeReview: CODE_REVIEW,
  cases: results,
  spotChecks,
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-adv.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify({
  ok: true,
  pierced: results.filter((r) => r.pierced).map((r) => r.useCase),
  spot: spotChecks.map((r) => ({ label: r.useCase, pierced: r.pierced, footer: r.footer })),
}, null, 2))
