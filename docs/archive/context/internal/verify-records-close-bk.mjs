/**
 * BK: contract 3 only. After 改行 preview cancel, keep this hop list.
 * Catalog dump = after chip/footer/first/rows differ from the before-write hop snapshot.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA_CANCEL = `${STORE}/media/records-close-contract-cancel.png`
const MEDIA_WRITE = `${STORE}/media/records-close-contract-write.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-contract.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-bk.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const HOP_SPEECH = '停用客户还有哪些没关的工单？只要预览，不要过账，不要 biz_write。'

const [branch, sha] = execSync('git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD', {
  cwd: SCENE,
  encoding: 'utf8',
}).trim().split('\n')

let prev = {}
try { prev = JSON.parse(await readFile(REPORT_JSON, 'utf8')) } catch { prev = {} }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
const bizWriteUrls = []
page.on('request', (req) => {
  if (/\/biz\/write|biz_write/i.test(req.url()) && req.method() === 'POST') bizWriteUrls.push(req.url())
})

const out = {
  sha,
  branch,
  workspaceCwd,
  hardcodedInSrc: 'none',
  gateInjected: false,
  wrote: false,
  confirmed: false,
  silentBizWrite: false,
  originPushed: false,
  pnpm5174: true,
  slice: 'BK-contract-3-cancel',
  contract1: 'not-this-slice',
  contract2: 'not-this-slice',
  contract4: 'already-specified',
}

async function flush() {
  await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
}

function seedState(sessionId) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    if (sid) state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    }
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((p) => {
      if (p && p.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, sessionId })
}

async function goTab(name) {
  const btn = page.getByRole('button', { name, exact: true })
  if (await btn.count()) await btn.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(350)
}

async function readPending() {
  return page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    return {
      kind: sheet?.kind || null,
      action: sheet?.action || null,
      rows: rows.length,
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || '') : '',
      speech: sheet?.speech || '',
      preview_id: sheet?.preview_id || sheet?.previewId || null,
      sessionId: sheet?.sessionId || '',
    }
  }, workspaceCwd)
}

async function readUi() {
  return page.evaluate(() => {
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const kindChips = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const footer = [...document.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    const firstNo = table?.querySelector('tbody tr td')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const drawer = document.querySelector('div.fixed.inset-y-0.right-0')
    const drawerText = drawer ? (drawer.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240) : ''
    const tabs = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() || '')
    return {
      kindChips,
      footer,
      footerCount,
      firstNo,
      drawerOpen: Boolean(drawer),
      drawerText,
      tabs: { apps: tabs.includes('应用'), records: tabs.includes('业务记录'), ops: tabs.includes('操作记录') },
    }
  })
}

function snapshot(pending, ui) {
  return {
    kind: pending.kind,
    action: pending.action,
    rows: pending.rows,
    first: pending.first,
    speech: pending.speech,
    preview_id: pending.preview_id,
    chips: ui.kindChips,
    footer: ui.footer,
    footerCount: ui.footerCount,
    firstNo: ui.firstNo,
    drawerOpen: ui.drawerOpen,
  }
}

function catalogDump(before, after) {
  if (!before || !after) return true
  const chipChanged = (after.chips || []).join('|') !== (before.chips || []).join('|')
  const footerChanged = after.footerCount !== before.footerCount
  const rowsChanged = after.rows !== before.rows
  const firstChanged = Boolean(before.first) && Boolean(after.first) && after.first !== before.first
  const kindChanged = after.kind !== before.kind
  return chipChanged || footerChanged || rowsChanged || firstChanged || kindChanged
}

async function postPreview(body) {
  return page.evaluate(async ({ cwd, payload }) => {
    const res = await fetch('/api/v1/biz/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ workspace: cwd, ...payload }),
    })
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || json?.sheet || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    return {
      http: res.status,
      error: json?.error || null,
      kind: sheet?.kind || json?.data?.kind || null,
      action: sheet?.action || json?.data?.action || null,
      rows: rows.length,
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
      preview_id: sheet?.preview_id || json?.data?.preview_id || null,
      message: json?.error?.message || json?.message || '',
    }
  }, { cwd: workspaceCwd, payload: body })
}

async function dualWrite(src, rel) {
  const dest = `${CURSOR_STORE}/${rel}`
  try {
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
    return dest
  } catch (error) {
    return String(error)
  }
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  out.sessionId = await page.evaluate(async (cwd) => {
    const res = await fetch('/api/v1/ai/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwd, title: 'records-close-bk' }),
    })
    const json = await res.json().catch(() => ({}))
    return json?.data?.sessionId || json?.data?.id || json?.sessionId || null
  }, workspaceCwd)
  await seedState(out.sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await goTab('业务记录')
  await page.waitForTimeout(1200)

  let before = { pending: await readPending(), ui: await readUi() }
  const hop = await page.evaluate(async ({ sid, text }) => {
    const res = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sid)}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const json = await res.json().catch(() => ({}))
    return { http: res.status, accepted: Boolean(json?.data?.accepted) }
  }, { sid: out.sessionId, text: HOP_SPEECH })
  out.rehop = hop
  const hopDeadline = Date.now() + 120000
  while (Date.now() < hopDeadline) {
    const p = await readPending()
    const u = await readUi()
    if (
      p.kind
      && p.action === '现查'
      && p.rows > 0
      && u.footerCount === p.rows
      && /停用客户/.test(String(p.speech || ''))
      && !u.drawerOpen
    ) break
    await page.waitForTimeout(700)
  }
  before = { pending: await readPending(), ui: await readUi() }

  out.beforeWrite = snapshot(before.pending, before.ui)
  out.hopSpeechStayed = /停用客户/.test(String(before.pending.speech || ''))
    && Boolean(before.pending.kind)
    && before.pending.kind !== '请假申请'

  if (!(out.beforeWrite.rows > 0 && out.hopSpeechStayed && out.beforeWrite.footerCount === out.beforeWrite.rows && out.beforeWrite.action === '现查')) {
    throw new Error(`hop list not ready before write: ${JSON.stringify(out.beforeWrite)}`)
  }

  out.writeFallback = await postPreview({
    kind: before.pending.kind,
    action: '改行',
    speech: before.pending.speech,
    input: { status: 'resolved' },
  })

  const writeDeadline = Date.now() + 90000
  let writeState = { pending: await readPending(), ui: await readUi() }
  while (Date.now() < writeDeadline) {
    writeState = { pending: await readPending(), ui: await readUi() }
    if (writeState.pending.action === '改行' && (writeState.ui.drawerOpen || writeState.pending.preview_id)) break
    await page.waitForTimeout(700)
  }
  out.write = {
    ...snapshot(writeState.pending, writeState.ui),
    drawerText: writeState.ui.drawerText,
    ready: writeState.pending.action === '改行' && Boolean(writeState.pending.preview_id || writeState.ui.drawerOpen),
  }
  await mkdir(dirname(MEDIA_WRITE), { recursive: true })
  await page.screenshot({ path: MEDIA_WRITE, fullPage: true })
  await flush()

  if (!out.write.ready) throw new Error(`改行 preview did not open: ${JSON.stringify(out.write)}`)

  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  const clickedCancel = (await cancelBtn.count())
    ? (await cancelBtn.click({ timeout: 8000 }).then(() => true).catch(() => false))
    : false

  let after = { pending: await readPending(), ui: await readUi() }
  let dumpedDuringWait = false
  const settleUntil = Date.now() + 5000
  while (Date.now() < settleUntil) {
    after = { pending: await readPending(), ui: await readUi() }
    if (catalogDump(out.beforeWrite, snapshot(after.pending, after.ui))) {
      dumpedDuringWait = true
      break
    }
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(800)
  after = { pending: await readPending(), ui: await readUi() }
  const afterSnap = snapshot(after.pending, after.ui)
  const dumped = dumpedDuringWait || catalogDump(out.beforeWrite, afterSnap)

  out.cancel = {
    clicked: clickedCancel,
    ...afterSnap,
    catalogDump: dumped,
    heldBatch: !dumped
      && afterSnap.kind === out.beforeWrite.kind
      && afterSnap.rows === out.beforeWrite.rows
      && afterSnap.footerCount === out.beforeWrite.footerCount
      && (afterSnap.chips || []).join('|') === (out.beforeWrite.chips || []).join('|')
      && afterSnap.first === out.beforeWrite.first,
    hopSpeechStayed: /停用客户/.test(String(afterSnap.speech || '')),
  }
  await page.screenshot({ path: MEDIA_CANCEL, fullPage: true })
  await dualWrite(MEDIA_WRITE, 'media/records-close-contract-write.png')
  await dualWrite(MEDIA_CANCEL, 'media/records-close-contract-cancel.png')
  out.mediaWrite = MEDIA_WRITE
  out.mediaCancel = MEDIA_CANCEL

  await goTab('应用')
  const appsTab = await page.evaluate(() => /创建应用|本周现场走访记录/.test(document.body?.innerText || ''))
  await goTab('操作记录')
  const opsTab = await page.evaluate(() => /操作记录|回退/.test(document.body?.innerText || ''))
  await goTab('业务记录')
  out.decision22 = {
    tabs: (await readUi()).tabs,
    appsTab,
    opsTab,
  }

  out.wrote = bizWriteUrls.length > 0
  out.silentBizWrite = bizWriteUrls.length > 0
  out.confirmed = /确认过账/.test(after.ui.drawerText || '') && after.ui.drawerOpen
  out.contract3 = Boolean(
    out.cancel.clicked
    && out.cancel.heldBatch
    && !out.cancel.catalogDump
    && !out.cancel.drawerOpen
    && out.cancel.hopSpeechStayed
    && !out.wrote
    && !out.confirmed,
  )
  out.ok = Boolean(out.contract3)
  if (!out.ok) out.fail = dumped
    ? `cancel dumped catalog: before=${JSON.stringify(out.beforeWrite)} after=${JSON.stringify(afterSnap)}`
    : `cancel did not hold hop list: ${JSON.stringify(out.cancel)}`
} catch (error) {
  out.ok = false
  out.contract3 = false
  out.fail = String(error && error.message ? error.message : error)
} finally {
  await browser.close().catch(() => {})
}

const md = [
  '---',
  'cursor:',
  '  subagentId: "hold-sheet-after-cancel"',
  '---',
  '',
  '# Verify: BK 契约 3 取消不倒目录',
  '',
  `**product SHA:** \`${out.sha}\``,
  `**branch:** \`${out.branch}\``,
  `**闸注入:** no`,
  `**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}`,
  '',
  '## 因果',
  '',
  '同指纹批量改行原先不收 displayBeforeWriteRef；GET pending-sheet 用目录 lastEmittedPending 盖 hall。取消必须回到取消前那张 hop 现查，不能倒连接器目录。',
  '',
  '## 对照',
  '',
  `| 项 | 状态 | 证据 |`,
  `|---|---|---|`,
  `| 取消前 hop 表 | ${out.beforeWrite?.rows ? '已摸过' : '仍差'} | kind=${out.beforeWrite?.kind} rows=${out.beforeWrite?.rows} chips=${(out.beforeWrite?.chips || []).join(',')} first=${out.beforeWrite?.first} |`,
  `| 改行抽屉 | ${out.write?.ready ? '已摸过' : '仍差'} | action=${out.write?.action} drawer=${out.write?.drawerOpen} preview=${out.write?.preview_id} |`,
  `| 契约 3 取消仍是这张 | ${out.contract3 ? '已对' : '仍差'} | catalogDump=${out.cancel?.catalogDump} heldBatch=${out.cancel?.heldBatch} chips=${(out.cancel?.chips || []).join(',')} footer=${out.cancel?.footerCount} first=${out.cancel?.first} drawer=${out.cancel?.drawerOpen} |`,
  `| 契约 1–2 | 未对（本刀不重开） | |`,
  `| 决策 22 三 Tab | ${out.decision22?.tabs?.apps && out.decision22?.tabs?.records && out.decision22?.tabs?.ops ? '已摸过' : '仍差'} | ${JSON.stringify(out.decision22?.tabs)} |`,
  '',
  `已对：${out.contract3 ? '取消后右表/chip/footer 仍是取消前 hop 表' : '无'}`,
  `未对：契约 1–2（不重开）`,
  `仍差：${out.ok ? '无（本刀只验契约 3）' : (out.fail || '取消倒目录')}`,
  '',
  '## 图',
  '',
  MEDIA_CANCEL,
  '',
]
await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md.join('\n'))
try {
  await dualWrite(REPORT_JSON, 'internal/verify-records-close-contract.json')
  await dualWrite(REPORT_MD, 'internal/verify-records-close-bk.md')
} catch { /* ignore */ }
console.log(JSON.stringify({
  ok: out.ok,
  sha: out.sha,
  beforeWrite: out.beforeWrite,
  write: out.write && { kind: out.write.kind, action: out.write.action, rows: out.write.rows, drawerOpen: out.write.drawerOpen, preview_id: out.write.preview_id },
  cancel: out.cancel,
  contract3: out.contract3,
  fail: out.fail,
}, null, 2))
process.exit(out.ok ? 0 : 1)
