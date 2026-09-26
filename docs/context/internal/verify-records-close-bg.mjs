/**
 * BG live close-out: Ace's 10 spoken examples, in order, with BF on main.
 * 1–3 must not regress: case 2 is the ~8-row 故障+紧急未关 batch (incl. TK20260105702),
 * not 0, not case 1's ~21, no 「哪一档」. Case 3 switches to pending 回款.
 * Case 4: stop on hits, pick, then 改行; quiz must close. 1/5 stay batches.
 * 5–10, cancel, history, session switch, Decision 22 all live. Fail = stop.
 * Do not hardcode which hit to pick. Do not copy examples into src/.
 * Preview only; never 确认过账 / biz_write / IM send.
 * Do not kill pnpm 5174. Do not edit 走访. Do not push origin. Do not git add -A.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'
import {
  kindMentions,
  relatedMentionedKinds,
} from '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/vendor-overlays/dsh-lan-assist/slots.js'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-close-bg.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-bg.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-bg.md`
const BIZ_ROW_MARKER = 'TK20260105702'
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

const CASES = [
  { n: 1, want: '现查', speech: '停用客户还有哪些没关的工单？' },
  { n: 2, want: '现查', speech: '故障类而且紧急、还没关的工单是哪家客户的？' },
  { n: 3, want: '现查', speech: '待审回款挂在哪些合同上？把已到期的那些摊出来。' },
  { n: 4, want: '改行', write: true, speech: `把停用客户恒通改成成交。${PREVIEW_ONLY}` },
  { n: 5, want: '过审', write: true, speech: `待审报销单都过一下。${PREVIEW_ONLY}` },
  { n: 6, want: '过审', write: true, speech: `过一下请假单 LV-2026-018。${PREVIEW_ONLY}` },
  { n: 7, want: '改行', write: true, speech: `把武汉云启那张紧急工单改成已解决。${PREVIEW_ONLY}` },
  { n: 8, want: '现查', speech: '昆明精密机电还有哪些待审采购单？' },
  {
    n: 9,
    want: '过审',
    write: true,
    queryThenWrite: true,
    querySpeech: '产假那张待审请假单是谁请的？',
    speech: `产假那张待审请假单是谁请的？过一下。${PREVIEW_ONLY}`,
  },
  {
    n: 10,
    want: '改行',
    write: true,
    queryThenWrite: true,
    querySpeech: '东莞联创到期合同下还有哪些待审回款？',
    speech: `东莞联创到期合同下还有哪些待审回款？把备注改成催收。${PREVIEW_ONLY}`,
  },
]

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

function coolingIn(text) {
  return /429|RATE_LIMIT|rate.?limit|upstream_cooling|上游账号正在冷却|可用账号正在冷却/i.test(String(text || ''))
}

function hoppedOf(sheet) {
  const from = sheet?.from && typeof sheet.from === 'object' ? sheet.from : null
  const hopWhere = Array.isArray(sheet?.hopWhere) ? sheet.hopWhere : []
  const steps = Array.isArray(sheet?.steps) ? sheet.steps : []
  return Boolean((from && from.kind) || hopWhere.length || steps.length > 1)
}

function hopMeta(sheet) {
  const from = sheet?.from && typeof sheet.from === 'object' ? sheet.from : null
  const hopWhereRaw = sheet?.hopWhere
  const hopWhere = Array.isArray(hopWhereRaw) ? hopWhereRaw : []
  const steps = Array.isArray(sheet?.steps) ? sheet.steps : []
  return {
    hop: hoppedOf(sheet),
    fromKind: from?.kind ? String(from.kind) : '',
    fromRows: from && Array.isArray(from.rows) ? from.rows.length : 0,
    fromFirst: from && Array.isArray(from.rows) && from.rows[0]
      ? String(from.rows[0].no || from.rows[0].orderId || from.rows[0].id || '')
      : '',
    hopWhere: Array.isArray(hopWhereRaw) ? hopWhere.length > 0 : Boolean(hopWhereRaw),
    steps: steps.map((row) => String(row?.kind || row || '')).filter(Boolean),
  }
}

function looksLikeCatalog(hitCount, shownCount) {
  const hit = Number(hitCount)
  const shown = Number(shownCount)
  if (!Number.isFinite(shown)) return false
  if (shown === CATALOG_PAGE && (!Number.isFinite(hit) || shown !== hit)) return true
  if (Number.isFinite(hit) && hit <= 3 && shown >= 8) return true
  if (Number.isFinite(hit) && shown >= hit * 3 && shown >= 8) return true
  return false
}

function parseChip(text, kinds) {
  const raw = String(text || '').replace(/\s+/g, '')
  const kind = [...kinds].sort((a, b) => b.length - a.length).find((name) => raw.startsWith(String(name).replace(/\s+/g, ''))) || ''
  const count = Number((raw.match(/(\d+)$/) || [])[1] || NaN)
  return { kind, count, text: String(text || '').trim() }
}

function drawerShowsAction(ui, action) {
  const text = String(ui?.drawerText || '')
  if (!ui?.drawerOpen) return false
  return text.includes(`操作：${action}`) || text.includes(`${action}确认`)
}

function sameSheet(ui, pending) {
  const footer = Number(ui?.footerCount)
  const tbody = Number(ui?.tbodyRows)
  const rows = Number(pending?.rows)
  const firstUi = String(ui?.firstNo || '')
  const firstPending = String(pending?.first || '')
  if (!Number.isFinite(footer) || !Number.isFinite(tbody) || !Number.isFinite(rows) || rows <= 0) return false
  if (footer !== rows) return false
  if (tbody <= 0 || tbody > rows) return false
  if (rows <= 10 && tbody !== rows) return false
  if (!firstUi || !firstPending || firstUi !== firstPending) return false
  return true
}

function hasFieldDiffs(ui, pending) {
  const payload = (pending?.changes || []).filter((row) => row && String(row.from) !== String(row.to))
  const blocks = (ui?.changeBlocks || []).filter((row) => row.arrow)
  return payload.length > 0 || blocks.length > 0
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

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const caseShots = CASES.map((row) => `${STORE}/internal/bg-case-${String(row.n).padStart(2, '0')}.png`)
const extraShots = {
  cancel: `${STORE}/internal/bg-cancel.png`,
  history: `${STORE}/internal/bg-history.png`,
  session: `${STORE}/internal/bg-session.png`,
  case4hits: `${STORE}/internal/bg-case-04-hits.png`,
}

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
  hardcodedInSrc: 'none',
  workspaceCwd,
  gateInjected: false,
  wrote: false,
  confirmed: false,
  silentBizWrite: false,
  originPushed: false,
  pnpm5174: true,
  cases: [],
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

async function stitchShots(labels) {
  const files = [...caseShots]
  const imgs = []
  for (const file of files) {
    if (!existsSync(file)) continue
    const buf = await readFile(file)
    imgs.push(`data:image/png;base64,${buf.toString('base64')}`)
  }
  const shot = await browser.newPage({ viewport: { width: 1800, height: 2200 } })
  const cells = imgs.map((src, i) => (
    `<div style="background:#fff;border:1px solid #d4d4d8;overflow:hidden">`
    + `<div style="font:12px/1.4 -apple-system,sans-serif;padding:6px 8px;background:#18181b;color:#fafafa">${labels[i] || ''}</div>`
    + `<img src="${src}" style="width:100%;height:360px;object-fit:contain;object-position:top;background:#fff;display:block"/>`
    + `</div>`
  )).join('')
  await shot.setContent(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#111;padding:8px">${cells}</div>`)
  await shot.screenshot({ path: MEDIA, fullPage: true })
  await shot.close()
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
  await page.waitForTimeout(1000)

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
  out.localAppNames = listedBefore.map((row) => row.name).filter(Boolean)

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
  await page.waitForTimeout(1500)

  const sessionGet = await page.evaluate(async (sid) => {
    const res = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sid)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    return { http: res.status, code: json?.error?.code || '', message: json?.error?.message || '', id: json?.data?.sessionId || '' }
  }, out.sessionId)
  out.sessionGet = sessionGet
  if (sessionGet.http === 404 && /接口不存在/.test(sessionGet.message)) {
    out.failCode = 'session-get-not-found-interface'
    throw new Error(out.failCode)
  }

  const kindsPack = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || {}
    return {
      kinds: Array.isArray(data.kinds) ? data.kinds.map((row) => ({
        kind: String(row?.kind || ''),
        can: Array.isArray(row?.can) ? row.can : [],
        fields: Array.isArray(row?.fields) ? row.fields : [],
      })) : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  }, workspaceCwd)
  const vocabRows = kindsPack.kinds
  const labels = vocabRows.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }

  async function iframeBlob() {
    const bits = []
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue
      try {
        const text = await frame.evaluate(() => document.body?.innerText || '')
        if (text) bits.push(text.replace(/\s+/g, ' ').trim())
      } catch {
        /* cross-origin */
      }
    }
    return bits.join('\n')
  }

  function isAskBlocking(text) {
    const blob = String(text || '')
    if (!blob) return false
    if (/等待回答/.test(blob) && (/跳过本题/.test(blob) || /提交/.test(blob))) return true
    if (/提问/.test(blob) && /深度求索中/.test(blob) && /跳过本题/.test(blob)) return true
    return false
  }

  async function waitAskClosed(ms = 20000) {
    const deadline = Date.now() + ms
    let last = ''
    while (Date.now() < deadline) {
      last = await iframeBlob()
      const thinking = /深度求索中/.test(last.slice(-800))
      if (!isAskBlocking(last) && !thinking) {
        return { closed: true, thinking: false, left: last.slice(-900) }
      }
      await page.waitForTimeout(700)
    }
    return { closed: !isAskBlocking(last), thinking: /深度求索中/.test(String(last).slice(-800)), left: String(last).slice(-900) }
  }

  async function recentTools() {
    return page.evaluate(async ({ ws, sid }) => {
      const res = await fetch(`/api/v1/events/recent?workspace=${encodeURIComponent(ws)}&limit=200`, { headers: { accept: 'application/json' } })
      const json = await res.json().catch(() => ({}))
      const items = Array.isArray(json?.items) ? json.items : []
      return items
        .filter((row) => !sid || row.sessionId === sid || !row.sessionId)
        .filter((row) => row.type === 'ai.tool.called' || row.type === 'ai.tool.finished' || row.type === 'biz.sheet.pending')
        .map((row) => ({
          type: row.type,
          tool: row.payload?.tool || '',
          action: row.payload?.action || row.payload?.sheet?.action || '',
        }))
    }, { ws: workspaceCwd, sid: out.sessionId })
  }

  async function readPending() {
    return page.evaluate(async (ws) => {
      const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
      const json = await res.json().catch(() => ({}))
      const sheet = json?.data?.sheet || json?.data || null
      const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
      const from = sheet?.from && typeof sheet.from === 'object' ? sheet.from : null
      const fromRows = from && Array.isArray(from.rows) ? from.rows : []
      return {
        kind: sheet?.kind || null,
        action: sheet?.action || null,
        rows: rows.length,
        first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || rows[0].name || '') : '',
        fromKind: from?.kind || '',
        fromRows: fromRows.length,
        fromFirst: fromRows[0] && typeof fromRows[0] === 'object' ? String(fromRows[0].no || fromRows[0].orderId || fromRows[0].id || '') : '',
        fromHasRows: Boolean(from && Array.isArray(from.rows)),
        fromNos: fromRows.map((row) => (row && typeof row === 'object' ? String(row.no || row.orderId || row.id || row.name || '') : '')).filter(Boolean),
        hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
        steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind || row).filter(Boolean) : [],
        speech: sheet?.speech || '',
        preview_id: sheet?.preview_id || json?.data?.preview_id || null,
        sessionId: sheet?.sessionId || '',
        changes: Array.isArray(sheet?.changes) ? sheet.changes : [],
        where: Array.isArray(sheet?.where) ? sheet.where : [],
        listed: Boolean(sheet?.listed),
        ambiguous: Boolean(sheet?.ambiguous),
        nos: rows.map((row) => (row && typeof row === 'object' ? String(row.no || row.orderId || row.id || '') : '')).filter(Boolean),
      }
    }, workspaceCwd)
  }

  async function readUi() {
    return page.evaluate((kinds) => {
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
      const connectorLabel = [...document.querySelectorAll('label')].find((el) => (el.textContent || '').includes('连接器'))
      const connectorSelect = connectorLabel?.querySelector('select')
      const history = [...document.querySelectorAll('select')].find((el) => (
        [...el.querySelectorAll('option')].some((o) => (o.textContent || '').includes('本会话浮现历史'))
      ))
      const historyOptions = history
        ? [...history.querySelectorAll('option')].map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
        : []
      const drawer = document.querySelector('div.fixed.inset-y-0.right-0')
      const drawerText = drawer?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const drawerAction = (drawerText.match(/操作：\s*(\S+)/) || [])[1] || ''
      const emptyHint = drawerText.includes('没有可展示的变更内容')
      const changeBlocks = drawer
        ? [...drawer.querySelectorAll('div.border.border-line.divide-y > div')].map((block) => {
          const label = block.querySelector('div.text-xs')?.textContent?.trim() || ''
          const line = block.textContent?.replace(/\s+/g, ' ').trim() || ''
          return { label, line, arrow: line.includes('→') }
        }).filter((row) => row.label || row.arrow)
        : []
      return {
        kindChips,
        selectedChip,
        footer,
        footerCount,
        tbodyRows,
        firstNo,
        banner,
        kinds,
        connectorSeparate: Boolean(connectorSelect) || !connectorLabel,
        historyValue: history ? String(history.value || '') : '',
        historyOptions,
        drawerOpen: Boolean(drawer),
        drawerAction,
        drawerText: drawerText.slice(0, 700),
        emptyHint,
        changeBlocks,
        crashJson: /接口不存在|{"error":\{"code":"not_found"/.test(document.body?.innerText || ''),
      }
    }, labels)
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

  async function dismissAskCard() {
    const clickSkip = async (root) => {
      const names = ['跳过本题', '跳过本轮', '跳过']
      for (const name of names) {
        const btn = root.getByRole('button', { name, exact: name !== '跳过' })
        if (await btn.count()) {
          await btn.first().click({ timeout: 4000 }).catch(() => {})
          await page.waitForTimeout(700)
          return true
        }
      }
      return false
    }
    if (await clickSkip(page)) return true
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue
      try {
        if (await clickSkip(frame)) return true
      } catch {
        /* cross-origin */
      }
    }
    return false
  }

  function hopNeedFor(speech) {
    const related = relatedMentionedKinds(speech, vocabRows, bag).related
    return { related, need: related.length >= 2 }
  }

  function pendingIdentity(p) {
    return JSON.stringify({
      sessionId: String(p?.sessionId || ''),
      speech: String(p?.speech || ''),
      kind: String(p?.kind || ''),
      action: String(p?.action || ''),
      first: String(p?.first || ''),
      rows: Number(p?.rows || 0),
      preview_id: String(p?.preview_id || ''),
    })
  }

  function thisTurnPending(pending, beforeId) {
    if (pending?.sessionId && out.sessionId && pending.sessionId !== out.sessionId) return false
    return pendingIdentity(pending) !== beforeId
  }

  function isCatalogDump(pending, ui) {
    const shown = Number(ui?.tbodyRows || pending?.rows || 0)
    const hit = Number(pending?.rows || 0)
    return looksLikeCatalog(hit, shown) || shown >= CATALOG_PAGE || hit >= CATALOG_PAGE
  }

  function isWaitingPick(pending, ui) {
    const pid = String(pending?.preview_id || '')
    const rows = Number(pending?.rows || 0)
    if (pid || rows <= 1 || isCatalogDump(pending, ui) || ui?.drawerOpen || !sameSheet(ui, pending)) return false
    if (pending?.listed || pending?.ambiguous) return true
    const act = String(pending?.action || '')
    return act === '改行' || act === '过审' || act === '删除'
  }

  function isSingleMatchWrite(pending, ui, want) {
    const pid = String(pending?.preview_id || '')
    const rows = Number(pending?.rows || 0)
    if (!pid || rows !== 1) return false
    if (pending?.listed || pending?.ambiguous) return false
    if (isCatalogDump(pending, ui)) return false
    return drawerShowsAction(ui, want) && sameSheet(ui, pending)
  }

  function prematureWriteCode(pending, ui) {
    const pid = String(pending?.preview_id || '')
    const rows = Number(pending?.rows || 0)
    if (isCatalogDump(pending, ui)) return `catalog-dump(rows=${rows},tbody=${ui?.tbodyRows})`
    if (pid && rows > 1) return `whole-set-write(rows=${rows})`
    if (rows > 1 && ui?.drawerOpen && (pid || drawerShowsAction(ui, '改行') || drawerShowsAction(ui, '过审'))) {
      return `preview-before-pick(action=${ui.drawerAction || ''},rows=${rows})`
    }
    return ''
  }

  async function actionReady(want, pending, ui, { write = false, hopNeed = false, pickThenWrite = false } = {}) {
    if (String(pending.action || '') !== want) return false
    if (hopNeed && !hoppedOf(pending)) return false
    if (pickThenWrite) return isWaitingPick(pending, ui) || isSingleMatchWrite(pending, ui, want)
    if (want === '现查') return sameSheet(ui, pending)
    if (!write) return sameSheet(ui, pending)
    if (!drawerShowsAction(ui, want)) return false
    if (want === '新建') return true
    return pending.rows > 0 && sameSheet(ui, pending)
  }

  async function settleTurn(want, beforeId, { write = false, hopNeed = false, pickThenWrite = false } = {}) {
    await goTab('业务记录')
    await page.waitForTimeout(700)
    const pending = await readPending()
    const ui = await readUi()
    const left = await iframeBlob()
    const hop = hopMeta(pending)
    const row = {
      want,
      pending,
      ui,
      hop,
      thinking: /深度求索中/.test(left),
      leftHasFirst: Boolean(
        (pending.first && left.includes(pending.first))
        || (pending.kind && left.includes(pending.kind)),
      ),
      leftSnippet: left.slice(-500),
    }
    if (!thisTurnPending(pending, beforeId)) row.failCode = row.thinking ? 'still-thinking' : 'pending-unchanged'
    else if (pending.sessionId && out.sessionId && pending.sessionId !== out.sessionId) row.failCode = `stale-pending-session(${pending.sessionId})`
    else if (String(pending.action || '') !== want) row.failCode = `action-mismatch(${pending.action || 'none'})`
    else if (hopNeed && !hop.hop) row.failCode = 'one-sided-no-from'
    else if (!pending.rows && want !== '新建') row.failCode = 'empty-sheet'
    else if (!sameSheet(ui, pending) && want !== '新建') row.failCode = `sheet-mismatch(footer=${ui.footerCount},tbody=${ui.tbodyRows},pending=${pending.rows},ui=${ui.firstNo},pendingFirst=${pending.first})`
    else if (pickThenWrite && !isSingleMatchWrite(pending, ui, want)) {
      row.failCode = prematureWriteCode(pending, ui)
        || (isWaitingPick(pending, ui) ? '' : `wait-pick-miss(rows=${pending.rows},preview=${pending.preview_id || 'none'},listed=${pending.listed},amb=${pending.ambiguous},drawer=${ui.drawerOpen})`)
    } else if (write && isWaitingPick(pending, ui)) row.failCode = `asked-one-by-one(rows=${pending.rows})`
    else if (write && !drawerShowsAction(ui, want)) row.failCode = `drawer-mismatch(${ui.drawerAction || 'none'})`
    else if (write && !pending.preview_id && pending.rows >= 8) row.failCode = `catalog-or-no-preview(rows=${pending.rows})`
    else if (write && (want === '改行' || want === '过审') && (ui.emptyHint || !hasFieldDiffs(ui, pending))) row.failCode = `${want}-empty-changes`
    else if (!row.leftHasFirst && pending.first) row.failCode = 'left-ai-missing-row'
    return row
  }

  async function waitReady(want, beforeId, { write = false, hopNeed = false, pickThenWrite = false } = {}) {
    const deadline = Date.now() + (pickThenWrite ? 360000 : write ? 75000 : 180000)
    let last = { pending: await readPending(), ui: await readUi(), thinking: true }
    while (Date.now() < deadline) {
      await page.waitForTimeout(2500)
      const blob = await iframeBlob()
      const pending = await readPending()
      const tools = await recentTools()
      const ui = await readUi()
      last = { pending, ui, thinking: /深度求索中/.test(blob.slice(-600)), blob }
      const wrote = tools.some((item) => /biz_write|biz\.write/i.test(String(item.tool || '')))
      if (wrote) {
        out.wrote = true
        out.silentBizWrite = true
        out.failCode = 'silent-biz-write'
        throw Object.assign(new Error('silent-biz-write'), { row: last })
      }
      if (coolingIn(blob.slice(-1500))) {
        out.rateLimited = true
        return { ...last, cooling: true }
      }
      if (thisTurnPending(pending, beforeId) && await actionReady(want, pending, ui, { write, hopNeed, pickThenWrite })) {
        if (!last.thinking || (write && !pickThenWrite && drawerShowsAction(ui, want)) || (pickThenWrite && (isWaitingPick(pending, ui) || isSingleMatchWrite(pending, ui, want)))) {
          return { ...last, cooling: false, ready: true }
        }
      }
      if (pickThenWrite && !last.thinking && thisTurnPending(pending, beforeId)) {
        const bad = prematureWriteCode(pending, ui)
        if (bad) return { ...last, cooling: false, ready: false, failFast: bad }
      }
    }
    return { ...last, cooling: false, ready: false }
  }

  async function pickFromThisHitSet() {
    const hit = await page.evaluate(() => {
      const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
      const trs = table ? [...table.querySelectorAll('tbody tr')] : []
      const nos = trs.map((tr) => tr.querySelector('td:nth-child(2)')?.textContent?.trim() || '').filter(Boolean)
      if (trs.length < 2 || nos.length < 2) {
        return { ok: false, count: trs.length, nos }
      }
      const pickIndex = trs.length - 1
      const btn = [...trs[pickIndex].querySelectorAll('button')].find((el) => (el.textContent || '').trim() === '改行')
      if (!btn) return { ok: false, count: trs.length, nos, missing: '改行' }
      btn.click()
      return { ok: true, count: trs.length, nos, pickedNo: nos[pickIndex], pickIndex }
    })
    return hit
  }

  async function promptWait({ want, speech, write = false, hopNeed = false, pickThenWrite = false }) {
    const row = { want, speech, write, pickThenWrite }
    let attempts = 0
    let lastBeforeId = pendingIdentity(await readPending())
    while (attempts < 2) {
      attempts += 1
      const beforeId = pendingIdentity(await readPending())
      lastBeforeId = beforeId
      const baseline = await iframeBlob()
      const prompted = await page.evaluate(async ({ sid, text }) => {
        const res = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sid)}/prompt`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ text }),
        })
        const json = await res.json().catch(() => ({}))
        return { http: res.status, accepted: Boolean(json?.data?.accepted), error: json?.error || null }
      }, { sid: out.sessionId, text: speech })
      row.prompted = prompted
      if (prompted.http >= 400) {
        row.failCode = `prompt-http-${prompted.http}`
        throw Object.assign(new Error(row.failCode), { row })
      }
      const waited = await waitReady(want, beforeId, { write: write && !pickThenWrite, hopNeed, pickThenWrite })
      row.aiDelta = String(waited.blob || '').slice(-1800)
      row.thinking = Boolean(waited.thinking)
      row.pending = waited.pending
      row.ui = waited.ui
      if (waited.cooling) {
        if (attempts >= 2) {
          out.failCode = 'ai-429'
          row.failCode = 'ai-429'
          throw Object.assign(new Error('ai-429'), { row })
        }
        await page.waitForTimeout(90000)
        continue
      }
      if (waited.failFast) {
        row.failCode = waited.failFast
        row.pending = waited.pending
        row.ui = waited.ui
        throw Object.assign(new Error(row.failCode), { row })
      }
      break
    }
    const first = await settleTurn(want, lastBeforeId, { write: write && !pickThenWrite, hopNeed, pickThenWrite })
    Object.assign(row, first)
    if (row.failCode) throw Object.assign(new Error(row.failCode), { row })
    if (!pickThenWrite) return row

    if (isSingleMatchWrite(row.pending, row.ui, want)) {
      row.hitSet = {
        rows: 1,
        nos: row.pending.nos || [row.pending.first].filter(Boolean),
        listed: false,
        ambiguous: false,
        preview_id: row.pending.preview_id || null,
        drawerOpen: row.ui.drawerOpen,
        first: row.pending.first,
        footerCount: row.ui.footerCount,
        tbodyRows: row.ui.tbodyRows,
        singleMatch: true,
      }
      row.picked = {
        ok: true,
        count: 1,
        nos: row.hitSet.nos,
        pickedNo: row.pending.first,
        pickIndex: 0,
        singleMatch: true,
      }
      row.afterPick = {
        preview_id: row.pending.preview_id || null,
        rows: row.pending.rows,
        first: row.pending.first,
        drawerAction: row.ui.drawerAction,
        drawerOpen: row.ui.drawerOpen,
      }
      if ((want === '改行' || want === '过审') && (row.ui.emptyHint || !hasFieldDiffs(row.ui, row.pending))) {
        row.failCode = `${want}-empty-changes`
        throw Object.assign(new Error(row.failCode), { row })
      }
      const ask = await waitAskClosed(20000)
      row.askAfterPick = { closed: ask.closed, thinking: ask.thinking, left: ask.left }
      row.leftSnippet = ask.left
      if (!ask.closed || ask.thinking) {
        row.failCode = `ask-card-still-open(closed=${ask.closed},thinking=${ask.thinking})`
        throw Object.assign(new Error(row.failCode), { row })
      }
      return row
    }

    row.hitSet = {
      rows: row.pending.rows,
      nos: row.pending.nos || [],
      listed: row.pending.listed,
      ambiguous: row.pending.ambiguous,
      preview_id: row.pending.preview_id || null,
      drawerOpen: row.ui.drawerOpen,
      first: row.pending.first,
      footerCount: row.ui.footerCount,
      tbodyRows: row.ui.tbodyRows,
    }
    await page.screenshot({ path: extraShots.case4hits, fullPage: false }).catch(() => {})

    const picked = await pickFromThisHitSet()
    row.picked = picked
    if (!picked?.ok) {
      row.failCode = `pick-failed(count=${picked?.count || 0},nos=${(picked?.nos || []).join(',')},missing=${picked?.missing || ''})`
      throw Object.assign(new Error(row.failCode), { row })
    }
    const afterPickBefore = pendingIdentity(row.pending)
    const afterPick = await waitReady(want, afterPickBefore, { write: true, hopNeed: false, pickThenWrite: false })
    row.aiDelta = String(afterPick.blob || row.aiDelta || '').slice(-1800)
    const settled = await settleTurn(want, afterPickBefore, { write: true, hopNeed: false, pickThenWrite: false })
    row.pending = settled.pending
    row.ui = settled.ui
    row.hop = settled.hop
    row.leftHasFirst = settled.leftHasFirst
    row.leftSnippet = settled.leftSnippet
    row.afterPick = {
      preview_id: settled.pending.preview_id || null,
      rows: settled.pending.rows,
      first: settled.pending.first,
      drawerAction: settled.ui.drawerAction,
      drawerOpen: settled.ui.drawerOpen,
    }
    if (settled.failCode) {
      row.failCode = settled.failCode
      throw Object.assign(new Error(row.failCode), { row })
    }
    const hitNos = new Set(row.hitSet.nos)
    if (settled.pending.rows !== 1) {
      row.failCode = `pick-not-one(rows=${settled.pending.rows})`
      throw Object.assign(new Error(row.failCode), { row })
    }
    if (!hitNos.has(String(settled.pending.first || ''))) {
      row.failCode = `picked-outside-hit-set(${settled.pending.first})`
      throw Object.assign(new Error(row.failCode), { row })
    }
    if (!settled.pending.preview_id) {
      row.failCode = 'preview-missing-after-pick'
      throw Object.assign(new Error(row.failCode), { row })
    }
    const ask = await waitAskClosed(20000)
    row.askAfterPick = {
      closed: ask.closed,
      thinking: ask.thinking,
      left: ask.left,
    }
    row.leftSnippet = ask.left
    if (!ask.closed || ask.thinking) {
      row.failCode = `ask-card-still-open(closed=${ask.closed},thinking=${ask.thinking})`
      throw Object.assign(new Error(row.failCode), { row })
    }
    return row
  }

  async function checkChips(ui, pending, related) {
    const kinds = [...new Set([pending.kind, pending.fromKind, ...(pending.steps || []), ...(related || [])].filter(Boolean))]
    const chips = (ui.kindChips || []).map((text) => parseChip(text, kinds.length ? kinds : labels))
    const mixed = (ui.kindChips || []).some((text) => (out.localAppNames || []).some((name) => name && text.includes(name)))
    const selected = parseChip(ui.selectedChip, kinds.length ? kinds : labels)
    const relatedHits = (related || []).filter((kind) => chips.some((row) => row.kind === kind))
    if ((related || []).length >= 2 && relatedHits.length < 2) {
      return { ok: false, failCode: `chips-missing-related(${relatedHits.length}/${related.length})`, chips, mixed, selected }
    }
    let afterSide = null
    const side = chips.find((row) => row.kind && row.kind !== pending.kind && Number.isFinite(row.count) && row.count > 0)
    if (side?.kind) {
      await page.evaluate((kindName) => {
        const wrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
          .find((el) => [...el.querySelectorAll('button.btn')].some((b) => (b.textContent || '').includes(kindName)))
        const btn = [...(wrap?.querySelectorAll('button.btn') || [])].find((b) => (b.textContent || '').includes(kindName))
        btn?.click()
      }, side.kind)
      await page.waitForTimeout(700)
      const sideUi = await readUi()
      afterSide = {
        selectedChip: sideUi.selectedChip,
        tbodyRows: sideUi.tbodyRows,
        footerCount: sideUi.footerCount,
        firstNo: sideUi.firstNo,
        catalog: looksLikeCatalog(side.count, sideUi.tbodyRows) || looksLikeCatalog(side.count, sideUi.footerCount),
      }
      if (pending.kind) {
        await page.evaluate((kindName) => {
          const wrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
            .find((el) => [...el.querySelectorAll('button.btn')].some((b) => (b.textContent || '').includes(kindName)))
          const btn = [...(wrap?.querySelectorAll('button.btn') || [])].find((b) => (b.textContent || '').includes(kindName))
          btn?.click()
        }, pending.kind)
        await page.waitForTimeout(400)
      }
      if (afterSide.catalog || (Number.isFinite(side.count) && sideUi.tbodyRows !== side.count && sideUi.footerCount !== side.count)) {
        return { ok: false, failCode: `chip-opened-catalog(shown=${sideUi.tbodyRows},hit=${side.count})`, chips, mixed, selected, side, afterSide }
      }
    }
    return { ok: !mixed, failCode: mixed ? 'chips-mixed-with-local-apps' : '', chips, mixed, selected, side, afterSide, connectorSeparate: ui.connectorSeparate }
  }

  let stopped = false
  for (const spec of CASES) {
    if (stopped) {
      out.cases.push({ n: spec.n, speech: spec.speech, pass: false, failCode: 'stopped-before' })
      continue
    }
    const hopProbe = hopNeedFor(spec.querySpeech || spec.speech)
    const mentioned = kindMentions(spec.querySpeech || spec.speech, labels, bag).map((row) => row.kind)
    const rec = {
      n: spec.n,
      speech: spec.speech,
      want: spec.want,
      write: Boolean(spec.write),
      queryThenWrite: Boolean(spec.queryThenWrite),
      related: hopProbe.related,
      mentioned,
      hopNeed: hopProbe.need,
      pass: false,
    }
    try {
      await clickCancelIfOpen()
      await dismissAskCard()
      if (spec.queryThenWrite) {
        const queryHop = hopNeedFor(spec.querySpeech)
        rec.query = await promptWait({
          want: '现查',
          speech: spec.querySpeech,
          write: false,
          hopNeed: queryHop.need,
        })
        rec.querySameSheet = true
      }
      const live = await promptWait({
        want: spec.want,
        speech: spec.speech,
        write: Boolean(spec.write),
        hopNeed: hopProbe.need,
        pickThenWrite: spec.n === 4 && Boolean(spec.write),
      })
      rec.kind = live.pending.kind
      rec.action = live.pending.action
      rec.rows = live.pending.rows
      rec.first = live.ui.firstNo || live.pending.first
      rec.banner = live.ui.banner || ''
      rec.footerCount = live.ui.footerCount
      rec.tbodyRows = live.ui.tbodyRows
      rec.hop = live.hop
      rec.leftHasFirst = live.leftHasFirst
      rec.sameSheet = spec.want === '新建' ? true : sameSheet(live.ui, live.pending)
      rec.drawerAction = live.ui.drawerAction || ''
      rec.hasFieldDiffs = spec.write ? hasFieldDiffs(live.ui, live.pending) : undefined
      rec.emptyHint = live.ui.emptyHint
      rec.previewId = live.pending.preview_id
      rec.hitSet = live.hitSet || null
      rec.picked = live.picked || null
      rec.afterPick = live.afterPick || null
      rec.askAfterPick = live.askAfterPick || null
      rec.pendingSpeech = live.pending.speech || ''
      rec.nos = Array.isArray(live.pending.nos) ? live.pending.nos : []
      rec.chips = await checkChips(live.ui, live.pending, hopProbe.related)
      if (!rec.chips.ok) {
        rec.failCode = rec.chips.failCode
        throw Object.assign(new Error(rec.failCode), { row: rec })
      }
      if (spec.n === 2) {
        const left = `${rec.leftSnippet || ''} ${live.leftSnippet || ''} ${live.aiDelta || ''}`
        const banner = String(live.ui?.banner || rec.banner || '')
        rec.quiz = /哪一档/.test(left) || /哪一档/.test(banner)
        rec.askOpen = isAskBlocking(left)
        const prev = out.cases.find((row) => row.n === 1)
        if (!live.pending.rows) rec.failCode = 'case2-zero'
        else if (prev && live.pending.rows === prev.rows && String(live.pending.first || '') === String(prev.first || '')) rec.failCode = 'case2-stuck-on-case1'
        else if (prev && Number(prev.rows) >= 20 && live.pending.rows === prev.rows) rec.failCode = 'case2-stuck-on-case1-count'
        else if (rec.quiz) rec.failCode = 'case2-quiz'
        else if (rec.askOpen) rec.failCode = 'case2-ask-card'
        else if (rec.pendingSpeech && rec.pendingSpeech !== spec.speech) rec.failCode = 'case2-stale-speech'
        else if (live.pending.rows < 2) rec.failCode = `case2-not-batch(rows=${live.pending.rows})`
        else {
          const fromNos = Array.isArray(live.pending.fromNos) ? live.pending.fromNos : []
          rec.fromNos = fromNos
          rec.fromRows = live.pending.fromRows
          const allNos = [...new Set([...rec.nos, ...fromNos, rec.first, live.ui?.firstNo].map(String).filter(Boolean))]
          rec.hasBizMarker = allNos.includes(BIZ_ROW_MARKER)
          if (!rec.hasBizMarker) rec.failCode = 'case2-missing-biz-row'
        }
        if (rec.failCode) throw Object.assign(new Error(rec.failCode), { row: rec })
      }
      if (spec.n === 3) {
        const prev = out.cases.find((row) => row.n === 2)
        if (prev && rec.pendingSpeech && rec.pendingSpeech === prev.pendingSpeech) rec.failCode = 'case3-carried-speech'
        else if (prev && live.pending.kind === prev.kind && live.pending.rows === prev.rows && String(live.pending.first || '') === String(prev.first || '')) rec.failCode = 'case3-carried-sheet'
        else if (prev && rec.banner && prev.banner && rec.banner === prev.banner) rec.failCode = 'case3-carried-banner'
        if (rec.failCode) throw Object.assign(new Error(rec.failCode), { row: rec })
      }
      rec.pass = true
      await page.screenshot({ path: caseShots[spec.n - 1], fullPage: false })

      if (spec.n === 4 && spec.write) {
        rec.cancelledPreviewId = live.pending.preview_id
        rec.cancelBefore = { first: rec.first, tbodyRows: rec.tbodyRows, drawerOpen: live.ui.drawerOpen }
        const cancelled = await clickCancelIfOpen()
        await page.waitForTimeout(1200)
        const afterCancel = await readUi()
        rec.afterCancel = {
          clicked: cancelled,
          drawerOpen: afterCancel.drawerOpen,
          drawerAction: afterCancel.drawerAction,
          first: afterCancel.firstNo,
          tbodyRows: afterCancel.tbodyRows,
        }
        if (afterCancel.drawerOpen && afterCancel.drawerAction === spec.want) {
          rec.failCode = 'cancel-did-not-close'
          rec.pass = false
          throw Object.assign(new Error(rec.failCode), { row: rec })
        }
        await page.screenshot({ path: extraShots.cancel, fullPage: false })
        await page.waitForTimeout(1500)
        const still = await readUi()
        if (still.drawerOpen && still.drawerAction === spec.want) {
          rec.failCode = 'cancelled-preview-reopened'
          rec.pass = false
          throw Object.assign(new Error(rec.failCode), { row: rec })
        }
        rec.cancelHeld = true
      }
    } catch (error) {
      rec.pass = false
      rec.failCode = rec.failCode || error?.row?.failCode || error?.message || String(error)
      rec.error = String(error?.message || error)
      if (error?.row?.hitSet) rec.hitSet = error.row.hitSet
      if (error?.row?.picked) rec.picked = error.row.picked
      if (error?.row?.afterPick) rec.afterPick = error.row.afterPick
      if (error?.row?.askAfterPick) rec.askAfterPick = error.row.askAfterPick
      if (error?.row?.prompted) rec.prompted = error.row.prompted
      if (error?.row?.aiDelta) rec.aiDelta = String(error.row.aiDelta).slice(-1800)
      if (error?.row?.leftSnippet) rec.leftSnippet = error.row.leftSnippet
      if (error?.row?.pending) rec.pending = error.row.pending
      if (error?.row?.ui) rec.ui = {
        footerCount: error.row.ui.footerCount,
        tbodyRows: error.row.ui.tbodyRows,
        firstNo: error.row.ui.firstNo,
        banner: error.row.ui.banner,
        kindChips: error.row.ui.kindChips,
        drawerAction: error.row.ui.drawerAction,
      }
      await page.screenshot({ path: caseShots[spec.n - 1], fullPage: false }).catch(() => {})
      out.failCode = `case-${spec.n}:${rec.failCode}`
      stopped = true
    }
    out.cases.push(rec)
    console.log(JSON.stringify({
      n: rec.n,
      pass: rec.pass,
      failCode: rec.failCode || '',
      kind: rec.kind || '',
      rows: rec.rows ?? null,
      first: rec.first || '',
      quiz: rec.quiz,
      marker: rec.hasBizMarker,
    }))
    if (stopped) break
  }

  const allCasesPass = out.cases.length === 10 && out.cases.every((row) => row.pass)
  if (!stopped) {
    const historyUi = await readUi()
    const labeled = (historyUi.historyOptions || []).filter((row) => row.value)
    const pick = labeled.find((row) => /现查/.test(row.label)) || labeled[0]
    out.historyStart = labeled.map((row) => row.label)
    if (pick) {
      const historySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '本会话浮现历史' }) })
      await historySelect.selectOption(pick.value)
      await page.waitForTimeout(1000)
      const afterHist = await readUi()
      out.afterHistory = {
        value: afterHist.historyValue,
        label: pick.label,
        firstNo: afterHist.firstNo,
        tbodyRows: afterHist.tbodyRows,
        footerCount: afterHist.footerCount,
      }
      out.historySwitched = afterHist.historyValue === pick.value && afterHist.tbodyRows > 0
      await page.screenshot({ path: extraShots.history, fullPage: false })
    } else {
      out.historySwitched = false
      out.failCode = out.failCode || 'no-history-option'
    }

    const other = await page.evaluate(() => {
      const aside = document.querySelector('aside')
      const buttons = aside ? [...aside.querySelectorAll('button.flex-1')] : []
      const current = buttons.find((btn) => btn.closest('li')?.querySelector('.font-medium'))
      const next = buttons.find((btn) => btn !== current)
      if (!next) return { ok: false }
      next.click()
      return { ok: true, title: next.querySelector('div.text-sm')?.textContent?.trim() || '' }
    })
    out.sessionSwitchClick = other
    await page.waitForTimeout(2000)
    if (!other?.ok) {
      const sessions = await page.evaluate(async () => {
        const json = await fetch('/api/v1/ai/sessions?includeBlank=true', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
        return Array.isArray(json?.data?.items) ? json.data.items.map((row) => row.sessionId) : []
      })
      const otherId = sessions.find((id) => id && id !== out.sessionId)
      if (otherId) await page.goto(`${mainBase}/ai/${otherId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    }
    await page.waitForTimeout(1500)
    await goTab('业务记录')
    const afterSwitchUi = await readUi()
    const afterSwitchBlob = await iframeBlob()
    out.portsAfterSwitch = await hostsUp()
    out.afterSwitch = {
      url: page.url(),
      iframeCrash: /接口不存在|{"error":\{"code":"not_found"/.test(afterSwitchBlob),
      pageCrash: afterSwitchUi.crashJson,
      leftAlive: Boolean(afterSwitchBlob) && !/接口不存在/.test(afterSwitchBlob),
      tbodyRows: afterSwitchUi.tbodyRows,
    }
    out.sessionOk = Boolean(out.portsAfterSwitch.ok && out.afterSwitch.leftAlive && !out.afterSwitch.iframeCrash)
    await page.screenshot({ path: extraShots.session, fullPage: false })
    if (!out.sessionOk) out.failCode = out.failCode || 'session-switch-crash'
  }

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
    else await page.locator('[data-app-create-entry]').click().catch(() => {})
  }
  await goTab('业务记录')
  await goTab('操作记录')
  out.opsTabOk = /操作记录|回退|审查 corpus/.test(await page.locator('body').innerText())
  await goTab('应用')
  // Ace 2026-09-20: skip opening 抄表 LEDGER_ID and clicking 问 AI.
  // That click spawned leftover 「小区水电抄表 · 问」. See chaobiao-session-cause.md.
  out.askAiSkipped = true
  out.askAiButton = false
  const back = page.getByRole('button', { name: /返回列表/ })
  if (await back.count()) await back.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  await goTab('应用')
  out.catalogHasVisit = await page.locator(`[data-app-row="${visitId}"]`).count() > 0
  if (out.catalogHasVisit) {
    await page.locator(`[data-app-row="${visitId}"]`).locator('button').first().click({ timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
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

  const cancelOk = Boolean(out.cases.find((row) => row.n === 4)?.cancelHeld)
  out.req = {
    cases: allCasesPass,
    cancel: cancelOk || Boolean(out.cases.find((row) => row.n === 4)?.afterCancel && !out.cases.find((row) => row.n === 4)?.afterCancel?.drawerOpen),
    history: Boolean(out.historySwitched),
    session: Boolean(out.sessionOk),
  }
  out.d22 = {
    tabs: Boolean(out.threeTabs?.app && out.threeTabs?.records && out.threeTabs?.ops),
    create: Boolean(out.createEntry),
    stretch: [out.wide?.asideW, out.narrow?.asideW].includes(48) && [out.wide?.asideW, out.narrow?.asideW].includes(224),
    askAi: out.askAiSkipped ? 'skipped' : Boolean(out.askAiButton),
    visit: Boolean(out.visitUnchanged && out.catalogHasVisit),
  }
  out.silentBizWrite = bizWriteUrls.length > 0 || out.wrote
  out.autoIm = imSendUrls.length > 0
  out.pass = Boolean(
    allCasesPass
    && out.req.cancel
    && out.req.history
    && out.req.session
    && Object.values(out.d22).every(Boolean)
    && !out.silentBizWrite
    && !out.autoIm
    && out.portsEnd?.ok,
  )
  if (!out.pass && !out.failCode) {
    const missed = out.cases.filter((row) => !row.pass).map((row) => row.n).join(',')
    out.failCode = missed ? `cases:${missed}` : 'not-closed'
  }

  await stitchShots(out.cases.map((row) => {
    const mark = row.pass ? '过' : '没过'
    return `${row.n} ${mark} · ${row.kind || ''} ${row.action || ''} ${row.first || ''} ×${row.rows ?? '?'}`
  }))
} catch (error) {
  out.pass = false
  out.error = String(error?.message || error)
  if (!out.failCode) out.failCode = 'script-error'
  if (error?.row) out.lastRow = error.row
  try {
    await page.screenshot({ path: extraShots.session, fullPage: false })
    await stitchShots(CASES.map((row, i) => {
      const rec = out.cases[i]
      return rec ? `${rec.n} ${rec.pass ? '过' : '没过'} · ${rec.failCode || rec.first || ''}` : `${row.n} 未跑`
    }))
  } catch {
    await page.screenshot({ path: MEDIA, fullPage: false }).catch(() => {})
  }
} finally {
  out.silentBizWrite = Boolean(out.silentBizWrite || bizWriteUrls.length)
  out.autoIm = Boolean(out.autoIm || imSendUrls.length)
  const caseRows = CASES.map((spec) => {
    const rec = out.cases.find((row) => row.n === spec.n) || { pass: false, failCode: 'not-run' }
    return `| ${spec.n} | ${rec.pass ? '过' : '没过'} | want=${spec.want} kind=${rec.kind || '—'} action=${rec.action || '—'} rows=${rec.rows ?? '—'} first=${rec.first || '—'} speech=${JSON.stringify(rec.pendingSpeech || rec.speech || '')} banner=${JSON.stringify(rec.banner || rec.ui?.banner || '')} hop=${JSON.stringify(rec.hop || null)} sameSheet=${rec.sameSheet} chips=${JSON.stringify(rec.chips?.chips || rec.ui?.kindChips || [])} diffs=${rec.hasFieldDiffs} left=${rec.leftHasFirst} quiz=${rec.quiz} marker=${rec.hasBizMarker} hitSet=${JSON.stringify(rec.hitSet || null)} picked=${JSON.stringify(rec.picked || rec.afterPick || null)} askClosed=${JSON.stringify(rec.askAfterPick || null)} ${rec.queryThenWrite ? `querySheet=${rec.querySameSheet}` : ''} fail=${rec.failCode || '—'} |`
  }).join('\n')
  const md = `---
cursor:
  subagentId: "bc-e8b23ddd-6eb2-56cf-959d-4bbb493f8898"
---

# Verify: BG 业务记录整块收口（带上 BF，跑完 10 条）

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**failCode:** ${out.failCode || '—'}
**闸注入:** no
**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}
**确认过账:** no
**自动发 IM:** ${out.autoIm ? 'yes' : 'no'}
**5174 未杀:** yes
**src 写入例字面量:** ${out.hardcodedInSrc}
**走访不动:** ${out.visitUnchanged ? 'yes' : 'no'}

## 1–10

| # | 过/没过 | 现网 |
|---|---|---|
${caseRows}

口语原句只当活用例，未写入 \`src/\`。where/hop 对照词表+图；芯片对照当次命中。1–3 不能回退：第 2 条仍是故障+紧急未关那批（约 8 行，含 \`${BIZ_ROW_MARKER}\`），不是 0、不是第 1 条那页、不出「哪一档」；第 3 条右表换成当次 pending 回款。第 4 条必须先停在这次命中的几家（无 preview_id、不倒目录），人选其中一家之后才出改行预览，且左栏选择题必须关掉。人选的 no 来自这次命中，脚本不写死哪一家。第 1 / 5 条仍出那批，不一家家问。

## 取消 / 浮现历史 / 切会话

| 项 | 过/没过 | 证据 |
|---|---|---|
| 取消预览不再弹出 | ${out.req?.cancel ? '过' : '没过'} | ${JSON.stringify(out.cases.find((row) => row.n === 4)?.afterCancel || null)} |
| 浮现历史换表 | ${out.req?.history ? '过' : '没过'} | ${JSON.stringify(out.afterHistory || null)} |
| 切会话不炸 | ${out.req?.session ? '过' : '没过'} | GET session=${JSON.stringify(out.sessionGet || null)} after=${JSON.stringify(out.afterSwitch || null)} ports=${JSON.stringify(out.portsAfterSwitch || null)} |

## 决策 22

| 项 | 过/没过 | 证据 |
|---|---|---|
| 三 Tab | ${out.d22?.tabs ? '过' : '没过'} | ${JSON.stringify(out.threeTabs || null)} |
| 创建应用入口 | ${out.d22?.create ? '过' : '没过'} | entry=${out.createEntry} wizard=${out.createWizard} |
| 拉伸 48/224 | ${out.d22?.stretch ? '过' : '没过'} | wide=${out.wide?.asideW} narrow=${out.narrow?.asideW} |
| 问 AI | ${out.askAiSkipped ? '跳过' : (out.d22?.askAi ? '过' : '没过')} | 抄表夹具不再点问 AI skipped=${out.askAiSkipped} |
| 走访应用还在 | ${out.d22?.visit ? '过' : '没过'} | catalog=${out.catalogHasVisit} opened=${out.visitOpened} before=${out.visitBefore?.updatedAt} after=${out.visitAfter?.updatedAt} |

## 禁区

硬编码进 src=${out.hardcodedInSrc} 闸注入=${out.gateInjected} 评测集/第9步/决策20/21/corpus去留=未做

${out.error ? `## 错误\\n\\n\`${out.error}\` failCode=${out.failCode}` : ''}

已对：${out.cases.filter((row) => row.pass).map((row) => row.n).join('、') || '无'}
未对：${out.cases.filter((row) => !row.pass).map((row) => row.n).join('、') || (out.pass ? '无（本刀 1–10 + 取消/历史/切会话 + 决策22）' : '见上表')}
仍差：${out.pass ? '无（本刀收口）' : (out.failCode || '现网未齐')}

## 图

十格按序 1–10，不是只拍合同∩回款。

\`${MEDIA}\`
`
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2), 'utf8')
  await writeFile(REPORT_MD, md, 'utf8')
  await dualWrite(REPORT_MD, 'internal/verify-records-close-bg.md')
  await dualWrite(REPORT_JSON, 'internal/verify-records-close-bg.json')
  if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/records-close-bg.png')
  await browser.close()
  console.log(JSON.stringify({
    pass: out.pass,
    failCode: out.failCode,
    sha: out.sha,
    cases: (out.cases || []).map((row) => ({ n: row.n, pass: row.pass, failCode: row.failCode, kind: row.kind, rows: row.rows })),
    d22: out.d22,
    rateLimited: Boolean(out.rateLimited),
    silentBizWrite: out.silentBizWrite,
  }))
  if (!out.pass) process.exitCode = 1
}
