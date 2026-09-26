/**
 * managed-warehouses-sheet eval — see internal/managed-warehouses-sheet.md
 */
import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const REPORT = `${STORE}/internal/biz-data-eval-managed-warehouses-sheet.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = execSync('git -C "$REPO" rev-parse HEAD', { env: { REPO } }).toString().trim()
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TURN_MS = 240000
const SHOT_PREFIX = 'biz-data-eval-managed-warehouses-sheet'

const CASES = [
  {
    short: 'edge-speech',
    speech: '员工档案的仓库',
    expectKind: '仓库',
    screenshot: `${STORE}/media/${SHOT_PREFIX}-edge-speech.png`,
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

async function nocoMeta(resource, filter) {
  const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8')).lookupToken
  const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
  const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  })
  const body = await res.json()
  const c = Number(body?.meta?.count)
  return Number.isFinite(c) ? c : null
}

async function nocoWarehouseNos() {
  const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8')).lookupToken
  const filter = { managerId: { $notEmpty: true } }
  const q = `&filter=${encodeURIComponent(JSON.stringify(filter))}`
  const res = await fetch(`http://127.0.0.1:13000/api/biz_warehouses:list?page=1&pageSize=50${q}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  })
  const body = await res.json()
  const rows = Array.isArray(body?.data) ? body.data : []
  return rows
    .map((row) => String(row?.code || row?.warehouseNo || row?.no || '').trim())
    .filter(Boolean)
    .sort()
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
      state.state.panels = panels.map((p) => (p?.id === 'data' ? { ...p, state: 'full', width: 1100 } : p))
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
    const tableBody = document.querySelector('table tbody')
    const rowEls = tableBody ? [...tableBody.querySelectorAll('tr')].filter((tr) => (tr.textContent || '').trim()) : []
    const headers = [...document.querySelectorAll('table thead th')].map((th) =>
      (th.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const rowLabels = rowEls.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120))
    const planCandidates = [...document.querySelectorAll('button, [role="combobox"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.includes('现查') && t.length < 240)
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr,
      visibleRowCount: rowEls.length,
      tableHeaders: headers,
      rowLabels,
      planLine: planCandidates[0] || '',
    }
  })
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

function stepsOk(steps) {
  if (!Array.isArray(steps) || steps.length < 2) return false
  const kinds = steps.map((s) => String(s?.kind || '').trim())
  return kinds[0] === '员工档案' && kinds[1] === '仓库'
}

function sheetNos(sheet) {
  if (!sheet || !Array.isArray(sheet.rows)) return []
  return sheet.rows.map((r) => String(r?.no || '').trim()).filter(Boolean).sort()
}

function assess(c, lib, dbNos, sheet, ui) {
  const libraryHit = lib.edgeLibraryCount
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const hitTotalState = String(sheet?.hitTotalState || ui.hitTotalStateAttr || '')
  const sheetKind = sheet?.kind || null
  const footerCount =
    ui.footerCount != null
      ? ui.footerCount
      : ui.footerAttr && /^共\s+\d+\s+条/.test(ui.footerAttr)
        ? Number((ui.footerAttr.match(/共\s+(\d+)\s+条/) || [])[1])
        : null
  const nos = sheetNos(sheet)
  const whLike = nos.length > 0 && nos.every((n) => /^WH/i.test(n))
  const setMatch =
    dbNos.length === nos.length && dbNos.every((n, i) => n === nos[i])
  const notes = []
  let fail = false
  if (ui.visibleRowCount === 0) {
    fail = true
    notes.push('表内无可见行')
  }
  if (!ui.footerAttr) {
    fail = true
    notes.push('未见页脚')
  }
  if (sheetKind !== c.expectKind) {
    fail = true
    notes.push(`sheet.kind=${sheetKind}`)
  }
  if (!stepsOk(sheet?.steps)) fail = true
  if (!whLike) {
    fail = true
    notes.push(`行号非 WH 仓库单: ${nos.join(',')}`)
  }
  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    fail = true
    notes.push(`hitTotal=${rightHit} 库=${libraryHit}`)
  }
  if (libraryHit != null && footerCount != null && footerCount !== libraryHit) {
    fail = true
    notes.push(`页脚=${footerCount} 库=${libraryHit}`)
  }
  if (dbNos.length && !setMatch) {
    fail = true
    notes.push('行集与库不一致')
  }
  const pass =
    !fail &&
    hitTotalState === 'known' &&
    libraryHit != null &&
    rightHit === libraryHit &&
    footerCount === libraryHit &&
    whLike &&
    setMatch
  return {
    libraryHit,
    fullTable: lib.fullTableWarehouses,
    rightHitTotal: rightHit,
    hitTotalState,
    sheetKind,
    sheetNos: nos,
    dbNos,
    setMatch,
    footerText: ui.footerVisible || ui.footerAttr,
    footerAttr: ui.footerAttr,
    visibleRowCount: ui.visibleRowCount,
    tableHeaders: ui.tableHeaders,
    rowLabels: ui.rowLabels,
    planLine: ui.planLine,
    pass,
    note: notes.join('；') || '库、WH 行集、页脚一致',
  }
}

function footerAttrOk(footerAttr) {
  return footerAttr === '总数未知' || footerAttr === '不完整' || /^共\s+\d+\s+条/.test(footerAttr || '')
}

async function waitAligned(page, sessionId, c) {
  let sheet = null
  let ui = null
  let stable = 0
  let lastKey = ''
  for (let i = 0; i < 90; i += 1) {
    sheet = await official(sessionId)
    ui = await readUi(page)
    const kindOk = sheet?.kind === c.expectKind
    const footerReady = footerAttrOk(ui.footerAttr)
    const rowsReady = ui.visibleRowCount > 0
    const key = `${sheet?.kind}|${ui.footerAttr}|${sheet?.hitTotal}|${ui.visibleRowCount}`
    if (kindOk && footerReady && rowsReady && stepsOk(sheet?.steps)) {
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
  return { sheet, ui: await readUi(page) }
}

async function dismissPending(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  if (!sheet) return
  await bffJson('/api/v1/biz/preview/dismiss', {
    method: 'POST',
    body: { sessionId, cwd: DATA, preview_id: sheet.preview_id || sheet.previewId },
  }).catch(() => ({}))
}

async function runCase(browser, workspaceId, c, lib, dbNos) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error('session-create-failed')
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)
  await dismissPending(sessionId)
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
  let sheetAfterTurn = null
  for (let i = 0; i < 30; i += 1) {
    sheetAfterTurn = await official(sessionId)
    if (sheetAfterTurn?.kind === c.expectKind && stepsOk(sheetAfterTurn?.steps)) break
    await page.waitForTimeout(1000)
  }
  if (!sheetAfterTurn || sheetAfterTurn.kind !== c.expectKind) {
    await page.close()
    return {
      short: c.short,
      speech: c.speech,
      sessionId,
      screenshot: c.screenshot,
      pass: false,
      note: '回合结束无官方仓库表',
      sheetKind: sheetAfterTurn?.kind || null,
    }
  }
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  try {
    await page.waitForSelector('[data-records-footer]', { timeout: 90000 })
  } catch {
    /* hydrate may lag; waitAligned keeps polling */
  }
  const aligned = await waitAligned(page, sessionId, c)
  const verdict = assess(c, lib, dbNos, aligned.sheet, aligned.ui)
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path: c.screenshot,
      clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 520), width: Math.min(1120, 1580), height: Math.min(580, 1100) },
    })
  } else {
    const snapPage = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
    await snapPage.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await seedState(snapPage, workspaceId, sessionId)
    await snapPage.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await snapPage.waitForSelector('[data-records-footer]', { timeout: 90000 })
    await snapPage.waitForTimeout(3000)
    await snapPage.locator('[data-records-footer]').scrollIntoViewIfNeeded().catch(() => {})
    const snapBox = await snapPage.locator('[data-records-footer]').boundingBox().catch(() => null)
    if (snapBox) {
      await snapPage.screenshot({
        path: c.screenshot,
        clip: { x: Math.max(0, snapBox.x - 40), y: Math.max(0, snapBox.y - 520), width: Math.min(1120, 1580), height: Math.min(580, 1100) },
      })
      const snapUi = await readUi(snapPage)
      Object.assign(verdict, assess(c, lib, dbNos, aligned.sheet, snapUi))
    } else {
      await snapPage.screenshot({ path: c.screenshot, fullPage: false })
    }
    await snapPage.close()
  }
  await page.close()
  return { short: c.short, speech: c.speech, sessionId, screenshot: c.screenshot, ...verdict }
}

const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8'))
void token

const lib = {
  edgeLibraryCount: await nocoMeta('biz_warehouses', { managerId: { $notEmpty: true } }),
  fullTableWarehouses: await nocoMeta('biz_warehouses'),
  resource: 'biz_warehouses',
}
const dbNos = await nocoWarehouseNos()

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
if (!workspaceId) throw new Error('workspace-missing')

await mkdir(`${STORE}/media`, { recursive: true })
const browser = await chromium.launch({ headless: true })
if (!(await bffJson('/api/v1/ai/status')).json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}

const results = []
for (const c of CASES) {
  results.push(await runCase(browser, workspaceId, c, lib, dbNos))
}
await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  edge: { from: '员工档案', to: '仓库', field: 'managedWarehouses' },
  library: lib,
  dbWarehouseNos: dbNos,
  cases: results,
  allPass: results.every((r) => r.pass),
  pushed: false,
}
await writeFile(REPORT, `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify({ allPass: out.allPass, commit: COMMIT, cases: results.map((r) => ({ pass: r.pass, note: r.note })) }, null, 2))
