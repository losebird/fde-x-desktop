import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const REPORT = `${STORE}/internal/biz-data-eval-shared-enum-chip-exact.json`
const EVAL_JSON = `${STORE}/internal/biz-data-eval.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const EXPECTED_COMMIT = '7f535ce427d565ae91c4fa364ec319240257f80b'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const FALLBACK_WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 180000
const SHOT_PREFIX = 'biz-data-eval-shared-enum-chip-exact'

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
  { slug: 'doing', speech: '进行中的项目任务和项目', kinds: ['项目任务', '项目'], caseRow: doingCase },
  {
    slug: 'other',
    speech: '其他的费用报销和请假申请和销售合同',
    kinds: ['费用报销', '请假申请', '销售合同'],
    caseRow: otherCase,
  },
]

const SPOTS = [
  { short: 'warehouse-semi', speech: '半成品库的仓库', expectKind: '仓库', filter: { whType: '半成品库' } },
  { short: 'supplier-c', speech: 'C的供应商', expectKind: '供应商', filter: { rating: 'C' } },
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

async function metaCount(resource, filter) {
  const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8')).lookupToken
  const q = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
  const res = await fetch(`http://127.0.0.1:13000/api/${resource}:list?page=1&pageSize=1${q}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  return Number.isFinite(Number(body?.meta?.count)) ? Number(body.meta.count) : null
}

async function libraryForCase(caseRow, kinds) {
  const byKind = {}
  for (const kind of kinds) {
    const opt = flattenOptions(caseRow.objects).find((o) => o.kind === kind)
    const resource = KIND_RESOURCE[kind]
    if (!resource || !opt) {
      byKind[kind] = null
      continue
    }
    const filter = opt.field && opt.code ? { [opt.field]: opt.code } : undefined
    byKind[kind] = await metaCount(resource, filter)
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
    const rows = tbody ? [...tbody.querySelectorAll('tr')].filter((tr) => (tr.textContent || '').trim()) : []
    const rowTexts = rows.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim())
    const headers = [...document.querySelectorAll('table thead th')].map((th) => (th.textContent || '').replace(/\s+/g, '').trim())
    const pager = (document.querySelector('[data-records-footer]')?.parentElement?.textContent || '').replace(/\s+/g, ' ')
    const pageMatch = pager.match(/第\s*(\d+)\s*\/\s*(\d+)\s*页/)
    return {
      footerAttr,
      footerVisible,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      hitTotalStateAttr: footerEl?.getAttribute('data-hit-total-state') || '',
      tableRowCount: rows.length,
      tableHeaders: headers,
      tableSample: rowTexts.slice(0, 3).join(' | '),
      hasPrjInTable: rowTexts.some((t) => /\bPRJ\d+/i.test(t) || /PRJ-/.test(t)),
      hasTaskNoPattern: rowTexts.some((t) => /TASK|任务单|TSK/i.test(t)),
      pagination: pageMatch ? { page: Number(pageMatch[1]), pages: Number(pageMatch[2]) } : null,
      pagerText: pager.slice(0, 120),
    }
  })
}

async function runSession(page, workspaceId, speech, kindsOnBar = []) {
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
  const settleDeadline = Date.now() + 60000
  while (Date.now() < settleDeadline) {
    const sheet = await officialSheet(sessionId)
    if (sheet && String(sheet.kind || '').trim()) break
    await page.waitForTimeout(800)
  }
  if (kindsOnBar.length) await waitKindChipsReady(page, kindsOnBar, 120000)
  return sessionId
}

/** Longest object name on the chip bar; literal kind prefix (not Playwright hasText). */
function resolveChipSideKind(buttonText, kindsOnBar) {
  const t = String(buttonText || '').replace(/\s+/g, '')
  const sorted = [...new Set(kindsOnBar.map((k) => String(k || '').trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )
  for (const k of sorted) {
    if (t !== k && !t.startsWith(k)) continue
    const longer = sorted.find(
      (other) => other.length > k.length && other.startsWith(k) && (t === other || t.startsWith(other)),
    )
    if (longer) continue
    return k
  }
  return ''
}

function recordsKindChipBar(page) {
  return page
    .locator('[data-records-footer]')
    .locator(
      'xpath=ancestor::div[contains(@class,"space-y-3")][1]//div[contains(@class,"items-center") and contains(@class,"gap-1") and contains(@class,"flex-wrap")]',
    )
    .first()
}

async function waitKindChipsReady(page, kindsOnBar, timeoutMs = 90000) {
  const bar = recordsKindChipBar(page)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const labels = await bar.locator('button.btn').allTextContents().catch(() => [])
    const resolved = labels
      .map((text) => resolveChipSideKind(text, kindsOnBar))
      .filter(Boolean)
    if (resolved.length >= kindsOnBar.length) return bar
    await page.waitForTimeout(400)
  }
  return bar
}

async function clickKindChip(page, targetKind, sessionId, libCount, kindsOnBar) {
  let clicked = false
  const clickDeadline = Date.now() + 120000
  while (!clicked && Date.now() < clickDeadline) {
    await waitKindChipsReady(page, kindsOnBar, 15000).catch(() => {})
    const bar = recordsKindChipBar(page)
    const buttons = await bar.locator('button.btn').all()
    for (const btn of buttons) {
      const text = await btn.textContent().catch(() => '')
      if (resolveChipSideKind(text, kindsOnBar) !== targetKind) continue
      await btn.scrollIntoViewIfNeeded().catch(() => {})
      await btn.click({ timeout: 20000 })
      clicked = true
      break
    }
    if (!clicked) await page.waitForTimeout(500)
  }
  if (!clicked) throw new Error(`chip-miss:${targetKind}`)
  const deadline = Date.now() + 35000
  while (Date.now() < deadline) {
    const sheet = await officialSheet(sessionId)
    const kindOk = String(sheet?.kind || '').trim() === targetKind
    const totalOk = libCount == null || Number(sheet?.hitTotal) === libCount
    if (kindOk && totalOk) break
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(800)
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

async function fileDigest(path) {
  const buf = await readFile(path)
  return { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') }
}

function assess({ kind, library, sheet, ui, prevSheetKind }) {
  const notes = []
  let pass = true
  const officialKind = sheet?.kind ? String(sheet.kind).trim() : ''
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)

  if (library == null) {
    pass = false
    notes.push('库计数失败')
  }
  if (prevSheetKind && officialKind && officialKind === prevSheetKind && kind !== prevSheetKind) {
    pass = false
    notes.push(`sheet.kind仍=${prevSheetKind}`)
  }
  if (officialKind && officialKind !== kind) {
    pass = false
    notes.push(`official kind=${officialKind}`)
  }
  if (library != null && rightHit != null && rightHit !== library) {
    pass = false
    notes.push(`右边hitTotal${rightHit}≠库${library}`)
  }
  if (library != null && ui.footerCount != null && ui.footerCount !== library) {
    pass = false
    notes.push(`页脚${ui.footerCount}≠库${library}`)
  }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) {
    pass = false
    notes.push('hitTotal与页脚不一致')
  }
  if (ui.footerVisible.includes('总数未知')) {
    pass = false
    notes.push('页脚总数未知')
  }
  if (library === 0) {
    if (!ui.footerVisible.includes('共 0 条') && !ui.footerAttr.includes('共 0 条')) {
      pass = false
      notes.push('缺共0条')
    }
    if (ui.footerCount != null && ui.footerCount !== 0) {
      pass = false
      notes.push('空表页脚非0')
    }
  } else if (library != null && ui.tableRowCount === 0) {
    pass = false
    notes.push('表无行')
  }

  if (
    library != null
    && library > 0
    && ui.pagination
    && sheet
    && Number(sheet.hitTotal) === library
  ) {
    const pageSize = Number(sheet.pageSize) > 0
      ? Math.floor(Number(sheet.pageSize))
      : (ui.tableRowCount > 0 ? ui.tableRowCount : 20)
    const expectPages = Math.max(1, Math.ceil(library / pageSize))
    if (ui.pagination.pages !== expectPages) {
      pass = false
      notes.push(`分页${ui.pagination.page}/${ui.pagination.pages}≠${expectPages}`)
    }
    if (ui.pagination.page !== 1) {
      pass = false
      notes.push('非第1页')
    }
  }

  return {
    pass,
    notes: notes.join('；') || '一致',
    officialKind,
    officialHitTotal: rightHit,
    hitTotalState: sheet?.hitTotalState || ui.hitTotalStateAttr || null,
  }
}

function vitePid() {
  try {
    const out = execSync('lsof -i :5174 -sTCP:LISTEN -t 2>/dev/null | head -1', { encoding: 'utf8' }).trim()
    return out ? Number(out) : null
  } catch {
    return null
  }
}

function runtimePid() {
  try {
    const out = execSync('lsof -i :4318 -sTCP:LISTEN -t 2>/dev/null | head -1', { encoding: 'utf8' }).trim()
    return out ? Number(out) : null
  } catch {
    return null
  }
}

function gitHead() {
  try {
    return execSync('git -C /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation rev-parse HEAD', {
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

const libraryDoing = await libraryForCase(doingCase, ['项目任务', '项目'])
const libraryOther = await libraryForCase(otherCase, ['费用报销', '请假申请', '销售合同'])
const librarySpots = {
  仓库: await metaCount(KIND_RESOURCE['仓库'], { whType: '半成品库' }),
  供应商: await metaCount(KIND_RESOURCE['供应商'], { rating: 'C' }),
}

const library = { ...libraryDoing, ...libraryOther, ...librarySpots }

const routeProbe = await bffJson('/api/v1/biz/focus-kind', { method: 'POST', body: { kind: 'test', sessionId: 'probe' } })
await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const captures = []
let runError = null

try {
  for (const sess of SESSIONS) {
    const speech = speechFor(sess.speech)
    const sessionId = await runSession(page, FALLBACK_WS, speech, sess.kinds)
    let prevSheetKind = String((await officialSheet(sessionId))?.kind || '').trim()

    for (const kind of sess.kinds) {
      const short = `${sess.slug}-${kind}`
      const lib = library[kind]
      try {
        await clickKindChip(page, kind, sessionId, lib, sess.kinds)
        const sheet = await officialSheet(sessionId)
        const ui = await readUi(page)
        const shot = `${STORE}/media/${SHOT_PREFIX}-${short}.png`
        await shotFooter(page, shot)
        const digest = await fileDigest(shot)
        const { pass, notes, officialKind, officialHitTotal, hitTotalState } = assess({
          kind,
          library: lib,
          sheet,
          ui,
          prevSheetKind,
        })
        captures.push({
          short,
          group: sess.slug,
          object: kind,
          library: lib,
          librarySource: 'nocobase meta.count read-only :13000',
          rightHitTotal: officialHitTotal,
          hitTotalState,
          footerText: ui.footerVisible,
          footerAttr: ui.footerAttr,
          footerCount: ui.footerCount,
          tableRowCount: ui.tableRowCount,
          tableHeaders: ui.tableHeaders,
          tableSample: ui.tableSample,
          pagination: ui.pagination,
          officialSheet: { kind: officialKind, hitTotal: officialHitTotal, hitTotalState },
          prevSheetKindBeforeClick: prevSheetKind || null,
          pass,
          note: notes,
          screenshot: shot,
          ...digest,
          sessionId,
          speech,
        })
        prevSheetKind = officialKind || prevSheetKind
      } catch (error) {
        runError = runError || String(error?.message || error)
        captures.push({
          short,
          group: sess.slug,
          object: kind,
          library: lib,
          pass: false,
          note: String(error?.message || error),
          sessionId,
          speech,
        })
      }
    }
  }

  for (const spot of SPOTS) {
    const speech = speechFor(spot.speech)
    const lib = library[spot.expectKind]
    const sessionId = await runSession(page, FALLBACK_WS, speech, [spot.expectKind])
    let sheet = await officialSheet(sessionId)
    let ui = await readUi(page)
    const settleDeadline = Date.now() + TURN_MS
    while (Date.now() < settleDeadline) {
      sheet = await officialSheet(sessionId)
      ui = await readUi(page)
      const rowsOk = lib == null || lib === 0 || ui.tableRowCount > 0
      if (
        String(sheet?.kind || '').trim() === spot.expectKind
        && sheet?.hitTotalState === 'known'
        && lib != null
        && ui.footerCount === lib
        && rowsOk
      ) break
      await page.waitForTimeout(1200)
    }
    const onKind = String(sheet?.kind || '').trim() === spot.expectKind
    const footerOk = lib != null && ui.footerCount === lib
    if (!onKind || !footerOk) {
      if (String(sheet?.kind || '').trim() !== spot.expectKind) {
        await clickKindChip(page, spot.expectKind, sessionId, lib, [spot.expectKind])
      }
      sheet = await officialSheet(sessionId)
      ui = await readUi(page)
    }
    const shot = `${STORE}/media/${SHOT_PREFIX}-${spot.short}.png`
    await shotFooter(page, shot)
    const digest = await fileDigest(shot)
    const { pass, notes, officialKind, officialHitTotal, hitTotalState } = assess({
      kind: spot.expectKind,
      library: lib,
      sheet,
      ui,
      prevSheetKind: null,
    })
    captures.push({
      short: spot.short,
      group: 'spot',
      object: spot.expectKind,
      library: lib,
      librarySource: 'nocobase meta.count read-only :13000',
      rightHitTotal: officialHitTotal,
      hitTotalState,
      footerText: ui.footerVisible,
      footerAttr: ui.footerAttr,
      footerCount: ui.footerCount,
      tableRowCount: ui.tableRowCount,
      tableHeaders: ui.tableHeaders,
      officialSheet: { kind: officialKind, hitTotal: officialHitTotal, hitTotalState },
      pass,
      note: notes,
      screenshot: shot,
      ...digest,
      sessionId,
      speech,
    })
  }
} catch (error) {
  runError = String(error?.message || error)
}

await browser.close().catch(() => {})

const taskShot = captures.find((c) => c.short === 'doing-项目任务')
const projShot = captures.find((c) => c.short === 'doing-项目')
const shotsDistinct = Boolean(taskShot && projShot && taskShot.sha256 !== projShot.sha256)
const headCommit = gitHead()

const report = {
  branch: 'cursor/eval-three-causes-2d90',
  headCommit,
  expectedHeadCommit: EXPECTED_COMMIT,
  headCommitMatches: headCommit === EXPECTED_COMMIT,
  focusKindRouteOn4318: routeProbe.status !== 404,
  workspace: DATA,
  vitePort5174: 5174,
  vitePid5174: vitePid(),
  runtimePort: 4318,
  runtimePid4318: runtimePid(),
  library,
  taskVsProject:
    taskShot && projShot
      ? {
          task: { path: taskShot.screenshot, bytes: taskShot.bytes, sha256: taskShot.sha256 },
          project: { path: projShot.screenshot, bytes: projShot.bytes, sha256: projShot.sha256 },
        }
      : null,
  shotsDistinct,
  captures,
  allPass: captures.length >= 7 && captures.every((c) => c.pass) && shotsDistinct,
  runError,
  capturedAt: new Date().toISOString(),
}

await writeFile(REPORT, JSON.stringify(report, null, 2))
console.log(
  JSON.stringify({
    allPass: report.allPass,
    shotsDistinct,
    headCommit,
    vitePid: report.vitePid5174,
    runtimePid: report.runtimePid4318,
    library,
    captures: captures.map((c) => ({
      s: c.short,
      pass: c.pass,
      lib: c.library,
      hit: c.rightHitTotal,
      f: c.footerCount,
      kind: c.officialSheet?.kind,
      sha: c.sha256?.slice(0, 12),
      note: c.note,
    })),
  }),
)
