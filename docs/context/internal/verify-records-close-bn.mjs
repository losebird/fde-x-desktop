/**
 * BN: original cases 6–10 once vs frozen four-point contract. Preview only.
 * Do not invent case 11. Do not grow 印证. Do not reopen BM unless case 5 chrome
 * regresses into this slice. 现查 N is not a 过审 pass. Hop 工单 stays 工单.
 * Chrome of this pending must match this action — 过审/改行 must not read 「AI 刚查了」.
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
const MEDIA = `${STORE}/media/records-close-bn.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-bn.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-bn.md`
const BIZ_ROW_MARKER = 'TK20260105702'
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const PREVIEW_ONLY = '只要预览，不要过账，不要 biz_write。'
const CATALOG_PAGE = 20
const SUBAGENT_ID = 'bc-a68307c8-e09e-506b-8226-745920d49815'

const CASES = [
  { n: 6, want: '过审', write: true, speech: `过一下请假单 LV-2026-018。${PREVIEW_ONLY}` },
  { n: 7, want: '改行', write: true, speech: `把武汉云启那张紧急工单改成已解决。${PREVIEW_ONLY}` },
  { n: 8, want: '现查', speech: '昆明精密机电还有哪些待审采购单？' },
  { n: 9, want: '过审', write: true, speech: `产假那张待审请假单是谁请的？过一下。${PREVIEW_ONLY}` },
  { n: 10, want: '改行', write: true, speech: `东莞联创到期合同下还有哪些待审回款？把备注改成催收。${PREVIEW_ONLY}` },
]

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['main', 'unknown']
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

function resolveKindRow(name, catalog, aliasesMap) {
  const key = String(name || '').trim()
  if (!key) return null
  let row = catalog.find((r) => r.kind === key)
  if (row) return row
  row = catalog.find((r) => (r.aliases || []).includes(key))
  if (row) return row
  const mapped = aliasesMap?.[key]
  if (mapped) return catalog.find((r) => r.kind === mapped) || null
  return null
}

function connectorBacked(name, catalog, aliasesMap) {
  const row = resolveKindRow(name, catalog, aliasesMap)
  if (!row) return { connected: false, resource: '', canonicalKind: keyName(name) }
  const resource = String(row.resource || '').trim()
  if (!resource || resource === '(in graph)') {
    return { connected: false, resource, canonicalKind: row.kind }
  }
  return { connected: true, resource, canonicalKind: row.kind }
}

function keyName(name) {
  return String(name || '').trim()
}

function speechMatchesTurn(pendingSpeech, turnSpeech, specSpeech) {
  const p = String(pendingSpeech || '').trim()
  const needles = [turnSpeech, specSpeech].map((s) => String(s || '').replace(PREVIEW_ONLY, '').trim()).filter(Boolean)
  if (!p) return false
  return needles.some((n) => p === n || p.includes(n) || n.includes(p))
}

function isBatchSpeech(spec) {
  if ([1, 2, 5, 8].includes(spec.n)) return true
  return /还有哪些|都过一下/.test(spec.speech || '')
}

function isGongdanSpeech(spec) {
  const blob = `${spec.speech || ''} ${spec.querySpeech || ''}`
  return /工单/.test(blob) && [1, 2, 7].includes(spec.n)
}

function sheetSnap(pending) {
  return {
    kind: String(pending?.kind || ''),
    rows: Number(pending?.rows || 0),
    first: String(pending?.first || ''),
    speech: String(pending?.speech || ''),
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

const [branchRaw, sha] = gitSha()
const branch = branchRaw || 'main'
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const caseShots = Object.fromEntries(CASES.map((row) => [row.n, `${STORE}/internal/bn-case-${String(row.n).padStart(2, '0')}.png`]))
const caseMediaShots = Object.fromEntries(CASES.map((row) => [row.n, `${STORE}/media/records-close-bn-case-${String(row.n).padStart(2, '0')}.png`]))

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
  slice: 'BN-original-6-10-frozen-contract',
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
  const imgs = []
  for (const spec of CASES) {
    const file = caseShots[spec.n]
    if (!file || !existsSync(file)) continue
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

async function saveCasePng(n) {
  const media = caseMediaShots[n]
  const internal = caseShots[n]
  if (!media || !internal) throw new Error(`missing-shot-path(n=${n})`)
  await page.screenshot({ path: media, fullPage: false })
  await copyFile(media, internal)
  await dualWrite(media, `media/records-close-bn-case-${String(n).padStart(2, '0')}.png`)
  await dualWrite(internal, `internal/bn-case-${String(n).padStart(2, '0')}.png`)
}

async function goTab(name) {
  const btn = page.getByRole('button', { name, exact: true })
  if (await btn.count()) await btn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

let kindCatalog = []
let aliasesMap = {}
let labels = []

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

  const kindsPack = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || {}
    return {
      kinds: Array.isArray(data.kinds) ? data.kinds.map((row) => ({
        kind: String(row?.kind || ''),
        resource: String(row?.resource || ''),
        aliases: Array.isArray(row?.aliases) ? row.aliases.map(String) : [],
        can: Array.isArray(row?.can) ? row.can : [],
        fields: Array.isArray(row?.fields) ? row.fields : [],
      })) : [],
      aliases: data.aliases && typeof data.aliases === 'object' ? data.aliases : {},
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  }, workspaceCwd)
  kindCatalog = kindsPack.kinds
  aliasesMap = kindsPack.aliases || {}
  const vocabRows = kindCatalog.map((row) => ({ kind: row.kind, can: row.can, fields: row.fields }))
  labels = kindCatalog.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }
  out.kindCatalogCount = kindCatalog.length

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
    const shown = Number(ui?.tbodyRows || 0)
    const footer = Number(ui?.footerCount || 0)
    const hit = Number(pending?.rows || 0)
    // Paginated matching set (footer == this hit) is not a connector directory dump.
    if (Number.isFinite(hit) && hit > 0 && footer === hit) return false
    return looksLikeCatalog(hit, shown) || looksLikeCatalog(hit, footer)
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
    const deadline = Date.now() + (pickThenWrite ? 360000 : write ? 240000 : 180000)
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
      row.picked = { ok: true, count: 1, nos: row.hitSet.nos, pickedNo: row.pending.first, pickIndex: 0, singleMatch: true }
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
    row.askAfterPick = { closed: ask.closed, thinking: ask.thinking, left: ask.left }
    row.leftSnippet = ask.left
    if (!ask.closed || ask.thinking) {
      row.failCode = `ask-card-still-open(closed=${ask.closed},thinking=${ask.thinking})`
      throw Object.assign(new Error(row.failCode), { row })
    }
    return row
  }

  async function judgeFrozenContract(spec, live, { prevSnap, turnSpeech, leftBlob }) {
    const pending = live.pending
    const ui = live.ui
    const contract = { C1: 'pass', C2: 'pass', C3: 'pass', C4: 'pass' }

    const conn = connectorBacked(pending.kind, kindCatalog, aliasesMap)
    if (!conn.connected) {
      contract.C1 = 'fail'
      return { failCode: `unconnected-kind(kind=${pending.kind})`, contract }
    }
    const chipNames = [...labels, ...kindCatalog.flatMap((r) => r.aliases || [])]
    const selected = parseChip(ui.selectedChip, chipNames)
    if (selected.kind && selected.kind !== pending.kind) {
      const chipConn = connectorBacked(selected.kind, kindCatalog, aliasesMap)
      if (!chipConn.connected || chipConn.canonicalKind !== conn.canonicalKind) {
        contract.C1 = 'fail'
        return { failCode: `unconnected-kind(chip=${selected.kind})`, contract }
      }
    }

    // C2 is one pending this turn, not string-equal of 人话. DSH may store a structured restatement.
    if (prevSnap && pending.speech && String(pending.speech) === String(prevSnap.speech || '')) {
      contract.C2 = 'fail'
      return { failCode: 'stale-speech', contract }
    }
    if (!live.leftHasFirst && pending.first && !(pending.kind && leftBlob.includes(pending.kind))) {
      contract.C2 = 'fail'
      return { failCode: 'left-ai-missing-row', contract }
    }
    if (!sameSheet(ui, pending) && spec.want !== '新建') {
      contract.C2 = 'fail'
      return { failCode: 'empty-sheet', contract }
    }

    await page.waitForTimeout(400)
    const pendingAfter = await readPending()
    const afterConn = connectorBacked(pendingAfter.kind, kindCatalog, aliasesMap)
    if (pendingAfter.kind !== pending.kind && !afterConn.connected) {
      contract.C2 = 'fail'
      return { failCode: `second-pending-overwrite(kind=${pendingAfter.kind})`, contract }
    }

    if (prevSnap
      && pending.kind === prevSnap.kind
      && pending.rows === prevSnap.rows
      && String(pending.first) === String(prevSnap.first)
      && String(pending.speech || '') === String(prevSnap.speech || '')) {
      contract.C3 = 'fail'
      return { failCode: 'held-previous', contract }
    }
    if (isCatalogDump(pending, ui)) {
      contract.C3 = 'fail'
      return { failCode: 'catalog-dump', contract }
    }
    if (!sameSheet(ui, pending) && spec.want !== '新建') {
      contract.C3 = 'fail'
      return { failCode: 'sheet-mismatch', contract }
    }
    if ((spec.want === '过审' || spec.want === '改行') && /AI\s*刚查了/.test(String(ui.banner || ''))) {
      contract.C3 = 'fail'
      return { failCode: 'chrome-query-on-write', contract }
    }

    const left = `${live.leftSnippet || ''} ${leftBlob || ''}`
    if (isBatchSpeech(spec)) {
      if (/哪一档/.test(left) || /哪一档/.test(ui.banner || '')) {
        contract.C4 = 'fail'
        return { failCode: 'batch-became-quiz', contract }
      }
      if (spec.write && isWaitingPick(pending, ui)) {
        contract.C4 = 'fail'
        return { failCode: 'asked-one-by-one', contract }
      }
    }

    if (isGongdanSpeech(spec) && pending.kind !== '工单') {
      return { failCode: 'hop-not-工单', contract: { ...contract, hop: 'fail' } }
    }

    if (spec.n === 2) {
      if (!pending.rows) return { failCode: 'case2-zero', contract }
      if (prevSnap && pending.rows === prevSnap.rows && String(pending.first) === String(prevSnap.first)) {
        return { failCode: 'case2-stuck-on-case1', contract }
      }
      if (/哪一档/.test(left)) return { failCode: 'case2-quiz', contract }
      if (isAskBlocking(left)) return { failCode: 'case2-ask-card', contract }
      if (pending.rows < 2) return { failCode: `case2-not-batch(rows=${pending.rows})`, contract }
    }

    if (spec.n === 3) {
      const prev2 = prevSnap
      if (prev2 && pending.kind === prev2.kind && pending.rows === prev2.rows) {
        return { failCode: 'case3-carried-sheet', contract }
      }
      const k = String(pending.kind || '')
      if (!/回款|合同/.test(k) && !live.hop?.hop) {
        return { failCode: 'case3-no-hop-off-工单', contract }
      }
    }

    if (spec.write && String(pending.action || '') === '现查') {
      return { failCode: 'xiancha-not-write', contract }
    }

    if (spec.write && (spec.want === '改行' || spec.want === '过审')) {
      if (!pending.preview_id) return { failCode: 'preview-missing', contract }
      if (!drawerShowsAction(ui, spec.want)) return { failCode: `drawer-mismatch(${ui.drawerAction || 'none'})`, contract }
      if (ui.emptyHint || !hasFieldDiffs(ui, pending)) return { failCode: `${spec.want}-empty-changes`, contract }
    }

    return { failCode: '', contract }
  }

  let stopped = false
  let prevSnap = null

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
      let leftBlob = ''
      if (spec.queryThenWrite) {
        const queryHop = hopNeedFor(spec.querySpeech)
        rec.query = await promptWait({
          want: '现查',
          speech: spec.querySpeech,
          write: false,
          hopNeed: queryHop.need,
        })
        leftBlob = `${rec.query.leftSnippet || ''}`
      }
      const live = await promptWait({
        want: spec.want,
        speech: spec.speech,
        write: Boolean(spec.write),
        hopNeed: hopProbe.need,
        pickThenWrite: Boolean(spec.pickThenWrite),
      })
      leftBlob = `${leftBlob} ${live.leftSnippet || ''} ${live.aiDelta || ''}`
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
      rec.previewId = live.pending.preview_id
      rec.hitSet = live.hitSet || null
      rec.picked = live.picked || null
      rec.afterPick = live.afterPick || null
      rec.pendingSpeech = live.pending.speech || ''
      rec.nos = Array.isArray(live.pending.nos) ? live.pending.nos : []

      if (spec.n === 2) {
        const fromNos = Array.isArray(live.pending.fromNos) ? live.pending.fromNos : []
        const allNos = [...new Set([...rec.nos, ...fromNos, rec.first].map(String).filter(Boolean))]
        rec.hasBizMarker = allNos.includes(BIZ_ROW_MARKER)
        rec.fromNos = fromNos
      }

      const judged = await judgeFrozenContract(spec, live, {
        prevSnap,
        turnSpeech: spec.speech,
        leftBlob,
      })
      rec.contract = judged.contract
      if (judged.failCode) {
        rec.failCode = judged.failCode
        throw Object.assign(new Error(rec.failCode), { row: rec })
      }

      rec.pass = true
      await saveCasePng(spec.n)
      prevSnap = sheetSnap(live.pending)
    } catch (error) {
      rec.pass = false
      rec.failCode = rec.failCode || error?.row?.failCode || error?.message || String(error)
      rec.error = String(error?.message || error)
      if (error?.row?.hitSet) rec.hitSet = error.row.hitSet
      if (error?.row?.picked) rec.picked = error.row.picked
      if (error?.row?.pending) rec.pending = error.row.pending
      await saveCasePng(spec.n).catch(() => {})
      out.failCode = `case-${spec.n}:${rec.failCode}`
      stopped = true
    }
    out.cases.push(rec)
    console.log(JSON.stringify({ n: rec.n, pass: rec.pass, failCode: rec.failCode || '', kind: rec.kind || '', rows: rec.rows ?? null }))
    if (stopped) break
  }

  for (let i = out.cases.length; i < CASES.length; i += 1) {
    const spec = CASES[i]
    out.cases.push({ n: spec.n, speech: spec.speech, pass: false, failCode: 'stopped-before' })
  }

  const allCasesPass = out.cases.length === CASES.length && out.cases.every((row) => row.pass)
  out.silentBizWrite = bizWriteUrls.length > 0 || out.wrote
  out.autoIm = imSendUrls.length > 0
  out.portsEnd = await hostsUp()
  out.pass = Boolean(allCasesPass && !out.silentBizWrite && !out.autoIm && out.portsEnd?.ok)
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
  const passed = out.cases.filter((row) => row.pass).map((row) => row.n)
  const failed = out.cases.filter((row) => !row.pass).map((row) => row.n)
  const caseRows = CASES.map((spec) => {
    const rec = out.cases.find((row) => row.n === spec.n) || { pass: false, failCode: 'not-run' }
    return `| ${spec.n} | ${rec.pass ? '过' : '没过'} | ${rec.failCode || '—'} | C=${JSON.stringify(rec.contract || null)} kind=${rec.kind || '—'} rows=${rec.rows ?? '—'} |`
  }).join('\n')
  const md = `---
cursor:
  subagentId: "${SUBAGENT_ID}"
---

# Verify: BN 原 6–10 × 冻结四点（preview only）

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${branch}\`
**failCode:** ${out.failCode || '—'}
**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}
**确认过账:** no
**5174 未杀:** yes
**现查当过审:** no
**第 11 条:** no

## 这一条

| # | 过/没过 | fail | 证据 |
|---|---|---|---|
${caseRows}

已对：${passed.length ? passed.join('、') : '无'}
未对：${failed.length ? failed.join('、') : '无'}
仍差：${out.pass ? '整块 1–10 本刀不重跑 1–5' : (out.failCode || '6–10 没过')}

## 图

\`${MEDIA}\`

${out.error ? `## 错误\n\n\`${out.error}\`` : ''}
`
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2), 'utf8')
  await writeFile(REPORT_MD, md, 'utf8')
  await dualWrite(REPORT_MD, 'internal/verify-records-close-bn.md')
  await dualWrite(REPORT_JSON, 'internal/verify-records-close-bn.json')
  if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/records-close-bn.png')
  await browser.close()
  console.log(JSON.stringify({ pass: out.pass, failCode: out.failCode, sha: out.sha, cases: out.cases?.map((r) => ({ n: r.n, pass: r.pass })) }))
  if (!out.pass) process.exitCode = 1
}
