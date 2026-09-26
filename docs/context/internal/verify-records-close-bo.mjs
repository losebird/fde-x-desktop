/**
 * BO: ORIGINAL 10 live fixtures ONCE vs frozen four-point contract (C1–C4). Preview only.
 * Close the remaining 9 valves then prove. Do not stop the whole job after one miss.
 * If a fixture id has drifted (already 已过 / deleted / no longer 待审), swap to another
 * live row of the same connected kind + action + conditions. Do not invent case 11.
 * Do not treat a stale id as a product fail. Do not hardcode the replacement into src/runtime.
 * Already-at-target 过审 must be explicit (not empty-drawer success). 现查 N is not 过审 pass.
 * No 确认过账. No silent biz_write. No 问 AI on 小区水电抄表.
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
const MEDIA = `${STORE}/media/records-close-bo.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-bo.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-bo.md`
const BIZ_ROW_MARKER = 'TK20260105702'
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const PREVIEW_ONLY = '只要预览，不要过账，不要 biz_write。'
const CATALOG_PAGE = 20
const SUBAGENT_ID = 'bc-27c6efb7-c120-5574-9806-0352b659aceb'

const CASES = [
  { n: 1, want: '现查', speech: '停用客户还有哪些没关的工单？' },
  { n: 2, want: '现查', speech: '故障类而且紧急、还没关的工单是哪家客户的？' },
  { n: 3, want: '现查', speech: '待审回款挂在哪些合同上？把已到期的那些摊出来。' },
  { n: 4, want: '改行', write: true, pickThenWrite: true, speech: `把停用客户恒通改成成交。${PREVIEW_ONLY}` },
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

function namedIdFromSpeech(speech) {
  const m = String(speech || '').match(/[A-Za-z]{1,8}-?\d{4}-\d+/)
  return m ? m[0] : ''
}

function statusLooksApproved(status) {
  return /已过|已批准|approved|done|已解决|closed|resolved|complete/i.test(String(status || ''))
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

const caseShots = CASES.map((row) => `${STORE}/internal/bo-case-${String(row.n).padStart(2, '0')}.png`)
const caseMediaShots = CASES.map((row) => `${STORE}/media/records-close-bo-case-${String(row.n).padStart(2, '0')}.png`)

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
  slice: 'BO-close-nine-valves-prove-10',
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
  for (const file of caseShots) {
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

async function saveCasePng(n) {
  const idx = n - 1
  const media = caseMediaShots[idx]
  const internal = caseShots[idx]
  await page.screenshot({ path: media, fullPage: false })
  await copyFile(media, internal)
  await dualWrite(media, `media/records-close-bo-case-${String(n).padStart(2, '0')}.png`)
  await dualWrite(internal, `internal/bo-case-${String(n).padStart(2, '0')}.png`)
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
  const beforeReload = await page.evaluate(async () => {
    const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
    return json?.data || {}
  })
  if (!beforeReload.connected) {
    await page.evaluate(async () => {
      await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
    })
  }
  for (let i = 0; i < 90; i += 1) {
    await page.waitForTimeout(1000)
    const live = await page.evaluate(async () => {
      const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
      return json?.data || {}
    })
    if (live.connected) {
      out.reloadWaitSec = i + 1
      break
    }
    if (i === 8 || i === 20 || i === 40) {
      await page.evaluate(async () => {
        await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
      })
    }
  }
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
  const lookupCreated = await page.evaluate(async (wsId) => {
    const res = await fetch('/api/v1/ai/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ workspaceId: wsId }),
    })
    const json = await res.json().catch(() => ({}))
    return { http: res.status, sessionId: json?.data?.sessionId || '', error: json?.error || null }
  }, workspaceId)
  out.lookupSessionId = lookupCreated.sessionId || ''
  if (!out.lookupSessionId) {
    out.failCode = 'lookup-session-create-failed'
    throw new Error(out.failCode)
  }
  await seedState({ activeDataSubview: 'records', panelWidth: 1100, sessionId: out.sessionId })
  await page.goto(`${mainBase}/ai/${out.sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)
  await goTab('业务记录')
  await page.waitForSelector('iframe', { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(1500)

  let kindsPack = { kinds: [], aliases: {}, relations: [] }
  const kindsDeadline = Date.now() + 20000
  while (Date.now() < kindsDeadline) {
    kindsPack = await page.evaluate(async (ws) => {
      const urls = [
        `/api/v1/biz/kinds?cwd=${encodeURIComponent(ws)}`,
        `/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`,
      ]
      for (const url of urls) {
        const res = await fetch(url, { headers: { accept: 'application/json' } })
        const json = await res.json().catch(() => ({}))
        const data = json?.data || {}
        const kinds = Array.isArray(data.kinds) ? data.kinds.map((row) => ({
          kind: String(row?.kind || ''),
          resource: String(row?.resource || ''),
          aliases: Array.isArray(row?.aliases) ? row.aliases.map(String) : [],
          can: Array.isArray(row?.can) ? row.can : [],
          fields: Array.isArray(row?.fields) ? row.fields : [],
        })) : []
        if (kinds.length) {
          return {
            kinds,
            aliases: data.aliases && typeof data.aliases === 'object' ? data.aliases : {},
            relations: Array.isArray(data.relations) ? data.relations : [],
            url,
          }
        }
      }
      return { kinds: [], aliases: {}, relations: [], url: '' }
    }, workspaceCwd)
    if (kindsPack.kinds.length > 0) break
    await page.waitForTimeout(1000)
  }
  kindCatalog = kindsPack.kinds
  aliasesMap = kindsPack.aliases || {}
  const vocabRows = kindCatalog.map((row) => ({ kind: row.kind, can: row.can, fields: row.fields }))
  labels = kindCatalog.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }
  out.kindCatalogCount = kindCatalog.length
  out.kindsFetchUrl = kindsPack.url || ''
  if (kindCatalog.length === 0) {
    out.failCode = 'catalog-empty'
    throw new Error(out.failCode)
  }

  function connectedKindForSpeech(speech) {
    const text = String(speech || '')
    const mentioned = kindMentions(text, labels, bag).map((row) => row.kind)
    for (const name of mentioned) {
      const conn = connectorBacked(name, kindCatalog, aliasesMap)
      if (conn.connected) return conn.canonicalKind
    }
    const tokens = ['请假单', '请假申请', '报销单', '工单', '回款', '采购单', '采购订单', '客户']
    for (const token of tokens) {
      if (!text.includes(token)) continue
      const conn = connectorBacked(token, kindCatalog, aliasesMap)
      if (conn.connected) return conn.canonicalKind
    }
    return ''
  }

  function rowDrifted(lookup, spec, { namedId = '', want = '' } = {}) {
    if (!lookup || lookup.http >= 500) return { drifted: true, reason: 'lookup-failed' }
    const nos = lookup.nos || []
    const statuses = lookup.statuses || []
    if (!nos.length && !lookup.rows) return { drifted: true, reason: 'empty-slice' }
    if (namedId) {
      const idx = nos.indexOf(namedId)
      if (idx < 0) return { drifted: true, reason: 'named-missing' }
      if (want === '过审' && statusLooksApproved(statuses[idx])) return { drifted: true, reason: 'already-at-target' }
    }
    if (spec.n === 7 && namedId) {
      const idx = nos.indexOf(namedId)
      if (idx >= 0 && statusLooksApproved(statuses[idx])) return { drifted: true, reason: 'ticket-closed' }
    }
    return { drifted: false, reason: '' }
  }

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
    return page.evaluate(async ({ ws, sid }) => {
      const q = new URLSearchParams({ cwd: ws })
      if (sid) q.set('sessionId', sid)
      const res = await fetch(`/api/v1/biz/pending-sheet?${q}`)
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
        alreadyAtTarget: Boolean(sheet?.alreadyAtTarget),
        canWrite: Boolean(sheet?.canWrite ?? sheet?.can_write),
        speak: String(sheet?.speak || ''),
        nos: rows.map((row) => (row && typeof row === 'object' ? String(row.no || row.orderId || row.id || '') : '')).filter(Boolean),
      }
    }, { ws: workspaceCwd, sid: out.sessionId })
  }

  async function findLiveWriteRows(kind, speech) {
    return page.evaluate(async ({ kind, speech, ws, sid }) => {
      const res = await fetch('/api/v1/biz/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          kind,
          action: '现查',
          speech,
          sessionId: sid,
          workspace: ws,
        }),
      })
      const json = await res.json().catch(() => ({}))
      const sheet = json?.data?.sheet || json?.data || {}
      const rows = Array.isArray(sheet.rows) ? sheet.rows : []
      const items = rows.map((row) => {
        const fields = row?.fields && typeof row.fields === 'object' ? row.fields : {}
        const blob = JSON.stringify({ ...row, fields })
        return {
          no: String(row?.no || row?.orderId || row?.id || ''),
          status: String(row?.status || row?.state || row?.stage || fields.status || fields.state || ''),
          blob,
        }
      })
      const where = Array.isArray(sheet.where) ? sheet.where : []
      return {
        http: res.status,
        kind: String(sheet.kind || kind || ''),
        action: String(sheet.action || ''),
        nos: items.map((row) => row.no).filter(Boolean),
        statuses: items.map((row) => row.status),
        items,
        where,
        rows: rows.length,
        alreadyAtTarget: Boolean(sheet?.alreadyAtTarget),
        error: json?.error || json?.data?.error || null,
        speak: String(sheet.speak || ''),
      }
    }, { kind, speech, ws: workspaceCwd, sid: out.lookupSessionId })
  }

  async function dismissLookupPending() {
    if (!out.lookupSessionId) return
    await page.evaluate(async ({ ws, sid }) => {
      const q = new URLSearchParams({ cwd: ws, sessionId: sid })
      const res = await fetch(`/api/v1/biz/pending-sheet?${q}`, { headers: { accept: 'application/json' } })
      const json = await res.json().catch(() => ({}))
      const sheet = json?.data?.sheet || json?.data
      if (!sheet) return
      await fetch('/api/v1/biz/pending-sheet/dismiss', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ cwd: ws, sessionId: sid }),
      }).catch(() => {})
    }, { ws: workspaceCwd, sid: out.lookupSessionId })
    await page.waitForTimeout(400)
  }

  function swapQuerySpeech(spec, rec) {
    if (spec.n === 6) return '待审的请假申请'
    if (spec.n === 7) return '紧急还没关的工单'
    if (spec.n === 9) return rec?.maternityEmpty ? '待审的请假申请' : '产假那张待审请假申请'
    if (spec.n === 10) return rec?.contractSliceEmpty ? '到期合同下还有哪些待审回款？' : String(spec.querySpeech || '').replace(PREVIEW_ONLY, '').trim()
    return String(spec.querySpeech || spec.speech || '')
      .replace(PREVIEW_ONLY, '')
      .replace(/[A-Za-z]{1,8}-?\d{4}-\d+/g, '')
      .trim()
  }

  function whereBlob(found) {
    return JSON.stringify(found?.where || [])
  }

  function itemsOf(found) {
    return Array.isArray(found?.items) ? found.items : []
  }

  function maternityLiveItems(found) {
    return itemsOf(found).filter((row) => /产假/.test(row.blob || '') && !statusLooksApproved(row.status))
  }

  function namedConditionLiveItems(found, needles) {
    const re = new RegExp(needles.map((n) => String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))
    return itemsOf(found).filter((row) => re.test(row.blob || ''))
  }

  function pickLiveNo(found, staleId, { skipApproved = false } = {}) {
    const nos = found?.nos || []
    const statuses = found?.statuses || []
    const stale = String(staleId || '').trim()
    for (let i = 0; i < nos.length; i += 1) {
      const no = nos[i]
      if (!no || no === stale) continue
      if (skipApproved && statusLooksApproved(statuses[i])) continue
      return no
    }
    return ''
  }

  async function lookupSlice(kind, speech) {
    if (!kind) return { http: 0, nos: [], rows: 0, error: 'no-kind' }
    const found = await findLiveWriteRows(kind, speech)
    await dismissLookupPending()
    return found
  }

  async function preDriftBeforeProve(spec, rec) {
    if (![6, 7, 9, 10].includes(spec.n)) return
    const proveSpeech = String(rec.speech || spec.speech)
    const kind = connectedKindForSpeech(proveSpeech)
    rec.connectedKind = kind
    if (!kind) {
      rec.driftNote = 'speech-kind-unresolved'
      return
    }

    if (spec.n === 6) {
      const namedId = namedIdFromSpeech(spec.speech)
      const probeSpeech = namedId ? `请假单 ${namedId}` : proveSpeech.replace(PREVIEW_ONLY, '').trim()
      let found = await lookupSlice(kind, probeSpeech)
      rec.preDriftLookup = found
      let drift = rowDrifted(found, spec, { namedId, want: '过审' })
      if (found.alreadyAtTarget) drift = { drifted: true, reason: 'already-at-target' }
      if (drift.drifted) {
        found = await lookupSlice(kind, swapQuerySpeech(spec, rec))
        rec.preDriftFallback = found
        const nextNo = pickLiveNo(found, namedId, { skipApproved: true })
        if (!nextNo) {
          rec.driftNote = drift.reason || 'no-live-待审请假'
          return
        }
        rec.swappedFrom = namedId
        rec.swappedTo = nextNo
        rec.swapped = true
        rec.driftNote = `fixture-drift(${drift.reason})→待审请假`
        rec.speech = swappedUtterance(spec, kind, nextNo)
      }
      return
    }

    if (spec.n === 7) {
      const probe = proveSpeech.replace(PREVIEW_ONLY, '').trim()
      let found = await lookupSlice(kind, probe)
      rec.preDriftLookup = found
      const namedHits = namedConditionLiveItems(found, ['武汉云启'])
      const liveNamed = namedHits.filter((row) => !statusLooksApproved(row.status))
      let drift = { drifted: false, reason: '' }
      if (!found.nos?.length) drift = { drifted: true, reason: 'wuhan-urgent-empty' }
      else if (!namedHits.length) drift = { drifted: true, reason: 'wuhan-missing' }
      else if (!liveNamed.length) drift = { drifted: true, reason: 'wuhan-already-resolved' }
      if (drift.drifted) {
        found = await lookupSlice(kind, swapQuerySpeech(spec, rec))
        rec.preDriftFallback = found
        const nextNo = pickLiveNo(found, namedHits[0]?.no || '', { skipApproved: true })
        if (!nextNo) {
          rec.driftNote = 'no-live-紧急工单'
          return
        }
        rec.swappedFrom = namedHits[0]?.no || '武汉云启紧急'
        rec.swappedTo = nextNo
        rec.swapped = true
        rec.driftNote = `fixture-drift(${drift.reason})→紧急工单`
        rec.speech = swappedUtterance(spec, kind, nextNo)
      }
      return
    }

    if (spec.n === 9) {
      const q = String(spec.querySpeech || '产假那张待审请假申请')
      let found = await lookupSlice(kind, q)
      rec.preDriftLookup = found
      const maternity = maternityLiveItems(found)
      const whereHasMaternity = /产假/.test(whereBlob(found))
      if (maternity.length || (whereHasMaternity && (found.nos || []).length)) {
        rec.maternityEmpty = false
        return
      }
      rec.maternityEmpty = true
      rec.driftNote = '产假待审切片为空，改走同条件待审请假过审'
      found = await lookupSlice(kind, swapQuerySpeech(spec, rec))
      rec.preDriftFallback = found
      const nextNo = pickLiveNo(found, '', { skipApproved: true })
      if (!nextNo) {
        rec.driftNote = `${rec.driftNote}；无待审请假`
        return
      }
      rec.swappedTo = nextNo
      rec.swapped = true
      rec.speech = swappedUtterance(spec, kind, nextNo)
      return
    }

    if (spec.n === 10) {
      const q = String(spec.querySpeech || '')
      let found = await lookupSlice(kind, q)
      rec.preDriftLookup = found
      if (found.nos?.length) return
      rec.contractSliceEmpty = true
      found = await lookupSlice(kind, swapQuerySpeech(spec, rec))
      rec.preDriftFallback = found
      const nextNo = pickLiveNo(found, '', { skipApproved: true })
      if (!nextNo) {
        rec.driftNote = '到期待审回款切片为空'
        return
      }
      rec.swappedFrom = q
      rec.swappedTo = nextNo
      rec.swapped = true
      rec.driftNote = '东莞联创切片空→到期合同待审回款'
      rec.speech = swappedUtterance(spec, kind, nextNo)
    }
  }

  function proveTurnStillDrifted(spec, live, rec) {
    const namedInSpeech = namedIdFromSpeech(rec.speech || spec.speech)
    const kind = connectedKindForSpeech(rec.speech || spec.speech)
    if (kind && live?.pending?.kind && live.pending.kind !== kind) return true
    if (spec.want === '过审' && String(live?.pending?.action || '') === '现查') return true
    if (live?.pending?.alreadyAtTarget || live?.ui?.alreadyAtTarget) return true
    if (namedInSpeech && live?.pending?.first && live.pending.first !== namedInSpeech && spec.want === '过审') return true
    const fc = rec.failCode || live?.failCode || ''
    return fc === '过审-empty-changes'
      || fc === '改行-empty-changes'
      || fc === '过审-already-at-target'
      || fc === '改行-already-at-target'
      || fc === 'empty-sheet'
      || (spec.n === 7 && fc.startsWith('action-mismatch'))
  }

  async function tryDriftSwap(spec, rec, live) {
    if (rec.swapAttempted) return null
    if (![6, 7, 9, 10].includes(spec.n)) return null
    rec.swapAttempted = true
    const proveSpeech = String(rec.speech || spec.speech)
    const kind = connectedKindForSpeech(proveSpeech)
    if (!kind) return null
    const stale = String(rec.swappedTo || namedIdFromSpeech(spec.speech) || live?.pending?.first || rec.first || '')
    if (spec.n === 9 && !rec.maternityEmpty) {
      const qFound = await lookupSlice(kind, String(spec.querySpeech || ''))
      const maternity = maternityLiveItems(qFound)
      if (maternity.length || /产假/.test(whereBlob(qFound))) return null
      rec.maternityEmpty = true
      rec.driftNote = rec.driftNote || '产假待审切片为空，改走同条件待审请假过审'
    }
    const query = swapQuerySpeech(spec, rec)
    let found = await lookupSlice(kind, query)
    rec.driftLookup = found
    const nextNo = pickLiveNo(found, stale, { skipApproved: spec.want === '过审' || spec.want === '改行' })
    if (!nextNo) return null
    rec.swappedFrom = rec.swappedFrom || stale
    rec.swappedTo = nextNo
    rec.swapped = true
    rec.speech = swappedUtterance(spec, kind, nextNo)
    await clickCancelIfOpen()
    await dismissAskCard()
    return promptWait({
      want: spec.want,
      speech: rec.speech,
      write: Boolean(spec.write),
      hopNeed: hopNeedFor(rec.speech).need,
      pickThenWrite: false,
    })
  }

  async function ensureIdleBeforeCase(spec, prevRec) {
    if (spec.n < 5) return
    await dismissAskCard()
    await clickCancelIfOpen()
    await waitAskClosed(90000)
    let pending = await readPending()
    const prevSpeech = prevRec ? String(prevRec.speech || '') : ''
    if (prevRec && prevSpeech && speechMatchesTurn(pending.speech, prevSpeech, prevSpeech)) {
      await page.waitForTimeout(8000)
      await waitAskClosed(90000)
      pending = await readPending()
      if (speechMatchesTurn(pending.speech, prevSpeech, prevSpeech) && /深度求索中/.test(await iframeBlob())) {
        /* still thinking from previous turn */
      }
    }
  }

  function swappedUtterance(spec, kind, no) {
    const ticket = String(no || '').trim()
    if (!ticket) return ''
    if (spec.n === 6) return `过一下请假单 ${ticket}。${PREVIEW_ONLY}`
    if (spec.n === 7) return `把工单 ${ticket} 改成已解决。${PREVIEW_ONLY}`
    if (spec.n === 9) return `过一下请假单 ${ticket}。${PREVIEW_ONLY}`
    if (spec.n === 10) return `把回款 ${ticket} 的备注改成催收。${PREVIEW_ONLY}`
    const raw = String(spec.speech || '')
    if (/[A-Za-z]{1,8}-?\d{4}-\d+/.test(raw)) {
      return raw.replace(/[A-Za-z]{1,8}-?\d{4}-\d+/, ticket)
    }
    return `${kind} ${ticket}。${PREVIEW_ONLY}`
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
      const emptyHint = /没有可展示的变更内容|没有待提交的变更|无需再过审/.test(drawerText)
      const alreadyAtTarget = /无需再过审|没有待提交的变更/.test(drawerText)
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
        alreadyAtTarget,
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

  function isPickThenWriteListState(pending, ui) {
    if (String(pending?.action || '') !== '现查') return false
    const rows = Number(pending?.rows || 0)
    if (rows <= 1) return false
    if (ui?.drawerOpen) return false
    if (isCatalogDump(pending, ui)) return false
    return sameSheet(ui, pending)
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
    if (pickThenWrite && isPickThenWriteListState(pending, ui)) return true
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
    else if (String(pending.action || '') !== want && !(pickThenWrite && isPickThenWriteListState(pending, ui))) {
      row.failCode = `action-mismatch(${pending.action || 'none'})`
    }
    else if (hopNeed && !hop.hop) row.failCode = 'one-sided-no-from'
    else if (!pending.rows && want !== '新建') row.failCode = 'empty-sheet'
    else if (!sameSheet(ui, pending) && want !== '新建') row.failCode = `sheet-mismatch(footer=${ui.footerCount},tbody=${ui.tbodyRows},pending=${pending.rows},ui=${ui.firstNo},pendingFirst=${pending.first})`
    else if (pickThenWrite && !isSingleMatchWrite(pending, ui, want)) {
      row.failCode = prematureWriteCode(pending, ui)
        || (isWaitingPick(pending, ui) || isPickThenWriteListState(pending, ui)
          ? ''
          : `wait-pick-miss(rows=${pending.rows},preview=${pending.preview_id || 'none'},listed=${pending.listed},amb=${pending.ambiguous},drawer=${ui.drawerOpen})`)
    } else if (write && isWaitingPick(pending, ui) && !pickThenWrite) row.failCode = `asked-one-by-one(rows=${pending.rows})`
    else if (write && !drawerShowsAction(ui, want)) row.failCode = `drawer-mismatch(${ui.drawerAction || 'none'})`
    else if (write && !pending.preview_id && pending.rows >= 8) row.failCode = `catalog-or-no-preview(rows=${pending.rows})`
    else if (write && (want === '改行' || want === '过审') && (ui.emptyHint || !hasFieldDiffs(ui, pending))) row.failCode = `${want}-empty-changes`
    else if (!row.leftHasFirst && pending.first && !(pickThenWrite && isPickThenWriteListState(pending, ui))) row.failCode = 'left-ai-missing-row'
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
        const listPick = pickThenWrite && isPickThenWriteListState(pending, ui)
        if (!last.thinking || listPick || (write && !pickThenWrite && drawerShowsAction(ui, want)) || (pickThenWrite && (isWaitingPick(pending, ui) || isSingleMatchWrite(pending, ui, want)))) {
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
      && String(pending.first) === String(prevSnap.first)) {
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

    if (spec.n === 5) {
      const expenseRow = resolveKindRow('报销单', kindCatalog, aliasesMap)
      if (expenseRow && pending.kind !== expenseRow.kind) {
        return { failCode: `case5-wrong-kind(${pending.kind})`, contract }
      }
      if (!pending.rows) return { failCode: 'case5-empty-batch', contract }
      if (!pending.preview_id) return { failCode: 'case5-no-preview', contract }
      if (!drawerShowsAction(ui, '过审')) return { failCode: 'case5-drawer', contract }
    }

    if (spec.write && (spec.want === '改行' || spec.want === '过审')) {
      if (!pending.preview_id) return { failCode: 'preview-missing', contract }
      if (!drawerShowsAction(ui, spec.want)) return { failCode: `drawer-mismatch(${ui.drawerAction || 'none'})`, contract }
      if ((pending.alreadyAtTarget || ui.alreadyAtTarget) && (ui.emptyHint || !hasFieldDiffs(ui, pending))) {
        return { failCode: `${spec.want}-already-at-target`, contract }
      }
      if (ui.emptyHint || !hasFieldDiffs(ui, pending)) return { failCode: `${spec.want}-empty-changes`, contract }
    }

    return { failCode: '', contract }
  }

  async function fillRecFromLive(rec, spec, live) {
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
    rec.alreadyAtTarget = Boolean(live.pending.alreadyAtTarget || live.ui.alreadyAtTarget)
    rec.hitSet = live.hitSet || rec.hitSet || null
    rec.picked = live.picked || rec.picked || null
    rec.afterPick = live.afterPick || rec.afterPick || null
    rec.pendingSpeech = live.pending.speech || ''
    rec.nos = Array.isArray(live.pending.nos) ? live.pending.nos : []
    rec.canWrite = live.pending.canWrite
    rec.speak = live.pending.speak || ''
    if (spec.n === 2) {
      const fromNos = Array.isArray(live.pending.fromNos) ? live.pending.fromNos : []
      const allNos = [...new Set([...rec.nos, ...fromNos, rec.first].map(String).filter(Boolean))]
      rec.hasBizMarker = allNos.includes(BIZ_ROW_MARKER)
      rec.fromNos = fromNos
    }
  }

  let prevSnap = null
  let prevRec = null

  for (const spec of CASES) {
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
      await ensureIdleBeforeCase(spec, prevRec)
      await preDriftBeforeProve(spec, rec)
      const skipQuery = Boolean(spec.queryThenWrite && (
        (spec.n === 9 && rec.maternityEmpty)
        || (spec.n === 10 && rec.contractSliceEmpty && rec.swapped)
      ))
      let leftBlob = ''
      if (spec.queryThenWrite && !skipQuery) {
        const queryHop = hopNeedFor(spec.querySpeech)
        rec.query = await promptWait({
          want: '现查',
          speech: spec.querySpeech,
          write: false,
          hopNeed: queryHop.need,
        })
        leftBlob = `${rec.query.leftSnippet || ''}`
      }
      let live = await promptWait({
        want: spec.want,
        speech: rec.speech,
        write: Boolean(spec.write),
        hopNeed: hopNeedFor(rec.speech).need,
        pickThenWrite: Boolean(spec.pickThenWrite),
      })
      leftBlob = `${leftBlob} ${live.leftSnippet || ''} ${live.aiDelta || ''}`
      await fillRecFromLive(rec, spec, live)

      let judged = await judgeFrozenContract(spec, live, {
        prevSnap,
        turnSpeech: rec.speech,
        leftBlob,
      })
      rec.contract = judged.contract
      if (judged.failCode && proveTurnStillDrifted(spec, live, rec)) {
        rec.failCode = judged.failCode
        rec.explicitAlready = Boolean(live.pending?.alreadyAtTarget || live.ui?.alreadyAtTarget)
        const swapped = await tryDriftSwap(spec, rec, live)
        if (swapped) {
          live = swapped
          leftBlob = `${leftBlob} ${swapped.leftSnippet || ''} ${swapped.aiDelta || ''}`
          await fillRecFromLive(rec, spec, live)
          judged = await judgeFrozenContract(spec, live, {
            prevSnap,
            turnSpeech: rec.speech,
            leftBlob,
          })
          rec.contract = judged.contract
        }
      }
      if (judged.failCode) {
        rec.failCode = judged.failCode
        throw Object.assign(new Error(rec.failCode), { row: rec })
      }

      rec.pass = true
      rec.failCode = ''
      await saveCasePng(spec.n)
      prevSnap = sheetSnap(live.pending)
      prevRec = rec
    } catch (error) {
      rec.pass = false
      rec.failCode = rec.failCode || error?.row?.failCode || error?.message || String(error)
      rec.error = String(error?.message || error)
      if (error?.row?.hitSet) rec.hitSet = error.row.hitSet
      if (error?.row?.picked) rec.picked = error.row.picked
      if (error?.row?.pending) rec.pending = error.row.pending
      const liveErr = error?.row
      if (proveTurnStillDrifted(spec, liveErr, rec) && !rec.swapAttempted) {
        try {
          const swapped = await tryDriftSwap(spec, rec, liveErr)
          if (swapped) {
            await fillRecFromLive(rec, spec, swapped)
            const judged = await judgeFrozenContract(spec, swapped, {
              prevSnap,
              turnSpeech: rec.speech,
              leftBlob: `${swapped.leftSnippet || ''} ${swapped.aiDelta || ''}`,
            })
            rec.contract = judged.contract
            if (!judged.failCode) {
              rec.pass = true
              rec.failCode = ''
              rec.error = undefined
              prevSnap = sheetSnap(swapped.pending)
              prevRec = rec
            } else {
              rec.failCode = judged.failCode
            }
          }
        } catch (swapError) {
          rec.swapError = String(swapError?.message || swapError)
        }
      }
      if (!rec.pass) prevRec = rec
      await saveCasePng(spec.n).catch(() => {})
    }
    out.cases.push(rec)
    console.log(JSON.stringify({
      n: rec.n,
      pass: rec.pass,
      failCode: rec.failCode || '',
      kind: rec.kind || '',
      rows: rec.rows ?? null,
      swapped: rec.swapped || false,
      swappedTo: rec.swappedTo || '',
    }))
  }

  for (let i = out.cases.length; i < CASES.length; i += 1) {
    const spec = CASES[i]
    out.cases.push({ n: spec.n, speech: spec.speech, pass: false, failCode: 'stopped-before' })
  }

  const allCasesPass = out.cases.length === 10 && out.cases.every((row) => row.pass)
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

# Verify: BO 十条 live × 剩余九阀（preview only）

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${branch}\`
**failCode:** ${out.failCode || '—'}
**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}
**确认过账:** no
**5174 未杀:** yes

## 十条

| # | 过/没过 | fail | 证据 |
|---|---|---|---|
${caseRows}

已对：${passed.length ? passed.join('、') : '无'}
未对：${failed.length ? failed.join('、') : (out.pass ? '无' : '见上表')}
仍差：${out.pass ? '无（本 slice 仅 10 条 + C1–C4）' : (out.failCode || '现网未齐')}

## 图

\`${MEDIA}\`

${out.error ? `## 错误\n\n\`${out.error}\`` : ''}
`
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2), 'utf8')
  await writeFile(REPORT_MD, md, 'utf8')
  await dualWrite(REPORT_MD, 'internal/verify-records-close-bo.md')
  await dualWrite(REPORT_JSON, 'internal/verify-records-close-bo.json')
  if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/records-close-bo.png')
  await browser.close()
  console.log(JSON.stringify({ pass: out.pass, failCode: out.failCode, sha: out.sha, cases: out.cases?.map((r) => ({ n: r.n, pass: r.pass })) }))
  if (!out.pass) process.exitCode = 1
}
