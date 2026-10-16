/**
 * U live prove + S leftover live check. Store internal/ — do not git-add.
 * Live utterance must be one hop preview. Two one-sided biz_preview + Bash fails.
 * Does not kill pnpm. Gate POST is not the pass.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/records-hop-intersection.png`
const REPORT_JSON = `${STORE}/internal/verify-records-remaining-u.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const speech = '待审回款 ∩ 已到期合同'
const reuseSessionId = String(process.env.HOP_SESSION || '').trim()

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

function spokenCountFrom(text) {
  const src = String(text || '')
  if (!src.trim() || coolingIn(src)) return null
  const cleaned = src
    .replace(/\d+\s*条消息/g, ' ')
    .replace(/\d+\s*次工具调用/g, ' ')
    .replace(/\d+\s*轮/g, ' ')
    .replace(/\d+\s*步/g, ' ')
    .replace(/\d+\s*张表/g, ' ')
    .replace(/事务记录由 SQLite 管理[^。]*/g, ' ')
  const eqZhang = cleaned.match(/=\s*(\d+)\s*张/)
  if (eqZhang) return Number(eqZhang[1])
  if (/就这一[张条行]/.test(cleaned)) return 1
  const zhang = [...cleaned.matchAll(/(\d+)\s*张/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n))
  if (zhang.length) return zhang[zhang.length - 1]
  const hits = [...cleaned.matchAll(/(\d+)\s*(?:条|行)/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n))
  if (!hits.length) return null
  return hits[hits.length - 1]
}

function hoppedOf(sheet) {
  const from = sheet?.from && typeof sheet.from === 'object' ? sheet.from : null
  const hopWhere = Array.isArray(sheet?.hopWhere) ? sheet.hopWhere : []
  const steps = Array.isArray(sheet?.steps) ? sheet.steps : []
  return Boolean((from && from.kind) || hopWhere.length || steps.length > 1)
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
let out = {
  sha,
  branch,
  hardcodedLiterals: 'none',
  workspaceCwd,
  speech,
  gateInjected: false,
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
  await page.waitForTimeout(1500)

  const reconnect = reuseSessionId ? { skipped: true } : await page.evaluate(async () => {
    const before = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
    if (before?.data?.connected) {
      await fetch('/api/v1/ai/disconnect', { method: 'POST', headers: { accept: 'application/json' } }).catch(() => ({}))
    }
    const res = await fetch('/api/v1/ai/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: '{}',
    })
    const json = await res.json().catch(() => ({}))
    return { http: res.status, json, beforePid: before?.data?.pid }
  })
  out.reconnect = { http: reconnect.http, beforePid: reconnect.beforePid, error: reconnect.json?.error || null }
  for (let i = 0; i < 45; i += 1) {
    await page.waitForTimeout(1000)
    const st = await page.evaluate(async () => {
      const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
      return json?.data || {}
    })
    out.connect = { connected: Boolean(st.connected), pid: st.pid, error: st.lastError || null }
    if (st.connected) break
  }
  if (!reuseSessionId && !out.connect?.connected) {
    out.failCode = 'dsh-not-connected'
    throw new Error(out.failCode)
  }
  if (reuseSessionId) {
    const st = await page.evaluate(async () => {
      const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
      return json?.data || {}
    })
    out.connect = { connected: Boolean(st.connected), pid: st.pid, error: st.lastError || null, reused: true }
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
  await page.waitForTimeout(2000)

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
      const res = await fetch(`/api/v1/events/recent?workspace=${encodeURIComponent(ws)}&limit=80`, { headers: { accept: 'application/json' } })
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
          rows: Array.isArray(row.payload?.sheet?.rows) ? row.payload.sheet.rows.length : row.payload?.rows,
          hop: Boolean(row.payload?.sheet?.from || (Array.isArray(row.payload?.sheet?.hopWhere) && row.payload.sheet.hopWhere.length) || (Array.isArray(row.payload?.sheet?.steps) && row.payload.sheet.steps.length > 1)),
        }))
    }, { ws: workspaceCwd, sid: out.sessionId })
  }

  const baseline = await iframeBlob()
  if (!reuseSessionId) {
    await page.evaluate((text) => {
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', { detail: { text } }))
    }, speech)
  }

  const startedAt = Date.now()
  const deadline = startedAt + (reuseSessionId ? 120000 : 180000)
  while (Date.now() < deadline) {
    await page.waitForTimeout(reuseSessionId ? 2000 : 3000)
    const blob = await iframeBlob()
    const delta = reuseSessionId ? blob : (blob.startsWith(baseline) ? blob.slice(baseline.length) : blob)
    out.aiDelta = delta.slice(-4000)
    const thinking = /深度求索中/.test(blob)
    out.thinking = thinking
    if (coolingIn(delta) || coolingIn(blob.slice(-1500))) {
      out.rateLimited = true
      out.failCode = 'ai-429'
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
        first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || '') : '',
        from: sheet?.from || null,
        hopWhere: Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0,
        steps: Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind).filter(Boolean) : [],
        speech: sheet?.speech || '',
      }
    }, workspaceCwd)
    out.pending = pending
    out.tools = await recentTools()
    const spoken = spokenCountFrom(delta)
    if (spoken != null) out.aiCount = spoken
    const hop = hoppedOf(pending)
    const speechHit = String(pending.speech || '').includes('待审回款') || String(pending.speech || '') === speech
    if (!thinking && speechHit && hop && spoken != null) break
    if (!thinking && reuseSessionId && spoken != null && hop) break
  }

  if (out.rateLimited) throw new Error('ai-429')

  if (await recordsBtn.count()) await recordsBtn.click({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  out.ui = await page.evaluate(() => {
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
    const firstCell = table?.querySelector('tbody tr')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const firstNo = table?.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || ''
    const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return { active, footer, footerCount, tbodyRows, firstCell, firstNo, banner }
  })

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
  await page.screenshot({ path: MEDIA, fullPage: false })

  const called = (out.tools || []).filter((row) => row.type === 'ai.tool.called').map((row) => String(row.tool || ''))
  const iframeText = String(out.aiDelta || '')
  const iframePreviews = [...iframeText.matchAll(/biz_preview/g)].length
  const iframeBash = /(?<![A-Za-z_])bash(?![A-Za-z_])/i.test(iframeText)
  out.toolNames = called
  out.bashUsed = called.some((name) => /bash|shell|^nb$/i.test(name)) || (called.length === 0 && iframeBash)
  out.previewCallCount = called.filter((name) => /biz_preview|biz\.preview/i.test(name)).length || iframePreviews
  const bashUsed = out.bashUsed
  const previewCalls = { length: out.previewCallCount }

  const pending = out.pending || {}
  const hop = hoppedOf(pending)
  const tableRows = Number.isFinite(out.ui?.footerCount) ? out.ui.footerCount : pending.rows
  const chipCount = (() => {
    const text = (out.ui?.active || [])[0] || ''
    const n = Number((text.match(/(\d+)\s*$/) || [])[1] || NaN)
    return Number.isFinite(n) ? n : null
  })()

  if (bashUsed) out.failCode = 'two-sided-or-bash'
  else if (previewCalls.length > 1) out.failCode = 'two-one-sided-preview'
  else if (!hop) out.failCode = 'one-sided-no-from'
  else if (!pending.rows) out.failCode = 'empty-sheet'
  else if (out.ui?.tbodyRows !== tableRows) out.failCode = `sheet-rows-not-footer(tbody=${out.ui?.tbodyRows}, footer=${tableRows})`
  else if (pending.first && out.ui?.firstNo && pending.first !== out.ui.firstNo) out.failCode = 'sheet-first-not-pending'
  else if (chipCount != null && chipCount !== tableRows) out.failCode = 'chip-not-this-sheet'
  else if (out.aiCount == null) out.failCode = 'ai-count-missing'
  else if (out.aiCount !== tableRows) out.failCode = 'ai-count-mismatch'
  else if (previewCalls.length < 1 && !pending.speech) out.failCode = 'no-live-preview'
  else out.failCode = ''

  out.pass = !out.failCode
  if (!out.pass) throw new Error(out.failCode)

  const kindsPack = await page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`, { headers: { accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    const kinds = Array.isArray(json?.data?.kinds) ? json.data.kinds : []
    return kinds.map((row) => String(row?.kind || '')).filter(Boolean)
  }, workspaceCwd)
  const leftover = kindsPack.find((kind) => kindsPack.some((other) => other !== kind && other.endsWith(kind)))
  if (leftover) {
    const refuse = await page.evaluate(async ({ ws, kind }) => {
      const res = await fetch('/api/v1/biz/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ workspace: ws, cwd: ws, kind, action: '现查' }),
      })
      const json = await res.json().catch(() => ({}))
      const err = json?.error || json?.data?.error || json?.data?.sheet?.error || null
      const sheet = json?.data?.sheet || json?.data || null
      return {
        http: res.status,
        kind,
        error: err && (err.code || err),
        hint: err && (err.message || err.hint || err),
        sheetKind: sheet && sheet.kind,
        rows: Array.isArray(sheet?.rows) ? sheet.rows.length : 0,
        previewId: sheet?.preview_id || json?.data?.preview_id || null,
      }
    }, { ws: workspaceCwd, kind: leftover })
    out.leftoverLive = refuse
  }
} catch (err) {
  if (!out.failCode) {
    out.failCode = 'probe-error'
    out.error = err instanceof Error ? err.message : String(err)
  }
  out.pass = false
  try {
    await page.screenshot({ path: MEDIA, fullPage: false })
  } catch {
    /* ignore */
  }
} finally {
  await browser.close()
}

await writeFile(REPORT_JSON, JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify({
  pass: out.pass,
  failCode: out.failCode,
  sha: out.sha,
  rateLimited: Boolean(out.rateLimited),
  aiCount: out.aiCount ?? null,
  pending: out.pending,
  ui: { tbody: out.ui?.tbodyRows, footer: out.ui?.footerCount, first: out.ui?.firstNo, chip: out.ui?.active },
  tools: out.toolNames,
  leftoverLive: out.leftoverLive || null,
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exit(1)
