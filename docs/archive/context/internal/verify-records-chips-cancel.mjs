/**
 * Z live prove: connector picker separate from operation kind chips;
 * cancel write preview keeps the floated sheet (no same-kind catalog flash).
 * Store internal/ only — do not git-add. Preview only; never 确认过账.
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
const MEDIA = `${STORE}/media/records-chips-cancel.png`
const REPORT_JSON = `${STORE}/internal/verify-records-chips-cancel.json`
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

function patchFieldFromVocab(row) {
  const fields = Array.isArray(row?.fields) ? row.fields.map((item) => String(item || '').trim()).filter(Boolean) : []
  return fields.find((name) => (
    name
    && !/^(id|no|status|index)$/i.test(name)
    && !/Id$|_id$|No$|编号|状态|金额|日期|时间/.test(name)
  )) || fields.find((name) => name && !/^(id|no|status)$/i.test(name)) || ''
}

function looksLikeCatalog(beforeCount, afterCount) {
  const before = Number(beforeCount)
  const after = Number(afterCount)
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false
  if (after <= before) return false
  if (before <= 3 && after >= 8) return true
  return after >= before * 3 && after >= 8
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
      })) : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  }, workspaceCwd)
  const vocabRows = kindsPack.kinds
  const labels = vocabRows.map((row) => row.kind).filter(Boolean)
  const bag = { vocab: vocabRows, relations: kindsPack.relations }
  const relatedPack = relatedMentionedKinds(speech, vocabRows, bag)
  out.mentionedKinds = [...new Set(kindMentions(speech, labels, bag).map((row) => row.kind))]
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
  const fieldLabel = patchFieldFromVocab(targetRow)
  const writeAction = allowed.find((action) => action !== '过审' && action !== '新建') || allowed[0]
  out.writeAction = writeAction
  if (!writeAction) {
    out.failCode = 'vocab-can-no-write'
    throw new Error(out.failCode)
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
        sessionId: sheet?.sessionId || '',
      }
    }, workspaceCwd)
  }

  async function readUi() {
    return page.evaluate(() => {
      const connectorLabel = [...document.querySelectorAll('label')]
        .find((el) => (el.textContent || '').includes('连接器') && el.querySelector('select'))
      const connectorSelect = connectorLabel?.querySelector('select') || null
      const connectorOptions = connectorSelect
        ? [...connectorSelect.options].map((opt) => (opt.textContent || '').replace(/\s+/g, ' ').trim())
        : []
      const connectorSelected = connectorSelect?.selectedOptions?.[0]
        ? (connectorSelect.selectedOptions[0].textContent || '').replace(/\s+/g, ' ').trim()
        : ''
      const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
        .find((el) => [...el.querySelectorAll('button.btn')].length)
      const kindChips = chipWrap
        ? [...chipWrap.querySelectorAll('button.btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
        : []
      const mixedLocalOnKindRow = kindChips.some((text) => text.includes('本地'))
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
      return {
        connectorOptions,
        connectorSelected,
        kindChips,
        mixedLocalOnKindRow,
        footer,
        footerCount,
        tbodyRows,
        firstNo,
        banner,
        drawerOpen: Boolean(drawer),
        drawerAction,
      }
    })
  }

  async function promptAndWait({ utterance, wantAction, wantDrawer }) {
    const row = { utterance, wantAction, confirmed: false }
    const baseline = await iframeBlob()
    await page.evaluate((prompt) => {
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', { detail: { text: prompt } }))
    }, utterance)
    const deadline = Date.now() + 180000
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000)
      const blob = await iframeBlob()
      const delta = blob.startsWith(baseline) ? blob.slice(baseline.length) : blob
      row.aiDelta = delta.slice(-2000)
      row.thinking = /深度求索中/.test(blob)
      if (coolingIn(delta) || coolingIn(blob.slice(-1500))) {
        out.rateLimited = true
        out.failCode = 'ai-429'
        throw Object.assign(new Error('ai-429'), { row })
      }
      const pending = await readPending()
      const tools = await recentTools()
      const ui = await readUi()
      row.pending = pending
      row.ui = ui
      const wrote = tools.some((item) => /biz_write|biz\.write/i.test(String(item.tool || '')))
      if (wrote) {
        out.wrote = true
        out.silentBizWrite = true
        out.failCode = 'silent-biz-write'
        throw Object.assign(new Error('silent-biz-write'), { row })
      }
      const hop = hoppedOf(pending)
      const actionHit = String(pending.action || '') === wantAction
      const drawerHit = wantDrawer
        ? (ui.drawerOpen && (ui.drawerAction === wantAction || (ui.drawerAction || '').includes(wantAction)))
        : !ui.drawerOpen || ui.drawerAction !== wantAction
      const rowOk = pending.rows > 0
      if (!row.thinking && actionHit && hop && rowOk && (wantDrawer ? drawerHit : true)) break
    }
    if (await recordsBtn.count()) await recordsBtn.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(700)
    const pending = await readPending()
    const ui = await readUi()
    row.pending = pending
    row.ui = ui
    if (String(pending.action || '') !== wantAction) row.failCode = `action-mismatch(${pending.action || 'none'})`
    else if (!hoppedOf(pending)) row.failCode = 'one-sided-no-from'
    else if (!pending.rows) row.failCode = 'empty-sheet'
    else if (wantDrawer && !(ui.drawerOpen && (ui.drawerAction === wantAction || (ui.drawerAction || '').includes(wantAction)))) {
      row.failCode = `drawer-mismatch(${ui.drawerAction || 'none'})`
    }
    if (row.failCode) throw Object.assign(new Error(row.failCode), { row })
    return row
  }

  const listed = await promptAndWait({ utterance: speech, wantAction: '现查', wantDrawer: false })
  out.beforeWrite = {
    kind: listed.pending.kind,
    action: listed.pending.action,
    pendingRows: listed.pending.rows,
    first: listed.ui.firstNo || listed.pending.first,
    footerCount: listed.ui.footerCount,
    tbodyRows: listed.ui.tbodyRows,
    kindChips: listed.ui.kindChips,
    connectorOptions: listed.ui.connectorOptions,
    connectorSelected: listed.ui.connectorSelected,
    mixedLocalOnKindRow: listed.ui.mixedLocalOnKindRow,
    sessionId: listed.pending.sessionId,
  }
  if (listed.ui.mixedLocalOnKindRow) {
    out.failCode = 'kind-chips-mixed-local-app'
    throw new Error(out.failCode)
  }

  const writeUtterance = fieldLabel
    ? `把${speech}那一行的${fieldLabel}改成 hop-z-preview，只要预览，不要过账，不要 biz_write。`
    : `${writeAction}${speech}那一行，只要预览，不要过账，不要 biz_write。`
  const previewed = await promptAndWait({ utterance: writeUtterance, wantAction: writeAction, wantDrawer: true })
  out.beforeCancel = {
    kind: previewed.pending.kind,
    action: previewed.pending.action,
    previewId: previewed.pending.preview_id,
    pendingRows: previewed.pending.rows,
    first: previewed.ui.firstNo || previewed.pending.first,
    footerCount: previewed.ui.footerCount,
    tbodyRows: previewed.ui.tbodyRows,
    drawerOpen: previewed.ui.drawerOpen,
    drawerAction: previewed.ui.drawerAction,
    kindChips: previewed.ui.kindChips,
    mixedLocalOnKindRow: previewed.ui.mixedLocalOnKindRow,
  }
  out.cancelledPreviewId = previewed.pending.preview_id || ''

  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  if (!(await cancelBtn.count())) {
    out.failCode = 'cancel-button-missing'
    throw new Error(out.failCode)
  }
  await cancelBtn.click({ timeout: 8000 })
  await page.waitForTimeout(1500)
  const afterUi = await readUi()
  const afterPending = await readPending()
  out.afterCancel = {
    drawerOpen: afterUi.drawerOpen,
    drawerAction: afterUi.drawerAction,
    pendingAction: afterPending.action,
    pendingPreviewId: afterPending.preview_id,
    kind: afterPending.kind || afterUi.kindChips,
    first: afterUi.firstNo || afterPending.first,
    footerCount: afterUi.footerCount,
    tbodyRows: afterUi.tbodyRows,
    pendingRows: afterPending.rows,
    kindChips: afterUi.kindChips,
    connectorOptions: afterUi.connectorOptions,
    connectorSelected: afterUi.connectorSelected,
    mixedLocalOnKindRow: afterUi.mixedLocalOnKindRow,
    sessionId: afterPending.sessionId,
    banner: afterUi.banner,
  }

  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  if (afterUi.drawerOpen && afterUi.drawerAction === writeAction) {
    out.failCode = 'cancel-did-not-close'
    throw new Error(out.failCode)
  }
  if (afterUi.mixedLocalOnKindRow) {
    out.failCode = 'kind-chips-mixed-local-app'
    throw new Error(out.failCode)
  }
  const beforeCount = Number.isFinite(out.beforeWrite.footerCount) ? out.beforeWrite.footerCount : out.beforeWrite.pendingRows
  const afterCount = Number.isFinite(afterUi.footerCount) ? afterUi.footerCount : afterUi.tbodyRows
  const beforeFirst = String(out.beforeWrite.first || '')
  const afterFirst = String(out.afterCancel.first || '')
  out.sameSheetAfterCancel = beforeCount === afterCount && (!beforeFirst || !afterFirst || beforeFirst === afterFirst)
  if (looksLikeCatalog(beforeCount, afterCount)) {
    out.failCode = `cancel-flashed-catalog(before=${beforeCount},after=${afterCount})`
    throw new Error(out.failCode)
  }
  if (beforeFirst && afterFirst && beforeFirst !== afterFirst && afterCount !== beforeCount) {
    out.failCode = `cancel-first-row-changed(${beforeFirst}→${afterFirst})`
    throw new Error(out.failCode)
  }
  if (afterPending.sessionId && out.sessionId && afterPending.sessionId !== out.sessionId) {
    out.failCode = 'table-pulled-other-session'
    throw new Error(out.failCode)
  }
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
  beforeWrite: out.beforeWrite,
  beforeCancel: out.beforeCancel,
  afterCancel: out.afterCancel,
  sameSheetAfterCancel: out.sameSheetAfterCancel,
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exit(1)
