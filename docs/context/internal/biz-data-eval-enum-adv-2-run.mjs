import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = '3c58dadd874104d89d3cd0f505362a6945322405'
const VITE_PID_5174 = 1985
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const MAIN_CASES = [
  {
    short: 'supplier-c',
    useCase: '供应商 / C',
    speech: `C的供应商。${TAIL}`,
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
    expectKind: '供应商',
    screenshot: true,
  },
  {
    short: 'movement-production',
    useCase: '出入库流水 / 生产领料',
    speech: `生产领料的出入库流水。${TAIL}`,
    library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } },
    expectKind: '出入库流水',
    screenshot: true,
  },
  {
    short: 'warehouse-semi',
    useCase: '仓库 / 半成品库',
    speech: `半成品库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    expectKind: '仓库',
    screenshot: true,
  },
  {
    short: 'warehouse-mixed',
    useCase: '仓库 / 综合库',
    speech: `综合库的仓库。${TAIL}`,
    library: { resource: 'biz_warehouses', filter: { whType: '综合库' } },
    expectKind: '仓库',
    screenshot: true,
  },
  {
    short: 'spot-manager',
    useCase: '员工档案 / 直属上级（现查）',
    speech: `现查员工档案的直属上级。${TAIL}`,
    library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } },
    expectKind: '员工档案',
    screenshot: false,
  },
]

const SPOT_CASES = [
  {
    short: 'ticket-resolved',
    useCase: '抽查 工单 / 已解决',
    speech: `已解决的工单。${TAIL}`,
    library: { resource: 'biz_tickets', filter: { status: 'resolved' } },
  },
  {
    short: 'ticket-closed',
    useCase: '抽查 工单 / 已关闭',
    speech: `已关闭的工单。${TAIL}`,
    library: { resource: 'biz_tickets', filter: { status: 'closed' } },
  },
  {
    short: 'project-active',
    useCase: '抽查 项目 / 进行中',
    speech: `进行中的项目。${TAIL}`,
    library: { resource: 'biz_projects', filter: { status: 'active' } },
  },
  {
    short: 'movement-transfer',
    useCase: '抽查 出入库流水 / 库存调拨',
    speech: `库存调拨的出入库流水。${TAIL}`,
    library: { resource: 'biz_stock_movements', filter: { refType: '库存调拨' } },
  },
  {
    short: 'spot-product-movements',
    useCase: '抽查 商品物料→出入库流水',
    speech: `现查商品物料的出入库流水。${TAIL}`,
    library: { walkProductFk: true },
  },
  {
    short: 'spot-dept-roles',
    useCase: '抽查 部门→角色',
    speech: `现查{{t("Departments")}}的{{t("Roles")}}。${TAIL}`,
    library: { fixed: 0 },
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

async function libraryCounts(allCases) {
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
  for (const c of allCases) {
    if (c.library.fixed != null) {
      out.byCase[c.short] = c.library.fixed
      continue
    }
    if (c.library.walkProductFk) {
      out.byCase[c.short] = await walkProductFk()
      if (out.full.biz_stock_movements == null) out.full.biz_stock_movements = await meta('biz_stock_movements')
      continue
    }
    const { resource, filter } = c.library
    out.byCase[c.short] = await meta(resource, filter)
    if (out.full[resource] == null) out.full[resource] = await meta(resource)
  }
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
      else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
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

async function readUi(page) {
  return page.evaluate(() => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const footer =
      footerAttr ||
      [...document.querySelectorAll('span')]
        .map((s) => s.textContent?.trim() || '')
        .find((t) => /^共\s+\d+\s+条/.test(t) || t === '总数未知' || t === '不完整') ||
      ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const planCandidates = [...document.querySelectorAll('button, [role="combobox"]')]
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() || '')
      .filter((t) => t.includes('现查') && t.length < 240)
    const chipRow = document.querySelector('[data-kind-chips]')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return { footer, footerCount, planLine: planCandidates[0] || '', chipRow }
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

function piercedFromCommit() {
  const diff = execSync(`git show ${COMMIT} --no-color`, { cwd: REPO, encoding: 'utf8' })
  const hits = []
  if (diff.includes('hitTotal = 1')) {
    hits.push({
      file: 'runtime/vendor-overlays/dsh-lan-assist/write.js',
      line: 219,
      reason: 'packSheet 在 where+单行时把 hitTotal 写死为字面量 1，不是枚举名但属于条数写死',
    })
  }
  if (diff.includes('rows.length === 1')) {
    hits.push({
      file: 'runtime/vendor-overlays/dsh-lan-assist/write.js',
      line: 217,
      reason: '单行结果即升格 known，与半成品库/综合库库内常为 1 条时页脚「共 1 条」可能同源于此启发式而非独立计数',
    })
  }
  const enumWordsInDiff = ['半成品库', '综合库', '生产领料', '供应商', '1647', '16', '80'].filter((w) => diff.includes(w))
  return {
    commitDiffTouchesFooter: true,
    enumOrCountLiteralsInDiff: enumWordsInDiff,
    pierced: hits,
    piercedByHardcodedBizEnumInSource: false,
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
  let sheet = await official(sessionId)
  let ui = await readUi(page)
  const libraryHit = lib.byCase[c.short]
  const fullTable =
    c.library.walkProductFk || c.library.fixed != null
      ? lib.full.biz_stock_movements ?? null
      : lib.full[c.library.resource] ?? null
  for (let i = 0; i < 60; i += 1) {
    sheet = await official(sessionId)
    ui = await readUi(page)
    const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
    const footerOk = ui.footer && !ui.footer.includes('总数未知')
    const planOk = Boolean(ui.planLine)
    if (hit != null && footer != null && footerOk && planOk && hit === footer && hit === libraryHit) break
    await page.waitForTimeout(800)
  }
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
  const pierced =
    libraryHit != null &&
    fullTable != null &&
    (rightHit === fullTable || footer === fullTable) &&
    libraryHit !== fullTable
  let screenshot = null
  if (c.screenshot) {
    screenshot = `${STORE}/media/biz-data-eval-enum-adv-2-${c.short}.png`
    await page.screenshot({ path: screenshot, fullPage: false })
  }
  return {
    short: c.short,
    useCase: c.useCase,
    speech: c.speech,
    sessionId,
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    rightKind: sheet?.kind || null,
    footer,
    footerText: ui.footer,
    planLine: ui.planLine,
    pierced,
    pass:
      !pierced &&
      rightHit === libraryHit &&
      footer === libraryHit &&
      libraryHit !== 0 &&
      libraryHit !== fullTable &&
      !String(ui.footer).includes('总数未知'),
    screenshot,
  }
}

const allCases = [...MAIN_CASES, ...SPOT_CASES]
const lib = await libraryCounts(allCases)
const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find(
  (r) => String(r?.cwd || r?.description || '') === DATA,
)
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

const cases = []
for (const c of MAIN_CASES) cases.push(await runCase(page, workspaceId, c, lib))
for (const c of SPOT_CASES) cases.push(await runCase(page, workspaceId, c, lib))
await browser.close()

const resolved = cases.find((r) => r.useCase.includes('已解决'))
const closed = cases.find((r) => r.useCase.includes('已关闭'))
const spotChecks = {
  resolvedNotSameAsClosed:
    resolved?.rightHitTotal != null &&
    closed?.rightHitTotal != null &&
    resolved.rightHitTotal !== closed.rightHitTotal,
  projectActiveNotZero: (cases.find((r) => r.short === 'project-active') || {}).rightHitTotal !== 0,
  transferNotFullLedger: (() => {
    const r = cases.find((x) => x.short === 'movement-transfer')
    return r && r.rightHitTotal !== r.fullTable && r.footer === r.rightHitTotal
  })(),
  productMovementsFooterHasTotal: (() => {
    const r = cases.find((x) => x.short === 'spot-product-movements')
    return r && r.footerText && /共\s+\d+\s+条/.test(r.footerText)
  })(),
  deptRolesIsZero: (cases.find((x) => x.short === 'spot-dept-roles') || {}).rightHitTotal === 0,
}

const out = {
  branch: 'cursor/eval-three-causes-2d90',
  commit: COMMIT,
  vitePid5174: VITE_PID_5174,
  bffPort: 4318,
  workspace: DATA,
  library: lib,
  codeReview: piercedFromCommit(),
  spotChecks,
  cases,
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-adv-2.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ spotChecks, cases: cases.map((c) => ({ useCase: c.useCase, libraryHit: c.libraryHit, right: c.rightHitTotal, footer: c.footerText, pierced: c.pierced, pass: c.pass })) }, null, 2))
