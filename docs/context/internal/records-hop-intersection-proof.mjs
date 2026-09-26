/**
 * One-shot hop-intersection proof. Store internal/ only — do not git-add into the product tree.
 * Step I only: live 待审回款 ∩ 已到期合同. Do not redo G/H unless this prove shows a regression.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { kindMentions, relatedMentionedKinds } from '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/vendor-overlays/dsh-lan-assist/slots.js'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/records-hop-intersection.png`
const REPORT = `${STORE}/internal/verify-records-hop-intersection.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const reuseSessionId = String(process.env.HOP_SESSION || '').trim()
const speech = '待审回款 ∩ 已到期合同'
const AGENT_ID = 'bc-c3b01a5b-d699-5722-a4ad-166d5dc8a64c'

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function hopOnMain(sha) {
  try {
    execSync(`git merge-base --is-ancestor 216b45d727cf264a310b6a7d06392156ae77997e ${sha}`, { cwd: SCENE })
    return true
  } catch {
    return false
  }
}

function errBlob(json) {
  return json?.error || json?.data?.error || json?.data?.sheet?.error || json?.sheet?.error || null
}

function isExpired(err) {
  if (!err) return false
  const code = String(err.code || err || '')
  const msg = String(err.message || err.msg || err || '')
  return code === 'EXPIRED' || /过期|EXPIRED/i.test(msg)
}

function sheetOf(json) {
  const data = json?.data && typeof json.data === 'object' ? json.data : json
  return data?.sheet && typeof data.sheet === 'object' ? data.sheet : data
}

function rowCount(sheet) {
  return Array.isArray(sheet?.rows) ? sheet.rows.length : 0
}

function firstNo(sheet) {
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const lead = rows[0]
  if (!lead || typeof lead !== 'object') return ''
  return String(lead.no || lead.paymentNo || lead.contractNo || '')
}

function firstStatus(sheet) {
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const lead = rows[0]
  if (!lead || typeof lead !== 'object') return ''
  return String(lead.status || lead.状态 || '')
}

function firstFields(sheet) {
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const lead = rows[0]
  if (!lead || typeof lead !== 'object') return {}
  return lead.fields && typeof lead.fields === 'object' ? lead.fields : {}
}

function writableInput(fields) {
  const own = fields && typeof fields === 'object' ? fields : {}
  const key = Object.keys(own).reverse().find((name) => (
    name
    && !/^(id|no|status|index)$/i.test(name)
    && !/Id$|_id$/.test(name)
    && !/^(createdAt|updatedAt|createdBy|updatedBy)$/i.test(name)
  ))
  if (!key) return {}
  return { [key]: own[key] }
}

function hopMeta(sheet) {
  const from = sheet?.from && typeof sheet.from === 'object' ? sheet.from : null
  const hopWhere = Array.isArray(sheet?.hopWhere) ? sheet.hopWhere : []
  const steps = Array.isArray(sheet?.steps) ? sheet.steps : []
  const where = Array.isArray(sheet?.where) ? sheet.where : []
  return {
    fromKind: from?.kind ? String(from.kind) : '',
    fromNested: from?.from && typeof from.from === 'object' ? String(from.from.kind || '') : '',
    fromWhere: Array.isArray(from?.where) ? from.where : [],
    hopWhere,
    where,
    steps: steps.map((row) => String(row?.kind || '')).filter(Boolean),
    hopped: Boolean(from?.kind) || hopWhere.length > 0 || steps.length > 1,
  }
}

function summarizeSheet(json) {
  const err = errBlob(json)
  const sheet = sheetOf(json)
  const hop = hopMeta(sheet)
  return {
    error: err,
    expired: isExpired(err),
    kind: sheet?.kind || null,
    rows: rowCount(sheet),
    first: firstNo(sheet),
    status: firstStatus(sheet),
    speak: String(sheet?.speak || '').slice(0, 240),
    speech: String(sheet?.speech || ''),
    fields: firstFields(sheet),
    ...hop,
  }
}

function coolingIn(text) {
  return /429|RATE_LIMIT|rate.?limit|upstream_cooling|上游账号正在冷却|可用账号正在冷却/i.test(String(text || ''))
}

function spokenCountFrom(text) {
  const src = String(text || '')
  if (!src.trim() || coolingIn(src)) return null
  const cleaned = src
    .replace(/\d+\s*条消息/g, ' ')
    .replace(/\d+\s*次工具调用/g, ' ')
    .replace(/\d+\s*轮/g, ' ')
    .replace(/\d+\s*步/g, ' ')
  const eqZhang = cleaned.match(/=\s*(\d+)\s*张/)
  if (eqZhang) return Number(eqZhang[1])
  if (/就这一[张条行]/.test(cleaned)) return 1
  const zhang = [...cleaned.matchAll(/(\d+)\s*张/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n))
  if (zhang.length) return zhang[zhang.length - 1]
  const hits = [...cleaned.matchAll(/(\d+)\s*(?:条|行)/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n))
  if (!hits.length) return null
  return hits[hits.length - 1]
}

const sha = gitSha()
const hopCommitOnMain = hopOnMain(sha)
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

const out = {
  sha,
  hopCommitOnMain,
  speech,
  sessionId: '',
  gateOriginal: null,
  gateRegisteredLabels: null,
  catalogTarget: null,
  catalogMention: null,
  pendingBefore: null,
  pendingAfter: null,
  ui: null,
  aiText: '',
  aiDelta: '',
  aiCount: null,
  expired: false,
  injected: false,
  hardcodedLiterals: 'none',
  connect: null,
  rateLimited: false,
  ghRedone: false,
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
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
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
      p && p.id === 'data' ? { ...p, state: 'full', width: 1100 } : p
    ))
    if (!state.state.panels.some((p) => p && p.id === 'data')) {
      state.state.panels = fallbackPanels
    }
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2500)

  const connect = await page.evaluate(async () => {
    const status = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
    if (status?.data?.connected) return { already: true, status: status.data }
    const res = await fetch('/api/v1/ai/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: '{}',
    })
    const json = await res.json().catch(() => ({}))
    return { already: false, http: res.status, json }
  })
  out.connect = {
    already: !!connect.already,
    http: connect.http || 200,
    connected: Boolean(connect.status?.connected || connect.json?.data?.connected),
    pid: connect.status?.pid || connect.json?.data?.pid,
    error: connect.json?.error || null,
  }
  for (let i = 0; i < 30 && !out.connect.connected; i += 1) {
    await page.waitForTimeout(1000)
    const st = await page.evaluate(async () => {
      const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
      return json?.data || {}
    })
    out.connect.connected = Boolean(st.connected)
    out.connect.pid = st.pid || out.connect.pid
    if (st.lastError) out.connect.error = st.lastError
  }

  const created = reuseSessionId
    ? { http: 200, sessionId: reuseSessionId, error: null, reused: true }
    : await page.evaluate(async (wsId) => {
      const res = await fetch('/api/v1/ai/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ workspaceId: wsId }),
      })
      const json = await res.json().catch(() => ({}))
      return { http: res.status, sessionId: json?.data?.sessionId || '', error: json?.error || null, reused: false }
    }, workspaceId)
  out.created = created
  out.sessionId = created.sessionId || ''
  if (!out.sessionId) {
    out.connect.error = created.error || { message: 'session-create-failed' }
  } else {
    await page.evaluate(({ workspaceId: wsId, sessionId: sid }) => {
      const key = 'scene-39-workstation'
      const raw = localStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : { state: {} }
      state.state = state.state || {}
      state.state.activeWorkspaceId = wsId
      state.state.activeAiSessionId = sid
      state.state.activeDataSubview = 'records'
      if (state.version == null) state.version = 17
      localStorage.setItem(key, JSON.stringify(state))
    }, { workspaceId, sessionId: out.sessionId })
    await page.goto(`${mainBase}/ai/${out.sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(2500)
  }

  const kindsPack = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || {}
    return {
      kinds: Array.isArray(data.kinds) ? data.kinds.map((row) => ({
        kind: String(row?.kind || ''),
        can: Array.isArray(row?.can) ? row.can : [],
        relations: Array.isArray(row?.relations) ? row.relations : [],
      })) : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  }, workspaceCwd)
  out.vocabCounts = { kinds: kindsPack.kinds.length, relations: kindsPack.relations.length }
  out.kindsPack = kindsPack

  const vocabRows = kindsPack.kinds
  const labels = vocabRows.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }
  out.mentionedKinds = [...new Set(kindMentions(speech, labels, bag).map((row) => row.kind))]
  const relatedPack = relatedMentionedKinds(speech, vocabRows, bag)
  out.relatedKinds = relatedPack.related
  const listed = vocabRows.filter((row) => (row.can || []).includes('现查')).map((row) => row.kind)
  const childFirst = listed.filter((kind) => (
    relatedPack.related.includes(kind)
    && kindsPack.relations.some((rel) => String(rel?.to || '') === kind && relatedPack.related.includes(String(rel?.from || '')))
  ))
  const targetCandidates = [...new Set([
    ...childFirst,
    ...relatedPack.related.filter((kind) => listed.includes(kind)),
  ])]
  out.targetCandidates = targetCandidates

  async function preview(kind, text) {
    return page.evaluate(async ({ ws, kind, text }) => {
      const res = await fetch('/api/v1/biz/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ workspace: ws, cwd: ws, kind, action: '现查', speech: text }),
      })
      const json = await res.json().catch(() => ({}))
      return { status: res.status, json }
    }, { ws: workspaceCwd, kind, text })
  }

  const leftoverShort = kindsPack.kinds
    .map((row) => row.kind)
    .filter((kind) => kind && kindsPack.kinds.some((other) => other.kind !== kind && String(other.kind).endsWith(kind)))
  const vocabLong = kindsPack.kinds
    .map((row) => row.kind)
    .filter((kind) => kind && leftoverShort.some((short) => kind.endsWith(short) && kind !== short))
  out.leftoverShort = leftoverShort
  out.vocabLong = vocabLong

  if (out.connect.connected && targetCandidates.length) {
    const target = targetCandidates[0]
    const catalog = await preview(target, target)
    out.catalogTarget = { target, ...summarizeSheet(catalog.json), http: catalog.status }
    if (out.catalogTarget.expired) out.expired = true
    const gate = await preview(target, speech)
    out.gateOriginal = { target, ...summarizeSheet(gate.json), http: gate.status }
    if (out.gateOriginal.expired) out.expired = true
  }
  if (out.connect.connected && leftoverShort.length) {
    const leftover = leftoverShort.find((kind) => (
      (out.relatedKinds || []).some((long) => long.endsWith(kind) && long !== kind)
    )) || leftoverShort.find((kind) => vocabLong.some((long) => long.endsWith(kind))) || leftoverShort[0]
    const remap = await preview(leftover, speech)
    out.gateLeftoverRemap = { leftover, ...summarizeSheet(remap.json), http: remap.status }
    if (out.gateLeftoverRemap.expired) out.expired = true
  }
  if (out.connect.connected && out.mentionedKinds.length) {
    const mention = out.mentionedKinds[0]
    const catalog = await preview(mention, mention)
    out.catalogMention = { kind: mention, ...summarizeSheet(catalog.json), http: catalog.status }
    if (out.catalogMention.expired) out.expired = true
  }

  const registeredPair = kindsPack.kinds
    .map((row) => row.kind)
    .filter((kind) => targetCandidates.includes(kind) || (out.relatedKinds || []).includes(kind))
    .filter((kind) => kind.length > 2)
  if (out.connect.connected && registeredPair.length >= 2) {
    const child = targetCandidates.find((kind) => registeredPair.includes(kind)) || registeredPair[registeredPair.length - 1]
    const parent = registeredPair.find((kind) => kind !== child && !out.mentionedKinds.includes(kind)) || registeredPair.find((kind) => kind !== child)
    if (child && parent) {
      const labeled = `待审${child} ∩ 已到期${parent}`
      const hop = await preview(child, labeled)
      out.gateRegisteredLabels = { child, parent, speech: labeled, ...summarizeSheet(hop.json), http: hop.status }
      if (out.gateRegisteredLabels.expired) out.expired = true
    }
  }
  if (out.connect.connected && targetCandidates.length && out.gateOriginal && !out.gateOriginal.expired) {
    const restore = await preview(targetCandidates[0], speech)
    out.gateRestore = summarizeSheet(restore.json)
    if (out.gateRestore.expired) out.expired = true
  }

  out.pendingBefore = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    return {
      kind: sheet?.kind || null,
      rows: rows.length,
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
      speech: sheet?.speech || '',
    }
  }, workspaceCwd)

  async function openRecordsPanel() {
    const docked = await page.evaluate(() => {
      const records = [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === '业务记录')
      const footer = [...document.querySelectorAll('span')].some((s) => /^共\s+\d+\s+条/.test((s.textContent || '').trim()))
      return records || footer
    })
    if (!docked) {
      const top = page.getByTitle(/^业务应用/)
      if (await top.count()) {
        await top.first().click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(600)
      }
      const tool = page.locator('aside[aria-label="工作区工具"]')
      if (await tool.count()) {
        await tool.getByText('业务应用', { exact: true }).click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(600)
      }
    }
    const stillClosed = await page.evaluate(() => ![...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === '业务记录'))
    if (stillClosed) {
      await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(800)
      if (out.sessionId) {
        await page.goto(`${mainBase}/ai/${out.sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.waitForTimeout(1200)
      }
      const tool = page.locator('aside[aria-label="工作区工具"]')
      if (await tool.count()) {
        await tool.getByText('业务应用', { exact: true }).click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(600)
      }
    }
    const recordsBtn = page.getByRole('button', { name: '业务记录' })
    if (await recordsBtn.count()) {
      await recordsBtn.click({ timeout: 15000 }).catch(() => {})
    }
    out.panelDom = await page.evaluate(() => ({
      recordsBtn: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === '业务记录'),
      footer: [...document.querySelectorAll('span')].map((s) => (s.textContent || '').trim()).find((t) => /^共\s+\d+\s+条/.test(t)) || '',
      tbody: document.querySelectorAll('tbody tr').length,
      toolLabels: [...document.querySelectorAll('aside[aria-label="工作区工具"] span')].map((s) => (s.textContent || '').trim()).filter(Boolean).slice(0, 12),
    }))
    return recordsBtn
  }
  const recordsBtn = await openRecordsPanel()

  await page.waitForTimeout(1500)
  const iframeReady = await page.waitForSelector('iframe', { timeout: 30000 }).then(() => true).catch(() => false)
  out.iframeReady = iframeReady
  await page.waitForTimeout(3000)

  async function iframeBlob() {
    const bits = []
    for (const frame of page.frames()) {
      try {
        const text = await frame.evaluate(() => document.body?.innerText || '')
        if (text) bits.push(text.replace(/\s+/g, ' ').trim())
      } catch {
        /* cross-origin */
      }
    }
    return bits.join('\n')
  }

  const baseline = await iframeBlob()
  out.baselineLen = baseline.length

  out.prompted = { dispatched: !reuseSessionId, sessionId: out.sessionId, text: speech, reused: Boolean(reuseSessionId) }
  if (!reuseSessionId) {
    await page.evaluate(async ({ sessionId: sid, speech: text }) => {
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', { detail: { text } }))
      return { dispatched: true, sessionId: sid, text }
    }, { sessionId: out.sessionId, speech })
  }

  const startedAt = Date.now()
  const deadline = startedAt + (reuseSessionId ? 20000 : 180000)
  while (Date.now() < deadline) {
    await page.waitForTimeout(reuseSessionId ? 1500 : 3000)
    const blob = await iframeBlob()
    const delta = reuseSessionId ? blob : (blob.startsWith(baseline) ? blob.slice(baseline.length) : blob)
    out.aiDelta = delta.slice(-4000)
    out.aiText = blob.slice(-4000)
    if (!reuseSessionId && (coolingIn(delta) || coolingIn(blob.slice(-1500)))) {
      out.rateLimited = true
      break
    }
    const pending = await page.evaluate(async (ws) => {
      const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
      const json = await res.json().catch(() => ({}))
      const sheet = json?.data?.sheet || json?.data || null
      const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
      return {
        kind: sheet?.kind || null,
        action: sheet?.action || null,
        rows: rows.length,
        first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
        status: rows[0] && typeof rows[0] === 'object' ? String(rows[0].status || '') : '',
        from: sheet?.from || null,
        hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
        where: Array.isArray(sheet?.where) ? sheet.where : [],
        steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind).filter(Boolean) : [],
        speech: sheet?.speech || '',
      }
    }, workspaceCwd)
    out.pendingAfter = pending
    const speechHit = String(pending.speech || '').includes('待审回款') || String(pending.speech || '') === speech
    const hopped = Boolean(pending.hopWhere || (pending.steps || []).length > 1 || pending.from)
    const spoken = spokenCountFrom(delta)
    if (spoken != null) out.aiCount = spoken
    if (speechHit && hopped && spoken != null) break
    if (reuseSessionId && spoken != null) break
  }

  await openRecordsPanel()
  if (await recordsBtn.count()) {
    await recordsBtn.click({ timeout: 15000 }).catch(() => {})
  }
  for (let i = 0; i < 40; i += 1) {
    const ready = await page.evaluate((expect) => {
      const footer = [...document.querySelectorAll('span')]
        .map((s) => (s.textContent || '').trim())
        .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
      const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
      const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
      const rows = table ? [...table.querySelectorAll('tbody tr')] : []
      const first = rows[0] ? (rows[0].textContent || '') : ''
      return Number.isFinite(footerCount)
        && footerCount === expect.rows
        && rows.length === expect.rows
        && (!expect.first || first.includes(expect.first))
    }, { rows: out.pendingAfter?.rows || out.gateOriginal?.rows || 0, first: out.pendingAfter?.first || out.gateOriginal?.first || '' })
    if (ready) break
    await page.waitForTimeout(400)
  }

  out.ui = await page.evaluate(() => {
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const chips = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const active = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')]
        .filter((b) => b.className.includes('bg-ink'))
        .map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const footer = [...document.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const empty = [...document.querySelectorAll('td')]
      .some((td) => /当前型还没有可展示的行|加载中/.test(td.textContent || ''))
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
    const firstCell = table?.querySelector('tbody tr')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const bannerEl = document.querySelector('div.border-blue-200.bg-blue-50')
    const banner = bannerEl?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const bannerKind = (banner.match(/AI 刚查了\s+(\S+)/) || banner.match(/AI 拟改\s+(\S+)/) || [])[1] || ''
    const bannerRows = Number((banner.match(/(\d+)\s*行/) || [])[1] || NaN)
    return { chips, active, footer, footerCount, empty, tbodyRows, firstCell, banner, bannerKind, bannerRows }
  })

  const latestBlob = await iframeBlob()
  const latestDelta = latestBlob.startsWith(baseline) ? latestBlob.slice(baseline.length) : latestBlob
  out.aiDelta = latestDelta.slice(-4000)
  out.aiText = latestBlob.slice(-4000)
  if (!out.rateLimited) out.rateLimited = coolingIn(latestDelta) || coolingIn(latestBlob.slice(-1500))
  if (out.rateLimited) {
    out.aiCount = null
  } else if (out.aiCount == null) {
    out.aiCount = spokenCountFrom(latestDelta)
  }

  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const root = document.scrollingElement || document.body
        if (root) root.scrollTop = root.scrollHeight
      })
    } catch {
      /* frames */
    }
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: MEDIA, fullPage: false })

  const livePending = out.pendingAfter || {}
  const liveHopped = Boolean(livePending.from || livePending.hopWhere || (livePending.steps || []).length > 1)
  const liveChip = (() => {
    const text = (out.ui?.active || [])[0] || ''
    const n = Number((text.match(/(\d+)\s*$/) || [])[1] || NaN)
    return Number.isFinite(n) ? n : null
  })()
  const liveTable = Number.isFinite(out.ui?.footerCount) ? out.ui.footerCount : livePending.rows
  const liveIntersection = out.gateOriginal?.hopped && out.gateOriginal.rows ? out.gateOriginal.rows : out.gateRegisteredLabels?.rows
  const iReady = Boolean(
    out.connect?.connected
    && !out.expired
    && !out.rateLimited
    && out.aiCount != null
    && livePending.rows
    && liveHopped
    && livePending.hopWhere
    && (!liveIntersection || livePending.rows === liveIntersection)
    && out.aiCount === liveTable
    && (liveChip == null || liveChip === liveTable)
  )
  out.canActions = []
  out.actionHop = []
  out.writePathRan = false
  if (iReady) {
    out.writePathRan = true
    const hopKind = livePending.kind || out.gateOriginal?.kind
    const row = (out.kindsPack && Array.isArray(out.kindsPack.kinds) ? out.kindsPack.kinds : []).find((item) => item.kind === hopKind)
    const cans = (row && Array.isArray(row.can) ? row.can : []).filter((act) => act && act !== '现查')
    out.canActions = cans
    const input = writableInput(out.gateOriginal?.fields)
    for (const action of ['改行', '删除', '过审', '新建']) {
      if (!cans.includes(action)) continue
      const body = { workspace: workspaceCwd, cwd: workspaceCwd, kind: hopKind, action, speech }
      if (action === '改行') body.input = input
      try {
        const raw = await page.evaluate(async (payload) => {
          const res = await fetch('/api/v1/biz/preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(payload),
          })
          return res.json().catch(() => ({}))
        }, body)
        const sheet = summarizeSheet(raw)
        out.actionHop.push({
          action,
          kind: sheet.kind,
          rows: sheet.rows,
          first: sheet.first,
          hopped: sheet.hopped,
          fromKind: sheet.fromKind,
          steps: sheet.steps,
          hopWhere: sheet.hopWhere.length > 0,
          error: sheet.error,
          previewOnly: true,
        })
      } catch (error) {
        out.actionHop.push({ action, error: String(error && error.message || error), previewOnly: true })
      }
    }
  }
} finally {
  await browser.close()
}

const pending = out.pendingAfter || {}
const hop = hopMeta({ from: pending.from, hopWhere: pending.hopWhere ? pending.from?.where || [{}] : [], steps: (pending.steps || []).map((kind) => ({ kind })), kind: pending.kind, where: pending.where })
if (pending.from || pending.hopWhere || (pending.steps || []).length > 1) hop.hopped = true
const chipCount = (() => {
  const text = (out.ui?.active || [])[0] || ''
  const n = Number((text.match(/(\d+)\s*$/) || [])[1] || NaN)
  return Number.isFinite(n) ? n : null
})()
const tableRows = Number.isFinite(out.ui?.footerCount) ? out.ui.footerCount : pending.rows
const catalogRows = out.catalogTarget?.rows
const catalogFirst = out.catalogTarget?.first || ''
const mentionRows = out.catalogMention?.rows
const trueRows = out.gateRegisteredLabels?.rows
const trueFirst = out.gateRegisteredLabels?.first || ''

const intersectionRows = out.gateOriginal?.hopped && out.gateOriginal.rows ? out.gateOriginal.rows : trueRows
const intersectionFirst = out.gateOriginal?.first || trueFirst

out.canActions = out.canActions || []
out.actionHop = out.actionHop || []
out.writePathRan = Boolean(out.writePathRan)

function writeHopFail() {
  if (!out.writePathRan) return ''
  if (!out.actionHop.length) return 'write-can-empty'
  const bad = out.actionHop.find((row) => {
    if (row.error) return true
    if (!row.hopped) return true
    if (row.action !== '新建' && intersectionRows && row.rows !== intersectionRows) return true
    if (row.action !== '新建' && intersectionFirst && row.first && row.first !== intersectionFirst) return true
    return false
  })
  if (!bad) return ''
  return `g-regression(${bad.action} kind=${bad.kind || '—'} rows=${bad.rows ?? '—'} first=${bad.first || '—'} hop=${bad.hopped ? 'yes' : 'no'})`
}

function failReason() {
  if (out.expired) return 'EXPIRED'
  if (!out.connect?.connected) return 'dsh-not-connected'
  if (!out.sessionId) return 'session-create-failed'
  if (out.rateLimited) return 'ai-429'
  if (!pending.rows) return 'empty-sheet'
  if (mentionRows && pending.kind === out.catalogMention?.kind && pending.rows === mentionRows && pending.rows > 1 && !hop.hopped) {
    return 'one-sided-catalog'
  }
  if (!hop.hopped) return 'one-sided-no-from'
  if (catalogRows && pending.rows === catalogRows && pending.first && catalogFirst && pending.first === catalogFirst && !pending.hopWhere) {
    return 'catalog-half-table'
  }
  if (intersectionRows && pending.rows !== intersectionRows) {
    return `not-relation-chain-intersection(got ${pending.rows}, gate hop is ${intersectionRows} row ${intersectionFirst})`
  }
  if (!Number.isFinite(out.ui?.footerCount) && !(out.ui?.tbodyRows > 0)) return 'records-panel-not-in-frame'
  if (Number.isFinite(out.ui?.footerCount) && out.ui.tbodyRows !== out.ui.footerCount) {
    return `sheet-rows-not-footer(tbody=${out.ui.tbodyRows}, footer=${out.ui.footerCount})`
  }
  if (pending.first && out.ui?.firstCell && !String(out.ui.firstCell).includes(pending.first)) {
    return `sheet-first-not-pending(got ${out.ui.firstCell}, pending ${pending.first})`
  }
  if (chipCount != null && chipCount !== tableRows) return 'chip-not-this-sheet'
  if (Number.isFinite(out.ui?.bannerRows) && out.ui.bannerRows !== tableRows) return 'banner-rows-mismatch'
  if (!pending.hopWhere) return 'pending-hopWhere-empty'
  if (out.aiCount == null) return 'ai-count-missing'
  if (out.aiCount !== tableRows) return 'ai-count-mismatch'
  const writeFail = writeHopFail()
  if (writeFail) return writeFail
  return ''
}

const reason = failReason()
const pass = !reason
const actionLines = (out.actionHop || []).length
  ? (out.actionHop || []).map((row) => `- ${row.action}: hop=${row.hopped ? 'yes' : 'no'} kind=${row.kind || '—'} rows=${row.rows ?? '—'} first=${row.first || '—'} from=${row.fromKind || '—'} steps=${(row.steps || []).join('→') || '—'} previewOnly=yes ${row.error ? `error=${JSON.stringify(row.error)}` : ''}`).join('\n')
  : (out.writePathRan ? '- 词表 can 无改行/删除/过审/新建' : '- 未走（I 未过关）')

const verify = `---
cursor:
  subagentId: "${AGENT_ID}"
---

# Verify: 跨对象 hop 交集 vs 业务记录

**hardcoded literals:** none
**pass:** ${pass ? 'yes' : `no（${reason}）`}
**step:** I only（不重做 G/H，除非本轮暴露回归）

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${sha}\` |
| hop ancestor 216b45d | **${hopCommitOnMain ? 'yes' : 'no'}** |
| hop 是否发生（现查 pending） | **${hop.hopped ? 'yes' : 'no'}** |
| pending hopWhere | **${pending.hopWhere ? 'yes' : 'no'}** |

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。

## I · 原句再验（5174 · cwd \`${workspaceCwd}\` · 会话 \`${out.sessionId || '—'}\`）

| 探针 | rowCount | first | hop |
|---|---:|---|---|
| Ace 原句 gate | ${out.gateOriginal?.rows ?? '—'} | ${out.gateOriginal?.first || '—'} / ${out.gateOriginal?.status || ''} | ${out.gateOriginal?.hopped ? 'yes' : 'no'} from=${out.gateOriginal?.fromKind || '—'} steps=${(out.gateOriginal?.steps || []).join('→') || '—'} |
| leftover remap gate | ${out.gateLeftoverRemap?.rows ?? '—'} | ${out.gateLeftoverRemap?.first || '—'} kind=${out.gateLeftoverRemap?.kind || '—'} leftover=${out.gateLeftoverRemap?.leftover || '—'} | ${out.gateLeftoverRemap?.hopped ? 'yes' : 'no'} from=${out.gateLeftoverRemap?.fromKind || '—'} |
| 登记全称对照 | ${out.gateRegisteredLabels?.rows ?? '—'} | ${out.gateRegisteredLabels?.first || '—'} / ${out.gateRegisteredLabels?.status || ''} | ${out.gateRegisteredLabels?.hopped ? 'yes' : 'no'} from=${out.gateRegisteredLabels?.fromKind || '—'} speech=\`${out.gateRegisteredLabels?.speech || '—'}\` |
| 单侧 target catalog | ${out.catalogTarget?.rows ?? '—'} | ${out.catalogTarget?.first || '—'} | ${out.catalogTarget?.hopped ? 'yes' : 'no'} |
| pending | ${pending.rows ?? '—'} | ${pending.first || '—'} / ${pending.status || ''} | hopWhere=${pending.hopWhere ? 'yes' : 'no'} from=${pending.from?.kind || '—'} steps=${(pending.steps || []).join('→') || '—'} |
| 面板 footer | ${out.ui?.footerCount ?? '—'} | chip: ${(out.ui?.active || []).join(' / ') || '—'} |
| 横幅 | ${Number.isFinite(out.ui?.bannerRows) ? out.ui.bannerRows : '—'} | ${out.ui?.banner || '—'} |
| 左侧 AI 条数 | ${out.rateLimited ? '429 未口述' : (out.aiCount ?? '—')} | |

- **speech（Ace 原句）:** ${speech}
- **mentioned kinds in speech:** ${(out.mentionedKinds || []).join('、') || '—'}
- **target candidates (graph):** ${(out.targetCandidates || []).join('、') || '—'}
- **pending speech:** ${pending.speech || '—'}
- **preview error:** ${out.gateOriginal?.error ? JSON.stringify(out.gateOriginal.error) : 'none'}
- **connect:** connected=${out.connect?.connected} pid=${out.connect?.pid || '—'}
- **rateLimited:** ${out.rateLimited ? 'yes' : 'no'}
- **session create:** ${out.sessionId || 'failed'} http=${out.created?.http ?? '—'}

## 写路径（preview only · I 过关后才走）

词表 can=${(out.canActions || []).join('、') || '—'}。对照只来自词表 can + 图。未静默 biz_write。

${actionLines}

${reason === 'EXPIRED' ? `## 根因（停 · 不改产品）

\`POST /api/v1/biz/preview\` 返回 **EXPIRED**。连接器令牌失效。按计划停下，等批，不改产品逻辑凑数。
` : reason === 'dsh-not-connected' ? `## 根因（停 · 不改产品）

DSH 未接通。connect=${JSON.stringify(out.connect || {})}。
` : reason === 'ai-429' ? `## 根因（停）

左侧仍是 **429 / upstream_cooling**。不编造 AI 条数。I 过关句要 sheet = 左 AI 条数 = 交集。未重做 G/H。
` : reason && reason.startsWith('g-regression') ? `## 根因（停 · G 回归）

写动作 preview 不再是关系链交集。不闷头改 G/H，等批。

actionHop：${JSON.stringify(out.actionHop)}
` : reason ? `## 根因

失败码 \`${reason}\`。

pending：${JSON.stringify(pending)}

ui：${JSON.stringify(out.ui)}

actionHop：${JSON.stringify(out.actionHop)}
` : `## 过关

sheet = 左 AI 条数 = 交集命中，pending 带 hop。改行 / 删除 / 过审 / 新建（词表 can 有的）走同一条关系链交集（preview only）。
`}
**证明脚本：** store \`internal/records-hop-intersection-proof.mjs\`（不入产品仓）。

截图: \`media/records-hop-intersection.png\`

aiDeltaTail: ${JSON.stringify((out.aiDelta || '').slice(-800))}
`

await writeFile(REPORT, verify, 'utf8')
console.log(JSON.stringify({
  pass,
  reason,
  sha,
  sessionId: out.sessionId,
  pending,
  gateOriginal: out.gateOriginal,
  gateRegisteredLabels: out.gateRegisteredLabels,
  catalogTarget: out.catalogTarget,
  catalogMention: out.catalogMention,
  ui: out.ui,
  aiCount: out.aiCount,
  rateLimited: out.rateLimited,
  gateLeftoverRemap: out.gateLeftoverRemap,
  actionHop: out.actionHop,
  writePathRan: out.writePathRan,
  panelDom: out.panelDom,
  media: MEDIA,
}, null, 2))
if (!pass) process.exitCode = 2
