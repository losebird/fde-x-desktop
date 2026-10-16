import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const REPORT = `${STORE}/internal/biz-data-eval-shared-enum-chip-fix.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const FALLBACK_WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const TURN_MS = 180000

const LIBRARY = {
  项目任务: 161,
  项目: 96,
  销售合同: 0,
  仓库: 1,
}

const STEPS = [
  { slug: 'doing-项目任务', speech: '进行中的项目任务和项目', kind: '项目任务', group: 'doing' },
  { slug: 'doing-项目', speech: '进行中的项目任务和项目', kind: '项目', group: 'doing', reuseSession: true },
  { slug: 'contract-empty', speech: '销售合同', kind: '销售合同', group: 'spot' },
  { slug: 'warehouse-semi', speech: '半成品库的仓库', kind: '仓库', group: 'spot' },
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
      tableRowCount: rows.length,
      tableHeaders: headers,
      tableSample: rowTexts.slice(0, 3).join(' | '),
      hasPrjInTable: rowTexts.some((t) => /\bPRJ\d+/i.test(t) || /PRJ-/.test(t)),
      pagination: pageMatch ? { page: Number(pageMatch[1]), pages: Number(pageMatch[2]) } : null,
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
  await page.evaluate((targetKind) => {
    const wrap = document.querySelector('div.flex.items-center.gap-1.flex-wrap')
    const buttons = wrap ? [...wrap.querySelectorAll('button.btn')] : []
    const match = (text) => {
      const t = String(text || '').replace(/\s+/g, '')
      if (!t.includes(targetKind)) return false
      if (targetKind === '项目') return /^项目(?!任务)/.test(t)
      return t.startsWith(targetKind)
    }
    const btn = buttons.find((b) => match(b.textContent))
    if (btn) btn.click()
  }, kind)
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    const sheet = await officialSheet(sessionId)
    const ui = await readUi(page)
    const kindOk = String(sheet?.kind || '').trim() === kind
    const footerMoved = prevFooter != null && ui.footerCount != null && ui.footerCount !== prevFooter
    if (kindOk || footerMoved) break
    await page.waitForTimeout(400)
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

function gitHead() {
  try {
    return execSync('git -C /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

await bffJson('/api/v1/ai/connect', { method: 'POST', body: {} })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const captures = []
let runError = null
let sharedSessionId = null

try {
  for (const step of STEPS) {
    const speech = speechFor(step.speech)
    let sessionId = sharedSessionId
    if (!step.reuseSession) {
      sessionId = await runSession(page, FALLBACK_WS, speech)
      if (step.group === 'doing') sharedSessionId = sessionId
    } else if (!sessionId) throw new Error('missing shared session')

    if (step.group === 'doing' && step.kind === '项目') {
      const before = await readUi(page)
      await clickKindChip(page, step.kind, sessionId, before.footerCount)
    } else if (step.group === 'doing' && step.kind === '项目任务') {
      await clickKindChip(page, step.kind, sessionId, null)
    }

    const sheet = await officialSheet(sessionId)
    const ui = await readUi(page)
    const shot = `${STORE}/media/biz-data-eval-shared-enum-chip-fix-${step.slug}.png`
    await shotFooter(page, shot)
    const digest = await fileDigest(shot)
    const library = LIBRARY[step.kind]
    let pass = true
    const notes = []
    const officialKind = String(sheet?.kind || '').trim()
    const hit = sheet?.hitTotal == null ? null : Number(sheet.hitTotal)
    if (officialKind !== step.kind) {
      pass = false
      notes.push(`official=${officialKind}`)
    }
    if (hit != null && hit !== library) {
      pass = false
      notes.push(`hit=${hit}`)
    }
    if (ui.footerCount != null && ui.footerCount !== library) {
      pass = false
      notes.push(`footer=${ui.footerCount}`)
    }
    if (step.kind === '项目' && ui.hasPrjInTable === false && library > 0) {
      pass = false
      notes.push('no-prj')
    }
    if (library > 20 && ui.pagination && ui.pagination.pages <= 1) {
      pass = false
      notes.push(`pager=${ui.pagination.page}/${ui.pagination.pages}`)
    }
    captures.push({
      slug: step.slug,
      kind: step.kind,
      library,
      officialKind,
      hitTotal: hit,
      footerCount: ui.footerCount,
      pagination: ui.pagination,
      tableRowCount: ui.tableRowCount,
      tableSample: ui.tableSample,
      pass,
      note: notes.join('；') || 'ok',
      screenshot: shot,
      ...digest,
      sessionId,
    })
  }
} catch (e) {
  runError = String(e?.message || e)
}

await browser.close().catch(() => {})

const taskShot = captures.find((c) => c.slug === 'doing-项目任务')
const projShot = captures.find((c) => c.slug === 'doing-项目')
const shotsDistinct = taskShot && projShot && taskShot.sha256 !== projShot.sha256

const report = {
  branch: 'cursor/eval-three-causes-2d90',
  headCommit: gitHead(),
  shotsDistinct,
  taskVsProject: taskShot && projShot
    ? { task: { bytes: taskShot.bytes, sha256: taskShot.sha256 }, project: { bytes: projShot.bytes, sha256: projShot.sha256 } }
    : null,
  captures,
  allPass: captures.length >= 4 && captures.every((c) => c.pass) && shotsDistinct,
  runError,
  capturedAt: new Date().toISOString(),
}

await writeFile(REPORT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ allPass: report.allPass, shotsDistinct, captures: captures.map((c) => ({ s: c.slug, pass: c.pass, note: c.note, sha: c.sha256?.slice(0, 12) })) }))
