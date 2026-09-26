/**
 * X live prove: cancel this preview_id, next hop is a new action;
 * 过审 drawer shows changed fields (原值→新值). Store internal/ only — do not git-add.
 * Preview only; never click 确认过账. If 429 or silent biz_write, stop.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import {
  kindMentions,
  relatedMentionedKinds,
} from '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/vendor-overlays/dsh-lan-assist/slots.js'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/records-write-cancel.png`
const REPORT_JSON = `${STORE}/internal/verify-records-write-cancel.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const speech = '待审回款 ∩ 已到期合同'
const WRITE_CAN = ['改行', '删除', '过审', '新建']

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
    hopWhere: Array.isArray(hopWhereRaw) ? hopWhere.length > 0 : Boolean(hopWhereRaw),
    steps: steps.map((row) => String(row?.kind || row || '')).filter(Boolean),
  }
}

function patchFieldFromVocab(row) {
  const fields = Array.isArray(row?.fields) ? row.fields.map((item) => String(item || '').trim()).filter(Boolean) : []
  return fields.find((name) => (
    name
    && !/^(id|no|status|index)$/i.test(name)
    && !/Id$|_id$|No$|编号|状态|金额|日期|时间/.test(name)
  )) || fields.find((name) => name && !/^(id|no|status)$/i.test(name)) || ''
}

function utteranceFor(action, intersection, fieldLabel) {
  if (action === '改行') {
    return fieldLabel
      ? `把${intersection}那一行的${fieldLabel}改成 hop-x-preview，只要预览，不要过账，不要 biz_write。`
      : `改行${intersection}那一行，只要预览，不要过账，不要 biz_write。`
  }
  if (action === '删除') return `删除${intersection}那一行，只要预览，不要过账，不要 biz_write。`
  if (action === '过审') return `过审${intersection}那一行，只要预览，不要过账，不要 biz_write。`
  if (action === '新建') return `按${intersection}同一条关系链新建一条，只要预览，不要过账，不要 biz_write。`
  return intersection
}

function drawerShowsAction(ui, action) {
  const text = String(ui?.drawerText || '')
  if (!ui?.drawerOpen) return false
  return text.includes(`操作：${action}`) || text.includes(`${action}确认`)
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

const out = {
  sha,
  branch,
  hardcodedLiterals: 'none',
  workspaceCwd,
  speech,
  gateInjected: false,
  wrote: false,
  confirmed: false,
  cancelledPreviewId: '',
  nextHopDrawerAction: '',
  approveHasFieldDiffs: false,
  silentBizWrite: false,
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
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
      p && p.id === 'data' ? { ...p, state: 'full', width: 1100 } : p
    ))
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)

  const st = await page.evaluate(async () => {
    const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
    return json?.data || {}
  })
  out.connect = { connected: Boolean(st.connected), pid: st.pid, error: st.lastError || null, reused: false }
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
    out.created = created
    throw new Error(out.failCode)
  }
  await page.evaluate(({ workspaceId: wsId, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeAiSessionId = sid
    state.state.activeDataSubview = 'records'
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, sessionId: out.sessionId })
  await page.goto(`${mainBase}/ai/${out.sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)

  const recordsBtn = page.getByRole('button', { name: '业务记录' })
  if (await recordsBtn.count()) await recordsBtn.click({ timeout: 15000 }).catch(() => {})
  await page.waitForSelector('iframe', { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(1500)

  const kindsPack = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || {}
    return {
      kinds: Array.isArray(data.kinds) ? data.kinds.map((row) => ({
        kind: String(row?.kind || ''),
        can: Array.isArray(row?.can) ? row.can : [],
        fields: Array.isArray(row?.fields) ? row.fields : [],
        relations: Array.isArray(row?.relations) ? row.relations : [],
      })) : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  }, workspaceCwd)
  const vocabRows = kindsPack.kinds
  const labels = vocabRows.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }
  out.mentionedKinds = [...new Set(kindMentions(speech, labels, bag).map((row) => row.kind))]
  const relatedPack = relatedMentionedKinds(speech, vocabRows, bag)
  out.relatedKinds = relatedPack.related
  const childFirst = vocabRows
    .map((row) => row.kind)
    .filter((kind) => (
      relatedPack.related.includes(kind)
      && kindsPack.relations.some((rel) => String(rel?.to || '') === kind && relatedPack.related.includes(String(rel?.from || '')))
    ))
  const targetKind = childFirst[0] || relatedPack.related[0] || ''
  const targetRow = vocabRows.find((row) => row.kind === targetKind) || null
  const allowed = WRITE_CAN.filter((action) => (targetRow?.can || []).includes(action))
  out.targetKindFromVocab = targetKind
  out.targetCan = targetRow?.can || []
  out.allowedWrites = allowed
  const fieldLabel = patchFieldFromVocab(targetRow)
  out.patchFieldFromVocab = fieldLabel
  if (!allowed.includes('过审')) {
    out.failCode = 'vocab-can-missing-approve'
    throw new Error(out.failCode)
  }
  const firstAction = allowed.find((action) => action !== '过审' && action !== '新建') || allowed.find((action) => action !== '过审')
  if (!firstAction) {
    out.failCode = 'vocab-can-no-cancel-hop'
    throw new Error(out.failCode)
  }
  out.firstAction = firstAction

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

  async function recentTools() {
    return page.evaluate(async ({ ws, sid }) => {
      const res = await fetch(`/api/v1/events/recent?workspace=${encodeURIComponent(ws)}&limit=160`, { headers: { accept: 'application/json' } })
      const json = await res.json().catch(() => ({}))
      const items = Array.isArray(json?.items) ? json.items : []
      return items
        .filter((row) => !sid || row.sessionId === sid || !row.sessionId)
        .filter((row) => row.type === 'ai.tool.called' || row.type === 'ai.tool.finished' || row.type === 'biz.sheet.pending')
        .map((row) => ({
          type: row.type,
          tool: row.payload?.tool || '',
          ts: row.ts,
          kind: row.payload?.kind || row.payload?.sheet?.kind || '',
          action: row.payload?.action || row.payload?.sheet?.action || '',
          rows: Array.isArray(row.payload?.sheet?.rows) ? row.payload.sheet.rows.length : row.payload?.rows,
          hop: Boolean(row.payload?.sheet?.from || (Array.isArray(row.payload?.sheet?.hopWhere) && row.payload.sheet.hopWhere.length) || (Array.isArray(row.payload?.sheet?.steps) && row.payload.sheet.steps.length > 1)),
          preview_id: row.payload?.preview_id || row.payload?.sheet?.preview_id || '',
        }))
    }, { ws: workspaceCwd, sid: out.sessionId })
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
        from: sheet?.from || null,
        hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
        steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind || row).filter(Boolean) : [],
        speech: sheet?.speech || '',
        preview_id: sheet?.preview_id || json?.data?.preview_id || null,
        canWrite: Boolean(sheet?.canWrite),
        sessionId: sheet?.sessionId || '',
        changes: Array.isArray(sheet?.changes) ? sheet.changes : [],
      }
    }, workspaceCwd)
  }

  async function readUi() {
    return page.evaluate(() => {
      const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
        .find((el) => [...el.querySelectorAll('button.btn')].length)
      const active = chipWrap
        ? [...chipWrap.querySelectorAll('button.btn')]
          .filter((b) => b.className.includes('bg-ink'))
          .map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
        : []
      const footer = [...document.querySelectorAll('span')]
        .map((s) => s.textContent?.trim() || '')
        .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
      const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
      const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
      const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
      const firstNo = table?.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || ''
      const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const drawer = document.querySelector('div.fixed.inset-y-0.right-0')
      const drawerText = drawer?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const drawerAction = (drawerText.match(/操作：\s*(\S+)/) || [])[1] || ''
      const confirmBtn = [...(drawer ? drawer.querySelectorAll('button') : [])].some((b) => (b.textContent || '').trim() === '确认过账')
      const emptyHint = drawerText.includes('没有可展示的变更内容')
      const changeBlocks = drawer
        ? [...drawer.querySelectorAll('div.border.border-line.divide-y > div')].map((block) => {
          const label = block.querySelector('div.text-xs')?.textContent?.trim() || ''
          const line = block.textContent?.replace(/\s+/g, ' ').trim() || ''
          const arrow = line.includes('→')
          return { label, line, arrow }
        }).filter((row) => row.label || row.arrow)
        : []
      return {
        active,
        footer,
        footerCount,
        tbodyRows,
        firstNo,
        banner,
        drawerOpen: Boolean(drawer),
        drawerAction,
        drawerText: drawerText.slice(0, 500),
        confirmBtn,
        emptyHint,
        changeBlocks,
      }
    })
  }

  async function waitHop(action) {
    const row = { action, utterance: utteranceFor(action, speech, fieldLabel), previewOnly: true, confirmed: false }
    const baseline = await iframeBlob()
    await page.evaluate((prompt) => {
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', { detail: { text: prompt } }))
    }, row.utterance)
    const deadline = Date.now() + 180000
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000)
      const blob = await iframeBlob()
      const delta = blob.startsWith(baseline) ? blob.slice(baseline.length) : blob
      row.aiDelta = delta.slice(-2500)
      row.thinking = /深度求索中/.test(blob)
      if (coolingIn(delta) || coolingIn(blob.slice(-1500))) {
        out.rateLimited = true
        out.failCode = 'ai-429'
        row.failCode = 'ai-429'
        throw Object.assign(new Error('ai-429'), { row })
      }
      const pending = await readPending()
      const tools = await recentTools()
      const ui = await readUi()
      row.pending = pending
      row.tools = tools.slice(-12)
      row.ui = ui
      const wrote = tools.some((item) => /biz_write|biz\.write/i.test(String(item.tool || '')))
      if (wrote) {
        out.wrote = true
        out.silentBizWrite = true
        out.failCode = 'silent-biz-write'
        row.failCode = 'silent-biz-write'
        throw Object.assign(new Error('silent-biz-write'), { row })
      }
      const hop = hoppedOf(pending)
      const actionHit = String(pending.action || '') === action
      const drawerHit = drawerShowsAction(ui, action)
      const rowOk = action === '新建' || pending.rows > 0
      if (!row.thinking && actionHit && hop && rowOk && drawerHit) break
    }
    if (await recordsBtn.count()) await recordsBtn.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(600)
    const pending = await readPending()
    const ui = await readUi()
    const hop = hopMeta(pending)
    row.pending = pending
    row.ui = ui
    row.kind = pending.kind
    row.rows = pending.rows
    row.first = pending.first
    row.hop = hop.hop
    row.fromKind = hop.fromKind
    row.hopWhere = hop.hopWhere
    row.steps = hop.steps
    row.previewId = pending.preview_id
    row.canWrite = pending.canWrite
    row.sessionId = pending.sessionId
    row.drawerAction = ui.drawerAction || ''
    row.changes = pending.changes
    row.emptyHint = ui.emptyHint
    row.changeBlocks = ui.changeBlocks
    if (String(pending.action || '') !== action) row.failCode = `action-mismatch(${pending.action || 'none'})`
    else if (!drawerShowsAction(ui, action)) row.failCode = `drawer-mismatch(${ui.drawerAction || 'none'})`
    else if (!hop.hop) row.failCode = 'one-sided-no-from'
    else if (action !== '新建' && !pending.rows) row.failCode = 'empty-sheet'
    else if (action !== '新建' && pending.rows !== 1) row.failCode = `half-table(rows=${pending.rows})`
    if (row.failCode) throw Object.assign(new Error(row.failCode), { row })
    return row
  }

  const first = await waitHop(firstAction)
  out.firstHop = {
    action: first.action,
    previewId: first.previewId,
    drawerAction: first.drawerAction,
    kind: first.kind,
    first: first.first,
    sessionId: first.sessionId,
    hop: first.hop,
  }

  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  if (!(await cancelBtn.count())) {
    out.failCode = 'cancel-button-missing'
    throw new Error(out.failCode)
  }
  await cancelBtn.click({ timeout: 8000 })
  await page.waitForTimeout(1200)
  const afterCancel = {
    pending: await readPending(),
    ui: await readUi(),
  }
  out.cancelledPreviewId = first.previewId
  out.afterCancel = {
    drawerOpen: afterCancel.ui.drawerOpen,
    drawerAction: afterCancel.ui.drawerAction,
    pendingAction: afterCancel.pending.action,
    pendingPreviewId: afterCancel.pending.preview_id,
    kind: afterCancel.pending.kind || afterCancel.ui.active,
    first: afterCancel.ui.firstNo || afterCancel.pending.first,
    rows: afterCancel.ui.tbodyRows || afterCancel.pending.rows,
    sessionId: afterCancel.pending.sessionId,
  }
  if (afterCancel.ui.drawerOpen && afterCancel.ui.drawerAction === firstAction) {
    out.failCode = 'cancel-did-not-close'
    throw new Error(out.failCode)
  }
  if (afterCancel.pending.preview_id && afterCancel.pending.preview_id === first.previewId && afterCancel.pending.action === firstAction) {
    out.failCode = 'cancel-pending-still-old'
    throw new Error(out.failCode)
  }

  const next = await waitHop('过审')
  out.nextHop = {
    action: next.action,
    previewId: next.previewId,
    drawerAction: next.drawerAction,
    kind: next.kind,
    first: next.first,
    sessionId: next.sessionId,
    hop: next.hop,
    emptyHint: next.emptyHint,
    changeBlocks: next.changeBlocks,
    changes: next.changes,
  }
  out.nextHopDrawerAction = next.drawerAction || next.action
  const payloadDiffs = (next.changes || []).filter((row) => row && (row.from !== undefined || row.to !== undefined) && String(row.from) !== String(row.to))
  const uiDiffs = (next.changeBlocks || []).filter((row) => row.arrow)
  out.approveHasFieldDiffs = payloadDiffs.length > 0 || uiDiffs.length > 0
  if (next.previewId && next.previewId === first.previewId) {
    out.failCode = 'next-hop-reused-cancelled-preview'
    throw new Error(out.failCode)
  }
  if (String(next.drawerAction || '') !== '过审') {
    out.failCode = `next-hop-drawer-not-approve(${next.drawerAction || 'none'})`
    throw new Error(out.failCode)
  }
  if (next.emptyHint || !out.approveHasFieldDiffs) {
    out.failCode = 'approve-empty-changes'
    throw new Error(out.failCode)
  }
  if (next.sessionId && out.sessionId && next.sessionId !== out.sessionId) {
    out.failCode = 'table-pulled-other-session'
    throw new Error(out.failCode)
  }

  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA
  out.failCode = ''
  out.pass = true
} catch (err) {
  if (!out.failCode) {
    out.failCode = 'probe-error'
    out.error = err instanceof Error ? err.message : String(err)
  }
  if (err && err.row) out.lastRow = err.row
  out.pass = false
  try {
    await page.screenshot({ path: MEDIA, fullPage: false })
    out.screenshot = MEDIA
  } catch {
    /* ignore */
  }
} finally {
  await browser.close()
}

out.silentBizWrite = Boolean(out.wrote)
await writeFile(REPORT_JSON, JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify({
  pass: out.pass,
  failCode: out.failCode,
  sha: out.sha,
  branch: out.branch,
  hardcodedLiterals: out.hardcodedLiterals,
  rateLimited: Boolean(out.rateLimited),
  wrote: out.wrote,
  confirmed: out.confirmed,
  silentBizWrite: out.silentBizWrite,
  firstAction: out.firstAction,
  cancelledPreviewId: out.cancelledPreviewId,
  nextHopDrawerAction: out.nextHopDrawerAction,
  approveHasFieldDiffs: out.approveHasFieldDiffs,
  afterCancel: out.afterCancel,
  nextHop: out.nextHop && {
    action: out.nextHop.action,
    previewId: out.nextHop.previewId,
    drawerAction: out.nextHop.drawerAction,
    emptyHint: out.nextHop.emptyHint,
    changeBlocks: out.nextHop.changeBlocks,
    changes: out.nextHop.changes,
  },
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exit(1)
