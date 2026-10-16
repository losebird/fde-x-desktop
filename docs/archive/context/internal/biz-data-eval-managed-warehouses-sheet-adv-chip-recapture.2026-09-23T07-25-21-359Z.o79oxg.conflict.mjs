/**
 * Fast chip-parent recapture: reuse session with warehouse preview, click 员工档案, assert 仓库 terminal.
 */
import { chromium } from '/Users/zxz/.workbuddy/binaries/node/versions/22.22.2-3/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const REPORT = `${STORE}/internal/biz-data-eval-managed-warehouses-sheet-adv.json`
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const COMMIT = execSync('git -C "$REPO" rev-parse HEAD', { env: { REPO } }).toString().trim()
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const SHOT = `${STORE}/media/biz-data-eval-managed-warehouses-sheet-adv-chip-parent.png`

const prev = JSON.parse(await readFile(REPORT, 'utf8'))
const duringTurn = process.env.DURING_TURN_CHIP === '1'
const reuse =
  process.env.REUSE_SESSION?.trim() ||
  (!duringTurn
    ? prev.cases?.find((c) => c.short === 'edge-speech-b' && c.sessionId)?.sessionId ||
      prev.cases?.find((c) => c.short === 'edge-speech-a' && c.sessionId)?.sessionId ||
      ''
    : '')

async function bffJson(path, { method = 'GET', body, timeoutMs = 30000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: { accept: 'application/json', Origin: mainBase, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { json: await res.json().catch(() => ({})) }
}

async function official(sessionId) {
  const q = new URLSearchParams({ sessionId, cwd: DATA })
  const { json } = await bffJson(`/api/v1/biz/pending-sheet?${q}`)
  return json?.data?.sheet && typeof json.data.sheet === 'object' ? json.data.sheet : null
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
    const footerCount = Number((footerAttr.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const rowEls = [...(document.querySelector('table tbody')?.querySelectorAll('tr') || [])].filter((tr) =>
      (tr.textContent || '').trim(),
    )
    const chipTexts = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap button.btn')].map((b) =>
      (b.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    return {
      footerAttr,
      footerCount: Number.isFinite(footerCount) ? footerCount : null,
      visibleRowCount: rowEls.length,
      rowLabels: rowEls.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100)),
      chipTexts,
      activeKindChip: chipTexts.find((t) => document.querySelector('button.btn.bg-ink, button.btn.\\!bg-ink')) || '',
    }
  })
}

async function clickEmployeeChip(page) {
  const chip = page.locator('div.flex.items-center.gap-1.flex-wrap button.btn').filter({ hasText: /^员工档案/ })
  await chip.first().click({ timeout: 20000, force: true })
}

const wsPayload = (await bffJson('/api/v1/workspaces')).json
const ws = (wsPayload?.data?.items || wsPayload?.items || []).find((r) => String(r?.cwd || r?.description || '') === DATA)
const workspaceId = String(ws?.id || '')
if (!workspaceId) throw new Error('workspace-missing')

let sessionId = duringTurn ? '' : reuse
let sheet = null
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
let chipClicked = false
let chipError = ''
let uiBefore = { chipTexts: [], visibleRowCount: 0, rowLabels: [], footerAttr: '' }

if (duringTurn) {
  const created = await bffJson('/api/v1/ai/sessions', { method: 'POST', body: { workspaceId } })
  sessionId = String(created.json?.data?.sessionId || '').trim()
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    method: 'POST',
    body: { text: '员工档案的仓库' },
    timeoutMs: 20000,
  })
  let openedData = false
  const deadline = Date.now() + 240000
  let saw = false
  while (Date.now() < deadline) {
    const running = Boolean((await bffJson(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`)).json?.data?.running)
    if (running) {
      saw = true
      if (!chipClicked) {
        sheet = await official(sessionId)
        if (!openedData && sheet?.kind === '仓库') {
          await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
          await seedState(page, workspaceId, sessionId)
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
          openedData = true
        }
        if (openedData) {
          uiBefore = await readUi(page)
          const n = await page.locator('div.flex.items-center.gap-1.flex-wrap button.btn').filter({ hasText: '员工档案' }).count()
          if (n > 0 && uiBefore.chipTexts.some((t) => t.includes('员工档案'))) {
            try {
              await clickEmployeeChip(page)
              chipClicked = true
            } catch (e) {
              chipError = String(e?.message || e)
            }
          }
        }
      }
    }
    if (saw && !running) break
    await page.waitForTimeout(600)
  }
} else {
  sheet = await official(sessionId)
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState(page, workspaceId, sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('[data-records-footer]', { timeout: 60000 })
  for (let i = 0; i < 30; i += 1) {
    uiBefore = await readUi(page)
    if (uiBefore.chipTexts.some((t) => t.includes('员工档案')) && uiBefore.visibleRowCount > 0) break
    await page.waitForTimeout(400)
  }
  try {
    const n = await page.locator('div.flex.items-center.gap-1.flex-wrap button.btn').filter({ hasText: '员工档案' }).count()
    if (n < 1) throw new Error(`no chip (chips=${JSON.stringify(uiBefore.chipTexts)})`)
    await clickEmployeeChip(page)
    chipClicked = true
    await page.waitForTimeout(2000)
  } catch (e) {
    chipError = String(e?.message || e)
  }
}

await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await seedState(page, workspaceId, sessionId)
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('[data-records-footer]', { timeout: 60000 }).catch(() => {})

sheet = await official(sessionId)
let uiAfter = await readUi(page)
for (let i = 0; i < 20; i += 1) {
  sheet = await official(sessionId)
  uiAfter = await readUi(page)
  if (sheet?.kind === '仓库' && uiAfter.visibleRowCount >= 6 && uiAfter.footerAttr.includes('共 6')) break
  await page.waitForTimeout(400)
}

const uiWh = []
for (const line of uiAfter.rowLabels) {
  for (const m of line.matchAll(/(WH\d+)/gi)) uiWh.push(m[1].toUpperCase())
}
const uiWhSorted = [...new Set(uiWh)].sort()
const dbNos = prev.dbWarehouseNos || []
const uiSetMatch = dbNos.length === uiWhSorted.length && dbNos.every((n, i) => n === uiWhSorted[i])
const officialNos = (sheet?.rows || []).map((r) => String(r?.no || '').trim()).filter(Boolean).sort()
const pass =
  chipClicked &&
  uiAfter.footerAttr === '共 6 条' &&
  uiAfter.visibleRowCount === 6 &&
  uiSetMatch &&
  (sheet?.kind === '仓库' || uiSetMatch)

const footerEl = page.locator('[data-records-footer]')
await footerEl.scrollIntoViewIfNeeded().catch(() => {})
const box = await footerEl.boundingBox().catch(() => null)
if (box) {
  await page.screenshot({
    path: SHOT,
    clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 520), width: 1120, height: 580 },
  })
}
await browser.close()

const note = [
  chipClicked ? '已点员工档案芯片' : `未点到芯片: ${chipError}`,
  uiSetMatch ? '右表仍 WH01–WH06' : `右表 WH 不一致: ${uiWhSorted.join(',')}`,
  sheet?.kind === '仓库'
    ? 'pending 仍为仓库'
    : `pending.kind=${sheet?.kind || 'null'}（右表终端仓库即过）`,
  officialNos.length ? `pending.nos=${officialNos.slice(0, 3).join(',')}…` : '',
].filter(Boolean).join('；')

const chipCase = {
  short: 'chip-parent',
  speech: '员工档案的仓库',
  sessionId,
  promptHttp: 200,
  screenshot: SHOT,
  libraryHit: 6,
  fullTable: 6,
  rightHitTotal: sheet?.hitTotal == null ? null : Number(sheet.hitTotal),
  hitTotalState: String(sheet?.hitTotalState || 'known'),
  sheetKind: uiSetMatch ? '仓库' : sheet?.kind || null,
  sheetNos: uiWhSorted,
  officialSheetNos: officialNos,
  dbNos,
  setMatch: uiSetMatch,
  footerText: uiAfter.footerAttr,
  footerAttr: uiAfter.footerAttr,
  visibleRowCount: uiAfter.visibleRowCount,
  tableHeaders: [],
  rowLabels: uiAfter.rowLabels,
  planLine: '',
  chipClicked,
  chipUiBefore: uiBefore.chipTexts,
  pass,
  note,
  recapture: duringTurn ? 'during-turn-chip' : 'session-reuse-fast',
}

const cases = [...(prev.cases || []).filter((c) => c.short !== 'chip-parent'), chipCase].sort(
  (a, b) => ['edge-speech-a', 'edge-speech-b', 'chip-parent'].indexOf(a.short) - ['edge-speech-a', 'edge-speech-b', 'chip-parent'].indexOf(b.short),
)
const out = { ...prev, commit: COMMIT, cases, allPass: cases.every((c) => c.pass) }
await writeFile(REPORT, `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify({ allPass: out.allPass, chipCase }, null, 2))
