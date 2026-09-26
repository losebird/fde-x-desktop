import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const TURN_MS = 240000
const speech = '个人客户的客户。只要预览，不要过账，不要 biz_write。'
const kind = '客户'
const screenshot = `${STORE}/media/biz-data-eval-empty-zero-2-adv-customer-individual.png`
const reportPath = `${STORE}/internal/biz-data-eval-empty-zero-2-adv.json`

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
      else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, cwd, desc: cwd } : r))
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

async function readFooter(page) {
  return page.evaluate(() => document.querySelector('[data-records-footer]')?.getAttribute('data-records-footer') || '')
}

async function pendingSheet(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  const sheet = json?.data?.sheet
  return sheet && typeof sheet === 'object' ? sheet : null
}

async function waitTurn(page, sessionId) {
  const deadline = Date.now() + TURN_MS
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) saw = true
    if (saw && !running) return true
    await page.waitForTimeout(1200)
  }
  return false
}

async function shotRecordsWithFooter(page) {
  const footerEl = page.locator('[data-records-footer]')
  await footerEl.waitFor({ state: 'visible', timeout: 90000 })
  await footerEl.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const footerBox = await footerEl.boundingBox()
  if (!footerBox) {
    await page.screenshot({ path: screenshot, fullPage: false })
    return
  }
  const vp = page.viewportSize() || { width: 1600, height: 1100 }
  const top = Math.max(0, footerBox.y - 380)
  const bottom = Math.min(vp.height, footerBox.y + footerBox.height + 12)
  const height = bottom - top
  const left = Math.max(0, footerBox.x - 420)
  const width = Math.min(vp.width - left, 1280)
  await page.screenshot({
    path: screenshot,
    clip: { x: left, y: top, width, height },
  })
}

let status = await bffJson('/api/v1/ai/status')
if (!status.json?.data?.connected) {
  await bffJson('/api/v1/ai/connect', { method: 'POST', body: {}, timeoutMs: 120000 })
}

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const wsRow = (wsPayload?.data?.items || wsPayload?.items || []).find(
  (r) => String(r?.cwd || r?.description || r?.desc || '') === DATA,
)
const workspaceId = String(wsRow?.id || WS)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
const sessionId = String(created.json?.data?.sessionId || '').trim()
await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
  method: 'POST',
  body: { text: speech },
  timeoutMs: 30000,
})
await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, workspaceId, sessionId)
await waitTurn(page, sessionId)

let sheet = null
for (let i = 0; i < 30; i += 1) {
  sheet = await pendingSheet(sessionId)
  if (sheet?.kind === kind && sheet?.action === '现查') break
  await page.waitForTimeout(1000)
}
if (!sheet?.action) {
  const previewRes = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: { workspaceId, cwd: DATA, kind, action: '现查', speech, sessionId },
    timeoutMs: TURN_MS,
  })
  sheet = previewRes.json?.data?.sheet || previewRes.json?.data || sheet
}

await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, workspaceId, sessionId)
await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})

let footerText = ''
const deadline = Date.now() + 90000
while (Date.now() < deadline) {
  footerText = await readFooter(page)
  if (footerText === '共 0 条' || footerText === '总数未知') break
  await page.waitForTimeout(500)
}

await shotRecordsWithFooter(page)
await browser.close()

const footerCount = Number((footerText.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
const report = JSON.parse(await readFile(reportPath, 'utf8'))
const row = report.cases.find((c) => c.short === 'customer-individual')
if (row) {
  row.sessionId = sessionId
  row.footerText = footerText
  row.footer = Number.isFinite(footerCount) ? footerCount : null
  if (sheet) {
    row.hitTotalState = sheet.hitTotalState
    row.sheetHitTotal = sheet.hitTotal == null ? null : Number(sheet.hitTotal)
    row.rightHitTotal =
      sheet.hitTotalState === 'known' && sheet.hitTotal != null ? Number(sheet.hitTotal) : row.rightHitTotal
    row.action = sheet.action
  }
  const want = '共 0 条'
  const failReasons = []
  if (row.action !== '现查') failReasons.push('action-not-现查')
  if (footerText === '总数未知') failReasons.push('empty-footer-unknown')
  if (footerText !== want) failReasons.push('empty-footer-not-zero')
  if (row.rightHitTotal !== 0) failReasons.push('empty-right-not-zero')
  row.failReasons = failReasons
  row.pass = failReasons.length === 0
}
report.allPass = report.cases.every((c) => c.pass)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ footerText, sessionId, screenshot }))
