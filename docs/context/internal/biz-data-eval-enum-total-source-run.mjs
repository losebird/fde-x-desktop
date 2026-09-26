import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
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
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-source-warehouse-semi.png`,
  },
  {
    short: 'warehouse-mixed',
    useCase: '仓库 / 综合库',
    speech: `综合库的仓库。${TAIL}`,
    expectKind: '仓库',
    library: { resource: 'biz_warehouses', filter: { whType: '综合库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-source-warehouse-mixed.png`,
  },
  {
    short: 'supplier-c',
    useCase: '供应商 / C',
    speech: `C的供应商。${TAIL}`,
    expectKind: '供应商',
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-source-supplier-c.png`,
  },
  {
    short: 'movement-production',
    useCase: '出入库流水 / 生产领料',
    speech: `生产领料的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-source-movement-production.png`,
  },
  {
    short: 'product-movements',
    useCase: '商品物料→出入库流水',
    speech: `现查商品物料的出入库流水。${TAIL}`,
    expectKind: '出入库流水',
    library: { walkProductFk: true },
    screenshot: `${STORE}/media/biz-data-eval-enum-total-source-product-movements.png`,
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
  const out = { byCase: {}, full: {} }
  for (const c of cases) {
    if (c.library.walkProductFk) {
      out.byCase[c.short] = await walkProductFk()
      out.full.biz_stock_movements = await meta('biz_stock_movements')
      continue
    }
    const { resource, filter } = c.library
    out.byCase[c.short] = await meta(resource, filter)
    out.full[resource] = await meta(resource)
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
    const stateAttr = footerEl?.getAttribute('data-hit-total-state') || ''
    const footer =
      footerAttr ||
      [...document.querySelectorAll('span')]
        .map((s) => s.textContent?.trim() || '')
        .find((t) => /^共\s+\d+\s+条/.test(t) || t === '总数未知' || t === '不完整') ||
      ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const kind = document.querySelector('[data-records-kind]')?.textContent?.trim() || ''
    return { footer, footerCount, hitTotalState: stateAttr, kindLabel: kind }
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

async function previewSummary(sessionId) {
  const { json } = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: { cwd: DATA, sessionId, action: '现查', speech: CASES.find((c) => c.short === 'product-movements')?.speech },
  }).catch(() => ({ json: {} }))
  const sheet = json?.data?.sheet || json?.sheet || {}
  return {
    kind: sheet.kind ?? null,
    hitTotal: sheet.hitTotal ?? null,
    hitTotalState: sheet.hitTotalState ?? null,
    rowCount: Array.isArray(sheet.rows) ? sheet.rows.length : null,
    keys: Object.keys(sheet).sort(),
  }
}

async function runCase(browser, workspaceId, c, lib) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
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
  let sheet = await official(sessionId)
  let ui = await readUi(page)
  const libraryHit = lib.byCase[c.short]
  const fullTable = c.library.walkProductFk ? lib.full.biz_stock_movements : lib.full[c.library.resource]
  for (let i = 0; i < 80; i += 1) {
    sheet = await official(sessionId)
    ui = await readUi(page)
    const state = String(sheet?.hitTotalState || ui.hitTotalState || '')
    const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    if (state === 'known' && hit != null && ui.footer && !ui.footer.includes('总数未知')) break
    if (state === 'unknown' && ui.footer === '总数未知') break
    await page.waitForTimeout(800)
  }
  if (c.screenshot) await page.screenshot({ path: c.screenshot, fullPage: false })
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const footer = Number.isFinite(ui.footerCount) ? ui.footerCount : null
  const state = String(sheet?.hitTotalState || '')
  const pierced = libraryHit != null && fullTable != null && (rightHit === fullTable || footer === fullTable) && libraryHit !== fullTable
  const passKnown =
    state === 'known' &&
    rightHit === libraryHit &&
    footer === libraryHit &&
    !pierced &&
    libraryHit !== fullTable
  const passUnknown = state === 'unknown' && ui.footer === '总数未知' && rightHit == null
  let previewProbe = null
  if (c.short === 'product-movements' && (footer === 0 || ui.footer === '共 0 条' || !sheet?.kind)) {
    previewProbe = await previewSummary(sessionId)
  }
  await page.close()
  return {
    short: c.short,
    useCase: c.useCase,
    speech: c.speech,
    sessionId,
    promptHttp: promptRes.http,
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    hitTotalState: state || null,
    rightKind: sheet?.kind || null,
    footer,
    footerText: ui.footer,
    pierced,
    pass: passKnown || passUnknown,
    passMode: passKnown ? 'known-from-query' : passUnknown ? 'unknown-footer' : 'fail',
    screenshot: c.screenshot,
    previewProbe,
    priorRoundMissCapture: c.short === 'product-movements' && passKnown && sheet?.kind === '出入库流水',
  }
}

const writeJs = await readFile(`${REPO}/runtime/vendor-overlays/dsh-lan-assist/write.js`, 'utf8')
const packSnippet = writeJs.split('\n').slice(211, 222).join('\n')
const finishSnippet = writeJs.split('\n').slice(1048, 1062).join('\n')
const recordsSnippet = await readFile(`${REPO}/src/components/biz/RecordsPanel.tsx`, 'utf8')
const footerFn = recordsSnippet.match(/function hitFooterText[\s\S]*?^}/m)?.[0] || ''

const lib = await libraryCounts(CASES)
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
  const b = c.ownBrowser ? await chromium.launch({ headless: true }) : browser
  results.push(await runCase(b, workspaceId, c, lib))
  if (c.ownBrowser) await b.close()
}
await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  priorCommitRemovedLiteralOne: '3c58dadd874104d89d3cd0f505362a6945322405',
  codeAfterFix: {
    packSheetHitTotal: packSnippet,
    finishStructuredListingTotals: finishSnippet,
    recordsPanelHitFooterText: footerFn,
    note: '已删除 packSheet 中 querySettled+where+rows.length===1 时 hitTotal=1 与升格 known；finishStructured 不再用 matched/allRows 长度冒充查询计数；RecordsPanel 不再在 unknown 时用屏上行数。',
  },
  library: lib,
  cases: results,
  allPass: results.every((r) => r.pass),
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-total-source.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ commit: COMMIT, allPass: out.allPass, cases: results.map((r) => ({ short: r.short, pass: r.pass, footerText: r.footerText, libraryHit: r.libraryHit, rightHitTotal: r.rightHitTotal })) }, null, 2))
