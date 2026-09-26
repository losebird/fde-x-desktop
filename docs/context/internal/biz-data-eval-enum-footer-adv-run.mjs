import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = '278cdcbc103ef140d67a9343b1fa75361ff3b465'
const VITE_PID = 1985
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TURN_MS = 240000

const CASES = [
  {
    short: 'warehouse-semi',
    useCase: '仓库 / 半成品库',
    speech: '半成品库的仓库',
    expectKind: '仓库',
    forbidFullResource: 'biz_warehouses',
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-footer-adv-warehouse-semi.png`,
  },
  {
    short: 'warehouse-mixed',
    useCase: '仓库 / 综合库',
    speech: '综合库的仓库',
    expectKind: '仓库',
    forbidFullResource: 'biz_warehouses',
    library: { resource: 'biz_warehouses', filter: { whType: '综合库' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-footer-adv-warehouse-mixed.png`,
  },
  {
    short: 'supplier-c',
    useCase: '供应商 / C',
    speech: 'C的供应商',
    expectKind: '供应商',
    forbidFullResource: 'biz_suppliers',
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-footer-adv-supplier-c.png`,
  },
  {
    short: 'movement-production',
    useCase: '出入库流水 / 生产领料',
    speech: '生产领料的出入库流水',
    expectKind: '出入库流水',
    forbidFullResource: 'biz_stock_movements',
    forbidZero: true,
    library: { resource: 'biz_stock_movements', filter: { refType: '生产领料' } },
    screenshot: `${STORE}/media/biz-data-eval-enum-footer-adv-movement-production.png`,
  },
  {
    short: 'spot-manager',
    useCase: '现查 员工档案→直属上级',
    speech: '现查员工档案的直属上级',
    expectKind: '员工档案',
    forbidFullResource: 'biz_employees',
    library: { resource: 'biz_employees', filter: { managerId: { $notEmpty: true } } },
    screenshot: `${STORE}/media/biz-data-eval-enum-footer-adv-spot-manager.png`,
    ownBrowser: true,
    spotManagerColumn: true,
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
  const out = { byCase: {}, full: {} }
  for (const c of cases) {
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

async function readUi(page, spotManagerColumn) {
  return page.evaluate((wantMgr) => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const hitTotalStateAttr = footerEl?.getAttribute('data-hit-total-state') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const tableBody = document.querySelector('table tbody')
    const visibleRowCount = tableBody ? tableBody.querySelectorAll('tr').length : 0
    const pagination =
      [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^第\s+\d+\s+\/\s+\d+\s+页/.test(t)) || ''
    const chip =
      [...document.querySelectorAll('[class*="chip"], [data-kind], button, span')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^(仓库|供应商|出入库流水|员工档案)/.test(t)) || ''
    let emptyManagerCells = null
    if (wantMgr && tableBody) {
      const headers = [...document.querySelectorAll('table thead th')].map((th) =>
        (th.textContent || '').replace(/\s+/g, '').trim(),
      )
      const idx = headers.findIndex((h) => h.includes('直属上级'))
      if (idx >= 0) {
        const empty = [...tableBody.querySelectorAll('tr')].filter((tr) => {
          const cell = tr.querySelectorAll('td')[idx]
          return cell && !(cell.textContent || '').trim()
        }).length
        emptyManagerCells = empty
      }
    }
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr,
      pagination,
      visibleRowCount,
      objectChip: chip,
      emptyManagerCells,
    }
  }, spotManagerColumn)
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
  const fullTable = lib.full[c.forbidFullResource] || lib.full[c.library.resource]
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const hitTotalState = String(sheet?.hitTotalState || ui.hitTotalStateAttr || '')
  const sheetKind = sheet?.kind || null
  const notes = []
  let pierced = false

  if (ui.footerAttr !== '总数未知' && ui.footerAttr !== '不完整' && ui.footerVisible && !ui.footerVisible.startsWith(ui.footerAttr)) {
    pierced = true
    notes.push(`data-records-footer 与可见页脚不一致：attr=${ui.footerAttr} visible=${ui.footerVisible}`)
  }
  if (ui.hitTotalStateAttr && hitTotalState && ui.hitTotalStateAttr !== hitTotalState) {
    pierced = true
    notes.push(`data-hit-total-state=${ui.hitTotalStateAttr} sheet=${hitTotalState}`)
  }

  if (c.expectKind && sheetKind !== c.expectKind) {
    pierced = true
    notes.push(`sheet.kind=${sheetKind} 期望 ${c.expectKind}`)
  }
  if (c.short === 'spot-manager' && rightHit === fullTable) {
    pierced = true
    notes.push(`员工整表 ${fullTable}`)
  }
  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    pierced = true
    notes.push(`rightHitTotal=${rightHit} 库=${libraryHit}`)
  }
  if (libraryHit != null && ui.footerCount != null && ui.footerCount !== libraryHit) {
    pierced = true
    notes.push(`页脚=${ui.footerCount} 库=${libraryHit}`)
  }
  if (ui.footerAttr === '总数未知' && libraryHit != null && hitTotalState === 'known' && rightHit === libraryHit) {
    pierced = true
    notes.push('已知总数却显示总数未知')
  }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }
  if (fullTable != null && rightHit === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`rightHit 整表 ${fullTable}`)
  }
  if (fullTable != null && ui.footerCount === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`页脚整表 ${fullTable}`)
  }
  if (c.forbidZero && (rightHit === 0 || ui.footerCount === 0)) {
    pierced = true
    notes.push('命中为 0')
  }
  if (c.spotManagerColumn && ui.emptyManagerCells > 0) {
    notes.push(`本页直属上级空单元格 ${ui.emptyManagerCells} 格`)
  }

  const pass =
    !pierced &&
    libraryHit != null &&
    rightHit === libraryHit &&
    (ui.footerAttr === '总数未知' ? false : ui.footerCount === libraryHit) &&
    hitTotalState === 'known' &&
    sheetKind === c.expectKind

  return {
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    hitTotalState: hitTotalState || null,
    sheetKind,
    objectChip: ui.objectChip || null,
    footerText: ui.footerVisible,
    footerAttr: ui.footerAttr,
    dataRecordsFooter: ui.footerAttr,
    dataHitTotalState: ui.hitTotalStateAttr || null,
    pagination: ui.pagination,
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
    ui = await readUi(page, c.spotManagerColumn)
    const kindOk = c.expectKind ? sheet?.kind === c.expectKind : Boolean(sheet?.kind)
    const chipOk = c.expectKind ? (ui.objectChip || '').includes(c.expectKind) || kindOk : true
    const footerReady =
      ui.footerAttr === '总数未知' ||
      ui.footerAttr === '不完整' ||
      /^共\s+\d+\s+条/.test(ui.footerAttr)
    const rowsReady = ui.visibleRowCount > 0 || (Array.isArray(sheet?.rows) && sheet.rows.length > 0)
    const key = `${sheet?.kind}|${ui.footerAttr}|${ui.hitTotalStateAttr}|${ui.visibleRowCount}|${sheet?.hitTotal}`
    if (kindOk && chipOk && footerReady && rowsReady) {
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
  return { sheet, ui: await readUi(page, c.spotManagerColumn) }
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

function codeAudit(recordsSnippet, writeJs) {
  const footerFn = recordsSnippet.match(/function hitFooterText[\s\S]*?^}/m)?.[0] || ''
  const usesShownInFooter = /\$\{shown\}/.test(footerFn) || /shown.*条/.test(footerFn)
  const unknownDefault = footerFn.includes("return '总数未知'")
  const writeHitFromMatches = /hitTotal\s*=\s*[^;]*matches\.length/.test(writeJs)
  const writeHitFromRowsLen = /hitTotal\s*:\s*[^,}]*rows\.length/.test(writeJs)
  const peerSnippet = writeJs.split('\n').slice(830, 852).join('\n')
  return {
    recordsPanelHitFooterTextFn: footerFn,
    hitFooterTextStillUsesShownCount: usesShownInFooter,
    hitFooterTextUnknownWhenNoQueryTotal: unknownDefault && !usesShownInFooter,
    writeJsPeerHitTotalBlock: peerSnippet,
    writeJsAssignsMatchesLengthToHitTotal: writeHitFromMatches || writeHitFromRowsLen,
    writeJsHitTotalFallbackRefs: writeHitFromMatches || writeHitFromRowsLen ? [] : null,
  }
}

const writeJs = await readFile(`${REPO}/runtime/vendor-overlays/dsh-lan-assist/write.js`, 'utf8')
const recordsSnippet = await readFile(`${REPO}/src/components/biz/RecordsPanel.tsx`, 'utf8')
const audit = codeAudit(recordsSnippet, writeJs)

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

const fallbacksRemain =
  audit.hitFooterTextStillUsesShownCount ||
  audit.writeJsAssignsMatchesLengthToHitTotal ||
  /listed\.rows\.length \? \{ hitTotal: listed\.rows\.length \}/.test(
    await readFile(`${REPO}/runtime/vendor-overlays/dsh-lan-assist/lookup.js`, 'utf8'),
  )

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  vitePid: VITE_PID,
  bffPort: 4318,
  dataPath: DATA,
  codeAudit: audit,
  lookupJsRowLengthHitTotalFallback: fallbacksRemain,
  library: lib,
  cases: results,
  allPass: results.every((r) => r.pass) && !fallbacksRemain,
}
await writeFile(`${STORE}/internal/biz-data-eval-enum-footer-adv.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ allPass: out.allPass, cases: results.map((r) => ({ short: r.short, pass: r.pass, pierced: r.pierced })) }, null, 2))
