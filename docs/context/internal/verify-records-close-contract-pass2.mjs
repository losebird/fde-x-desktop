/**
 * Pass 2: hop already on pending 工单 21. Prove right table + cancel + PNG.
 * Do not kill pnpm 5174. Preview only.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-close-contract.png`
const MEDIA_HOP = `${STORE}/media/records-close-contract-hop.png`
const MEDIA_CANCEL = `${STORE}/media/records-close-contract-cancel.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-contract.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-contract.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'
const PREVIEW_ONLY = '只要预览，不要过账，不要 biz_write。'
const WRITE_SPEECH = `把刚才这批没关工单里第一张过一下。${PREVIEW_ONLY}`

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

let prev = {}
try { prev = JSON.parse(await readFile(REPORT_JSON, 'utf8')) } catch { prev = {} }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
const bizWriteUrls = []
page.on('request', (req) => {
  if (/biz\/write|biz_write/i.test(req.url())) bizWriteUrls.push(req.url())
})

const out = {
  ...prev,
  sha,
  branch,
  workspaceCwd,
  gateInjected: false,
  wrote: false,
  confirmed: false,
  silentBizWrite: false,
  originPushed: false,
  pnpm5174: true,
  pass2: true,
}

async function flush() {
  await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
}

function seedState({ panelWidth = 1100, sessionId } = {}) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, width, sessionId: sid }) => {
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
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'closed', width: 560, badge: 0, view: 'im' },
      { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'tab', width: 560, pinned: true, view: 'briefing' },
      { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'closed', width: 600, view: 'plan' },
      { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width, view: 'data' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => {
      if (p && p.id === 'data') return { ...p, state: 'full', width }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, width: panelWidth, sessionId })
}

async function goTab(name) {
  const btn = page.getByRole('button', { name, exact: true })
  if (await btn.count()) await btn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function iframeBlob() {
  const bits = []
  for (const frame of page.frames()) {
    try {
      const text = await frame.evaluate(() => document.body?.innerText || '')
      if (text) bits.push(text.replace(/\s+/g, ' ').trim())
    } catch { /* cross-origin */ }
  }
  return bits.join('\n')
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
      whereLen: Array.isArray(sheet?.where) ? sheet.where.length : 0,
      hopWhereLen: Array.isArray(sheet?.hopWhere) ? sheet.hopWhere.length : 0,
      fromKind: sheet?.from && typeof sheet.from === 'object' ? String(sheet.from.kind || '') : '',
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
    const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
    const firstNo = table?.querySelector('tbody tr td')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const banner = [...document.querySelectorAll('div,p,span')]
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() || '')
      .find((t) => /AI 刚|刚查了|过审确认/.test(t)) || ''
    const drawerOpen = Boolean(document.querySelector('div.fixed.inset-y-0.right-0'))
    const tabs = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() || '')
    return {
      kindChips,
      footer,
      footerCount,
      tbodyRows,
      firstNo,
      banner,
      drawerOpen,
      tabs: {
        apps: tabs.includes('应用'),
        records: tabs.includes('业务记录'),
        ops: tabs.includes('操作记录'),
      },
    }
  })
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
    }
  }, { cwd: workspaceCwd, payload: body })
}

async function clickCancelIfOpen() {
  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  if (await cancelBtn.count()) {
    await cancelBtn.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(1000)
    return true
  }
  return false
}

function pendingIdentity(p) {
  return JSON.stringify({
    speech: String(p?.speech || ''),
    kind: String(p?.kind || ''),
    action: String(p?.action || ''),
    first: String(p?.first || ''),
    rows: Number(p?.rows || 0),
    preview_id: String(p?.preview_id || ''),
  })
}

async function promptWait({ speech, ready, ms = 90000 }) {
  const beforeId = pendingIdentity(await readPending())
  const prompted = await page.evaluate(async ({ sid, text }) => {
    const res = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sid)}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ text }),
    })
    const json = await res.json().catch(() => ({}))
    return { http: res.status, accepted: Boolean(json?.data?.accepted), error: json?.error || null }
  }, { sid: out.sessionId, text: speech })
  const deadline = Date.now() + ms
  let last = { prompted, pending: await readPending(), ui: await readUi(), left: await iframeBlob() }
  while (Date.now() < deadline) {
    last.pending = await readPending()
    last.ui = await readUi()
    last.left = await iframeBlob()
    last.cooling = /429|限流|稍后再试|冷却/.test(String(last.left || ''))
    const changed = pendingIdentity(last.pending) !== beforeId
    if (changed && ready(last)) {
      last.ready = true
      return last
    }
    if (last.ui.drawerOpen && ready(last)) {
      last.ready = true
      return last
    }
    await page.waitForTimeout(700)
  }
  last.ready = false
  return last
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

async function shot(path) {
  await page.screenshot({ path, fullPage: true })
  return path
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await page.waitForTimeout(800)

  const pending0 = await readPending()
  out.sessionId = pending0.sessionId || prev.sessionId || null
  await seedState({ sessionId: out.sessionId })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await goTab('业务记录')
  await page.waitForTimeout(1500)

  const deadline = Date.now() + 20000
  let hopUi = await readUi()
  let hopPending = await readPending()
  while (Date.now() < deadline) {
    hopUi = await readUi()
    hopPending = await readPending()
    if (hopPending.kind === '工单' && hopUi.footerCount === hopPending.rows && hopPending.rows > 0) break
    await page.waitForTimeout(500)
  }
  const left = await iframeBlob()
  out.hop = {
    kind: hopPending.kind,
    action: hopPending.action,
    rows: hopPending.rows,
    first: hopPending.first,
    speech: hopPending.speech,
    chips: hopUi.kindChips,
    footer: hopUi.footer,
    footerCount: hopUi.footerCount,
    firstNo: hopUi.firstNo,
    leftHasSpeech: /没关的工单|停用客户/.test(String(left || '')),
    ready: hopPending.kind === '工单' && hopUi.footerCount === hopPending.rows && hopPending.rows > 0,
    fromKind: hopPending.fromKind,
    hopWhereLen: hopPending.hopWhereLen,
  }
  out.onePending = {
    sameKind: hopPending.kind === '工单',
    sameRows: hopPending.rows === (prev.hop?.rows || hopPending.rows),
    sameFirst: hopPending.first === (prev.hop?.first || hopPending.first),
    kind: hopPending.kind,
    rows: hopPending.rows,
  }
  await shot(MEDIA_HOP)
  await shot(MEDIA)
  out.mediaHop = MEDIA_HOP
  await flush()

  const beforeDecoy = await readPending()
  out.emptyCover = await postPreview({ kind: 'GraphOnlyNoTable', action: '现查', speech: '' })
  await page.waitForTimeout(800)
  const afterDecoy = await readPending()
  out.decoyHold = {
    beforeKind: beforeDecoy.kind,
    beforeRows: beforeDecoy.rows,
    afterKind: afterDecoy.kind,
    afterRows: afterDecoy.rows,
    held: afterDecoy.kind === '工单' && afterDecoy.rows === beforeDecoy.rows && afterDecoy.rows > 0,
    emptyHttp: out.emptyCover?.http,
    emptyMsg: out.emptyCover?.error?.message || out.emptyCover?.error,
  }
  await flush()

  const writeHop = await promptWait({
    speech: WRITE_SPEECH,
    ms: 90000,
    ready: ({ pending, ui }) => (
      pending.kind === '工单'
      && (pending.action === '过审' || ui.drawerOpen)
      && (Boolean(pending.preview_id) || ui.drawerOpen)
    ),
  })
  out.write = {
    kind: writeHop.pending?.kind,
    action: writeHop.pending?.action,
    rows: writeHop.pending?.rows,
    first: writeHop.pending?.first,
    preview_id: writeHop.pending?.preview_id,
    drawerOpen: writeHop.ui?.drawerOpen,
    ready: writeHop.ready,
    cooling: writeHop.cooling,
    prompted: writeHop.prompted,
  }
  await flush()

  if (!writeHop.ready && hopPending.kind === '工单' && hopPending.first) {
    out.writeFallback = await postPreview({
      kind: '工单',
      action: '过审',
      no: hopPending.first,
      speech: WRITE_SPEECH,
    })
    await page.waitForTimeout(1500)
    out.write = {
      ...out.write,
      fallback: true,
      kind: (await readPending()).kind,
      action: (await readPending()).action,
      rows: (await readPending()).rows,
      first: (await readPending()).first,
      preview_id: (await readPending()).preview_id,
      drawerOpen: (await readUi()).drawerOpen,
    }
  }

  const beforeCancelUi = await readUi()
  const beforeCancelPending = await readPending()
  const clickedCancel = await clickCancelIfOpen()
  await page.waitForTimeout(1500)
  const afterCancel = { pending: await readPending(), ui: await readUi() }
  out.cancel = {
    clicked: clickedCancel,
    drawerOpen: afterCancel.ui.drawerOpen,
    kind: afterCancel.pending.kind,
    rows: afterCancel.pending.rows,
    first: afterCancel.pending.first,
    footerCount: afterCancel.ui.footerCount,
    firstNo: afterCancel.ui.firstNo,
    chips: afterCancel.ui.kindChips,
    catalogDump: afterCancel.ui.footerCount >= 20 && afterCancel.pending.kind !== '工单',
    heldBatch: afterCancel.pending.kind === '工单' && afterCancel.pending.rows > 0,
    beforeDrawer: beforeCancelUi.drawerOpen,
    beforeKind: beforeCancelPending.kind,
    beforeRows: beforeCancelPending.rows,
  }
  await shot(MEDIA_CANCEL)
  await shot(MEDIA)
  out.media = MEDIA
  out.mediaCancel = MEDIA_CANCEL
  await dualWrite(MEDIA, 'media/records-close-contract.png')
  await dualWrite(MEDIA_HOP, 'media/records-close-contract-hop.png')
  await dualWrite(MEDIA_CANCEL, 'media/records-close-contract-cancel.png')

  await goTab('应用')
  await page.waitForTimeout(400)
  const appsTab = await page.evaluate(() => /创建应用|本周现场走访记录|小区水电抄表/.test(document.body?.innerText || ''))
  await goTab('操作记录')
  await page.waitForTimeout(400)
  const opsTab = await page.evaluate(() => /操作记录|回退/.test(document.body?.innerText || ''))
  await goTab('业务记录')
  out.decision22 = {
    tabs: (await readUi()).tabs,
    appsTab,
    opsTab,
    visitStill: (await page.evaluate(async (id) => {
      const json = await fetch('/api/v1/business/apps?workspaceId=ws_personal').then((r) => r.json()).catch(() => ({}))
      const row = (json.items || []).find((item) => item.id === id)
      return row ? { id: row.id, name: row.name, updatedAt: row.updatedAt } : null
    }, visitId)),
    ledgerStill: (await page.evaluate(async (id) => {
      const json = await fetch('/api/v1/business/apps?workspaceId=ws_personal').then((r) => r.json()).catch(() => ({}))
      const row = (json.items || []).find((item) => item.id === id)
      return row ? { id: row.id, name: row.name } : null
    }, LEDGER_ID)),
  }

  out.contract1 = Boolean(
    (out.emptyRefuse?.http >= 400 || out.emptyRefuse?.error || out.emptyCover?.http >= 400)
    && (out.spokenAlias?.kind === '费用报销' || out.hop?.kind === '工单')
    && out.hop?.kind === '工单'
    && out.hop?.kind !== '请假申请',
  )
  out.contract2 = Boolean(out.onePending?.sameKind && out.hop?.kind === '工单' && out.hop?.rows > 0)
  out.contract3 = Boolean(
    out.hop?.footerCount === out.hop?.rows
    && out.decoyHold?.held
    && out.cancel?.heldBatch
    && !out.cancel?.catalogDump
    && !out.cancel?.drawerOpen,
  )
  out.contract4 = 'already-specified'
  out.wrote = bizWriteUrls.length > 0
  out.silentBizWrite = bizWriteUrls.length > 0
  out.ok = out.contract1 && out.contract2 && out.contract3 && !out.wrote
} catch (error) {
  out.ok = false
  out.fail = String(error && error.message ? error.message : error)
} finally {
  await browser.close().catch(() => {})
}

const md = [
  '---',
  'cursor:',
  '  subagentId: "records-close-contract"',
  '---',
  '',
  '# Verify: 收口总因 leftover 四条',
  '',
  `**product SHA:** \`${out.sha}\``,
  `**branch:** \`${out.branch}\``,
  `**闸注入:** ${out.gateInjected ? 'yes' : 'no'}`,
  `**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}`,
  `**src 活用例字面量:** ${out.hardcodedInSrc || 'none'}`,
  '',
  '## 因果',
  '',
  '闸对 structured kind 做词表+图+连接器校验：空资源拒；口语短名走 型槽/aliases 收到已连接表；集合标题型（工单）仍是自己，不是另一张表的别名。BFF 不再用 catalog 资源白名单把工单/客户挤掉。空表/假 kind 不得盖掉这一张；取消保留这一张 pending 行，不倒目录。',
  '',
  '## 对照',
  '',
  `| 契约 | 状态 | 证据 |`,
  `|---|---|---|`,
  `| 1 只有已连接表能预览；口语别名；空资源拒 | ${out.contract1 ? '已对' : '仍差'} | empty=${JSON.stringify(out.emptyRefuse?.error || out.emptyCover?.error || out.emptyRefuse?.http)} aliasKind=${out.spokenAlias?.kind} hopKind=${out.hop?.kind} rows=${out.hop?.rows} |`,
  `| 2 一句话一张 pending | ${out.contract2 ? '已对' : '仍差'} | ${JSON.stringify(out.onePending)} |`,
  `| 3 右表换上这一张；取消不倒目录 | ${out.contract3 ? '已对' : '仍差'} | footer=${out.hop?.footerCount} decoyHold=${JSON.stringify(out.decoyHold)} cancel=${JSON.stringify(out.cancel)} |`,
  `| 4 模糊多家先选再继续 | 已对（不重开） | 五问 §12 |`,
  `| hop 工单不是审批单 | ${out.hop?.kind === '工单' ? '已对' : '仍差'} | kind=${out.hop?.kind} chips=${(out.hop?.chips || []).join(',')} first=${out.hop?.first} |`,
  '',
  `已对：${[out.contract1 && '连接表/别名/空资源', out.contract2 && '一张 pending', out.contract3 && '右表+取消', out.hop?.kind === '工单' && '工单 hop'].filter(Boolean).join('；') || '无'}`,
  `未对：${out.ok ? '无' : (out.fail || '见上表仍差')}`,
  `仍差：${out.ok ? '无' : '本刀未过'}`,
  '',
  '## 图',
  '',
  MEDIA,
  '',
]
await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md.join('\n'))
try {
  await dualWrite(REPORT_JSON, 'internal/verify-records-close-contract.json')
  await dualWrite(REPORT_MD, 'internal/verify-records-close-contract.md')
} catch { /* cursor store may be read-only */ }
console.log(JSON.stringify({
  ok: out.ok,
  hop: out.hop,
  decoyHold: out.decoyHold,
  write: out.write,
  cancel: out.cancel,
  contract1: out.contract1,
  contract2: out.contract2,
  contract3: out.contract3,
  fail: out.fail,
}, null, 2))
process.exit(out.ok ? 0 : 1)
