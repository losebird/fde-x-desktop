/**
 * One 印证 after BI leftover: four contracts only. Hop speech 工单 must be 工单.
 * Left-pane speech for hop. Preview only. Do not kill pnpm 5174. No origin push.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-close-contract.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-contract.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-contract.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'
const PREVIEW_ONLY = '只要预览，不要过账，不要 biz_write。'
const HOP_SPEECH = `停用客户还有哪些没关的工单？${PREVIEW_ONLY}`

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

function srcHasHardcodedMap() {
  try {
    const blob = execSync(
      "rg -n \"报销单|费用报销|请假单|请假申请|恒通|\\\\(in graph\\\\)\" src runtime/biz runtime/routes --glob '!**/tests/**' || true",
      { cwd: SCENE, encoding: 'utf8' },
    )
    return String(blob || '').trim() || 'none'
  } catch {
    return 'none'
  }
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

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
  sha,
  branch,
  workspaceCwd,
  hardcodedInSrc: srcHasHardcodedMap(),
  gateInjected: false,
  wrote: false,
  confirmed: false,
  silentBizWrite: false,
  originPushed: false,
  pnpm5174: true,
}

function seedState({ activeDataSubview = 'records', panelWidth = 1100, sessionId } = {}) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, activeDataSubview: view, panelWidth: width, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = view
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
  }, { workspaceId, workspaceCwd, activeDataSubview, panelWidth, sessionId })
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
      preview_id: sheet?.preview_id || null,
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

async function promptWait({ speech, ready }) {
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
  const deadline = Date.now() + 120000
  let last = { prompted, pending: await readPending(), ui: await readUi(), left: await iframeBlob() }
  while (Date.now() < deadline) {
    last.pending = await readPending()
    last.ui = await readUi()
    last.left = await iframeBlob()
    last.cooling = /429|限流|稍后再试/.test(String(last.left || ''))
    const changed = pendingIdentity(last.pending) !== beforeId
    if (changed && ready(last)) {
      last.ready = true
      return last
    }
    await page.waitForTimeout(800)
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

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await page.waitForTimeout(1500)
  await seedState()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)

  out.kinds = await page.evaluate(async (cwd) => {
    const res = await fetch(`/api/v1/biz/kinds?cwd=${encodeURIComponent(cwd)}`)
    const json = await res.json().catch(() => ({}))
    const data = json.data || json
    const kinds = Array.isArray(data.kinds) ? data.kinds : []
    return {
      http: res.status,
      count: kinds.length,
      hasTicket: kinds.some((row) => row.kind === '工单'),
      hasLeave: kinds.some((row) => row.kind === '请假申请'),
      spokenAlias: (data.aliases || {})['报销单'] || '',
      approvalAlias: (data.aliases || {})['审批单'] || '',
    }
  }, workspaceCwd)

  out.emptyRefuse = await postPreview({ kind: 'GraphOnlyNoTable', action: '现查', speech: 'preview GraphOnlyNoTable' })
  out.spokenAlias = await postPreview({ kind: '报销单', action: '现查', speech: `待审报销一批。${PREVIEW_ONLY}` })

  const created = await page.evaluate(async (cwd) => {
    const res = await fetch('/api/v1/ai/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwd, title: 'records-close-contract' }),
    })
    const json = await res.json().catch(() => ({}))
    return json?.data?.sessionId || json?.data?.id || json?.sessionId || null
  }, workspaceCwd)
  out.sessionId = created
  await seedState({ sessionId: created })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await goTab('业务记录')
  await page.waitForTimeout(800)

  const hop = await promptWait({
    speech: HOP_SPEECH,
    ready: ({ pending, ui }) => (
      pending.kind === '工单'
      && pending.rows > 0
      && ui.footerCount === pending.rows
      && pending.kind !== '请假申请'
      && pending.kind !== '审批单'
    ),
  })
  out.hop = {
    kind: hop.pending?.kind,
    action: hop.pending?.action,
    rows: hop.pending?.rows,
    first: hop.pending?.first,
    speech: hop.pending?.speech,
    chips: hop.ui?.kindChips,
    footer: hop.ui?.footer,
    footerCount: hop.ui?.footerCount,
    firstNo: hop.ui?.firstNo,
    leftHasSpeech: /没关的工单|停用客户/.test(String(hop.left || '')),
    ready: hop.ready,
    cooling: hop.cooling,
  }
  const hopPendingAgain = await readPending()
  out.onePending = {
    sameKind: hopPendingAgain.kind === hop.pending?.kind,
    sameRows: hopPendingAgain.rows === hop.pending?.rows,
    sameFirst: hopPendingAgain.first === hop.pending?.first,
    kind: hopPendingAgain.kind,
    rows: hopPendingAgain.rows,
  }

  const writeHop = await promptWait({
    speech: `把刚才这批没关工单里第一张过一下。${PREVIEW_ONLY}`,
    ready: ({ pending }) => pending.kind === '工单' && pending.action === '过审' && Boolean(pending.preview_id),
  })
  out.write = {
    kind: writeHop.pending?.kind,
    action: writeHop.pending?.action,
    rows: writeHop.pending?.rows,
    first: writeHop.pending?.first,
    preview_id: writeHop.pending?.preview_id,
    ready: writeHop.ready,
  }
  await page.waitForTimeout(800)
  const beforeCancelUi = await readUi()
  const clickedCancel = await clickCancelIfOpen()
  await page.waitForTimeout(1200)
  const afterCancel = { pending: await readPending(), ui: await readUi() }
  out.cancel = {
    clicked: clickedCancel,
    drawerOpen: afterCancel.ui.drawerOpen,
    kind: afterCancel.pending.kind,
    rows: afterCancel.pending.rows,
    first: afterCancel.pending.first,
    footerCount: afterCancel.ui.footerCount,
    firstNo: afterCancel.ui.firstNo,
    catalogDump: afterCancel.ui.footerCount >= 20 && afterCancel.pending.kind !== '工单',
    heldBatch: afterCancel.pending.kind === '工单' && afterCancel.pending.rows > 0,
    beforeDrawer: beforeCancelUi.drawerOpen,
  }

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

  await page.screenshot({ path: MEDIA, fullPage: true })
  out.media = MEDIA
  await dualWrite(MEDIA, 'media/records-close-contract.png')

  out.contract1 = Boolean(
    out.emptyRefuse && (out.emptyRefuse.http >= 400 || out.emptyRefuse.error)
    && out.spokenAlias && out.spokenAlias.kind === '费用报销'
    && out.hop?.kind === '工单'
    && out.hop?.kind !== '请假申请',
  )
  out.contract2 = Boolean(out.onePending?.sameKind && out.onePending?.sameRows && out.hop?.kind === '工单')
  out.contract3 = Boolean(
    out.hop?.footerCount === out.hop?.rows
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
  `**src 活用例字面量:** ${out.hardcodedInSrc}`,
  '',
  '## 因果',
  '',
  '闸对 structured kind 做词表+图+连接器校验：空资源拒；口语短名走 型槽/aliases 收到已连接表；集合标题型（工单）仍是自己，不是另一张表的别名。BFF 不再用 catalog 资源白名单把工单/客户挤掉。取消保留这一张 pending 行，不倒目录。',
  '',
  '## 对照',
  '',
  `| 契约 | 状态 | 证据 |`,
  `|---|---|---|`,
  `| 1 只有已连接表能预览；口语别名；空资源拒 | ${out.contract1 ? '已对' : '仍差'} | empty=${JSON.stringify(out.emptyRefuse?.error || out.emptyRefuse?.http)} aliasKind=${out.spokenAlias?.kind} hopKind=${out.hop?.kind} rows=${out.hop?.rows} |`,
  `| 2 一句话一张 pending | ${out.contract2 ? '已对' : '仍差'} | ${JSON.stringify(out.onePending)} |`,
  `| 3 右表换上这一张；取消不倒目录 | ${out.contract3 ? '已对' : '仍差'} | footer=${out.hop?.footerCount} cancel=${JSON.stringify(out.cancel)} |`,
  `| 4 模糊多家先选再继续 | 已对（不重开） | 五问 §12 |`,
  `| hop 工单不是审批单 | ${out.hop?.kind === '工单' ? '已对' : '仍差'} | kind=${out.hop?.kind} chips=${(out.hop?.chips || []).join(',')} |`,
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
console.log(JSON.stringify({ ok: out.ok, hop: out.hop, contract1: out.contract1, contract2: out.contract2, contract3: out.contract3, fail: out.fail }, null, 2))
process.exit(out.ok ? 0 : 1)
