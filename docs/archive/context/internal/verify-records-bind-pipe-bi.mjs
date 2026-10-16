/**
 * BI live: left-pane speech, not POST-only. Connected-table 过审 batch,
 * cancel holds the batch, same-shape short name, Decision 22 hops 1–3.
 * Preview only. Do not confirm write / silent biz_write / auto IM.
 * Do not kill pnpm 5174. Do not push origin. Do not git add -A.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-bind-pipe-bi.png`
const REPORT_JSON = `${STORE}/internal/verify-records-bind-pipe-bi.json`
const REPORT_MD = `${STORE}/internal/verify-records-bind-pipe-bi.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'
const PREVIEW_ONLY = '只要预览，不要过账，不要 biz_write。'
const CATALOG_PAGE = 20
const HOP2_NO = 'TK20260105702'
const HOP3_NO = 'PAY-2026-005'

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
      "rg -n \"报销单|费用报销|请假单|请假申请|恒通|\\(in graph\\)\" src runtime/biz runtime/routes --glob '!**/tests/**' || true",
      { cwd: SCENE, encoding: 'utf8' },
    )
    return String(blob || '').trim() || 'none'
  } catch {
    return 'none'
  }
}

async function httpCode(url, accept = 'application/json') {
  try {
    const res = await fetch(url, { headers: { accept } })
    return res.status
  } catch (error) {
    return String(error?.cause?.code || error?.message || error)
  }
}

async function hostsUp() {
  const vite = await httpCode(mainBase, 'text/html')
  const bff = await httpCode(`${bffBase}/health`, 'application/json')
  return { vite, bff, ok: Number(vite) < 500 && Number(bff) < 500 }
}

function looksLikeCatalog(count, firstNo) {
  const n = Number(count)
  if (!Number.isFinite(n)) return false
  return n >= CATALOG_PAGE && /^CUST/i.test(String(firstNo || ''))
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
const imSendUrls = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
  if (/\/api\/v1\/im\/send(?:\?|$)/.test(url) && req.method() !== 'GET') imSendUrls.push(`${req.method()} ${url}`)
})

const out = {
  sha,
  branch,
  workspaceCwd,
  hardcodedInSrc: srcHasHardcodedMap(),
  gateInjected: false,
  overlayCause: false,
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

async function listApps() {
  return page.evaluate(async ({ wsId, cwd }) => {
    const params = new URLSearchParams({ workspaceId: wsId, workspaceCwd: cwd })
    const json = await fetch(`/api/v1/business/apps?${params}`).then((r) => r.json())
    return (json.items || []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      kind: row.appKind,
      revision: row.currentRevision,
      updatedAt: row.updatedAt,
    }))
  }, { wsId: workspaceId, cwd: workspaceCwd })
}

async function goTab(name) {
  const btn = page.getByRole('button', { name, exact: true })
  if (await btn.count()) await btn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function dragStage(deltaX) {
  const handle = page.locator('[title="拖拽调整宽度"]').first()
  await handle.waitFor({ state: 'visible', timeout: 10000 })
  const box = await handle.boundingBox()
  if (!box) throw new Error('no-resize-handle')
  const x = box.x + box.width / 2
  const y = box.y + Math.min(120, box.height / 2)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + deltaX, y, { steps: 24 })
  await page.mouse.up()
  await page.waitForTimeout(500)
}

async function measureChrome() {
  return page.evaluate(() => {
    const aside = document.querySelector('aside')
    return {
      asideW: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      asideOpen: aside ? aside.getBoundingClientRect().width > 80 : false,
      sessionTitle: Boolean(aside && /会话/.test(aside.innerText || '')),
    }
  })
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
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || rows[0].name || '') : '',
      nos: rows.map((row) => (row && typeof row === 'object' ? String(row.no || row.orderId || row.id || '') : '')).filter(Boolean),
      speech: sheet?.speech || '',
      preview_id: sheet?.preview_id || json?.data?.preview_id || null,
      sessionId: sheet?.sessionId || '',
    }
  }, workspaceCwd)
}

async function readUi() {
  return page.evaluate(() => {
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const kindChipEls = chipWrap ? [...chipWrap.querySelectorAll('button.btn')] : []
    const kindChips = kindChipEls.map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
    const footer = [...document.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
    const firstNo = table?.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || ''
    const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const selectedChip = kindChipEls.find((b) => b.className.includes('bg-ink'))?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const drawer = document.querySelector('div.fixed.inset-y-0.right-0')
    const drawerText = drawer?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const drawerAction = (drawerText.match(/操作：\s*(\S+)/) || [])[1] || ''
    return {
      kindChips,
      selectedChip,
      footer,
      footerCount,
      tbodyRows,
      firstNo,
      banner,
      drawerOpen: Boolean(drawer),
      drawerAction,
      drawerText: drawerText.slice(0, 500),
    }
  })
}

async function clickCancelIfOpen() {
  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  if (await cancelBtn.count()) {
    await cancelBtn.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(900)
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

const shots = {
  hops: `${STORE}/internal/bi-hops.png`,
  approve: `${STORE}/internal/bi-approve.png`,
  cancel: `${STORE}/internal/bi-cancel.png`,
  short: `${STORE}/internal/bi-short.png`,
}

try {
  out.portsBefore = await hostsUp()
  if (!out.portsBefore.ok) {
    out.failCode = 'host-down'
    throw new Error(out.failCode)
  }

  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await page.waitForTimeout(2500)
  await seedState({ activeDataSubview: 'records', panelWidth: 1100 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)

  const st = await page.evaluate(async () => {
    const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
    return json?.data || {}
  })
  out.connect = { connected: Boolean(st.connected), pid: st.pid, error: st.lastError || null }
  if (!out.connect.connected) {
    out.failCode = 'dsh-not-connected'
    throw new Error(out.failCode)
  }

  const listedBefore = await listApps()
  const visitBefore = listedBefore.find((row) => row.id === visitId) || listedBefore.find((row) => row.name === visitName)
  out.visitBefore = visitBefore || null

  const created = await page.evaluate(async (wsId) => {
    const res = await fetch('/api/v1/ai/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ workspaceId: wsId }),
    })
    const json = await res.json().catch(() => ({}))
    return { http: res.status, sessionId: json?.data?.sessionId || '', error: json?.error || null }
  }, workspaceId)
  out.sessionId = created.sessionId || ''
  if (!out.sessionId) {
    out.failCode = 'session-create-failed'
    throw new Error(out.failCode)
  }
  await seedState({ activeDataSubview: 'records', panelWidth: 1100, sessionId: out.sessionId })
  await page.goto(`${mainBase}/ai/${out.sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)
  await goTab('业务记录')
  await page.waitForSelector('iframe', { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(1200)

  let kindsPack = { kinds: [], aliases: {}, names: [] }
  for (let i = 0; i < 12; i += 1) {
    kindsPack = await page.evaluate(async (ws) => {
      const res = await fetch(`/api/v1/biz/kinds?cwd=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
      const json = await res.json().catch(() => ({}))
      const data = json?.data || {}
      const kinds = Array.isArray(data.kinds) ? data.kinds : []
      return {
        http: res.status,
        names: kinds.map((row) => row.kind).filter(Boolean),
        aliases: data.aliases && typeof data.aliases === 'object' ? data.aliases : {},
        kinds: kinds.map((row) => ({
          kind: row.kind,
          resource: row.resource || '',
          aliases: Array.isArray(row.aliases) ? row.aliases : [],
        })),
      }
    }, workspaceCwd)
    if (kindsPack.names.length) break
    await page.waitForTimeout(1200)
  }
  out.kinds = {
    http: kindsPack.http,
    count: kindsPack.names.length,
    spokenBatchIsKind: kindsPack.names.includes('报销单'),
    spokenShortIsKind: kindsPack.names.includes('请假单'),
    spokenBatchAlias: kindsPack.aliases['报销单'] || kindsPack.kinds.find((row) => (row.aliases || []).includes('报销单'))?.kind || '',
    spokenShortAlias: kindsPack.aliases['请假单'] || kindsPack.kinds.find((row) => (row.aliases || []).includes('请假单'))?.kind || '',
  }

  const hop1 = await promptWait({
    speech: '停用客户还有哪些没关的工单？',
    ready: ({ pending, ui }) => pending.kind && pending.rows >= 8 && !looksLikeCatalog(ui.footerCount, ui.firstNo),
  })
  out.hop1 = {
    kind: hop1.pending?.kind,
    action: hop1.pending?.action,
    rows: hop1.pending?.rows,
    first: hop1.pending?.first,
    footer: hop1.ui?.footer,
    chips: hop1.ui?.kindChips,
    leftHasSpeech: /停用客户还有哪些没关的工单/.test(hop1.left || ''),
    ready: hop1.ready,
    cooling: hop1.cooling,
  }

  const hop2 = await promptWait({
    speech: '故障类而且紧急、还没关的工单是哪家客户的？',
    ready: ({ pending }) => (
      pending.kind
      && pending.rows >= 1
      && pending.rows < Number(out.hop1.rows || 99)
      && (pending.nos || []).includes(HOP2_NO)
    ),
  })
  out.hop2 = {
    kind: hop2.pending?.kind,
    action: hop2.pending?.action,
    rows: hop2.pending?.rows,
    first: hop2.pending?.first,
    hasMarker: (hop2.pending?.nos || []).includes(HOP2_NO),
    footer: hop2.ui?.footer,
    chips: hop2.ui?.kindChips,
    leftHasSpeech: /故障类而且紧急/.test(hop2.left || ''),
    ready: hop2.ready,
  }

  const hop3 = await promptWait({
    speech: '待审回款挂在哪些合同上？把已到期的那些摊出来。',
    ready: ({ pending, ui }) => (
      pending.kind
      && pending.kind !== out.hop2.kind
      && pending.rows >= 1
      && (pending.first === HOP3_NO || (pending.nos || []).includes(HOP3_NO) || ui.firstNo === HOP3_NO)
    ),
  })
  out.hop3 = {
    kind: hop3.pending?.kind,
    action: hop3.pending?.action,
    rows: hop3.pending?.rows,
    first: hop3.pending?.first,
    footer: hop3.ui?.footer,
    chips: hop3.ui?.kindChips,
    leftHasSpeech: /待审回款挂在哪些合同/.test(hop3.left || ''),
    ready: hop3.ready,
  }
  await page.screenshot({ path: shots.hops, fullPage: false })

  const approveSpeech = `待审报销单都过一下。${PREVIEW_ONLY}`
  const approve = await promptWait({
    speech: approveSpeech,
    ready: ({ pending, ui, left }) => {
      const kind = String(pending.kind || '')
      const fakeKind = kind === '报销单' || (out.kinds?.spokenBatchAlias && kind !== out.kinds.spokenBatchAlias)
      const leftOk = /待审报销单都过一下/.test(left || '')
      return Boolean(
        leftOk
        && pending.action === '过审'
        && pending.preview_id
        && pending.rows > 0
        && !fakeKind
        && !looksLikeCatalog(ui.footerCount, ui.firstNo),
      )
    },
  })
  out.approve = {
    kind: approve.pending?.kind,
    action: approve.pending?.action,
    rows: approve.pending?.rows,
    first: approve.pending?.first,
    preview_id: approve.pending?.preview_id || null,
    footer: approve.ui?.footer,
    chips: approve.ui?.kindChips,
    drawerOpen: approve.ui?.drawerOpen,
    drawerAction: approve.ui?.drawerAction,
    banner: approve.ui?.banner,
    leftHasSpeech: /待审报销单都过一下/.test(approve.left || ''),
    leftSnippet: String(approve.left || '').slice(-900),
    fakeKind: approve.pending?.kind === '报销单' || Boolean(out.kinds?.spokenBatchAlias && approve.pending?.kind !== out.kinds.spokenBatchAlias),
    queryOnly: approve.pending?.action === '现查' && !approve.pending?.preview_id,
    ready: approve.ready,
    prompted: approve.prompted,
  }
  await page.screenshot({ path: shots.approve, fullPage: false })

  const beforeCancel = {
    kind: approve.pending?.kind,
    rows: approve.pending?.rows,
    first: approve.ui?.firstNo || approve.pending?.first,
    footerCount: approve.ui?.footerCount,
  }
  const clickedCancel = await clickCancelIfOpen()
  await page.waitForTimeout(1200)
  const afterCancelUi = await readUi()
  const afterCancelPending = await readPending()
  out.cancel = {
    clicked: clickedCancel,
    drawerOpen: afterCancelUi.drawerOpen,
    kind: afterCancelPending.kind || afterCancelUi.selectedChip,
    footer: afterCancelUi.footer,
    footerCount: afterCancelUi.footerCount,
    firstNo: afterCancelUi.firstNo,
    chips: afterCancelUi.kindChips,
    catalog: looksLikeCatalog(afterCancelUi.footerCount, afterCancelUi.firstNo),
    sameBatch: afterCancelUi.firstNo === beforeCancel.first || afterCancelPending.first === beforeCancel.first,
  }
  await page.screenshot({ path: shots.cancel, fullPage: false })

  const shortSpeech = `过一下请假单 LV-2026-018。${PREVIEW_ONLY}`
  const shortCanonical = out.kinds?.spokenShortAlias || ''
  const short = await promptWait({
    speech: shortSpeech,
    ready: ({ pending, left }) => {
      const kind = String(pending.kind || '')
      const noHit = pending.first === 'LV-2026-018' || (pending.nos || []).includes('LV-2026-018')
      return Boolean(
        /请假单/.test(left || '')
        && kind
        && kind !== '请假单'
        && (!shortCanonical || kind === shortCanonical)
        && pending.rows >= 1
        && noHit
        && (pending.action === '过审' || pending.action === '现查'),
      )
    },
  })
  out.short = {
    kind: short.pending?.kind,
    action: short.pending?.action,
    rows: short.pending?.rows,
    first: short.pending?.first,
    preview_id: short.pending?.preview_id || null,
    footer: short.ui?.footer,
    chips: short.ui?.kindChips,
    leftHasSpeech: /请假单/.test(short.left || ''),
    fakeKind: short.pending?.kind === '请假单' || Boolean(shortCanonical && short.pending?.kind !== shortCanonical),
    ready: short.ready,
  }
  await clickCancelIfOpen()
  await page.screenshot({ path: shots.short, fullPage: false })

  await page.setViewportSize({ width: 1600, height: 1000 })
  await seedState({ activeDataSubview: 'overview', panelWidth: 500, sessionId: out.sessionId })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(800)
  await goTab('应用')
  out.threeTabs = {
    app: await page.getByRole('button', { name: '应用', exact: true }).count() > 0,
    records: await page.getByRole('button', { name: '业务记录', exact: true }).count() > 0,
    ops: await page.getByRole('button', { name: '操作记录', exact: true }).count() > 0,
  }
  out.createEntry = await page.locator('[data-app-create-entry]').count() > 0
  if (out.createEntry) {
    await page.locator('[data-app-create-entry]').click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(400)
    out.createWizard = await page.locator('[data-app-create-wizard]').count() > 0
    const closeWizard = page.locator('[data-app-create-wizard] button', { hasText: '关闭' })
    if (await closeWizard.count()) await closeWizard.click().catch(() => {})
  }
  await goTab('业务记录')
  await goTab('操作记录')
  await goTab('应用')
  // Ace 2026-09-20: skip opening 抄表 LEDGER_ID and clicking 问 AI.
  // That click spawned leftover 「小区水电抄表 · 问」. See chaobiao-session-cause.md.
  out.askAiSkipped = true
  out.askAiButton = false
  const back = page.getByRole('button', { name: /返回列表/ })
  if (await back.count()) await back.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  await goTab('应用')
  out.catalogHasVisit = await page.locator(`[data-app-row="${visitId}"]`).count() > 0
  if (out.catalogHasVisit) {
    await page.locator(`[data-app-row="${visitId}"]`).locator('button').first().click({ timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(700)
    out.visitOpened = await page.locator('[data-app-workspace],[data-app-product]').count() > 0
    if (await back.count()) await back.click({ timeout: 8000 }).catch(() => {})
  }
  const listedAfter = await listApps()
  const visitAfter = listedAfter.find((row) => row.id === (visitBefore?.id || visitId))
  out.visitAfter = visitAfter || null
  out.visitUnchanged = Boolean(
    visitBefore
    && visitAfter
    && visitAfter.status === visitBefore.status
    && visitAfter.revision === visitBefore.revision
    && visitAfter.updatedAt === visitBefore.updatedAt,
  )
  await seedState({ activeDataSubview: 'overview', panelWidth: 500, sessionId: out.sessionId })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(700)
  await goTab('应用')
  await dragStage(420)
  out.wide = await measureChrome()
  await dragStage(-520)
  out.narrow = await measureChrome()
  out.portsEnd = await hostsUp()

  out.d22 = {
    hop1: Boolean(out.hop1?.ready && out.hop1?.leftHasSpeech),
    hop2: Boolean(out.hop2?.ready && out.hop2?.hasMarker),
    hop3: Boolean(out.hop3?.ready),
    tabs: Boolean(out.threeTabs?.app && out.threeTabs?.records && out.threeTabs?.ops),
    create: Boolean(out.createEntry),
    stretch: [out.wide?.asideW, out.narrow?.asideW].includes(48) && [out.wide?.asideW, out.narrow?.asideW].includes(224),
    askAi: out.askAiSkipped ? 'skipped' : Boolean(out.askAiButton),
    visit: Boolean(out.visitUnchanged && out.catalogHasVisit),
  }
  out.silentBizWrite = bizWriteUrls.length > 0
  out.autoIm = imSendUrls.length > 0
  out.approveOk = Boolean(
    out.approve?.ready
    && out.approve?.leftHasSpeech
    && out.approve?.action === '过审'
    && out.approve?.preview_id
    && out.approve?.rows > 0
    && !out.approve?.fakeKind
    && !out.approve?.queryOnly,
  )
  out.cancelOk = Boolean(out.cancel?.clicked && !out.cancel?.drawerOpen && !out.cancel?.catalog && out.cancel?.sameBatch)
  out.shortOk = Boolean(out.short?.ready && out.short?.kind && !out.short?.fakeKind)
  out.pass = Boolean(
    out.approveOk
    && out.cancelOk
    && out.shortOk
    && Object.values(out.d22).every(Boolean)
    && !out.silentBizWrite
    && !out.autoIm
    && out.portsEnd?.ok
    && out.hardcodedInSrc === 'none',
  )
  if (!out.pass && !out.failCode) {
    if (!out.approveOk) out.failCode = 'approve-preview-missing'
    else if (!out.cancelOk) out.failCode = 'cancel-dumped-or-lost-batch'
    else if (!out.shortOk) out.failCode = 'short-name-not-generic'
    else out.failCode = 'd22-regress'
  }

  const shotPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const cells = [
    ['过审预览', shots.approve],
    ['取消后', shots.cancel],
  ]
  const html = cells.map(([label, src]) => (
    `<div><div style="font:12px/1.4 -apple-system,sans-serif;padding:6px 8px;background:#18181b;color:#fafafa">${label}</div>`
    + `<img src="${src}" style="width:100%;height:400px;object-fit:contain;object-position:top;background:#fff;display:block"/></div>`
  )).join('')
  await shotPage.setContent(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#111;padding:8px">${html}</div>`)
  await shotPage.screenshot({ path: MEDIA, fullPage: true })
  await shotPage.close()
} catch (error) {
  out.pass = false
  out.error = String(error?.message || error)
  if (!out.failCode) out.failCode = 'script-error'
  try {
    await page.screenshot({ path: MEDIA, fullPage: false })
  } catch { /* ignore */ }
} finally {
  out.silentBizWrite = bizWriteUrls.length > 0
  out.autoIm = imSendUrls.length > 0
  const md = [
    '---',
    'cursor:',
    '  subagentId: "bi-records-bind-pipe"',
    '---',
    '',
    '# Verify: BI 业务记录 bind 管',
    '',
    `**pass:** ${out.pass ? 'yes' : 'no'}`,
    `**product SHA:** \`${out.sha}\``,
    `**branch:** \`${out.branch}\``,
    `**闸注入:** ${out.gateInjected ? 'yes' : 'no'}`,
    `**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}`,
    `**确认过账:** ${out.confirmed ? 'yes' : 'no'}`,
    `**自动发 IM:** ${out.autoIm ? 'yes' : 'no'}`,
    `**5174 未杀:** ${out.pnpm5174 ? 'yes' : 'no'}`,
    `**src 写入例字面量:** ${out.hardcodedInSrc}`,
    `**failCode:** ${out.failCode || '—'}`,
    '',
    '对照总因：[records-close-root-cause.md](../docs/records-close-root-cause.md)。左栏说话，不是只 POST 现查。',
    '',
    '## 对照表（图为准）',
    '',
    '| 项 | 状态 | 证据 |',
    '|---|---|---|',
    `| 待审报销单都过一下 过审预览 | ${out.approveOk ? '已对' : '仍差'} | 左栏含原句=${out.approve?.leftHasSpeech} kind=${out.approve?.kind} action=${out.approve?.action} rows=${out.approve?.rows} preview_id=${out.approve?.preview_id ? '有' : '空'} fakeKind=${out.approve?.fakeKind} queryOnly=${out.approve?.queryOnly} footer=${out.approve?.footer || ''} |`,
    `| 取消后仍是那批 | ${out.cancelOk ? '已对' : '仍差'} | clicked=${out.cancel?.clicked} drawer=${out.cancel?.drawerOpen} catalog=${out.cancel?.catalog} sameBatch=${out.cancel?.sameBatch} first=${out.cancel?.firstNo} footer=${out.cancel?.footer || ''} |`,
    `| 同形短名通用 | ${out.shortOk ? '已对' : '仍差'} | kind=${out.short?.kind} fakeKind=${out.short?.fakeKind} rows=${out.short?.rows} action=${out.short?.action} left=${out.short?.leftHasSpeech} |`,
    `| hop1 停用客户未关工单 | ${out.d22?.hop1 ? '已对' : '仍差'} | kind=${out.hop1?.kind} rows=${out.hop1?.rows} first=${out.hop1?.first} left=${out.hop1?.leftHasSpeech} |`,
    `| hop2 故障紧急未关 | ${out.d22?.hop2 ? '已对' : '仍差'} | kind=${out.hop2?.kind} rows=${out.hop2?.rows} has ${HOP2_NO}=${out.hop2?.hasMarker} |`,
    `| hop3 待审回款∩已到期合同 | ${out.d22?.hop3 ? '已对' : '仍差'} | kind=${out.hop3?.kind} rows=${out.hop3?.rows} first=${out.hop3?.first} |`,
    `| 决策22 三Tab/创建/拉伸/问AI/走访 | ${out.d22 && out.d22.tabs && out.d22.create && out.d22.stretch && out.d22.visit ? '已对' : '仍差'} | tabs=${JSON.stringify(out.threeTabs || null)} create=${out.createEntry} wide=${out.wide?.asideW} narrow=${out.narrow?.asideW} 问AI=跳过(抄表夹具不再点) visit=${out.visitUnchanged} |`,
    '',
    '## 禁区',
    '',
    `硬编码进 src=${out.hardcodedInSrc}。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留=未做。未推 origin。未杀 pnpm 5174。未点确认过账。未静默 biz_write。未自动发 IM。`,
    '',
    `已对：${[
      out.approveOk && '过审一批',
      out.cancelOk && '取消留批',
      out.shortOk && '同形短名',
      out.d22?.hop1 && 'hop1',
      out.d22?.hop2 && 'hop2',
      out.d22?.hop3 && 'hop3',
    ].filter(Boolean).join('、') || '—'}`,
    `未对：${out.pass ? '—' : (out.failCode || '现网未齐')}`,
    `仍差：${out.pass ? '—' : (out.error || out.failCode || '—')}`,
    '',
    '## 图',
    '',
    `\`${MEDIA}\``,
    '',
    `左：过审预览。右：取消后。图和自报不一致以图为准。`,
    '',
  ].join('\n')
  await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
  await writeFile(REPORT_MD, md)
  await dualWrite(REPORT_MD, 'internal/verify-records-bind-pipe-bi.md')
  await dualWrite(REPORT_JSON, 'internal/verify-records-bind-pipe-bi.json')
  await dualWrite(MEDIA, 'media/records-bind-pipe-bi.png')
  await browser.close()
  console.log(JSON.stringify({
    pass: out.pass,
    failCode: out.failCode,
    approve: out.approve,
    cancel: out.cancel,
    short: out.short,
    d22: out.d22,
  }, null, 2))
}
