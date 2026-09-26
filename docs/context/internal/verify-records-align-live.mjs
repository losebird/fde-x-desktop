/**
 * N live prove only. Store internal/ — do not git-add into the product tree.
 * Sends 待审回款 ∩ 已到期合同 in the fdex测试 AI session. Does not POST /biz/preview.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const HOP_MEDIA = `${STORE}/media/records-hop-intersection.png`
const HIST_MEDIA = `${STORE}/media/records-history-switched.png`
const REPORT = `${STORE}/internal/verify-records-align.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const sessionId = 'session-c4735df2-06ce-4c92-bff2-a74fbf863854'
const speech = '待审回款 ∩ 已到期合同'

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
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

async function writeReport(out) {
  await mkdir(`${STORE}/internal`, { recursive: true })
  await mkdir(`${STORE}/media`, { recursive: true })
  const lines = []
  lines.push('---')
  lines.push('cursor:')
  lines.push('  subagentId: "bc-ab6a9aa4-26f4-5572-9a4b-75a2d4692407"')
  lines.push('---')
  lines.push('')
  lines.push('# Verify: L+M+N records align')
  lines.push('')
  lines.push(`**hardcoded literals:** none`)
  lines.push(`**pass:** ${out.pass ? 'yes' : 'no'}`)
  lines.push(`**failCode:** ${out.failCode || '—'}`)
  lines.push('')
  lines.push('## SHA')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('|---|---|')
  lines.push(`| daily branch | \`cursor/records-align-lmn-2407\` |`)
  lines.push(`| HEAD | \`${out.sha}\` |`)
  lines.push(`| origin | not pushed |`)
  lines.push('')
  lines.push('产品仓已 commit L+M。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未 POST `/biz/preview`。未编造 AI 条数。')
  lines.push('')
  lines.push('## N · 原句现网')
  lines.push('')
  lines.push(`- cwd \`${workspaceCwd}\``)
  lines.push(`- 会话 \`${sessionId}\``)
  lines.push(`- speech: ${speech}`)
  lines.push(`- rateLimited: ${out.rateLimited ? 'yes' : 'no'}`)
  lines.push(`- gateInjected: no`)
  lines.push('')
  lines.push('| 探针 | 值 |')
  lines.push('|---|---|')
  lines.push(`| pending rows | ${out.pending?.rows ?? '—'} |`)
  lines.push(`| pending first | ${out.pending?.first || '—'} |`)
  lines.push(`| pending hop | ${out.pending?.hopped ? 'yes' : 'no'} from=${out.pending?.from || '—'} |`)
  lines.push(`| pending speech | ${out.pending?.speech || '—'} |`)
  lines.push(`| 左 AI 口述条数 | ${out.aiCount == null ? '未解析（未编造）' : out.aiCount} |`)
  lines.push(`| chip | ${out.hopUi?.active?.[0] || '—'} |`)
  lines.push(`| 横幅 rows | ${out.hopUi?.bannerRows ?? '—'} |`)
  lines.push(`| footer | ${out.hopUi?.footer || '—'} |`)
  lines.push(`| tbody | ${out.hopUi?.tbodyRows ?? '—'} first=${out.hopUi?.firstCell || '—'} |`)
  lines.push(`| history value | ${out.hopUi?.historyValue || '（空占位）'} |`)
  lines.push(`| history options | ${out.hopUi?.historyOptionsCount ?? 0} |`)
  lines.push('')
  if (out.hopUi?.historyOptions?.length) {
    lines.push('历史 option（最多 8 条）:')
    for (const opt of out.hopUi.historyOptions.slice(0, 8)) {
      lines.push(`- \`${opt.value || '（占位）'}\` ${opt.label}`)
    }
    lines.push('')
  }
  lines.push(`截图: \`media/records-hop-intersection.png\` ${out.hopShot ? '已写' : '未写'}`)
  lines.push('')
  lines.push('## M · 点历史换表')
  lines.push('')
  if (out.history) {
    lines.push(`- picked: ${out.history.pickedLabel || '—'}`)
    lines.push(`- before first: ${out.history.beforeFirst || '—'}`)
    lines.push(`- after first: ${out.history.afterFirst || '—'}`)
    lines.push(`- before footer: ${out.history.beforeFooter || '—'}`)
    lines.push(`- after footer: ${out.history.afterFooter || '—'}`)
    lines.push(`- after history value: ${out.history.afterValue || '—'}`)
    lines.push(`- cache first: ${out.history.cacheFirst || '—'}`)
    lines.push(`- cache rows: ${out.history.cacheRows ?? '—'}`)
    lines.push(`- switched: ${out.history.switched ? 'yes' : 'no'}`)
    lines.push(`- pin held (value stayed): ${out.history.pinHeld ? 'yes' : 'no'}`)
  } else {
    lines.push('- 未点历史（缺第二条缓存或 429 已停）')
  }
  lines.push('')
  lines.push(`截图: \`media/records-history-switched.png\` ${out.histShot ? '已写' : '未写'}`)
  lines.push('')
  lines.push('## 对照')
  lines.push('')
  lines.push(`- 已对：${out.aligned || '—'}`)
  lines.push(`- 未对：${out.unaligned || '—'}`)
  lines.push(`- 仍差：${out.still || '—'}`)
  lines.push('')
  if (out.aiDelta) {
    lines.push('## 左 AI 摘录（现网，未编造）')
    lines.push('')
    lines.push('```')
    lines.push(String(out.aiDelta).slice(-1200))
    lines.push('```')
    lines.push('')
  }
  await writeFile(REPORT, lines.join('\n'), 'utf8')
}

const sha = gitSha()
await mkdir(`${STORE}/media`, { recursive: true })
await mkdir(`${STORE}/internal`, { recursive: true })

async function main() {
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

const out = {
  sha,
  hardcodedLiterals: 'none',
  sessionId,
  speech,
  rateLimited: false,
  pass: false,
  failCode: '',
  hopShot: false,
  histShot: false,
}

try {
  await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeAiSessionId = sid
    state.state.activeDataSubview = 'records'
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'tab', width: 560, badge: 0, view: 'im' },
      { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'closed', width: 560, pinned: true, view: 'briefing' },
      { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'closed', width: 600, view: 'plan' },
      { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => {
      if (!p) return p
      if (p.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p.id === 'im') return { ...p, state: 'tab', width: 560 }
      return p
    })
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, sessionId })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)

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
    connected: Boolean(connect.status?.connected || connect.json?.data?.connected),
    pid: connect.status?.pid || connect.json?.data?.pid,
  }
  for (let i = 0; i < 20 && !out.connect.connected; i += 1) {
    await page.waitForTimeout(500)
    const st = await page.evaluate(async () => {
      const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
      return json?.data || {}
    })
    out.connect.connected = Boolean(st.connected)
    out.connect.pid = st.pid || out.connect.pid
  }

  async function openRecordsPanel() {
    const recordsBtn = page.getByRole('button', { name: '业务记录' })
    if (!(await recordsBtn.count())) {
      const top = page.getByTitle(/^业务应用/)
      if (await top.count()) await top.first().click({ timeout: 8000 }).catch(() => {})
      const tool = page.locator('aside[aria-label="工作区工具"]')
      if (await tool.count()) {
        await tool.getByText('业务应用', { exact: true }).click({ timeout: 8000 }).catch(() => {})
      }
    }
    if (await recordsBtn.count()) {
      await recordsBtn.click({ timeout: 15000 }).catch(() => {})
    }
    return recordsBtn
  }

  await openRecordsPanel()
  await page.waitForTimeout(2000)

  async function readPending() {
    return page.evaluate(async (ws) => {
      const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
      const json = await res.json().catch(() => ({}))
      const sheet = json?.data?.sheet || json?.data || null
      const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
      const first = rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || '') : ''
      const from = sheet?.from && typeof sheet.from === 'object' ? String(sheet.from.kind || '') : ''
      const steps = Array.isArray(sheet?.steps) ? sheet.steps.map((row) => row?.kind).filter(Boolean) : []
      const hopWhere = Array.isArray(sheet?.hopWhere) && sheet.hopWhere.length > 0
      return {
        kind: sheet?.kind || null,
        action: sheet?.action || null,
        rows: rows.length,
        first,
        from,
        steps,
        hopWhere,
        hopped: Boolean(from || hopWhere || steps.length > 1),
        speech: String(sheet?.speech || ''),
        previewId: String(sheet?.preview_id || sheet?.previewId || ''),
        sessionId: String(sheet?.sessionId || ''),
      }
    }, workspaceCwd)
  }

  async function readUi() {
    return page.evaluate(() => {
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
      const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
      const tbodyRows = table ? table.querySelectorAll('tbody tr').length : 0
      const firstCell = table?.querySelector('tbody tr')?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const bannerEl = document.querySelector('div.border-blue-200.bg-blue-50')
      const banner = bannerEl?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const bannerRows = Number((banner.match(/(\d+)\s*行/) || [])[1] || NaN)
      const select = [...document.querySelectorAll('select')].find((el) =>
        [...el.querySelectorAll('option')].some((o) => (o.textContent || '').includes('本会话浮现历史')),
      )
      const historyValue = select ? String(select.value || '') : ''
      const historyOptions = select
        ? [...select.querySelectorAll('option')].map((o) => ({
          value: o.value,
          label: (o.textContent || '').trim(),
        }))
        : []
      const stale = [...document.querySelectorAll('div')].map((d) => (d.textContent || '').trim())
        .find((t) => t.includes('已不在待确认区')) || ''
      return {
        chips,
        active,
        footer,
        footerCount,
        tbodyRows,
        firstCell,
        banner,
        bannerRows,
        historyValue,
        historyOptionsCount: historyOptions.length,
        historyOptions,
        stale,
      }
    })
  }

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

  out.beforePending = await readPending()
  out.beforeUi = await readUi()
  await page.waitForTimeout(1500)
  out.beforeUi2 = await readUi()

  let baseline = await iframeBlob()
  out.baselineLen = baseline.length
  const alreadyFlying = /深度求索中|正在思考|正在调用/.test(baseline)
  if (alreadyFlying) {
    out.prompted = { dispatched: false, reusedInFlight: true, sessionId, text: speech }
  } else {
    const prompted = await page.evaluate(async ({ sid, text }) => {
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', { detail: { text } }))
      return { dispatched: true, sessionId: sid, text }
    }, { sid: sessionId, text: speech })
    out.prompted = prompted
    baseline = await iframeBlob()
  }

  const startedAt = Date.now()
  const deadline = startedAt + 180000
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500)
    const blob = await iframeBlob()
    const delta = blob.startsWith(baseline) ? blob.slice(baseline.length) : blob
    out.aiDelta = (delta || blob).slice(-4000)
    out.aiText = blob.slice(-4000)
    const flying = /深度求索中|正在思考|正在调用/.test(blob)
    if (coolingIn(delta) || coolingIn(blob.slice(-1500))) {
      out.rateLimited = true
      out.failCode = '429'
      break
    }
    const pending = await readPending()
    out.pending = pending
    const spokenSource = flying ? '' : (delta || blob.slice(-2000))
    const spoken = spokenCountFrom(spokenSource)
    if (spoken != null) out.aiCount = spoken
    const speechHit = String(pending.speech || '').includes('待审回款') || String(pending.speech || '') === speech
    if (!flying && speechHit && pending.hopped && spoken != null) break
  }

  await openRecordsPanel()
  for (let i = 0; i < 30; i += 1) {
    const ui = await readUi()
    const pending = out.pending || await readPending()
    out.pending = pending
    const expect = pending.rows
    const chipN = Number((((ui.active || [])[0] || '').match(/(\d+)\s*$/) || [])[1] || NaN)
    if (
      Number.isFinite(expect)
      && ui.footerCount === expect
      && ui.tbodyRows === expect
      && (Number.isNaN(chipN) || chipN === expect)
      && (!pending.first || ui.firstCell.includes(pending.first))
    ) break
    await page.waitForTimeout(400)
  }

  out.hopUi = await readUi()
  out.pending = out.pending || await readPending()
  for (let i = 0; i < 20 && (out.hopUi.historyOptionsCount || 0) < 2; i += 1) {
    await page.waitForTimeout(500)
    out.hopUi = await readUi()
  }
  const latestBlob = await iframeBlob()
  const latestDelta = latestBlob.startsWith(baseline) ? latestBlob.slice(baseline.length) : latestBlob
  out.aiDelta = latestDelta.slice(-4000)
  if (!out.rateLimited) out.rateLimited = coolingIn(latestDelta) || coolingIn(latestBlob.slice(-1500))
  if (out.rateLimited) out.aiCount = null
  else if (out.aiCount == null) out.aiCount = spokenCountFrom(latestDelta)

  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const root = document.scrollingElement || document.body
        if (root) root.scrollTop = root.scrollHeight
      })
    } catch { /* frames */ }
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: HOP_MEDIA, fullPage: false })
  out.hopShot = true

  if (out.rateLimited) {
    out.failCode = '429'
    out.still = '现网 429 / 上游冷却，停。闸注入未做。'
    out.unaligned = 'N 未完成'
    out.aligned = `HEAD ${sha} L+M 已 commit；N 因 429 未过`
    await writeReport(out)
    console.log(JSON.stringify({ ...out, stop: '429' }, null, 2))
    return
  }

  const chipN = Number((((out.hopUi?.active || [])[0] || '').match(/(\d+)\s*$/) || [])[1] || NaN)
  const tbody = out.hopUi?.tbodyRows
  const footer = out.hopUi?.footerCount
  const banner = out.hopUi?.bannerRows
  const pendingRows = out.pending?.rows
  const firstOk = Boolean(out.pending?.first && String(out.hopUi?.firstCell || '').includes(out.pending.first))
  const hopOk = Boolean(out.pending?.hopped && String(out.pending?.speech || '').includes('待审回款'))
  const counts = [tbody, footer, banner, pendingRows, out.aiCount, Number.isFinite(chipN) ? chipN : pendingRows]
  const allSame = counts.every((n) => n === pendingRows) && Number.isFinite(pendingRows)
  const nPass = Boolean(hopOk && allSame && firstOk && out.aiCount != null && !out.rateLimited)

  if (!nPass) {
    out.failCode = !hopOk
      ? 'live-hop-missing'
      : out.aiCount == null
        ? 'ai-count-unparsed'
        : tbody !== footer
          ? `sheet-rows-not-footer(tbody=${tbody}, footer=${footer})`
          : `counts-mismatch tbody=${tbody} footer=${footer} chip=${chipN} banner=${banner} pending=${pendingRows} ai=${out.aiCount}`
    out.aligned = `pending hop=${out.pending?.hopped ? 'yes' : 'no'} rows=${pendingRows} first=${out.pending?.first || '—'}`
    out.unaligned = '现网原句未过（未把闸 preview 当过关）'
    out.still = out.failCode
    await writeReport(out)
    console.log(JSON.stringify(out, null, 2))
    return
  }

  const historySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '本会话浮现历史' }) })
  const options = out.hopUi?.historyOptions || []
  const currentId = out.hopUi?.historyValue || ''
  const pick = options.find((o) => o.value && o.value !== currentId)
  if (!pick?.value) {
    out.failCode = 'history-only-one-cached-surface'
    out.pass = false
    out.aligned = `N 表体/footer/chip/横幅/左 AI 都是 ${pendingRows}，首行 ${out.pending.first}`
    out.unaligned = '历史只有当前这一张缓存，没法点另一条'
    out.still = 'M 换表未证'
    await writeReport(out)
    console.log(JSON.stringify(out, null, 2))
    return
  }

  const cacheExpect = await page.evaluate(({ cwd, surfaceId }) => {
    function read(key) {
      try {
        const raw = sessionStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    const surface = read('fde:biz:surface-sheet-cache').find((row) => row.workspaceCwd === cwd && row.surfaceId === surfaceId)
    const kindList = read('fde:biz:kind-list-cache').find((row) => row.workspaceCwd === cwd && row.surfaceId === surfaceId)
    const sheet = surface?.sheet || kindList?.sheet
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    const first = rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || '') : ''
    return { rows: rows.length, first, kind: sheet?.kind || '', action: sheet?.action || '' }
  }, { cwd: workspaceCwd, surfaceId: pick.value })

  out.history = {
    pickedId: pick.value,
    pickedLabel: pick.label,
    beforeFirst: out.hopUi.firstCell,
    beforeFooter: out.hopUi.footer,
    cacheRows: cacheExpect.rows,
    cacheFirst: cacheExpect.first,
  }

  await historySelect.selectOption(pick.value)
  await page.waitForTimeout(1500)
  const afterUi = await readUi()
  out.history.afterFirst = afterUi.firstCell
  out.history.afterFooter = afterUi.footer
  out.history.afterTbody = afterUi.tbodyRows
  out.history.afterValue = afterUi.historyValue
  out.history.afterBanner = afterUi.banner
  const afterChip = Number((((afterUi.active || [])[0] || '').match(/(\d+)\s*$/) || [])[1] || NaN)
  const footerN = afterUi.footerCount
  const switched = Boolean(
    afterUi.historyValue === pick.value
    && cacheExpect.first
    && String(afterUi.firstCell || '').includes(cacheExpect.first)
    && footerN === cacheExpect.rows
    && afterUi.tbodyRows === Math.min(10, cacheExpect.rows)
    && (Number.isNaN(afterChip) || afterChip === cacheExpect.rows),
  )
  out.history.switched = switched
  out.history.pinHeld = afterUi.historyValue === pick.value
  await page.screenshot({ path: HIST_MEDIA, fullPage: false })
  out.histShot = true

  if (!switched) {
    out.failCode = 'history-did-not-apply-cached-surface'
    out.pass = false
    out.aligned = `N 过：tbody=footer=chip=banner=AI=pending=${pendingRows} first=${out.pending.first}`
    out.unaligned = '点历史后表不是那一条缓存'
    out.still = `picked ${pick.label} cacheFirst=${cacheExpect.first} afterFirst=${afterUi.firstCell}`
    await writeReport(out)
    console.log(JSON.stringify(out, null, 2))
    return
  }

  out.pass = true
  out.failCode = ''
  out.aligned = `N：tbody=footer=chip=banner=左AI=pending=${pendingRows} 首行 ${out.pending.first}；M：点「${pick.label}」表换成缓存 ${cacheExpect.rows} 行 ${cacheExpect.first}`
  out.unaligned = '—'
  out.still = '—'
  await writeReport(out)
  console.log(JSON.stringify({
    pass: out.pass,
    sha: out.sha,
    pending: out.pending,
    aiCount: out.aiCount,
    hopUi: {
      tbody: tbody,
      footer,
      banner,
      chip: out.hopUi.active,
      first: out.hopUi.firstCell,
      historyValue: out.hopUi.historyValue,
      historyOptionsCount: out.hopUi.historyOptionsCount,
    },
    history: out.history,
    rateLimited: out.rateLimited,
  }, null, 2))
} catch (err) {
  out.failCode = 'script-error'
  out.still = err instanceof Error ? err.message : String(err)
  await writeReport(out)
  throw err
} finally {
  await browser.close()
}
}

await main()
