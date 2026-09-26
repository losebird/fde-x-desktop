import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = '1325277905b57c7ebe870a4c3a8ea326108cbd34'
const VITE_PID = 1985
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 240000

const CASES = [
  {
    short: 'warehouse-semi',
    useCase: '仓库 / 半成品库',
    speech: `半成品库的仓库。${TAIL}`,
    expectKind: '仓库',
    forbidFullResource: 'biz_warehouses',
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-adv-warehouse-semi.png`,
  },
  {
    short: 'warehouse-mixed',
    useCase: '仓库 / 综合库',
    speech: `综合库的仓库。${TAIL}`,
    expectKind: '仓库',
    forbidFullResource: 'biz_warehouses',
    library: { resource: 'biz_warehouses', filter: { whType: '综合库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-adv-warehouse-mixed.png`,
  },
  {
    short: 'supplier-c',
    useCase: '供应商 / C',
    speech: `C的供应商。${TAIL}`,
    expectKind: '供应商',
    forbidFullResource: 'biz_suppliers',
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-adv-supplier-c.png`,
  },
  {
    short: 'movement-production',
    useCase: '出入库流水 / 生产领料',
    speech: `生产领料的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    forbidFullResource: 'biz_stock_movements',
    forbidZero: true,
    library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-adv-movement-production.png`,
  },
  {
    short: 'product-movements',
    useCase: '现查 商品物料→出入库流水',
    speech: `现查商品物料的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    library: { walkProductFk: true },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-adv-product-movements.png`,
    ownBrowser: true,
  },
  {
    short: 'spot-manager',
    useCase: '现查 员工档案→直属上级',
    speech: `现查员工档案的直属上级。${TAIL}`,
    expectKind: null,
    forbidFullResource: 'biz_employees',
    library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-adv-spot-manager.png`,
    ownBrowser: true,
  },
]

async function bffJson(path, { method = 'GET', body, timeoutMs = 30000 } = {}) {
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

async function libraryCounts(cases) {
  const secrets = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
  const token = String(secrets.lookupToken || '')
  const noco = async (path) => {
    const res = await fetch(`http://127.0.0.1:13000${path}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
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
      const body = await noco(
        `/api/biz_stock_movements:list?page=${page}&pageSize=200&sort=id&fields=product,productId`,
      )
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
  const out = { byCase: {}, full: {} }
  for (const c of cases) {
    if (c.library.walkProductFk) {
      out.byCase[c.short] = await walkProductFk()
      out.full.biz_stock_movements = await meta('biz_stock_movements')
      continue
    }
    const { resource, filter } = c.library
    out.byCase[c.short] = await meta(resource, filter)
    if (!out.full[resource]) out.full[resource] = await meta(resource)
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
    const hitTotalStateAttr = footerEl?.getAttribute('data-hit-total-state') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const visibleCount = Number((footerVisible.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const pagination =
      [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^第\s+\d+\s+\/\s+\d+\s+页/.test(t)) || ''
    const kindChips = [...document.querySelectorAll('button.rounded-full, [data-kind-chip]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, '').trim())
      .filter((t) => t && t.length < 48)
    const tableBody = document.querySelector('table tbody')
    const visibleRowCount = tableBody ? tableBody.querySelectorAll('tr').length : 0
    const banner =
      document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      visibleCount: Number.isFinite(visibleCount) ? visibleCount : null,
      hitTotalStateAttr,
      pagination,
      kindChips,
      visibleRowCount,
      banner,
    }
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

function assess(c, lib, sheet, ui) {
  const libraryHit = lib.byCase[c.short]
  const fullTable = c.library.walkProductFk
    ? lib.full.biz_stock_movements
    : c.forbidFullResource
      ? lib.full[c.forbidFullResource] || lib.full[c.library.resource]
      : null
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const hitTotalState = String(sheet?.hitTotalState || ui.hitTotalStateAttr || '')
  const sheetKind = sheet?.kind || null
  const notes = []
  let pierced = false

  if (ui.footerAttr && ui.footerVisible && ui.footerAttr !== '总数未知' && ui.footerAttr !== '不完整') {
    const attrN = ui.footerAttr.match(/共\s+(\d+)\s+条/)
    const visN = ui.footerVisible.match(/共\s+(\d+)\s+条/)
    if (attrN && visN && attrN[1] !== visN[1]) {
      pierced = true
      notes.push(`属性页脚与可见页脚数字打穿：attr=${ui.footerAttr} visible=${ui.footerVisible}`)
    }
    if (attrN && !visN && !ui.footerVisible.includes(ui.footerAttr)) {
      pierced = true
      notes.push(`属性页脚与可见文案打穿：attr=${ui.footerAttr} visible=${ui.footerVisible}`)
    }
  }

  if (c.expectKind && sheetKind !== c.expectKind) {
    pierced = true
    notes.push(`sheet.kind=${sheetKind} 期望 ${c.expectKind}`)
  }
  if (c.short === 'spot-manager' && sheetKind === '员工档案' && rightHit === fullTable) {
    pierced = true
    notes.push('落在员工整表')
  }
  if (c.short === 'spot-manager' && sheetKind && !/上级|员工/.test(String(sheetKind))) {
    pierced = true
    notes.push(`落点型异常 ${sheetKind}`)
  }

  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    pierced = true
    notes.push(`rightHitTotal=${rightHit} 库侧=${libraryHit}`)
  }
  if (libraryHit != null && ui.footerCount != null && ui.footerCount !== libraryHit) {
    pierced = true
    notes.push(`可见页脚计数=${ui.footerCount} 库侧=${libraryHit}`)
  }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }

  if (c.forbidFullResource && fullTable != null && rightHit === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`rightHit 等于整表 ${fullTable}`)
  }
  if (c.forbidFullResource && fullTable != null && ui.footerCount === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`页脚等于整表 ${fullTable}`)
  }

  if (c.short === 'product-movements') {
    if (sheetKind !== '出入库流水') {
      pierced = true
      notes.push(`对象须为出入库流水，实际 ${sheetKind}`)
    }
    if (rightHit === fullTable || ui.footerCount === fullTable) {
      notes.push(`与流水整表相同（${fullTable}），非独立筛后计数`)
      if (libraryHit !== fullTable) pierced = true
    }
  }

  if (c.forbidZero && (rightHit === 0 || ui.footerCount === 0)) {
    pierced = true
    notes.push('命中为 0')
  }

  const pass =
    !pierced &&
    libraryHit != null &&
    rightHit === libraryHit &&
    ui.footerCount === libraryHit &&
    hitTotalState === 'known' &&
    (c.expectKind ? sheetKind === c.expectKind : true)

  return {
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    hitTotalState: hitTotalState || null,
    sheetKind,
    footerText: ui.footerVisible,
    footerAttr: ui.footerAttr,
    pagination: ui.pagination,
    kindChips: ui.kindChips,
    visibleRowCount: ui.visibleRowCount,
    pierced,
    pass,
    note: notes.join('；') || '库、右边、页脚一致',
  }
}

async function waitAligned(page, sessionId, c) {
  let sheet = null
  let ui = null
  let stable = 0
  let lastKey = ''
  for (let i = 0; i < 90; i += 1) {
    sheet = await official(sessionId)
    ui = await readUi(page)
    const kindOk = c.expectKind ? sheet?.kind === c.expectKind : Boolean(sheet?.kind)
    const chipOk =
      !c.expectKind ||
      ui.kindChips.some((k) => k.includes(c.expectKind.replace(/档案/g, ''))) ||
      ui.banner.includes(c.expectKind)
    const footerReady =
      ui.footerAttr === '总数未知' ||
      ui.footerAttr === '不完整' ||
      /^共\s+\d+\s+条/.test(ui.footerAttr)
    const sheetRows = Array.isArray(sheet?.rows) ? sheet.rows.length : 0
    const rowsReady = ui.visibleRowCount > 0 || sheetRows > 0 || sheet?.hitTotal === 0
    const key = `${sheet?.kind}|${ui.footerAttr}|${ui.pagination}|${ui.visibleRowCount}`
    if (kindOk && footerReady && rowsReady && (chipOk || ui.banner.includes('现查'))) {
      if (key === lastKey) stable += 1
      else stable = 0
      lastKey = key
      if (stable >= 2) break
    } else {
      stable = 0
      lastKey = key
    }
    await page.waitForTimeout(800)
  }
  return { sheet, ui }
}

async function runCase(browser, workspaceId, c, lib) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error(`session-create-failed ${c.short}`)
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await dismissPending(sessionId)
  await page.waitForTimeout(600)
  const promptRes = await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
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
  const { sheet, ui } = await waitAligned(page, sessionId, c)
  await page.waitForTimeout(400)
  await page.screenshot({ path: c.screenshot, fullPage: false })
  const verdict = assess(c, lib, sheet, ui)
  await page.close()
  return {
    short: c.short,
    useCase: c.useCase,
    speech: c.speech,
    sessionId,
    promptHttp: promptRes.http,
    screenshot: c.screenshot,
    ...verdict,
  }
}

const writeJs = await readFile(`${REPO}/runtime/vendor-overlays/dsh-lan-assist/write.js`, 'utf8')
const recordsSnippet = await readFile(`${REPO}/src/components/biz/RecordsPanel.tsx`, 'utf8')
const hitTotalLiteralOne = /\bhitTotal\s*=\s*1\b/.test(writeJs)
const rowsLengthOneKnown = /rows\.length\s*===\s*1[\s\S]{0,120}hitTotalState\s*=\s*['"]known['"]/.test(writeJs)
const footerFn = recordsSnippet.match(/function hitFooterText[\s\S]*?^}/m)?.[0] || ''
const footerShownBranch = footerFn.includes('return `共 ${shown} 条`')

console.error('[adv] libraryCounts…')
const lib = await libraryCounts(CASES)
console.error('[adv] library', lib)
const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
if (!workspaceId) throw new Error('workspace-missing')

await mkdir(`${STORE}/media`, { recursive: true })
const browser = await chromium.launch({ headless: true })
const boot = await browser.newPage()
await boot.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded' })
if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}
await boot.close()

const results = []
for (const c of CASES) {
  console.error(`[adv] start ${c.short}`)
  const b = c.ownBrowser ? await chromium.launch({ headless: true }) : browser
  results.push(await runCase(b, workspaceId, c, lib))
  console.error(`[adv] done ${c.short}`)
  if (c.ownBrowser) await b.close()
}
await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  vitePid: VITE_PID,
  bffPort: 4318,
  dataPath: DATA,
  codeReadOnly: {
    writeJsHitTotalEquals1: hitTotalLiteralOne,
    writeJsOneRowPromoteKnownHeuristic: rowsLengthOneKnown,
    recordsPanelHitFooterTextFn: footerFn,
    recordsPanelShownFooterBranch: footerShownBranch,
    recordsPanelShownFooterWhen:
      'sheetHitState 非 known/incomplete/unknown 空串，或 state===known 但 hitTotal 缺失/非有限数；最终 fallback `共 ${shown} 条`（filteredRows.length）',
  },
  library: lib,
  cases: results,
  allPass: results.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-total-adv.json`, JSON.stringify(out, null, 2))
console.log(
  JSON.stringify(
    {
      allPass: out.allPass,
      cases: results.map((r) => ({
        short: r.short,
        pass: r.pass,
        pierced: r.pierced,
        libraryHit: r.libraryHit,
        rightHitTotal: r.rightHitTotal,
        footerText: r.footerText,
        footerAttr: r.footerAttr,
        sheetKind: r.sheetKind,
      })),
    },
    null,
    2,
  ),
)
