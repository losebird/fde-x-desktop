/**
 * Live prove §5: non-target kind chip shows this hop's hits, not catalog.
 * Store internal/ only — do not git-add. 现查 only; never 确认过账 / biz_write.
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
const MEDIA = `${STORE}/media/records-kind-chip.png`
const REPORT_JSON = `${STORE}/internal/verify-records-kind-chip.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const speech = '待审回款 ∩ 已到期合同'
const CATALOG_PAGE = 20

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
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await page.waitForTimeout(2500)

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
  out.targetKindFromVocab = targetKind
  const sideKindFromVocab = relatedPack.related.find((kind) => kind && kind !== targetKind) || ''
  out.sideKindFromVocab = sideKindFromVocab

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
        first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || '') : '',
        fromKind: from?.kind || '',
        fromRows: fromRows.length,
        fromFirst: fromRows[0] && typeof fromRows[0] === 'object' ? String(fromRows[0].no || fromRows[0].orderId || fromRows[0].id || '') : '',
        fromHasRows: Boolean(from && Array.isArray(from.rows)),
        hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
        steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind || row).filter(Boolean) : [],
        speech: sheet?.speech || '',
        preview_id: sheet?.preview_id || json?.data?.preview_id || null,
        sessionId: sheet?.sessionId || '',
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
      const selectedChip = kindChipEls.find((b) => b.className.includes('!bg-ink'))?.textContent?.replace(/\s+/g, ' ').trim() || ''
      return {
        kindChips,
        selectedChip,
        footer,
        footerCount,
        tbodyRows,
        firstNo,
        banner,
        kinds,
      }
    }, labels)
  }

  async function promptAndWait() {
    const row = { utterance: speech, wantAction: '现查' }
    const baseline = await iframeBlob()
    await page.evaluate((prompt) => {
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', { detail: { text: prompt } }))
    }, speech)
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
      const actionHit = String(pending.action || '') === '现查'
      if (!row.thinking && actionHit && hop && pending.rows > 0) break
    }
    if (await recordsBtn.count()) await recordsBtn.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(700)
    const pending = await readPending()
    const ui = await readUi()
    row.pending = pending
    row.ui = ui
    if (String(pending.action || '') !== '现查') row.failCode = `action-mismatch(${pending.action || 'none'})`
    else if (!hoppedOf(pending)) row.failCode = 'one-sided-no-from'
    else if (!pending.rows) row.failCode = 'empty-sheet'
    if (row.failCode) throw Object.assign(new Error(row.failCode), { row })
    return row
  }

  const listed = await promptAndWait()
  out.afterHop = {
    kind: listed.pending.kind,
    action: listed.pending.action,
    pendingRows: listed.pending.rows,
    first: listed.ui.firstNo || listed.pending.first,
    footerCount: listed.ui.footerCount,
    tbodyRows: listed.ui.tbodyRows,
    kindChips: listed.ui.kindChips,
    fromKind: listed.pending.fromKind,
    fromRows: listed.pending.fromRows,
    fromFirst: listed.pending.fromFirst,
    fromHasRows: listed.pending.fromHasRows,
    steps: listed.pending.steps,
    hopWhere: listed.pending.hopWhere,
  }
  if (!listed.pending.fromHasRows) {
    out.failCode = 'overlay-from-rows-missing'
    throw new Error(out.failCode)
  }

  const relatedKinds = [...new Set([
    ...(out.relatedKinds || []),
    listed.pending.kind,
    listed.pending.fromKind,
    ...(listed.pending.steps || []),
  ].filter(Boolean))]

  const chipDeadline = Date.now() + 20000
  let chips = listed.ui.kindChips.map((text) => parseChip(text, relatedKinds))
  let sideChip = chips.find((row) => row.kind && row.kind !== listed.pending.kind)
  while (Date.now() < chipDeadline && !(sideChip && Number.isFinite(sideChip.count) && sideChip.count > 0)) {
    await page.waitForTimeout(500)
    const ui = await readUi()
    chips = ui.kindChips.map((text) => parseChip(text, relatedKinds))
    sideChip = chips.find((row) => row.kind && row.kind !== listed.pending.kind)
  }
  const targetChip = chips.find((row) => row.kind && row.kind === listed.pending.kind)
  out.targetChip = targetChip || null
  out.sideChip = sideChip || null
  if (!sideChip?.kind) {
    out.failCode = 'non-target-chip-missing'
    throw new Error(out.failCode)
  }

  const clicked = await page.evaluate((kindName) => {
    const wrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].some((b) => (b.textContent || '').includes(kindName)))
    const btn = [...(wrap?.querySelectorAll('button.btn') || [])].find((b) => (b.textContent || '').includes(kindName))
    if (!btn) return { ok: false, disabled: null, text: '' }
    const disabled = Boolean(btn.disabled)
    btn.disabled = false
    btn.click()
    return { ok: true, disabled, text: (btn.textContent || '').replace(/\s+/g, ' ').trim() }
  }, sideChip.kind)
  out.sideClick = clicked
  if (!clicked?.ok) {
    out.failCode = 'non-target-chip-not-clickable'
    throw new Error(out.failCode)
  }
  const sideWait = Date.now() + 8000
  let afterSide = await readUi()
  while (Date.now() < sideWait) {
    const selected = parseChip(afterSide.selectedChip, relatedKinds)
    if (selected.kind && selected.kind === sideChip.kind) break
    if (afterSide.firstNo && listed.pending.fromFirst && afterSide.firstNo === listed.pending.fromFirst) break
    await page.waitForTimeout(400)
    afterSide = await readUi()
  }
  const afterSidePending = await readPending()
  out.afterSideClick = {
    kind: afterSide.selectedChip || sideChip.kind,
    rows: afterSide.tbodyRows,
    footerCount: afterSide.footerCount,
    first: afterSide.firstNo,
    kindChips: afterSide.kindChips,
    banner: afterSide.banner,
    pendingKind: afterSidePending.kind,
    pendingRows: afterSidePending.rows,
    pendingFirst: afterSidePending.first,
  }

  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  const shown = Number.isFinite(afterSide.footerCount) ? afterSide.footerCount : afterSide.tbodyRows
  const chipCount = Number.isFinite(sideChip.count) ? sideChip.count : shown
  const hopHits = listed.pending.fromRows
  out.sideIsThisHop = shown === hopHits && shown === afterSide.tbodyRows && shown === chipCount
  out.sideIsCatalog = looksLikeCatalog(hopHits, shown)
  if (out.sideIsCatalog || shown === CATALOG_PAGE && shown !== hopHits) {
    out.failCode = `side-chip-catalog(shown=${shown},hopHits=${hopHits},chip=${chipCount})`
    throw new Error(out.failCode)
  }
  if (!out.sideIsThisHop) {
    out.failCode = `side-chip-not-hop-hits(shown=${shown},hopHits=${hopHits},chip=${chipCount},tbody=${afterSide.tbodyRows})`
    throw new Error(out.failCode)
  }
  if (hopHits > 0 && listed.pending.fromFirst && afterSide.firstNo && afterSide.firstNo !== listed.pending.fromFirst) {
    out.failCode = `side-first-mismatch(${afterSide.firstNo}≠${listed.pending.fromFirst})`
    throw new Error(out.failCode)
  }

  if (!targetChip?.kind) {
    out.failCode = 'target-chip-missing'
    throw new Error(out.failCode)
  }
  const targetClicked = await page.evaluate((kindName) => {
    const wrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].some((b) => (b.textContent || '').includes(kindName)))
    const btn = [...(wrap?.querySelectorAll('button.btn') || [])].find((b) => (b.textContent || '').includes(kindName))
    if (!btn) return false
    btn.disabled = false
    btn.click()
    return true
  }, targetChip.kind)
  if (!targetClicked) {
    out.failCode = 'target-chip-not-clickable'
    throw new Error(out.failCode)
  }
  const backWait = Date.now() + 8000
  let afterBack = await readUi()
  while (Date.now() < backWait) {
    if (listed.pending.first && afterBack.firstNo === listed.pending.first) break
    await page.waitForTimeout(400)
    afterBack = await readUi()
  }
  out.afterTargetClick = {
    kind: afterBack.selectedChip || targetChip.kind,
    rows: afterBack.tbodyRows,
    footerCount: afterBack.footerCount,
    first: afterBack.firstNo,
    kindChips: afterBack.kindChips,
  }
  const backShown = Number.isFinite(afterBack.footerCount) ? afterBack.footerCount : afterBack.tbodyRows
  out.backIsThisHop = backShown === listed.pending.rows && afterBack.tbodyRows === listed.pending.rows
  if (listed.pending.first && afterBack.firstNo && afterBack.firstNo !== listed.pending.first) {
    out.failCode = `target-first-mismatch(${afterBack.firstNo}≠${listed.pending.first})`
    throw new Error(out.failCode)
  }
  if (!out.backIsThisHop) {
    out.failCode = `target-chip-not-intersection(shown=${backShown},hop=${listed.pending.rows})`
    throw new Error(out.failCode)
  }

  const tools = await recentTools()
  out.wrote = tools.some((item) => /biz_write|biz\.write/i.test(String(item.tool || '')))
  if (out.wrote) {
    out.silentBizWrite = true
    out.failCode = 'silent-biz-write'
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
out.confirmed = false
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
  afterHop: out.afterHop,
  sideChip: out.sideChip,
  afterSideClick: out.afterSideClick,
  afterTargetClick: out.afterTargetClick,
  sideIsThisHop: out.sideIsThisHop,
  sideIsCatalog: out.sideIsCatalog,
  backIsThisHop: out.backIsThisHop,
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exit(1)
