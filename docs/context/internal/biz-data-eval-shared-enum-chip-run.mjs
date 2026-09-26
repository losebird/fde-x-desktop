import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const EVAL_JSON = `${STORE}/internal/biz-data-eval.json`
const REPORT = `${STORE}/internal/biz-data-eval-shared-enum-chip.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const COMMIT = '19764229f9b2d9acee60761256db2f66719aecf4'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const FALLBACK_WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 180000

const KIND_RESOURCE = {
  项目任务: 'biz_project_tasks',
  项目: 'biz_projects',
  费用报销: 'biz_expenses',
  请假申请: 'biz_leave_requests',
  销售合同: 'biz_contracts',
  仓库: 'biz_warehouses',
  供应商: 'biz_suppliers',
}

const evalDoc = JSON.parse(await readFile(EVAL_JSON, 'utf8'))
const sharedCases = evalDoc.results.filter((r) => r.classId === 'shared')
const doingCase = sharedCases.find((r) => r.objects?.say === '进行中' && r.speech?.includes('项目任务和项目'))
const otherCase = sharedCases.find((r) => r.objects?.say === '其他' && r.speech?.includes('费用报销和请假申请'))

const SESSIONS = [
  {
    slug: 'doing',
    caseRow: doingCase,
    kinds: ['项目任务', '项目'],
  },
  {
    slug: 'other',
    caseRow: otherCase,
    kinds: ['费用报销', '请假申请', '销售合同'],
  },
]

const SPOTS = [
  {
    short: 'warehouse-semi',
    speech: '半成品库的仓库',
    expectKind: '仓库',
    library: { resource: 'biz_warehouses', filter: { whType: '半成品库' } },
  },
  {
    short: 'supplier-c',
    speech: 'C的供应商',
    expectKind: '供应商',
    library: { resource: 'biz_suppliers', filter: { rating: 'C' } },
  },
]

function flattenOptions(objects) {
  const out = []
  for (const group of objects?.options || []) for (const opt of group) out.push(opt)
  return out
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

async function bffJson(path, { method = 'GET', body, timeoutMs = 25000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

async function loadMeta() {
  const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8')).lookupToken
  return async (resource, filter) => {
    const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    return Number.isFinite(Number(body?.meta?.count)) ? Number(body.meta.count) : null
  }
}

async function libraryForKinds(caseRow, meta, kinds) {
  const byKind = {}
  for (const kind of kinds) {
    const opt = flattenOptions(caseRow.objects).find((o) => o.kind === kind)
    const resource = KIND_RESOURCE[kind]
    if (!resource || !opt) continue
    const filter = opt.field && opt.code ? { [opt.field]: opt.code } : undefined
    byKind[kind] = await meta(resource, filter)
  }
  return byKind
}

async function officialSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  return (await bffJson(`/api/v1/biz/pending-sheet?${q}`)).json?.data?.sheet || null
}

async function readUi(page) {
  return page.evaluate(() => {
    const footerEl = document.querySelector('[data-records-footer]')
    const footerAttr = footerEl?.getAttribute('data-records-footer') || ''
    const footerVisible = (footerEl?.textContent || '').replace(/\s+/g, ' ').trim()
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const tbody = document.querySelector('table tbody')
    const rowCount = tbody ? [...tbody.querySelectorAll('tr')].filter((tr) => (tr.textContent || '').trim()).length : 0
    const headers = [...document.querySelectorAll('table thead th')].map((th) => (th.textContent || '').replace(/\s+/g, '').trim())
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr: footerEl?.getAttribute('data-hit-total-state') || '',
      tableRowCount: rowCount,
      tableHeaders: headers.slice(0, 6).join(','),
    }
  })
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
  await page.waitForTimeout(800)
  return sessionId
}

function chipTextMatchesKind(text, kind) {
  const t = String(text || '').replace(/\s+/g, '')
  if (!t.includes(kind)) return false
  if (kind === '项目') return /^项目(?!任务)/.test(t)
  return t.startsWith(kind)
}

async function clickKindChip(page, kind, sessionId, prevFooter) {
  await page.waitForSelector('button.btn', { timeout: 60000 }).catch(() => {})
  const clicked = await page.evaluate((targetKind) => {
    const wrap = document.querySelector('div.flex.items-center.gap-1.flex-wrap')
    const buttons = wrap ? [...wrap.querySelectorAll('button.btn')] : []
    const match = (text) => {
      const t = String(text || '').replace(/\s+/g, '')
      if (!t.includes(targetKind)) return false
      if (targetKind === '项目') return /^项目(?!任务)/.test(t)
      return t.startsWith(targetKind)
    }
    const btn = buttons.find((b) => match(b.textContent))
    if (!btn) return false
    btn.click()
    return true
  }, kind)
  if (!clicked) {
    const chip = page.locator('div.flex.items-center.gap-1.flex-wrap button.btn').filter({ hasText: kind }).first()
    await chip.click({ timeout: 35000, force: true })
  }
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const sheet = await officialSheet(sessionId)
    const ui = await readUi(page)
    const kindOk = String(sheet?.kind || '').trim() === kind
    const footerMoved = prevFooter != null && ui.footerCount != null && ui.footerCount !== prevFooter
    if (kindOk || footerMoved) break
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(600)
}

async function shotFooter(page, path) {
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.scrollIntoViewIfNeeded().catch(() => {})
  const box = await footerEl.boundingBox().catch(() => null)
  if (box) {
    await page.screenshot({
      path,
      clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 520), width: 1120, height: 580 },
    })
  } else await page.screenshot({ path })
}

function assessEntry({ object, library, sheet, ui, prevSheetKind, expectKind }) {
  const notes = []
  let pass = true
  const officialKind = sheet?.kind ? String(sheet.kind).trim() : ''
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)

  if (prevSheetKind && officialKind && officialKind === prevSheetKind && object !== prevSheetKind) {
    pass = false
    notes.push(`sheet.kind仍=${prevSheetKind}`)
  }
  if (expectKind && officialKind && officialKind !== expectKind) {
    pass = false
    notes.push(`official kind=${officialKind}`)
  }
  if (library != null && rightHit != null && rightHit !== library) {
    pass = false
    notes.push(`右边${rightHit}≠库${library}`)
  }
  if (library != null && ui.footerCount != null && ui.footerCount !== library) {
    pass = false
    notes.push(`页脚${ui.footerCount}≠库${library}`)
  }
  if (ui.footerVisible.includes('总数未知')) {
    pass = false
    notes.push('页脚总数未知')
  }
  if (library === 0 && ui.footerCount === 0 && ui.tableRowCount > 0) {
    pass = false
    notes.push('空表应有0行')
  }
  if (library > 0 && ui.tableRowCount === 0) {
    pass = false
    notes.push('表无行')
  }

  return {
    pass,
    notes: notes.join('；') || '一致',
    officialKind,
    officialHitTotal: rightHit,
    hitTotalState: sheet?.hitTotalState || ui.hitTotalStateAttr || null,
  }
}

const routeProbe = await bffJson('/api/v1/biz/focus-kind', { method: 'POST', body: { kind: 'test', sessionId: 'probe' } })
const focusKindRoute = routeProbe.status !== 404

await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })
const workspaceId = FALLBACK_WS
const meta = await loadMeta()
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const captures = []
let runError = null

try {
for (const sess of SESSIONS) {
  const speech = speechFor(sess.caseRow.speech)
  const library = await libraryForKinds(sess.caseRow, meta, sess.kinds)
  const sessionId = await runSession(page, workspaceId, speech)
  let prevSheetKind = String((await officialSheet(sessionId))?.kind || '').trim()

  for (const kind of sess.kinds) {
    const beforeUi = await readUi(page)
    await clickKindChip(page, kind, sessionId, beforeUi.footerCount)
    const sheet = await officialSheet(sessionId)
    const ui = await readUi(page)
    const short = `${sess.slug}-${kind}`
    const shot = `${STORE}/media/biz-data-eval-shared-enum-chip-${short}.png`
    await shotFooter(page, shot)
    const { pass, notes, officialKind, officialHitTotal, hitTotalState } = assessEntry({
      object: kind,
      library: library[kind],
      sheet,
      ui,
      prevSheetKind,
      expectKind: kind,
    })
    captures.push({
      short,
      group: sess.slug,
      object: kind,
      library: library[kind],
      rightHitTotal: officialHitTotal,
      hitTotalState,
      footerText: ui.footerVisible,
      footerAttr: ui.footerAttr,
      footerCount: ui.footerCount,
      tableRowCount: ui.tableRowCount,
      officialSheet: { kind: officialKind, hitTotal: officialHitTotal, hitTotalState },
      prevSheetKindBeforeClick: prevSheetKind || null,
      chipKindSwitched: !(prevSheetKind && officialKind === prevSheetKind && kind !== prevSheetKind),
      pass,
      note: notes,
      screenshot: shot,
      sessionId,
      speech,
    })
    prevSheetKind = officialKind || prevSheetKind
  }
}

for (const spot of SPOTS) {
  const speech = speechFor(spot.speech)
  const library = await meta(spot.library.resource, spot.library.filter)
  const sessionId = await runSession(page, workspaceId, speech)
  const sheet = await officialSheet(sessionId)
  const ui = await readUi(page)
  const shot = `${STORE}/media/biz-data-eval-shared-enum-chip-${spot.short}.png`
  await shotFooter(page, shot)
  const { pass, notes, officialKind, officialHitTotal, hitTotalState } = assessEntry({
    object: spot.expectKind,
    library,
    sheet,
    ui,
    prevSheetKind: null,
    expectKind: spot.expectKind,
  })
  captures.push({
    short: spot.short,
    group: 'spot',
    object: spot.expectKind,
    library,
    rightHitTotal: officialHitTotal,
    hitTotalState,
    footerText: ui.footerVisible,
    footerAttr: ui.footerAttr,
    footerCount: ui.footerCount,
    tableRowCount: ui.tableRowCount,
    officialSheet: { kind: officialKind, hitTotal: officialHitTotal, hitTotalState },
    pass,
    note: notes,
    screenshot: shot,
    sessionId,
    speech,
  })
}
} catch (error) {
  runError = String(error?.message || error)
}

await browser.close().catch(() => {})

const report = {
  branch: 'cursor/eval-three-causes-2d90',
  headCommit: COMMIT,
  focusKindRouteOn4318: focusKindRoute,
  workspace: DATA,
  vitePort5174: 5174,
  runtimePort: 4318,
  captures,
  allPass: captures.length > 0 && captures.every((c) => c.pass),
  runError,
  capturedAt: new Date().toISOString(),
}

await writeFile(REPORT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ allPass: report.allPass, captures: captures.map((c) => ({ s: c.short, pass: c.pass, lib: c.library, r: c.rightHitTotal, f: c.footerCount, kind: c.officialSheet?.kind })) }))
