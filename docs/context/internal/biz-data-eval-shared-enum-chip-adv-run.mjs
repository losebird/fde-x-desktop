import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const REPORT = `${STORE}/internal/biz-data-eval-shared-enum-chip-adv.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const COMMIT = '19764229f9b2d9acee60761256db2f66719aecf4'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const FALLBACK_WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 180000

const LIBRARY = {
  项目任务: 161,
  项目: 96,
  费用报销: 42,
  请假申请: 26,
  销售合同: 0,
  仓库: 1,
  供应商: 16,
}

const SESSIONS = [
  {
    slug: 'doing',
    speech: '进行中的项目任务和项目',
    kinds: ['项目任务', '项目'],
  },
  {
    slug: 'other',
    speech: '其他的费用报销和请假申请和销售合同',
    kinds: ['费用报销', '请假申请', '销售合同'],
  },
]

const SPOTS = [
  { short: 'warehouse-semi', speech: '半成品库的仓库', expectKind: '仓库' },
  { short: 'supplier-c', speech: 'C的供应商', expectKind: '供应商' },
]

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
  const deadline = Date.now() + 20000
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

function assess({ kind, library, sheet, ui, prevSheetKind }) {
  const notes = []
  let pass = true
  const officialKind = sheet?.kind ? String(sheet.kind).trim() : ''
  const rightHit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)

  if (prevSheetKind && officialKind && officialKind === prevSheetKind && kind !== prevSheetKind) {
    pass = false
    notes.push(`sheet.kind仍=${prevSheetKind}`)
  }
  if (officialKind && officialKind !== kind) {
    pass = false
    notes.push(`official kind=${officialKind}`)
  }
  if (rightHit != null && rightHit !== library) {
    pass = false
    notes.push(`右边hitTotal${rightHit}≠库${library}`)
  }
  if (ui.footerCount != null && ui.footerCount !== library) {
    pass = false
    notes.push(`页脚${ui.footerCount}≠库${library}`)
  }
  if (rightHit != null && ui.footerCount != null && rightHit !== ui.footerCount) {
    pass = false
    notes.push(`hitTotal与页脚不一致`)
  }
  if (ui.footerVisible.includes('总数未知')) {
    pass = false
    notes.push('页脚总数未知')
  }
  if (library === 0) {
    if (ui.tableRowCount > 0) {
      pass = false
      notes.push('空表应有0行')
    }
    if (!ui.footerVisible.includes('共 0 条') && !ui.footerAttr.includes('共 0 条')) {
      pass = false
      notes.push('缺共0条')
    }
  } else if (ui.tableRowCount === 0) {
    pass = false
    notes.push('表无行')
  }

  if (kind === '项目') {
    if (officialKind === '项目任务' || (ui.tableHeaders.join(',').includes('任务') && !ui.hasPrjInTable)) {
      pass = false
      notes.push('仍是任务表')
    }
    if (ui.footerCount === 161 && library === 96) {
      pass = false
      notes.push('页脚仍161')
    }
    if (library === 96 && ui.pagination && ui.pagination.pages === 1 && library > 20) {
      pass = false
      notes.push(`分页${ui.pagination.page}/${ui.pagination.pages}仅${ui.tableRowCount}行`)
    }
    if (!ui.hasPrjInTable && ui.tableRowCount > 0) {
      pass = false
      notes.push('未见PRJ单号')
    }
  }

  if (kind === '项目任务' && library === 161 && ui.pagination && ui.pagination.pages === 1 && ui.tableRowCount <= 20) {
    pass = false
    notes.push(`任务分页异常${ui.pagination.page}/${ui.pagination.pages}`)
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
    const out = execSync("lsof -i :5174 -sTCP:LISTEN -t 2>/dev/null | head -1", { encoding: 'utf8' }).trim()
    return out ? Number(out) : null
  } catch {
    return null
  }
}

function runtimePid() {
  try {
    const out = execSync("lsof -i :4318 -sTCP:LISTEN -t 2>/dev/null | head -1", { encoding: 'utf8' }).trim()
    return out ? Number(out) : null
  } catch {
    return null
  }
}

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
    const sessionId = await runSession(page, FALLBACK_WS, speech)
    let prevSheetKind = String((await officialSheet(sessionId))?.kind || '').trim()

    for (const kind of sess.kinds) {
      const beforeUi = await readUi(page)
      await clickKindChip(page, kind, sessionId, beforeUi.footerCount)
      const sheet = await officialSheet(sessionId)
      const ui = await readUi(page)
      const short = `${sess.slug}-${kind}`
      const shot = `${STORE}/media/biz-data-eval-shared-enum-chip-adv-${short}.png`
      await shotFooter(page, shot)
      const library = LIBRARY[kind]
      const { pass, notes, officialKind, officialHitTotal, hitTotalState } = assess({
        kind,
        library,
        sheet,
        ui,
        prevSheetKind,
      })
      captures.push({
        short,
        group: sess.slug,
        object: kind,
        library,
        librarySource: 'postgres read-only nb-ace-postgres',
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
        sessionId,
        speech,
      })
      prevSheetKind = officialKind || prevSheetKind
    }
  }

  for (const spot of SPOTS) {
    const speech = speechFor(spot.speech)
    const sessionId = await runSession(page, FALLBACK_WS, speech)
    const sheet = await officialSheet(sessionId)
    const ui = await readUi(page)
    const shot = `${STORE}/media/biz-data-eval-shared-enum-chip-adv-${spot.short}.png`
    await shotFooter(page, shot)
    const library = LIBRARY[spot.expectKind]
    const { pass, notes, officialKind, officialHitTotal, hitTotalState } = assess({
      kind: spot.expectKind,
      library,
      sheet,
      ui,
      prevSheetKind: null,
    })
    captures.push({
      short: spot.short,
      group: 'spot',
      object: spot.expectKind,
      library,
      librarySource: 'postgres read-only nb-ace-postgres',
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
  focusKindRouteOn4318: routeProbe.status !== 404,
  workspace: DATA,
  vitePort5174: 5174,
  vitePid5174: vitePid(),
  runtimePort: 4318,
  runtimePid4318: runtimePid(),
  library: LIBRARY,
  captures,
  allPass: captures.length > 0 && captures.every((c) => c.pass),
  runError,
  capturedAt: new Date().toISOString(),
}

await writeFile(REPORT, JSON.stringify(report, null, 2))
console.log(
  JSON.stringify({
    allPass: report.allPass,
    vitePid: report.vitePid5174,
    runtimePid: report.runtimePid4318,
    captures: captures.map((c) => ({
      s: c.short,
      pass: c.pass,
      lib: c.library,
      hit: c.rightHitTotal,
      f: c.footerCount,
      kind: c.officialSheet?.kind,
      note: c.note,
    })),
  }),
)
