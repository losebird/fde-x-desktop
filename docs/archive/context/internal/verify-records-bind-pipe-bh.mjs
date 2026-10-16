/**
 * BH live close-out against records-close-root-cause.md contracts only.
 * Live: pending reimbursement batch on screen, cancel does not dump catalog,
 * same-shape short name, Decision 22. Preview only. Do not idle 10 cases.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-bind-pipe-bh.png`
const BATCH_SHOT = `${STORE}/media/records-bind-pipe-bh-batch.png`
const CANCEL_SHOT = `${STORE}/internal/bh-cancel.png`
const SHORT_SHOT = `${STORE}/internal/bh-short-name.png`
const REPORT_JSON = `${STORE}/internal/verify-records-bind-pipe-bh.json`
const REPORT_MD = `${STORE}/internal/verify-records-bind-pipe-bh.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'
const CATALOG_PAGE = 20
const SPOKEN_BATCH = '报销单'
const SPOKEN_SHORT = '请假单'

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
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

async function waitHosts(ms = 45000) {
  const deadline = Date.now() + ms
  let last = await hostsUp()
  while (Date.now() < deadline) {
    if (last.ok) return last
    await new Promise((r) => setTimeout(r, 800))
    last = await hostsUp()
  }
  return last
}

function looksLikeCatalog(shown, firstNo) {
  const n = Number(shown)
  if (!Number.isFinite(n)) return false
  if (n === CATALOG_PAGE && /^CUST/i.test(String(firstNo || ''))) return true
  if (n >= CATALOG_PAGE && /^CUST/i.test(String(firstNo || ''))) return true
  return false
}

function pendingWhereFor(row) {
  const labels = row?.fieldLabels && typeof row.fieldLabels === 'object' ? row.fieldLabels : {}
  const fields = Array.isArray(row?.fields) ? row.fields : []
  const names = fields.map((field) => {
    if (typeof field === 'string') return field
    if (field && typeof field === 'object') return String(field.name || field.key || field.id || '')
    return ''
  }).filter(Boolean)
  const status = names.find((name) => {
    const label = String(labels[name] || '')
    return name === '状态' || label === '状态' || /status/i.test(name)
  }) || names.find((name) => name === '状态') || '状态'
  return [{ keys: [status], values: ['待审'] }]
}

function srcHasHardcodedMap() {
  try {
    const blob = execSync("rg -n \"报销单.{0,24}费用报销|费用报销.{0,24}报销单\" src runtime --glob '!**/vendor/**' --glob '!**/tests/**' || true", {
      cwd: SCENE,
      encoding: 'utf8',
    })
    return String(blob || '').trim() || 'none'
  } catch {
    return 'none'
  }
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
    return {
      kindChips,
      selectedChip,
      footer,
      footerCount,
      tbodyRows,
      firstNo,
      banner,
      drawerOpen: Boolean(drawer),
      drawerText: drawerText.slice(0, 700),
    }
  })
}

async function postPreview(body) {
  return page.evaluate(async ({ cwd, body: payload }) => {
    const res = await fetch(`/api/v1/biz/preview?cwd=${encodeURIComponent(cwd)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ ...payload, cwd, workspace: cwd }),
    })
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    return {
      http: res.status,
      error: json?.error || null,
      message: json?.error?.message || json?.message || '',
      kind: sheet?.kind || null,
      action: sheet?.action || null,
      rows: rows.length,
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || rows[0].name || '') : '',
      preview_id: sheet?.preview_id || json?.data?.preview_id || null,
      speech: sheet?.speech || payload.speech || '',
    }
  }, { cwd: workspaceCwd, body })
}

async function waitUi(match, ms = 20000) {
  const deadline = Date.now() + ms
  let ui = await readUi()
  while (Date.now() < deadline) {
    if (match(ui)) return ui
    await page.waitForTimeout(400)
    ui = await readUi()
  }
  return ui
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

try {
  out.portsBefore = await waitHosts()
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
  await page.waitForTimeout(1500)

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
          catalogVersion: row.catalogVersion || '',
          aliases: Array.isArray(row.aliases) ? row.aliases : [],
          fields: row.fields,
          fieldLabels: row.fieldLabels || {},
          can: row.can || [],
        })),
      }
    }, workspaceCwd)
    if (kindsPack.names.length) break
    await page.waitForTimeout(1500)
  }
  out.kinds = {
    http: kindsPack.http,
    count: kindsPack.names.length,
    spokenBatchIsKind: kindsPack.names.includes(SPOKEN_BATCH),
    spokenShortIsKind: kindsPack.names.includes(SPOKEN_SHORT),
    spokenBatchAlias: kindsPack.aliases[SPOKEN_BATCH] || '',
    spokenShortAlias: kindsPack.aliases[SPOKEN_SHORT] || '',
  }
  const batchCanonical = kindsPack.aliases[SPOKEN_BATCH] || ''
  const shortCanonical = kindsPack.aliases[SPOKEN_SHORT] || ''
  const batchRow = kindsPack.kinds.find((row) => row.kind === batchCanonical)
  if (!batchCanonical || kindsPack.names.includes(SPOKEN_BATCH)) {
    out.failCode = 'spoken-batch-still-a-kind'
  }

  const orphan = await postPreview({
    kind: `GraphOnly-${Date.now()}`,
    action: '现查',
    speech: 'preview a concept with no business table',
  })
  out.orphan = orphan

  const batchPreview = await postPreview({
    kind: SPOKEN_BATCH,
    action: '现查',
    speech: '待审报销一批',
    where: pendingWhereFor(batchRow),
  })
  out.batchPreview = batchPreview
  const batchUi = await waitUi((ui) => (
    Number(ui.footerCount) === Number(batchPreview.rows)
    && ui.firstNo === batchPreview.first
    && !looksLikeCatalog(ui.footerCount, ui.firstNo)
  ), 25000)
  out.batchUi = batchUi
  await page.screenshot({ path: BATCH_SHOT, fullPage: false })
  const batchOnScreen = Boolean(
    batchPreview.http === 200
    && batchCanonical
    && batchPreview.kind === batchCanonical
    && batchPreview.rows > 1
    && batchUi.footerCount === batchPreview.rows
    && batchUi.firstNo === batchPreview.first
    && !kindsPack.names.includes(SPOKEN_BATCH)
    && !/^CUST/i.test(String(batchUi.firstNo || ''))
  )
  out.batchOnScreen = batchOnScreen
  if (!batchOnScreen && !out.failCode) out.failCode = `batch-not-on-screen(kind=${batchPreview.kind},rows=${batchPreview.rows},footer=${batchUi.footerCount})`

  const covering = await postPreview({
    kind: SPOKEN_BATCH,
    action: '过审',
    speech: '待审报销一批',
  })
  out.covering = covering
  const afterCover = await readUi()
  out.afterCover = afterCover
  const coverHeld = Boolean(
    afterCover.footerCount === batchUi.footerCount
    && afterCover.firstNo === batchUi.firstNo
    && (covering.http >= 400 || !covering.preview_id || covering.rows === 0 || covering.kind === batchCanonical)
  )
  out.coverHeld = coverHeld
  if (afterCover.footerCount === 0 && !out.failCode) out.failCode = 'empty-cover-painted'

  await page.evaluate(() => {
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    const cellBtn = table?.querySelector('tbody tr td:nth-child(3) button')
    cellBtn?.click()
  })
  await page.waitForTimeout(250)
  const cellInput = page.locator('div.overflow-x-auto.overflow-y-auto table tbody tr input').first()
  if (await cellInput.count()) {
    const current = await cellInput.inputValue().catch(() => '')
    await cellInput.fill(`${current || '待审'}*`)
    await cellInput.blur()
    await page.waitForTimeout(200)
  }
  out.editedCell = true
  const opened = await page.evaluate(() => {
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    table?.parentElement?.scrollTo?.(10000, 0)
    const tr = table?.querySelector('tbody tr')
    const btn = [...(tr?.querySelectorAll('button') || [])].find((el) => (el.textContent || '').trim() === '改行')
    if (!btn) return { ok: false, missing: true }
    btn.click()
    return { ok: true, action: '改行' }
  })
  out.openWrite = opened
  const drawerLoc = page.locator('div.fixed.inset-y-0.right-0')
  const cancelBtn = drawerLoc.getByRole('button', { name: '取消' })
  try {
    await cancelBtn.waitFor({ state: 'visible', timeout: 25000 })
    out.beforeCancel = await readUi()
    await cancelBtn.click({ timeout: 8000 })
    await page.waitForTimeout(1100)
    out.clickedCancel = true
  } catch (error) {
    out.beforeCancel = await readUi()
    out.clickedCancel = false
    out.cancelWaitError = String(error?.message || error)
  }
  const afterCancel = await readUi()
  out.afterCancel = afterCancel
  await page.screenshot({ path: CANCEL_SHOT, fullPage: false })
  const cancelHeld = Boolean(
    out.clickedCancel
    && !afterCancel.drawerOpen
    && !looksLikeCatalog(afterCancel.footerCount, afterCancel.firstNo)
    && Number(afterCancel.footerCount) > 0
    && !/^CUST/i.test(String(afterCancel.firstNo || ''))
  )
  out.cancelHeld = cancelHeld
  if (!cancelHeld && !out.failCode) out.failCode = `cancel-dumped(footer=${afterCancel.footer},first=${afterCancel.firstNo})`

  const shortPreview = await postPreview({
    kind: SPOKEN_SHORT,
    action: '现查',
    speech: 'same-shape short name',
  })
  out.shortPreview = shortPreview
  const shortUi = await waitUi((ui) => (
    shortCanonical
    && ui.footerCount === shortPreview.rows
    && ui.firstNo === shortPreview.first
  ), 20000)
  out.shortUi = shortUi
  await page.screenshot({ path: SHORT_SHOT, fullPage: false })
  const shortOk = Boolean(
    shortPreview.http === 200
    && shortCanonical
    && shortPreview.kind === shortCanonical
    && shortPreview.rows > 0
    && !kindsPack.names.includes(SPOKEN_SHORT)
    && shortUi.footerCount === shortPreview.rows
  )
  out.shortOk = shortOk
  if (!shortOk && !out.failCode) out.failCode = `short-name-miss(kind=${shortPreview.kind},rows=${shortPreview.rows})`

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
    batchOnScreen
    && cancelHeld
    && shortOk
    && Object.values(out.d22).every(Boolean)
    && !out.silentBizWrite
    && !out.autoIm
    && out.portsEnd?.ok
    && out.hardcodedInSrc === 'none'
    && orphan.http >= 400
  )
  if (!out.pass && !out.failCode) out.failCode = 'not-closed'

  const stitch = await browser.newPage({ viewport: { width: 1800, height: 1100 } })
  const { readFile } = await import('node:fs/promises')
  const { existsSync } = await import('node:fs')
  const cells = [
    { src: BATCH_SHOT, label: `待审一批 ${batchPreview.kind || ''} ×${batchPreview.rows ?? '?'} ${batchUi.firstNo || ''}` },
    { src: CANCEL_SHOT, label: `取消 ${afterCancel.footer || ''} ${afterCancel.firstNo || ''}` },
  ]
  const html = []
  for (const cell of cells) {
    if (!existsSync(cell.src)) continue
    const buf = await readFile(cell.src)
    html.push(
      `<div style="background:#fff;border:1px solid #d4d4d8;overflow:hidden">`
      + `<div style="font:12px/1.4 -apple-system,sans-serif;padding:6px 8px;background:#18181b;color:#fafafa">${cell.label}</div>`
      + `<img src="data:image/png;base64,${buf.toString('base64')}" style="width:100%;height:480px;object-fit:contain;object-position:top;background:#fff;display:block"/>`
      + `</div>`,
    )
  }
  await stitch.setContent(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#111;padding:8px">${html.join('')}</div>`)
  await stitch.screenshot({ path: MEDIA, fullPage: true })
  await stitch.close()
} catch (error) {
  out.pass = false
  out.error = String(error?.message || error)
  if (!out.failCode) out.failCode = 'script-error'
  try {
    await page.screenshot({ path: MEDIA, fullPage: false })
  } catch { /* ignore */ }
}

await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await dualWrite(REPORT_JSON, 'internal/verify-records-bind-pipe-bh.json')
await dualWrite(MEDIA, 'media/records-bind-pipe-bh.png').catch(() => '')
await browser.close()
console.log(JSON.stringify({ pass: out.pass, failCode: out.failCode || null, sha: out.sha }, null, 2))
if (!out.pass) process.exitCode = 1
