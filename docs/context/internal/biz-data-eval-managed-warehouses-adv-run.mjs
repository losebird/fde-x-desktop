/**
 * Independent managedWarehouses attack — store only, no product edits.
 * See internal/managed-warehouses-attack.md
 */
import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const REPORT = `${STORE}/internal/biz-data-eval-managed-warehouses-adv.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = execSync('git -C "$REPO" rev-parse HEAD', { env: { REPO } }).toString().trim()
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TURN_MS = 240000
const SHOT_PREFIX = 'biz-data-eval-managed-warehouses-adv'

const CASES = [
  {
    short: 'edge-speech-a',
    speech: '员工档案的仓库',
    expectKind: '仓库',
    screenshot: `${STORE}/media/${SHOT_PREFIX}-edge-speech-a.png`,
    ownBrowser: true,
  },
  {
    short: 'edge-speech-b',
    speech: '管理的仓库',
    expectKind: '仓库',
    screenshot: `${STORE}/media/${SHOT_PREFIX}-edge-speech-b.png`,
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

async function librarySnapshot() {
  const fullWarehouses = await nocoMeta('biz_warehouses')
  const edgeWarehouses = await nocoMeta('biz_warehouses', { managerId: { $notEmpty: true } })
  return {
    edgeLibraryCount: edgeWarehouses,
    fullTableWarehouses: fullWarehouses,
    fullEqualsEdge: fullWarehouses === edgeWarehouses,
    resource: 'biz_warehouses',
    edgeFilter: { managerId: { $notEmpty: true } },
  }
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
    const visibleRowCount = rowEls.length
    const headers = [...document.querySelectorAll('table thead th')].map((th) =>
      (th.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const rowLabels = rowEls.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120))
    const pagination =
      [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => /^第\s+\d+\s+\/\s+\d+\s+页/.test(t)) || ''
    const planCandidates = [...document.querySelectorAll('button, [role="combobox"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.includes('现查') && t.length < 240)
    const planLine = planCandidates[0] || ''
    const leftSessionEmpty =
      !document.querySelector('[data-records-footer]') &&
      rowEls.length === 0 &&
      !footerAttr
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr,
      pagination,
      visibleRowCount,
      tableHeaders: headers,
      rowLabels,
      planLine,
      planCandidates,
      leftSessionEmpty,
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

function planMatchesSpeech(planLine, speech) {
  const p = String(planLine || '').replace(/\s+/g, '')
  const s = String(speech || '').replace(/\s+/g, '')
  if (!p || !s) return false
  if (p.includes(s)) return true
  if (s === '管理的仓库' && /管理的仓库|员工档案.*仓库/.test(p)) return true
  if (s === '员工档案的仓库' && /员工档案.*仓库/.test(p)) return true
  return false
}

function stepsOk(steps) {
  if (!Array.isArray(steps) || steps.length < 2) return false
  const kinds = steps.map((s) => String(s?.kind || '').trim())
  return kinds[0] === '员工档案' && kinds[1] === '仓库'
}

function assess(c, lib, sheet, ui) {
  const libraryHit = lib.edgeLibraryCount
  const fullTable = lib.fullTableWarehouses
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
  const hitTotalState = String(sheet?.hitTotalState || ui.hitTotalStateAttr || '')
  const sheetKind = sheet?.kind || null
  const footerCount =
    ui.footerCount != null
      ? ui.footerCount
      : ui.footerAttr && /^共\s+\d+\s+条/.test(ui.footerAttr)
        ? Number((ui.footerAttr.match(/共\s+(\d+)\s+条/) || [])[1])
        : null
  const notes = []
  let pierced = false
  if (ui.leftSessionEmpty || (ui.visibleRowCount === 0 && !footerAttrOk(ui.footerAttr))) {
    pierced = true
    notes.push('空会话或未见右边表')
  }
  if (!ui.footerAttr && !ui.footerVisible) {
    pierced = true
    notes.push('未见页脚')
  }
  if (ui.visibleRowCount === 0) {
    pierced = true
    notes.push('表内无可见行')
  }
  if (!planMatchesSpeech(ui.planLine, c.speech)) {
    pierced = true
    notes.push(`计划条与口语不一致 plan=${ui.planLine || '(空)'} speech=${c.speech}`)
  }
  if (/下属|直属上级/.test(ui.planLine) && !c.speech.includes('下属') && !c.speech.includes('上级')) {
    pierced = true
    notes.push('刮入上一轮计划条')
  }
  if (c.expectKind && sheetKind !== c.expectKind) {
    pierced = true
    notes.push(`sheet.kind=${sheetKind} 期望 ${c.expectKind}`)
  }
  if (!stepsOk(sheet?.steps)) {
    pierced = true
    notes.push(`steps 非 员工档案→仓库: ${JSON.stringify(sheet?.steps || null)}`)
  }
  if (lib.fullEqualsEdge && rightHit === fullTable) {
    notes.push(`整表与边库同数 ${fullTable}，仅靠条数不能证过滤`)
  }
  if (rightHit === fullTable && libraryHit !== fullTable) {
    pierced = true
    notes.push(`误落整表 ${fullTable}`)
  }
  if (libraryHit != null && rightHit != null && rightHit !== libraryHit) {
    pierced = true
    notes.push(`rightHit=${rightHit} 库=${libraryHit}`)
  }
  if (libraryHit != null && footerCount != null && footerCount !== libraryHit) {
    pierced = true
    notes.push(`页脚=${footerCount} 库=${libraryHit}`)
  }
  if (rightHit != null && footerCount != null && rightHit !== footerCount) {
    pierced = true
    notes.push('页脚与 hitTotal 不一致')
  }
  const pass =
    !pierced &&
    libraryHit != null &&
    rightHit === libraryHit &&
    footerCount === libraryHit &&
    hitTotalState === 'known' &&
    sheetKind === c.expectKind &&
    ui.visibleRowCount > 0 &&
    stepsOk(sheet?.steps) &&
    planMatchesSpeech(ui.planLine, c.speech)
  return {
    libraryHit,
    fullTable,
    rightHitTotal: rightHit,
    hitTotalState: hitTotalState || null,
    sheetKind,
    footerText: ui.footerVisible || ui.footerAttr,
    footerAttr: ui.footerAttr,
    pagination: ui.pagination,
    planLine: ui.planLine,
    visibleRowCount: ui.visibleRowCount,
    tableHeaders: ui.tableHeaders,
    rowLabels: ui.rowLabels,
    planSteps: sheet?.steps || null,
    planMatchesSpeech: planMatchesSpeech(ui.planLine, c.speech),
    pierced,
    pass,
    note: notes.join('；') || '库、右边、页脚一致',
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
    const kindOk = c.expectKind ? sheet?.kind === c.expectKind : Boolean(sheet?.kind)
    const footerReady = footerAttrOk(ui.footerAttr)
    const rowsReady = ui.visibleRowCount > 0 || (Array.isArray(sheet?.rows) && sheet.rows.length > 0)
    const planOk = planMatchesSpeech(ui.planLine, c.speech)
    const key = `${sheet?.kind}|${ui.footerAttr}|${sheet?.hitTotal}|${ui.planLine}|${ui.visibleRowCount}`
    if (kindOk && footerReady && rowsReady && planOk && stepsOk(sheet?.steps)) {
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

async function runCase(browser, workspaceId, c, lib) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  const sessionId = String(created.json?.data?.sessionId || '').trim()
  if (!sessionId) throw new Error(`session-create-failed ${c.short}`)
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)
  await dismissPending(sessionId)
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
  const verdict = assess(c, lib, sheet, ui)
  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const aligned = await waitAligned(page, sessionId, c)
  Object.assign(verdict, assess(c, lib, aligned.sheet, aligned.ui))
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path: c.screenshot,
      clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 520), width: Math.min(1120, 1580), height: Math.min(580, 1100) },
    })
  } else {
    await page.screenshot({ path: c.screenshot, fullPage: false })
  }
  return {
    short: c.short,
    speech: c.speech,
    sessionId,
    promptHttp: promptRes.http,
    screenshot: c.screenshot,
    ...verdict,
    page,
  }
}

const lib = await librarySnapshot()
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
  const row = await runCase(b, workspaceId, c, lib)
  await row.page.close()
  delete row.page
  results.push(row)
  if (c.ownBrowser) await b.close()
}
await browser.close()

const out = {
  commit: COMMIT,
  branch: 'cursor/eval-three-causes-2d90',
  edge: { from: '员工档案', to: '仓库', field: 'managedWarehouses' },
  library: lib,
  cases: results,
  allPass: results.every((r) => r.pass),
}
await writeFile(REPORT, `${JSON.stringify(out, null, 2)}\n`)
console.log(
  JSON.stringify(
    {
      allPass: out.allPass,
      library: lib,
      cases: results.map((r) => ({
        short: r.short,
        pass: r.pass,
        hit: r.rightHitTotal,
        footer: r.footerAttr,
        rows: r.visibleRowCount,
        note: r.note,
      })),
    },
    null,
    2,
  ),
)
